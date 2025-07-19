const socket = io();
let myName = '';
let myRoom = '';
let isHost = false;
let currentRound = 1;
let timer;
let selectedVote = null;

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
const questionContainer = document.getElementById('question-container');
const answersContainer = document.getElementById('answers-container');
const votingContainer = document.getElementById('voting-container');
const resultsContainer = document.getElementById('results-container');

// Event Listeners
document.getElementById('createBtn').addEventListener('click', createRoom);
document.getElementById('joinBtn').addEventListener('click', joinRoom);
startGameBtn.addEventListener('click', startGame);
submitAnswerBtn.addEventListener('click', submitAnswer);
submitVoteBtn.addEventListener('click', submitVote);
playAgainBtn.addEventListener('click', () => location.reload());

function createRoom() {
  myName = playerNameInput.value.trim();
  if (myName) {
    socket.emit('createRoom', myName);
  } else {
    showError("Please enter your name");
  }
}

function joinRoom() {
  myName = playerNameInput.value.trim();
  myRoom = roomCodeInput.value.trim().toUpperCase();
  
  if (myName && myRoom) {
    socket.emit('joinRoom', { name: myName, roomCode: myRoom });
  } else {
    showError("Please enter both name and room code");
  }
}

function startGame() {
  socket.emit('startGame', myRoom);
}

function submitAnswer() {
  const answer = answerInput.value.trim();
  if (answer) {
    socket.emit('submitAnswer', { roomCode: myRoom, answer });
    answerInput.disabled = true;
    submitAnswerBtn.disabled = true;
    submitAnswerBtn.textContent = "Answer Submitted";
  } else {
    showError("Please enter an answer");
  }
}

function submitVote() {
  if (selectedVote) {
    socket.emit('submitVote', { roomCode: myRoom, votedPlayerId: selectedVote });
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = "Vote Submitted";
  } else {
    showError("Please select a player to vote for");
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  setTimeout(() => errorMessage.classList.add('hidden'), 3000);
}

// Socket Event Handlers
socket.on('roomCreated', (roomCode) => {
  myRoom = roomCode;
  showLobby(roomCode);
  isHost = true;
  hostControls.classList.remove('hidden');
});

socket.on('playerJoined', (players) => {
  updatePlayerList(players);
});

socket.on('joinError', (message) => {
  showError(message);
});

socket.on('gameStarted', (players) => {
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  updatePlayerList(players);
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
  
  answerInput.value = '';
  answerInput.disabled = false;
  submitAnswerBtn.disabled = false;
  submitAnswerBtn.textContent = "Submit Answer";
  
  if (data.isImposter) {
    showNotification("You are the IMPOSTER this round!", "danger");
  } else {
    showNotification("You are telling the TRUTH this round!", "success");
  }
  
  startTimer(data.time);
});

socket.on('revealAnswers', (data) => {
  questionContainer.classList.add('hidden');
  answersContainer.classList.remove('hidden');
  
  answersList.innerHTML = '';
  data.answers.forEach(answer => {
    const li = document.createElement('li');
    li.textContent = `${answer.playerName}: ${answer.answer}`;
    answersList.appendChild(li);
  });
  
  startTimer(10); // Short timer to view answers
});

socket.on('startVoting', (data) => {
  answersContainer.classList.add('hidden');
  votingContainer.classList.remove('hidden');
  
  voteOptions.innerHTML = '';
  selectedVote = null;
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
        selectedVote = player.id;
      });
      voteOptions.appendChild(li);
    }
  });
  
  startTimer(data.time);
});

socket.on('roundResults', (data) => {
  votingContainer.classList.add('hidden');
  resultsContainer.classList.remove('hidden');
  
  const imposterPlayer = data.players.find(p => p.id === data.imposterId);
  
  if (data.imposterCaught) {
    imposterResult.textContent = `The imposter (${imposterPlayer.name}) was caught!`;
    imposterResult.style.color = "green";
  } else {
    imposterResult.textContent = `The imposter (${imposterPlayer.name}) was not caught!`;
    imposterResult.style.color = "red";
  }
  
  // Update scores display
  updatePlayerList(data.players);
  
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
});

socket.on('updatePlayers', (players) => {
  updatePlayerList(players);
});

// Helper Functions
function showLobby(roomCode) {
  joinScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  roomDisplay.textContent = roomCode;
}

function updatePlayerList(players) {
  playerList.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player.name + (player.id === socket.id ? " (You)" : "");
    li.innerHTML += ` <span class="player-score">${player.score} points</span>`;
    playerList.appendChild(li);
  });
}

function startTimer(seconds) {
  clearInterval(timer);
  timeLeft.textContent = seconds;
  
  timer = setInterval(() => {
    seconds--;
    timeLeft.textContent = seconds;
    
    if (seconds <= 0) {
      clearInterval(timer);
    }
  }, 1000);
}

function showNotification(message, type) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Position at top center
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.padding = '10px 20px';
  notification.style.background = type === 'success' ? '#4CAF50' : '#F44336';
  notification.style.color = 'white';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '1000';
  notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  
  document.body.appendChild(notification);
  
  // Remove after delay
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}
