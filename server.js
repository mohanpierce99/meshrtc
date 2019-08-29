const fs = require('fs');
const express = require('express');
const app = express();
var server = require("http").Server(app);
let io = require("socket.io")(server);

app.use(express.static("./"));

io.on("connection", (socket) => {
			//SOCKET HANDLING
			io.on("connection", async (socket) => {
				console.log("+ CONNECTED: ", socket.id);

				//ROOM
				socket.on("joinRoom", async (data) => {
					socket.room = data.roomName;
					await socket.join(socket.room);
					io.to(socket.room).emit('roomStat', {
						room: socket.room,
						usercount: io.sockets.adapter.rooms[socket.room].length
					});
					console.log(`++  ${socket.id} JOINING |${socket.room}|`);
				});

				//GET SIGNAL AND EMIT TO ROOM
				socket.on('signal', async (data) => {
					socket.peerid = data.peerid;
					socket.broadcast.to(socket.room).emit('newSignal', {
						socketid: socket.id,
						peerid: socket.peerid
					});
					console.log(`~~ SOCKETID: ${socket.id} | PEERID: ${socket.peerid}`)
				});

				socket.on('returnSignal', (data) => {
					socket.broadcast.to(data.destSocket).emit('newReturnSignal', {
						socketid: socket.id,
						peerid: data.peerid
					});
				});

				socket.on('leaving', async (data) => {
					socket.broadcast.to(socket.room).emit('newLeaving', {
						leftPeerid: data.peerid
					});
					socket.broadcast.to(socket.room).emit('roomStat', {
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
						socket.broadcast.to(socket.room).emit('roomStat', {
							room: socket.room,
							usercount: io.sockets.adapter.rooms[socket.room].length
						});
						//await socket.leave(socket.room);
					}
					console.log("- DISCONNECTED: ", socket.id);
				});
			});




			server.listen(process.env.PORT || 3300);