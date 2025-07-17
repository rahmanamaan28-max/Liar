const socket = io();
let myName = '';
let myRoom = '';
let isHost = false;
let gameSettings = {};
let currentRound = 1;
let totalRounds = 5;

// DOM Elements
const elements = {
  joinScreen: document.getElementById('join-screen'),
  lobbyScreen: document.getElementById('lobby-screen'),
  gameScreen: document.getElementById('game-screen'),
  playerName: document.getElementById('playerName'),
  roomCode: document.getElementById('roomCode'),
  joinBtn: document.getElementById('joinBtn'),
  createBtn: document.getElementById('createBtn'),
  roomDisplay: document.getElementById('roomDisplay'),
  playerList: document.getElementById('playerList'),
  hostControls: document.getElementById('hostControls'),
  startGame: document.getElementById('startGame'),
  answerTime: document.getElementById('answerTime'),
  discussionTime: document.getElementById('discussionTime'),
  voteTime: document.getElementById('voteTime'),
  rounds: document.getElementById('rounds'),
  roundNum: document.getElementById('roundNum'),
  totalRounds: document.getElementById('totalRounds'),
  timer: document.getElementById('timer'),
  timeLeft: document.getElementById('timeLeft'),
  displayQuestion: document.getElementById('displayQuestion'),
  answerBox: document.getElementById('answer-box'),
  answerInput: document.getElementById('answerInput'),
  submitAnswer: document.getElementById('submitAnswer'),
  answersTable: document.getElementById('answers-table'),
  answersBody: document.getElementById('answersBody'),
  discussionBox: document.getElementById('discussion-box'),
  discussionMessages: document.getElementById('discussionMessages'),
  discussionInput: document.getElementById('discussionInput'),
  submitDiscussion: document.getElementById('submitDiscussion'),
  voteBox: document.getElementById('vote-box'),
  voteOptions: document.getElementById('voteOptions'),
  submitVote: document.getElementById('submitVote'),
  scoreboard: document.getElementById('scoreboard'),
  scoreboardBody: document.getElementById('scoreboardBody'),
  roundResult: document.getElementById('round-result'),
  nextRoundBtn: document.getElementById('nextRoundBtn'),
  errorMessage: document.getElementById('error-message'),
  lobbyStatus: document.getElementById('lobby-status')
};

// Event Listeners
elements.joinBtn.addEventListener('click', joinRoom);
elements.createBtn.addEventListener('click', createRoom);
elements.startGame.addEventListener('click', startGame);
elements.submitAnswer.addEventListener('click', submitAnswer);
elements.submitDiscussion.addEventListener('click', sendDiscussionMessage);
elements.submitVote.addEventListener('click', submitVote);
elements.nextRoundBtn.addEventListener('click', continueToNextRound);

// Allow pressing Enter in input fields
elements.playerName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') elements.roomCode.focus();
});

elements.roomCode.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinRoom();
});

elements.answerInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submitAnswer();
});

elements.discussionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendDiscussionMessage();
});

// Socket Event Handlers
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showError('Disconnected from server. Please refresh the page.');
});

socket.on('errorMessage', (msg) => {
  showError(msg);
});

socket.on('roomJoined', handleRoomJoined);
socket.on('updatePlayers', updatePlayerList);
socket.on('gameStarted', handleGameStarted);
socket.on('roundStart', handleRoundStart);
socket.on('revealAnswers', revealAnswers);
socket.on('startDiscussion', startDiscussion);
socket.on('newDiscussionMessage', addDiscussionMessage);
socket.on('startVote', startVoting);
socket.on('showScores', showScores);
socket.on('gameOver', showGameOver);

// Functions
function joinRoom() {
  myName = elements.playerName.value.trim();
  myRoom = elements.roomCode.value.trim().toUpperCase();
  
  if (!myName) {
    showError('Please enter your name');
    return;
  }
  if (!myRoom || myRoom.length !== 4) {
    showError('Please enter a valid 4-character room code');
    return;
  }
  
  socket.emit('joinRoom', { name: myName, room: myRoom });
}

function createRoom() {
  myName = elements.playerName.value.trim();
  
  if (!myName) {
    showError('Please enter your name');
    return;
  }
  
  socket.emit('createRoom', { name: myName });
}

function startGame() {
  gameSettings = {
    answerTime: +elements.answerTime.value,
    discussionTime: +elements.discussionTime.value,
    voteTime: +elements.voteTime.value,
    rounds: +elements.rounds.value
  };
  
  if (gameSettings.answerTime < 10 || gameSettings.discussionTime < 15 || 
      gameSettings.voteTime < 10 || gameSettings.rounds < 1) {
    showError('Please enter valid game settings');
    return;
  }
  
  socket.emit('startGame', gameSettings);
}

function submitAnswer() {
  const answer = elements.answerInput.value.trim();
  if (answer) {
    socket.emit('submitAnswer', answer);
    elements.answerInput.disabled = true;
    elements.submitAnswer.disabled = true;
  }
}

function sendDiscussionMessage() {
  const msg = elements.discussionInput.value.trim();
  if (msg) {
    socket.emit('discussionMessage', msg);
    elements.discussionInput.value = '';
  }
}

function submitVote() {
  const selected = document.querySelector('input[name="vote"]:checked');
  if (selected) {
    socket.emit('submitVote', selected.value);
    elements.submitVote.disabled = true;
  } else {
    showError('Please select a player to vote for');
  }
}

function continueToNextRound() {
  elements.scoreboard.classList.add('hidden');
  elements.nextRoundBtn.classList.add('hidden');
}

