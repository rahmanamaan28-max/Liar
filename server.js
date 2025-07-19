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

  socket.on('createRoom', (name) => {
    // Generate unique room code
    let roomCode;
    do {
      roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (rooms[roomCode]);
    
    rooms[roomCode] = {
      host: socket.id,
      players: [{ id: socket.id, name, score: 0 }],
      status: 'lobby',
      currentRound: 0,
      rounds: 5,
      imposter: null,
      answers: [],
      votes: {},
      settings: {
        answerTime: 30,
        discussionTime: 45,
        voteTime: 30
      }
    };
    
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
    console.log(`Room created: ${roomCode}`);
  });

  socket.on('joinRoom', ({ name, roomCode }) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    
    if (room && room.status === 'lobby') {
      room.players.push({ id: socket.id, name, score: 0 });
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
      room.currentRound = 1;
      startRound(roomCode);
      console.log(`Game started in ${roomCode}`);
    }
  });

  socket.on('submitAnswer', ({ roomCode, answer }) => {
    const room = rooms[roomCode];
    if (room && room.status === 'playing') {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        room.answers.push({
          playerId: socket.id,
          playerName: player.name,
          answer
        });
        console.log(`Answer submitted by ${player.name} in ${roomCode}`);
      }
    }
  });

  socket.on('submitVote', ({ roomCode, votedPlayerId }) => {
    const room = rooms[roomCode];
    if (room && room.status === 'playing') {
      room.votes[socket.id] = votedPlayerId;
      console.log(`Vote submitted by ${socket.id} in ${roomCode}`);
      
      // Check if all votes are in
      if (Object.keys(room.votes).length === room.players.length) {
        calculateRoundResults(roomCode);
      }
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
  
  function startRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    
    // Reset round data
    room.answers = [];
    room.votes = {};
    
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
        roomCode,
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
      answers: room.answers
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
    if (room.currentRound <= room.rounds) {
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
