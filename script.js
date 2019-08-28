/*
joinRoom - send {roomName}
signal - send {peerid}
returnSignal - send {destSocket, this.peerid}
leaving - send {peerid} 

* ALWAYS DELETE ELEMENT BEFORE PUSHING ELEMENT TO REMOVE DUPLICATES IF EXISTS
*/
var syncmode, seekflag = false;
var consensus = [];

function updateCounter(count) {
    connectedCounter.innerText = `CONNECTED: ${count}`;
}

function deletePeerData(peerid) {
    var index = -1;
    for (var i = 0; i < peersList.length; i++) {
        if (peersList[i].peerid === peerid)
            index = i;
    }
    if (index !== -1)
        peersList.splice(index, 1);
}

function deleteConnObj(peerid) {
    var index = -1;
    for (var i = 0; i < connObjList.length; i++) {
        if (connObjList[i].peer === peerid)
            index = i;
    }
    if (index !== -1)
        connObjList.splice(index, 1);
}

function deleteCallObj(peerid) {
    var index = -1;
    for (var i = 0; i < callObjList.length; i++) {
        if (callObjList[i].peer === peerid)
            index = i;
    }
    if (index !== -1)
        callObjList.splice(index, 1);
}

async function deleteAudioTags(peerid) {
    var temp = null;
    await audioCalls.childNodes.forEach(function (audioTag) {
        if (audioTag.id === peerid)
            temp = audioTag;
    });
    if (temp)
        audioCalls.removeChild(temp);
}

function transmitData(jsonString) {
    connObjList.forEach(function (connObj) {
        connObj.send(jsonString);
    });
}

function createDataPacket(msg, videoinfo) {
    data = {
        messageData: null,
        videoData: null
    };
    if (msg) {
        msgObject = {
            message: msg,
            sender: socket.id,
        };
        data.messageData = msgObject;
    }
    if (videoinfo) {
        data.videoData = {
            videoinfo: videoinfo,
            sender: socket.id,
        }
    }
    return JSON.stringify(data);
}

videoPlayer.onplay = function () {
    console.log("played", "  ", videoPlayer.readyState);
    if (videoControlFlag) {
        if (syncmode) {
            videoControlFlag = false;
            videoPlayer.pause();
            var jsonString = createDataPacket(null, {
                event: "consensus",
                peer: peer.id
            });
            transmitData(jsonString);
            return;
        }
        var videoinfo = {
            event: "played",
            play: true,
            pause: null,
            seekData: null,
        }
        var jsonString = createDataPacket(null, videoinfo);
        transmitData(jsonString);
    } else {
        videoControlFlag = true;
    }
}

videoPlayer.onpause = function () {
    console.log("paused", "  ", videoPlayer.readyState);
    if (videoControlFlag || seekflag) {
        var videoinfo = {
            event: "paused",
            play: null,
            pause: true,
            seekData: null,
        }
        var jsonString = createDataPacket(null, videoinfo);
        transmitData(jsonString);
    } else {
        videoControlFlag = true;
        seekflag = true;
    }
}

function isBuffered(currentTime) {
    let seekable = false;
    for (let i = 0; i < videoPlayer.buffered.length; i++) {
        if (currentTime > videoPlayer.buffered.start(i) && Math.floor(videoPlayer.buffered.end(i) - currentTime) > 3) {
            seekable = true;
        }
    }
    return seekable;
}

videoPlayer.onseeking = function () {
    syncmode = !(isBuffered(videoPlayer.currentTime))
    if (videoControlFlag) {
        var videoinfo = {
            event: "seeked",
            play: null,
            pause: null,
            seekData: {
                seekTime: videoPlayer.currentTime,
            },
            syncmode
        };
        var jsonString = createDataPacket(null, videoinfo);
        transmitData(jsonString);
    } else {
        videoControlFlag = true;
    }
}




function sendMessage() {
    var msg = messageSendText.value;
    updateMessageList(msg);
    var jsonString = createDataPacket(msg, null);
    transmitData(jsonString);
    messageSendText.value = "";
}

function updateMessageList(msg) {
    var p = document.createElement("p");
    p.innerText = msg;
    messages.append(p);
}

function handleOnData(jsonString) {
    data = JSON.parse(jsonString);
    if (data.messageData) {
        console.log(data);
        updateMessageList("PEER: " + data.messageData.message);
    }
    if (data.videoData && videoControlFlag) {

        var videoinfo = data.videoData.videoinfo
        if (videoinfo.event === "played") {
            videoControlFlag = false;
            videoPlayer.play();
        }

        if (videoinfo.event === "paused") {
            videoControlFlag = false;
            videoPlayer.pause();
            setTimeout(function () {
                videoControlFlag = true;
            }, 500);
        }

        if (videoinfo.event === "seeked") {
            videoControlFlag = false;
            seekflag = false;
            syncmode = Boolean(videoinfo.syncmode);
            if (syncmode) {
                consensus = [];
            }
            videoPlayer.currentTime = videoinfo.seekData.seekTime;
        }

        if (videoinfo.event === "consensus") {
            if (+connectedCounter.innerText - 1 === consensus.length + 1) {
                syncmode = false;
                videoControlFlag = false;
                videoPlayer.play();
                consensus = [];
                return;
            }
            consensus.push(true);
        }
    }
}

