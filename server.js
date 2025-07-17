const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// Setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Load questions
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf-8'));

// Game state
const rooms = {};

// Helpers
function getRandomQuestion() {
  return questions[Math.floor(Math.random() * questions.length)];
}

function getRoom(socket) {
  const rooms = Array.from(socket.rooms);
  return rooms.length > 1 ? rooms[1] : null; // Skip socket.id
}

// Socket events
io.on('connection', (socket) => {
  console.log('✅ A user connected:', socket.id);

  // Create a new game room
  socket.on('createRoom', ({ name }) => {
    if (!name || name.trim().length === 0) {
      socket.emit('errorMessage', 'Please enter a valid name');
      return;
    }

    const room = Math.random().toString(36).substring(2, 6).toUpperCase();
    rooms[room] = {
      host: socket.id,
      players: [],
      scores: {},
      settings: {},
      round: 1,
      status: 'waiting'
    };
    
    socket.join(room);
    rooms[room].players.push({ id: socket.id, name });
    rooms[room].scores[socket.id] = 0;

    socket.emit('roomJoined', {
      room,
      players: rooms[room].players,
      host: socket.id
    });
  });

  // Join an existing room
  socket.on('joinRoom', ({ name, room }) => {
    if (!name || name.trim().length === 0) {
      socket.emit('errorMessage', 'Please enter a valid name');
      return;
    }

    const game = rooms[room];
    if (!game) {
      socket.emit('errorMessage', 'Room does not exist');
      return;
    }

    if (game.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      socket.emit('errorMessage', 'Name already taken in this room');
      return;
    }

    if (game.status !== 'waiting') {
      socket.emit('errorMessage', 'Game already in progress');
      return;
    }

    socket.join(room);
    game.players.push({ id: socket.id, name });
    game.scores[socket.id] = 0;
    
    socket.emit('roomJoined', {
      room,
      players: game.players,
      host: game.host
    });
    
    io.to(room).emit('updatePlayers', {
      players: game.players,
      host: game.host
    });
  });

  // Start the game
  socket.on('startGame', (settings) => {
    const room = getRoom(socket);
    const game = rooms[room];
    if (!game || game.host !== socket.id) return;

    // Validate settings
    if (game.players.length < 2) {
      socket.emit('errorMessage', 'Need at least 2 players to start');
      return;
    }

    game.settings = {
      answerTime: Math.min(Math.max(parseInt(settings.answerTime) || 30, 10, 120),
      discussionTime: Math.min(Math.max(parseInt(settings.discussionTime) || 45, 15, 180),
      voteTime: Math.min(Math.max(parseInt(settings.voteTime) || 30, 10, 60),
      rounds: Math.min(Math.max(parseInt(settings.rounds) || 5, 1, 10)
    };

    game.status = 'playing';
    game.round = 1;
    io.to(room).emit('gameStarted', game.settings);
    startRound(room);
  });

  // Player submits answer
  socket.on('submitAnswer', (answer) => {
    const room = getRoom(socket);
    const game = rooms[room];
    if (!game || game.status !== 'playing') return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    if (!game.answers) game.answers = [];
    game.answers.push({ id: socket.id, name: player.name, answer });
  });

  // Discussion message
  socket.on('discussionMessage', (msg) => {
    const room = getRoom(socket);
    const game = rooms[room];
    if (!game || game.status !== 'playing') return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to(room).emit('newDiscussionMessage', { 
      name: player.name, 
      message: msg 
    });
  });

  // Player votes
  socket.on('submitVote', (votedId) => {
    const room = getRoom(socket);
    const game = rooms[room];
    if (!game || game.status !== 'playing') return;

    // Can't vote for yourself
    if (votedId === socket.id) {
      socket.emit('errorMessage', 'You cannot vote for yourself');
      return;
    }

    if (!game.votes) game.votes = {};
    game.votes[socket.id] = votedId;

    // Check if all votes are in
    if (Object.keys(game.votes).length === game.players.length) {
      processVotes(room);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const room = getRoom(socket);
    if (!room || !rooms[room]) return;

    const game = rooms[room];
    game.players = game.players.filter(p => p.id !== socket.id);
    delete game.scores[socket.id];

    // Reassign host if needed
    if (game.host === socket.id && game.players.length > 0) {
      game.host = game.players[0].id;
      io.to(room).emit('updatePlayers', {
        players: game.players,
        host: game.host
      });
    } else {
      io.to(room).emit('updatePlayers', {
        players: game.players,
        host: game.host
      });
    }

    // Clean up empty rooms
    if (game.players.length === 0) {
      delete rooms[room];
    }
  });
});

// Process votes and calculate scores
function processVotes(room) {
  const game = rooms[room];
  if (!game) return;

  // Count votes
  const voteCounts = {};
  Object.values(game.votes).forEach(id => {
    voteCounts[id] = (voteCounts[id] || 0) + 1;
  });

  // Find player with most votes
  let maxVotes = 0;
  let votedPlayerId = null;
  for (const [id, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      votedPlayerId = id;
    }
  }

  const imposterId = game.imposter;
  const isCorrect = votedPlayerId === imposterId;
  const votedPlayer = game.players.find(p => p.id === votedPlayerId)?.name || 'Unknown';

  // Award points
  if (isCorrect) {
    // Players who voted correctly get 1 point
    Object.entries(game.votes).forEach(([voterId, votedId]) => {
      if (votedId === imposterId) {
        game.scores[voterId] = (game.scores[voterId] || 0) + 1;
      }
    });
  } else {
    // Imposter gets 2 points if not caught
    game.scores[imposterId] = (game.scores[imposterId] || 0) + 2;
  }

  // Prepare scores for display
  const scoresToShow = game.players.map(p => ({
    id: p.id,
    name: p.name,
    score: game.scores[p.id] || 0
  }));

  // Show results
  io.to(room).emit('showScores', {
    scores: scoresToShow,
    imposter: game.players.find(p => p.id === imposterId)?.name || 'Unknown',
    votedPlayer,
    isCorrect
  });

  // Next round or game over
  game.round++;
  if (game.round <= game.settings.rounds) {
    // Wait 5 seconds before next round
    setTimeout(() => startRound(room), 5000);
  } else {
    // Game over
    game.status = 'finished';
    io.to(room).emit('gameOver', {
      scores: scoresToShow,
      imposter: game.players.find(p => p.id === imposterId)?.name || 'Unknown',
      votedPlayer,
      isCorrect
    });
  }
}

// Start a new round
function startRound(room) {
  const game = rooms[room];
  if (!game) return;

  const question = getRandomQuestion();
  game.currentQuestion = question;
  game.answers = [];
  game.votes = {};

  // Select random imposter
  const imposterIndex = Math.floor(Math.random() * game.players.length);
  game.imposter = game.players[imposterIndex].id;

  // Send questions to players
  game.players.forEach(p => {
    const q = p.id === game.imposter ? question.fake : question.real;
    io.to(p.id).emit('roundStart', {
      round: game.round,
      question: q,
      time: game.settings.answerTime
    });
  });

  // After answer phase
  setTimeout(() => {
    // Include all players in answer reveal (even if they didn't answer)
    const answersToShow = game.players.map(player => {
      const ans = game.answers.find(a => a.id === player.id);
      return {
        name: player.name,
        answer: ans ? ans.answer : "Did not answer"
      };
    });

    io.to(room).emit('revealAnswers', {
      question: question.real,
      answers: answersToShow
    });

    // After 3 sec → discussion
    setTimeout(() => {
      io.to(room).emit('startDiscussion', {
        time: game.settings.discussionTime
      });

      // After discussion → voting
      setTimeout(() => {
        io.to(room).emit('startVote', {
          players: game.players,
          time: game.settings.voteTime
        });
      }, game.settings.discussionTime * 1000);

    }, 3000);

  }, game.settings.answerTime * 1000);
}

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
