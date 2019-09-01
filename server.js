const fs = require('fs');
const express = require('express');
const app = express();
var server = require("http").Server(app);
let io = require("socket.io")(server);


app.get("inter.mp4",(req,res)=>{
	fs.createReadStream("./inter.mp4").pipe(res);
})
app.use(express.static("./"));

io.on("connection", (socket) => {

				//ROOM
				socket.on("joinRoom", async (data) => {
					socket.room = data;
					await socket.join(socket.room);
					socket.emit('roomJoinSuccess', {
						room: socket.room
					});
					io.to(socket.room).emit('userstat', {
						usercount: io.sockets.adapter.rooms[socket.room].length
					});

					console.log(`++  ${socket.id} JOINING |${socket.room}|`);
				});

				//GET SIGNAL AND EMIT TO ROOM
				socket.on('signal', async (data) => {
					socket.peerid = data.peerid;
					socket.broadcast.to(socket.room).emit('signal', {
						socketid: socket.id,
						peerid: socket.peerid
					});
					console.log(`~~ SOCKETID: ${socket.id} | PEERID: ${socket.peerid}`)
				});


				socket.on("controls", (obj) => {
					console.log("Server:controls");

					io.sockets.in(obj.room).emit("controlUpdate", obj);
				});


				socket.on('leaving', async (data) => {
					socket.broadcast.to(socket.room).emit('newLeaving', {
						leftPeerid: data.peerid
					});
					socket.broadcast.to(socket.room).emit('userstat', {
						room: socket.room,
						usercount: io.sockets.adapter.rooms[socket.room].length - 1
					});
					await socket.leave(socket.room);
					console.log(`--  ${socket.id} LEAVING |${socket.room}|`);
				});

				//HANDLE DISCONNECTION
				socket.on("disconnect", async () => {
					if (socket.room && io.sockets.adapter.rooms[socket.room]) {
						socket.broadcast.to(socket.room).emit('newLeaving', {
							leftPeerid: socket.peerid
						});
						socket.broadcast.to(socket.room).emit('userstat', {
							usercount: io.sockets.adapter.rooms[socket.room].length
						});
						await socket.leave(socket.room);
					}
					console.log("- DISCONNECTED: ", socket.id);
				});
			});




			server.listen(process.env.PORT || 3300);