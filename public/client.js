const socket = io();
let myName = '';
let myRoom = '';
let isHost = false;
let currentRound = 1;
let timer;

// DOM Elements
const joinScreen = document.getElementById('join-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCode');
const roomDisplay = document.getElementById('roomDisplay');
const playerList = document.getElementById('playerList');
const errorMessage = document.getElementById('error-message');
const hostControls = document.getElementById('hostControls');
const startGameBtn = document.getElementById('startGame');
const settingsForm = document.getElementById('settings-form');
const roundsInput = document.getElementById('rounds');
const answerTimeInput = document.getElementById('answerTime');
const discussionTimeInput = document.getElementById('discussionTime');
const voteTimeInput = document.getElementById('voteTime');
const roundNumber = document.getElementById('round-number');
const timeLeft = document.getElementById('time-left');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer-input');
const submitAnswerBtn = document.getElementById('submit-answer');
const answersList = document.getElementById('answers-list');
const voteOptions = document.getElementById('vote-options');
const submitVoteBtn = document.getElementById('submit-vote');
const imposterResult = document.getElementById('imposter-result');
const scoreUpdate = document.getElementById('score-update');
const nextRoundTimer = document.getElementById('next-round-timer');
const winnerName = document.getElementById('winner-name');
const winnerScore = document.getElementById('winner-score');
const finalScores = document.getElementById('final-scores');
const playAgainBtn = document.getElementById('play-again');
const playAgainHostBtn = document.getElementById('play-again-host');
const questionContainer = document.getElementById('question-container');
const answersContainer = document.getElementById('answers-container');
const votingContainer = document.getElementById('voting-container');
const resultsContainer = document.getElementById('results-container');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const chatContainer = document.getElementById('chat-container');
const floatingScoreboard = document.getElementById('floating-scoreboard');
const floatingScores = document.getElementById('floating-scores');
const loadingIndicator = document.getElementById('loading-indicator');
const minPlayersWarning = document.getElementById('min-players-warning');

// Event Listeners
document.getElementById('createBtn').addEventListener('click', createRoom);
document.getElementById('joinBtn').addEventListener('click', joinRoom);
startGameBtn.addEventListener('click', startGame);
submitAnswerBtn.addEventListener('click', submitAnswer);
submitVoteBtn.addEventListener('click', submitVote);
playAgainBtn.addEventListener('click', () => location.reload());
playAgainHostBtn.addEventListener('click', resetGame);
settingsForm.addEventListener('submit', updateSettings);
sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});

function createRoom() {
  myName = playerNameInput.value.trim();
  if (myName) {
    // Play sound
    AudioManager.playSound('button');
    
    // Get default settings from form
    const settings = {
      rounds: parseInt(roundsInput.value) || 5,
      answerTime: parseInt(answerTimeInput.value) || 30,
      discussionTime: parseInt(discussionTimeInput.value) || 45,
      voteTime: parseInt(voteTimeInput.value) || 30
    };
    
    socket.emit('createRoom', { name: myName, settings });
    loadingIndicator.classList.remove('hidden');
  } else {
    showError("Please enter your name");
  }
}

function joinRoom() {
  myName = playerNameInput.value.trim();
  myRoom = roomCodeInput.value.trim().toUpperCase();
  
  if (!myName) {
    showError("Please enter your name");
    return;
  }
  
  if (!myRoom || myRoom.length !== 4) {
    showError("Room code must be 4 characters");
    return;
  }
  
  // Play sound
  AudioManager.playSound('button');
  
  // Show loading indicator
  loadingIndicator.classList.remove('hidden');
  minPlayersWarning.classList.add('hidden');
  
  socket.emit('joinRoom', { name: myName, roomCode: myRoom });
}

function startGame() {
  // Play sound
  AudioManager.playSound('start');
  socket.emit('startGame');
}

function submitAnswer() {
  const answer = answerInput.value.trim();
  if (answer) {
    // Play sound
    AudioManager.playSound('submit');
    
    socket.emit('submitAnswer', { answer });
    answerInput.disabled = true;
    submitAnswerBtn.disabled = true;
    submitAnswerBtn.textContent = "Answer Submitted";
  } else {
    showError("Please enter an answer");
  }
}

function submitVote() {
  const selectedVote = document.querySelector('#vote-options li.selected');
  if (selectedVote) {
    // Play sound
    AudioManager.playSound('vote');
    
    socket.emit('submitVote', { votedPlayerId: selectedVote.dataset.playerId });
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = "Vote Submitted";
  } else {
    showError("Please select a player to vote for");
  }
}

function updateSettings(e) {
  e.preventDefault();
  
  // Play sound
  AudioManager.playSound('button');
  
  const settings = {
    rounds: parseInt(roundsInput.value) || 5,
    answerTime: parseInt(answerTimeInput.value) || 30,
    discussionTime: parseInt(discussionTimeInput.value) || 45,
    voteTime: parseInt(voteTimeInput.value) || 30
  };
  
  socket.emit('updateSettings', settings);
}

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (message) {
    // Play sound
    AudioManager.playSound('button');
    
    socket.emit('sendChatMessage', message);
    chatInput.value = '';
  }
}

