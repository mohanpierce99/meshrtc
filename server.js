const fs = require('fs');
const express=require('express');
const app=express();
var server=require("http").Server(app);
let io=require("socket.io")(server);

app.use(express.static("./"));

io.on("connection",(socket)=>{
    
    socket.on("joinroom",(d)=>{
        socket.room=d;
        socket.join(d);
        socket.emit("roomjoined",true)
        console.log("Socket joined rooom : "+d);
    });

    socket.on("signal",(obj)=>{
        console.log("Signalled"+obj.id);
        io.sockets.in(obj.room).emit("signalnewclient",obj.id);
    })
   
    socket.on("controls",(obj)=>{
        console.log("Server:controls");

    io.sockets.in(obj.room).emit("controlUpdate",obj);
    });

    socket.on("end",()=>{
        socket.leave(socket.room);
    })
});




server.listen(process.env.PORT||3300);