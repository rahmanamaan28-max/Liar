const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Load questions from file
const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
const rooms = {};

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('createRoom', ({ name, settings }) => {
    // Generate unique room code
    let roomCode;
    do {
      roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (rooms[roomCode]);
    
    // Default settings
    const defaultSettings = {
      rounds: 5,
      answerTime: 30,
      discussionTime: 45,
      voteTime: 30
    };
    
    rooms[roomCode] = {
      host: socket.id,
      players: [{ id: socket.id, name, score: 0 }],
      status: 'lobby',
      currentRound: 0,
      imposter: null,
      answers: [],
      votes: {},
      settings: { ...defaultSettings, ...settings },
      chat: []
    };
    
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.emit('roomCreated', roomCode);
    io.to(roomCode).emit('roomUpdated', {
      players: rooms[roomCode].players,
      settings: rooms[roomCode].settings,
      chat: rooms[roomCode].chat
    });
    console.log(`Room created: ${roomCode} by ${name} with ${rooms[roomCode].settings.rounds} rounds`);
  });

  socket.on('joinRoom', ({ name, roomCode }) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    
    if (!room) {
      socket.emit('joinError', 'Room not found');
      console.log(`Room not found: ${roomCode}`);
      return;
    }
    
    if (room.status !== 'lobby') {
      socket.emit('joinError', 'Game already started');
      console.log(`Game already started in ${roomCode}`);
      return;
    }
    
    // Check if player name is already in room
    const playerExists = room.players.some(player => player.name === name);
    if (playerExists) {
      socket.emit('joinError', 'Name already taken in this room');
      console.log(`Name taken: ${name} in ${roomCode}`);
      return;
    }
    
    // Add player to room
    room.players.push({ id: socket.id, name, score: 0 });
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    // Notify room about new player
    io.to(roomCode).emit('roomUpdated', {
      players: room.players,
      settings: room.settings,
      chat: room.chat
    });
    
    console.log(`${name} joined ${roomCode}`);
  });

  socket.on('updateSettings', (newSettings) => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    
    if (room && room.host === socket.id) {
      room.settings = { ...room.settings, ...newSettings };
      io.to(room.roomCode).emit('roomUpdated', {
        players: room.players,
        settings: room.settings,
        chat: room.chat
      });
      console.log(`Settings updated in ${socket.roomCode}:`, room.settings);
    }
  });

  socket.on('startGame', () => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    
    if (room && room.host === socket.id && room.players.length >= 3) {
      room.status = 'playing';
      room.currentRound = 1;
      startRound(socket.roomCode);
      console.log(`Game started in ${socket.roomCode} with ${room.settings.rounds} rounds`);
    } else {
      console.log(`Start game failed for ${socket.roomCode} by ${socket.id}`);
      if (room.players.length < 3) {
        socket.emit('gameError', 'Need at least 3 players to start');
      }
    }
  });

  socket.on('submitAnswer', ({ answer }) => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    
    if (room && room.status === 'playing') {
      const player = room.players.find(p => p.id === socket.id);
      if (player && !room.answers.some(a => a.playerId === socket.id)) {
        room.answers.push({
          playerId: socket.id,
          playerName: player.name,
          answer
        });
        console.log(`Answer submitted by ${player.name} in ${socket.roomCode}`);
      }
    }
  });

  socket.on('submitVote', ({ votedPlayerId }) => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    
    if (room && room.status === 'playing') {
      room.votes[socket.id] = votedPlayerId;
      console.log(`Vote submitted by ${socket.id} in ${socket.roomCode}`);
    }
  });
  
  socket.on('sendChatMessage', (message) => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    
    if (room && room.status === 'playing') {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        const chatMessage = {
          playerId: socket.id,
          playerName: player.name,
          message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        room.chat.push(chatMessage);
        io.to(socket.roomCode).emit('chatMessage', chatMessage);
      }
    }
  });

  socket.on('resetGame', () => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    
    if (room && room.host === socket.id) {
      // Reset game state but keep players and settings
      room.status = 'lobby';
      room.currentRound = 0;
      room.players.forEach(player => player.score = 0);
      room.imposter = null;
      room.answers = [];
      room.votes = {};
      room.chat = [];
      
      io.to(socket.roomCode).emit('gameReset', {
        players: room.players,
        settings: room.settings
      });
      console.log(`Game reset in ${socket.roomCode}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    // Clean up rooms
    for (const [code, room] of Object.entries(rooms)) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          delete rooms[code];
          console.log(`Room deleted: ${code}`);
        } else if (room.host === socket.id) {
          // Assign new host
          room.host = room.players[0].id;
          io.to(code).emit('roomUpdated', {
            players: room.players,
            settings: room.settings,
            chat: room.chat
          });
          console.log(`New host assigned in room ${code}: ${room.host}`);
        }
      }
    }
  });
  
  function startRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    
    // Reset round data
    room.answers = [];
    room.votes = {};
    room.chat = [];
    
    // Select random question
    const questionIndex = Math.floor(Math.random() * questions.length);
    const question = questions[questionIndex];
    
    // Select imposter randomly
    const imposterIndex = Math.floor(Math.random() * room.players.length);
    room.imposter = room.players[imposterIndex].id;
    
    // Send question to players
    room.players.forEach(player => {
      const questionToSend = player.id === room.imposter ? question.fake : question.real;
      io.to(player.id).emit('roundStart', {
        round: room.currentRound,
        question: questionToSend,
        isImposter: player.id === room.imposter,
        time: room.settings.answerTime
      });
    });
    
    io.to(roomCode).emit('gameStarted', room.players);
    
    // Start answer timer
    setTimeout(() => {
      revealAnswers(roomCode, question.real);
    }, room.settings.answerTime * 1000);
  }
  
  function revealAnswers(roomCode, realQuestion) {
    const room = rooms[roomCode];
    if (!room) return;
    
    io.to(roomCode).emit('revealAnswers', {
      question: realQuestion,
      answers: room.answers,
      time: room.settings.discussionTime // FIX: Send discussion time
    });
    
    // Start discussion timer
    setTimeout(() => {
      startVoting(roomCode);
    }, room.settings.discussionTime * 1000);
  }
  
  function startVoting(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    
    io.to(roomCode).emit('startVoting', {
      players: room.players,
      time: room.settings.voteTime
    });
    
    // Start voting timer
    setTimeout(() => {
      calculateRoundResults(roomCode);
    }, room.settings.voteTime * 1000);
  }
  
  function calculateRoundResults(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    
    // Count votes
    const voteCounts = {};
    for (const voterId in room.votes) {
      const votedPlayerId = room.votes[voterId];
      voteCounts[votedPlayerId] = (voteCounts[votedPlayerId] || 0) + 1;
    }
    
    // Find most voted player
    let mostVotedId = null;
    let maxVotes = 0;
    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        mostVotedId = playerId;
        maxVotes = count;
      }
    }
    
    // Determine if imposter was caught
    const imposterCaught = mostVotedId === room.imposter;
    
    // Award points
    if (imposterCaught) {
      // Players who voted for imposter get points
      for (const voterId in room.votes) {
        if (room.votes[voterId] === room.imposter) {
          const player = room.players.find(p => p.id === voterId);
          if (player) player.score += 1;
        }
      }
    } else {
      // Imposter gets points
      const imposter = room.players.find(p => p.id === room.imposter);
      if (imposter) imposter.score += 2;
    }
    
    // Send results
    io.to(roomCode).emit('roundResults', {
      imposterId: room.imposter,
      imposterCaught,
      votes: room.votes,
      players: room.players
    });
    
    // Check if game should continue
    room.currentRound++;
    if (room.currentRound <= room.settings.rounds) { // FIX: Use settings
      setTimeout(() => startRound(roomCode), 5000);
    } else {
      // Game over
      room.status = 'finished';
      const winner = room.players.reduce((prev, current) => 
        (prev.score > current.score) ? prev : current
      );
      
      io.to(roomCode).emit('gameOver', {
        winner,
        players: room.players
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