function resetGame() {
  // Play sound
  AudioManager.playSound('button');
  socket.emit('resetGame');
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

// Socket Event Handlers
socket.on('roomCreated', (roomCode) => {
  myRoom = roomCode;
  showLobby(roomCode);
  isHost = true;
  hostControls.classList.remove('hidden');
  loadingIndicator.classList.add('hidden');
  minPlayersWarning.classList.remove('hidden');
  
  // Play sound
  AudioManager.playSound('join');
});

socket.on('roomUpdated', (data) => {
  if (joinScreen.classList.contains('hidden') === false) {
    showLobby(myRoom);
  }
  
  updatePlayerList(data.players);
  updateFloatingScoreboard(data.players);
  
  if (isHost) {
    roundsInput.value = data.settings.rounds;
    answerTimeInput.value = data.settings.answerTime;
    discussionTimeInput.value = data.settings.discussionTime;
    voteTimeInput.value = data.settings.voteTime;
    
    // Update min players warning
    minPlayersWarning.textContent = data.players.length < 3 
      ? "Need at least 3 players to start" 
      : "Ready to start game!";
  }
  
  loadingIndicator.classList.add('hidden');
  
  // Play sound
  AudioManager.playSound('join');
});

socket.on('joinError', (message) => {
  showError(message);
  loadingIndicator.classList.add('hidden');
});

socket.on('gameError', (message) => {
  showError(message);
});

socket.on('gameStarted', (players) => {
  joinScreen.classList.add('hidden');
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  minPlayersWarning.classList.add('hidden');
  updatePlayerList(players);
  updateFloatingScoreboard(players);
});

socket.on('roundStart', (data) => {
  currentRound = data.round;
  roundNumber.textContent = currentRound;
  questionText.textContent = data.question;
  
  // Reset UI
  questionContainer.classList.remove('hidden');
  answersContainer.classList.add('hidden');
  votingContainer.classList.add('hidden');
  resultsContainer.classList.add('hidden');
  chatContainer.classList.add('hidden');
  
  answerInput.value = '';
  answerInput.disabled = false;
  submitAnswerBtn.disabled = false;
  submitAnswerBtn.textContent = "Submit Answer";
  
  // Play sound based on role
  if (data.isImposter) {
    showNotification("You are the IMPOSTER this round!", "danger");
    AudioManager.playSound('wrong');
  } else {
    showNotification("You are telling the TRUTH this round!", "success");
    AudioManager.playSound('correct');
  }
  
  startTimer(data.time);
});

socket.on('revealAnswers', (data) => {
  questionContainer.classList.add('hidden');
  answersContainer.classList.remove('hidden');
  chatContainer.classList.remove('hidden');
  
  answersList.innerHTML = '';
  const realQuestion = document.createElement('p');
  realQuestion.textContent = `The real question was: ${data.question}`;
  realQuestion.classList.add('real-question');
  answersList.appendChild(realQuestion);
  
  data.answers.forEach(answer => {
    const li = document.createElement('li');
    li.textContent = `${answer.playerName}: ${answer.answer}`;
    answersList.appendChild(li);
  });
  
  // Clear chat
  chatMessages.innerHTML = '';
  
  // Play sound
  AudioManager.playSound('reveal');
  
  // Start timer for discussion phase
  startTimer(data.time);
});

socket.on('chatMessage', (message) => {
  const messageElement = document.createElement('div');
  messageElement.classList.add('chat-message');
  
  const sender = document.createElement('strong');
  sender.textContent = `${message.playerName}: `;
  
  const content = document.createElement('span');
  content.textContent = message.message;
  
  const time = document.createElement('span');
  time.classList.add('chat-time');
  time.textContent = message.timestamp;
  
  messageElement.appendChild(sender);
  messageElement.appendChild(content);
  messageElement.appendChild(time);
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('startVoting', (data) => {
  answersContainer.classList.add('hidden');
  chatContainer.classList.add('hidden');
  votingContainer.classList.remove('hidden');
  
  voteOptions.innerHTML = '';
  submitVoteBtn.disabled = false;
  submitVoteBtn.textContent = "Submit Vote";
  
  data.players.forEach(player => {
    if (player.id !== socket.id) {
      const li = document.createElement('li');
      li.textContent = player.name;
      li.dataset.playerId = player.id;
      li.addEventListener('click', () => {
        // Remove selection from all
        document.querySelectorAll('#vote-options li').forEach(item => {
          item.classList.remove('selected');
        });
        // Select this one
        li.classList.add('selected');
      });
      voteOptions.appendChild(li);
    }
  });
  
  // Play sound
  AudioManager.playSound('vote');
  
  startTimer(data.time);
});

socket.on('roundResults', (data) => {
  votingContainer.classList.add('hidden');
  resultsContainer.classList.remove('hidden');
  
  const imposterPlayer = data.players.find(p => p.id === data.imposterId);
  
  if (data.imposterCaught) {
    imposterResult.textContent = `The imposter (${imposterPlayer.name}) was caught!`;
    imposterResult.style.color = "green";
    AudioManager.playSound('correct');
  } else {
    // Determine why imposter wasn't caught
    const imposterVotes = data.voteCounts[data.imposterId] || 0;
    const maxVotes = Math.max(...Object.values(data.voteCounts));
    
    let reason = "";
    if (imposterVotes < maxVotes) {
      reason = `didn't get the most votes (${imposterVotes} votes)`;
    } else {
      reason = `tied for most votes (${imposterVotes} votes)`;
    }
    
    imposterResult.textContent = `The imposter (${imposterPlayer.name}) was not caught because they ${reason}!`;
    imposterResult.style.color = "red";
    AudioManager.playSound('wrong');
  }
  
  // Update scores display
  updatePlayerList(data.players);
  updateFloatingScoreboard(data.players);
  
  // Show vote counts
  scoreUpdate.innerHTML = '<h4>Vote Results:</h4>';
  for (const [playerId, votes] of Object.entries(data.voteCounts)) {
    const player = data.players.find(p => p.id === playerId);
    if (player) {
      const voteDiv = document.createElement('div');
      voteDiv.textContent = `${player.name}: ${votes} vote${votes !== 1 ? 's' : ''}`;
      if (playerId === data.imposterId) {
        voteDiv.style.fontWeight = 'bold';
        voteDiv.style.color = 'var(--danger)';
      }
      scoreUpdate.appendChild(voteDiv);
    }
  }
  
  // Show countdown to next round
  let countdown = 5;
  nextRoundTimer.textContent = countdown;
  
  const countdownInterval = setInterval(() => {
    countdown--;
    nextRoundTimer.textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);
});

socket.on('gameOver', (data) => {
  gameScreen.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');
  
  winnerName.textContent = data.winner.name;
  winnerScore.textContent = data.winner.score;
  
  finalScores.innerHTML = '';
  data.players.sort((a, b) => b.score - a.score).forEach(player => {
    const li = document.createElement('li');
    li.innerHTML = `${player.name} <span class="player-score">${player.score} points</span>`;
    if (player.id === data.winner.id) {
      li.innerHTML += ' <span class="imposter-badge">WINNER</span>';
    }
    finalScores.appendChild(li);
  });
  
  // Play sound
  if (data.winner.id === socket.id) {
    AudioManager.playSound('win');
  } else {
    AudioManager.playSound('lose');
  }
  
  // Show play again button only to host
  playAgainHostBtn.classList.toggle('hidden', !isHost);
});

socket.on('gameReset', (data) => {
  gameOverScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  
  updatePlayerList(data.players);
  updateFloatingScoreboard(data.players);
  
  if (isHost) {
    roundsInput.value = data.settings.rounds;
    answerTimeInput.value = data.settings.answerTime;
    discussionTimeInput.value = data.settings.discussionTime;
    voteTimeInput.value = data.settings.voteTime;
    minPlayersWarning.classList.remove('hidden');
  }
});

socket.on('playerJoined', () => {
  AudioManager.playSound('join');
});

// Helper Functions
function showLobby(roomCode) {
  joinScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  roomDisplay.textContent = roomCode;
  floatingScoreboard.classList.remove('hidden');
}

function updatePlayerList(players) {
  playerList.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player.name + (player.id === socket.id ? " (You)" : "");
    li.innerHTML += ` <span class="player-score">${player.score} points</span>`;
    if (player.id === socket.id) {
      li.classList.add('you');
    }
    playerList.appendChild(li);
  });
  
  // Update min players warning
  if (isHost) {
    minPlayersWarning.textContent = players.length < 3 
      ? "Need at least 3 players to start" 
      : "Ready to start game!";
  }
}

function updateFloatingScoreboard(players) {
  floatingScores.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="player-name">${player.name}${player.id === socket.id ? " (You)" : ""}</span>
      <span class="player-score">${player.score}</span>
    `;
    if (player.id === socket.id) {
      li.classList.add('you');
    }
    floatingScores.appendChild(li);
  });
}

function startTimer(seconds) {
  clearInterval(timer);
  timeLeft.textContent = seconds;
  
  // Clear any existing timer sounds
  const timerSound = document.getElementById('timer-sound');
  if (timerSound) {
    timerSound.pause();
    timerSound.currentTime = 0;
  }
  
  timer = setInterval(() => {
    seconds--;
    timeLeft.textContent = seconds;
    
    // Play timer sound in last 3 seconds
    if (seconds <= 3 && seconds > 0) {
      AudioManager.playSound('timer');
    }
    
    if (seconds <= 0) {
      clearInterval(timer);
    }
  }, 1000);
}

function showNotification(message, type) {
  // Play sound
  AudioManager.playSound('notification');
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after animation completes
  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
                                                         }