function getAudioStream() {
    //AUDIO STREAM-CALL
    navigator.mediaDevices.getUserMedia({
        audio: true
    }).then(function (stream) {
        console.log(stream);
        window.stream = stream;
    }, function (err) {
        console.log(`ERROR GETTING STREAM`);
    });
}

function getCallStream(call, stream) {
    console.log("RECIEVED: ", stream);
    var audioTag = document.createElement("audio");
    audioTag.id = call.peer;
    audioTag.controls = "true";
    audioTag.srcObject = stream;
    audioCalls.appendChild(audioTag);
    audioTag.play();
}


//INIT
var socket = io(window.location.origin);
var peer = null;
var peersList = [];
var connObjList = [];
var callObjList = [];
var videoControlFlag = true;


socket.on('connect', async function () {
    console.log('CONNECTED');
    //INIT
    await getAudioStream();

    //JOIN A ROOM
    roomJoinButton.addEventListener('click', async function () {
        if (roomName.value === "")
            alert("Room name empty");
        else {
            //PEER LEAVING CURRENT ROOM / JOINING NEW
            peersList = [];
            connObjList = [];
            callObjList = [];
            if (socket.room) {
                messages.innerHTML = "";
                socket.emit('leaving', {
                    peerid: peer.id
                });
            }

            //P2P
            peer = new Peer();

            //INIT PEER ID & SIGNAL & JOIN ROOM
            peer.on('open', function (id) {
                peer.id = id;
                socket.room = roomName.value;
                socket.emit('joinRoom', {
                    roomName: socket.room
                });
                socket.emit('signal', {
                    peerid: peer.id
                });
                messageContainer.style.display = "block";
                console.log(`PEER ID: ${peer.id}`);
            });

            //RECIEVE CONNECTION - SET CONN METHODS ***********
            peer.on('connection', function (conn) {
                //DATA
                conn.on('data', function (jsonString) {
                    handleOnData(jsonString);
                });

                //PUSH CONN TO CONN LIST FINALLY
                deleteConnObj(conn.peer);
                connObjList.push(conn);
            });

            peer.on('call', function (call) {
                //GET REMOTE STREAM
                call.on('stream', function (stream) {
                    //getCallStream(call, stream);

                    //PUSH TO CALL OBJ ARRAY
                    deleteCallObj(call.peer);
                    callObjList.push(call);
                });

                //ANSWER
                call.answer(window.stream);
            });
        }
    });

    //DISPLAY NUMBER OF CONNECTED USERS
    //GET {room, usercount}
    socket.on('roomStat', function (data) {
        updateCounter(data.usercount);
        console.log(data);
    });

    //GET NEW PEER ID AND MAKE CONNECTION TO NEW CLIENT
    socket.on('newSignal', async function (data) {
        deletePeerData(data.peerid);
        peersList.push(data);

        //CONNECT TO PEER
        var conn = await peer.connect(data.peerid, {
            reliable: true
        });
        //CONN METHODS  ***********
        conn.on('open', function () {
            //DATA
            conn.on('data', function (jsonString) {
                handleOnData(jsonString);
            });

            //SEND CURRENT VIDEO INFO TO NEW CLIENT & PLAY}
            var videoinfoPosition = {
                play: null,
                pause: null,
                seekData: {
                    seekTime: videoPlayer.currentTime + 0.15,
                },
            };
            var jsonStringPosition = createDataPacket(null, videoinfoPosition);
            conn.send(jsonStringPosition);


            //PUSH TO PEER OBJ LIST
            deleteConnObj(conn.peer);
            connObjList.push(conn);
        });

        //CALL PEER
        var call = await peer.call(data.peerid, window.stream);
        //CALL METHODS
        call.on('stream', function (stream) {
            //getCallStream(call, stream);

            //PUSH TO CALL OBJ ARRAY
            deleteCallObj(call.peer);
            callObjList.push(call);
        });


        socket.emit('returnSignal', {
            destSocket: data.socketid,
            peerid: peer.id
        });
    });

    socket.on('newReturnSignal', function (data) {
        deletePeerData(data.peerid);
        peersList.push(data);
        //PRINT PEERSLIST AFTER ALL USERS JOIN
    });

    //DELETE LEFT USER FROM PEERSLIST
    socket.on('newLeaving', function (data) {
        deletePeerData(data.leftPeerid);
        deleteConnObj(data.leftPeerid);
        deleteCallObj(data.leftPeerid);
        deleteAudioTags(data.leftPeerid);
        console.log(`${data.leftPeerid} LEFT THE ROOM`);
    });
});