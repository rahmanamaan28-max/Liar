const socket = io();
let myName = '';
let myRoom = '';
let isHost = false;

// DOM Elements
const joinScreen = document.getElementById('join-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCode');
const roomDisplay = document.getElementById('roomDisplay');
const playerList = document.getElementById('playerList');
const errorMessage = document.getElementById('error-message');
const hostControls = document.getElementById('hostControls');

// Event Listeners
document.getElementById('createBtn').addEventListener('click', createRoom);
document.getElementById('joinBtn').addEventListener('click', joinRoom);
document.getElementById('startGame').addEventListener('click', startGame);

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

socket.on('gameStarted', () => {
  alert("Game started! Next step: Implement game rounds");
  // Will implement game rounds in next phase
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
    playerList.appendChild(li);
  });
}
