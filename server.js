/*
roomStat - send {room, usercount}
userDisconnecting - send {socketid}
newSignal - send {socketid, peerid}

//MULTI INSTANCE SAME BROWSER - CRASH / LAM ONLY(TURN)
*/

const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

//CONFIG VARIABLES
const PORT = process.env.PORT || 3000;
const IP4 = "192.168.1.100";

var app = express();
var httpServer = http.Server(app);
var io = socketIO(httpServer); 

app.use("/",express.static(path.join(__dirname,'/routes/public/')));

//SOCKET HANDLING
io.on("connection",async (socket)=>{
	console.log("+ CONNECTED: ",socket.id);

	//ROOM
	socket.on("joinRoom",async (data)=>{
		socket.room = data.roomName;
		await socket.join(socket.room);
		io.to(socket.room).emit('roomStat',{room: socket.room, usercount: io.sockets.adapter.rooms[socket.room].length});
		console.log(`++  ${socket.id} JOINING |${socket.room}|`);
	});

	//GET SIGNAL AND EMIT TO ROOM
	socket.on('signal', async (data)=>{
		socket.peerid = data.peerid;
		socket.broadcast.to(socket.room).emit('newSignal',{socketid: socket.id, peerid: socket.peerid});
		console.log(`~~ SOCKETID: ${socket.id} | PEERID: ${socket.peerid}`)
	});

	socket.on('returnSignal', (data)=>{
		socket.broadcast.to(data.destSocket).emit('newReturnSignal',{socketid: socket.id, peerid: data.peerid});
	});

	socket.on('leaving', async (data)=>{
		socket.broadcast.to(socket.room).emit('newLeaving',{leftPeerid: data.peerid});
		socket.broadcast.to(socket.room).emit('roomStat',{room: socket.room, usercount: io.sockets.adapter.rooms[socket.room].length-1});
		await socket.leave(socket.room);
		console.log(`--  ${socket.id} LEAVING |${socket.room}|`);
	});

	//HANDLE DISCONNECTION
	socket.on("disconnect",async ()=>{
		if(socket.room && io.sockets.adapter.rooms[socket.room]){
			socket.broadcast.to(socket.room).emit('newLeaving',{leftPeerid: socket.peerid});
			socket.broadcast.to(socket.room).emit('roomStat',{room: socket.room, usercount: io.sockets.adapter.rooms[socket.room].length});
			//await socket.leave(socket.room);
		}
		console.log("- DISCONNECTED: ",socket.id);
	});
});

httpServer.listen(PORT, ()=>{console.log(`HTTP SERVER UP ON PORT: ${PORT}`);});