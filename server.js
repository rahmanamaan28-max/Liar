const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('createRoom', (name) => {
    // Generate unique room code
    let roomCode;
    do {
      roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (rooms[roomCode]);
    
    rooms[roomCode] = {
      host: socket.id,
      players: [{ id: socket.id, name }],
      status: 'lobby'
    };
    
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
    console.log(`Room created: ${roomCode}`);
  });

  socket.on('joinRoom', ({ name, roomCode }) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    
    if (room && room.status === 'lobby') {
      room.players.push({ id: socket.id, name });
      socket.join(roomCode);
      io.to(roomCode).emit('playerJoined', room.players);
      console.log(`${name} joined ${roomCode}`);
    } else {
      socket.emit('joinError', room ? 'Game already started' : 'Room not found');
    }
  });

  socket.on('startGame', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.host === socket.id) {
      room.status = 'playing';
      io.to(roomCode).emit('gameStarted');
      console.log(`Game started in ${roomCode}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    // Clean up rooms
    for (const [code, room] of Object.entries(rooms)) {
      room.players = room.players.filter(p => p.id !== socket.id);
      
      if (room.players.length === 0) {
        delete rooms[code];
        console.log(`Room deleted: ${code}`);
      } else if (room.host === socket.id) {
        // Assign new host
        room.host = room.players[0].id;
        io.to(code).emit('updatePlayers', room.players);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