function handleRoomJoined({ room, players, host }) {
  elements.joinScreen.classList.add('hidden');
  elements.lobbyScreen.classList.remove('hidden');
  elements.roomDisplay.textContent = room;
  isHost = host === socket.id;
  elements.hostControls.classList.toggle('hidden', !isHost);
  updatePlayerList({ players, host });
  
  if (players.length >= 2) {
    elements.lobbyStatus.textContent = 'Ready to start the game!';
  } else {
    elements.lobbyStatus.textContent = 'Waiting for more players to join... (Need at least 2)';
  }
}

function updatePlayerList({ players, host }) {
  elements.playerList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    let text = p.name;
    if (p.id === socket.id) text += " (You)";
    if (p.id === host) text += " 👑"; // Crown emoji for host
    li.textContent = text;
    elements.playerList.appendChild(li);
  });
  
  isHost = host === socket.id;
  elements.hostControls.classList.toggle('hidden', !isHost);
  
  if (players.length >= 2 && isHost) {
    elements.startGame.disabled = false;
  } else if (isHost) {
    elements.startGame.disabled = true;
  }
}

function handleGameStarted(settings) {
  elements.lobbyScreen.classList.add('hidden');
  elements.gameScreen.classList.remove('hidden');
  totalRounds = settings.rounds;
  elements.totalRounds.textContent = totalRounds;
}

function handleRoundStart({ round, question, time }) {
  currentRound = round;
  elements.roundNum.textContent = currentRound;
  elements.displayQuestion.textContent = question;
  
  // Reset UI
  elements.scoreboard.classList.add('hidden');
  elements.answerBox.classList.remove('hidden');
  elements.answersTable.classList.add('hidden');
  elements.discussionBox.classList.add('hidden');
  elements.voteBox.classList.add('hidden');
  elements.answerInput.value = '';
  elements.answerInput.disabled = false;
  elements.submitAnswer.disabled = false;
  elements.discussionMessages.innerHTML = '';
  elements.submitVote.disabled = false;
  
  startTimer(time);
}

function revealAnswers({ question, answers }) {
  elements.displayQuestion.textContent = question;
  elements.answersBody.innerHTML = '';
  
  answers.forEach(ans => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${ans.name}</td><td>${ans.answer}</td>`;
    elements.answersBody.appendChild(row);
  });
  
  elements.answerBox.classList.add('hidden');
  elements.answersTable.classList.remove('hidden');
}

function startDiscussion({ time }) {
  elements.answersTable.classList.add('hidden');
  elements.discussionBox.classList.remove('hidden');
  startTimer(time);
}

function addDiscussionMessage({ name, message }) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.innerHTML = `<strong>${name}:</strong> ${message}`;
  elements.discussionMessages.appendChild(messageElement);
  elements.discussionMessages.scrollTop = elements.discussionMessages.scrollHeight;
}

function startVoting({ players, time }) {
  elements.discussionBox.classList.add('hidden');
  elements.voteBox.classList.remove('hidden');
  elements.voteOptions.innerHTML = '';
  
  players.forEach(p => {
    if (p.id !== socket.id) { // Can't vote for yourself
      const label = document.createElement('label');
      label.innerHTML = `
        <input type="radio" name="vote" value="${p.id}"/>
        ${p.name}
      `;
      elements.voteOptions.appendChild(label);
    }
  });
  
  startTimer(time);
}

function showScores({ scores, imposter, votedPlayer, isCorrect }) {
  elements.voteBox.classList.add('hidden');
  elements.scoreboard.classList.remove('hidden');
  elements.scoreboardBody.innerHTML = '';
  
  // Sort scores descending
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  
  sortedScores.forEach((p, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${p.name} ${p.id === socket.id ? '(You)' : ''}</td>
      <td>${p.score}</td>
    `;
    elements.scoreboardBody.appendChild(row);
  });
  
  // Show round result
  let resultMessage = '';
  if (isCorrect) {
    resultMessage = `✅ Correct! ${votedPlayer} was the imposter!`;
  } else {
    resultMessage = `❌ Wrong! ${imposter} was the imposter!`;
  }
  
  elements.roundResult.textContent = resultMessage;
  
  // Show continue button for host
  if (isHost && currentRound < totalRounds) {
    elements.nextRoundBtn.classList.remove('hidden');
  }
}

function showGameOver(finalScores) {
  showScores(finalScores);
  elements.roundResult.textContent += '\n\nGame Over! Thanks for playing!';
  elements.nextRoundBtn.classList.add('hidden');
}

function startTimer(seconds) {
  let remaining = seconds;
  elements.timeLeft.textContent = remaining;
  
  // Clear any existing timer
  if (window.timerInterval) {
    clearInterval(window.timerInterval);
  }
  
  window.timerInterval = setInterval(() => {
    remaining--;
    elements.timeLeft.textContent = remaining;
    
    // Change color when time is running out
    if (remaining <= 5) {
      elements.timer.style.backgroundColor = '#dc3545';
    } else if (remaining <= 10) {
      elements.timer.style.backgroundColor = '#ffc107';
      elements.timer.style.color = '#212529';
    } else {
      elements.timer.style.backgroundColor = '#343a40';
      elements.timer.style.color = 'white';
    }
    
    if (remaining <= 0) {
      clearInterval(window.timerInterval);
    }
  }, 1000);
}

function showError(message) {
  elements.errorMessage.textContent = message;
  setTimeout(() => {
    elements.errorMessage.textContent = '';
  }, 5000);
                     }
