// Audio Manager Module
const AudioManager = (function() {
  // Sound file paths
  const sounds = {
    button: '/sounds/button.mp3',
    join: '/sounds/join.mp3',
    start: '/sounds/start.mp3',
    submit: '/sounds/submit.mp3',
    reveal: '/sounds/reveal.mp3',
    vote: '/sounds/vote.mp3',
    correct: '/sounds/correct.mp3',
    wrong: '/sounds/wrong.mp3',
    win: '/sounds/win.mp3',
    lose: '/sounds/lose.mp3',
    timer: '/sounds/timer.mp3',
    notification: '/sounds/notification.mp3'
  };

  // Audio elements
  let audioElements = {};
  let isMuted = localStorage.getItem('isMuted') === 'true';
  const cooldowns = {};

  // Initialize audio
  function init() {
    // Preload audio files
    Object.keys(sounds).forEach(sound => {
      audioElements[sound] = new Audio(sounds[sound]);
      audioElements[sound].preload = 'auto';
    });

    // Create mute button
    createMuteButton();
  }

  // Create mute button UI
  function createMuteButton() {
    const muteBtn = document.createElement('button');
    muteBtn.id = 'mute-btn';
    muteBtn.className = `mute-btn ${isMuted ? 'muted' : ''}`;
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.title = isMuted ? 'Unmute' : 'Mute';
    muteBtn.addEventListener('click', toggleMute);
    
    document.body.appendChild(muteBtn);
  }

  // Toggle mute state
  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('isMuted', isMuted);
    
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
      muteBtn.title = isMuted ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('muted', isMuted);
    }
    
    playSound('button');
  }

  // Play sound with cooldown
  function playSound(soundName) {
    if (isMuted || !audioElements[soundName]) return;
    
    // Implement cooldown to prevent spamming
    const now = Date.now();
    if (cooldowns[soundName] && now - cooldowns[soundName] < 300) {
      return;
    }
    cooldowns[soundName] = now;
    
    try {
      // Reset and play sound
      const audio = audioElements[soundName];
      audio.currentTime = 0;
      audio.play().catch(e => {
        console.log(`Sound play prevented for ${soundName}:`, e.message);
      });
    } catch (e) {
      console.error(`Error playing ${soundName}:`, e);
    }
  }

  // Public API
  return {
    init,
    playSound,
    toggleMute
  };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', AudioManager.init);
