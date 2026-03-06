// ============================================
//  Cat vs Vacuums — Dodge Game Engine v2.0
//  Features: Title screen, 9 lives, collectibles,
//  waves, high score, sound, touch, rainbow hiss
// ============================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ---- Internal game resolution (all game logic uses these) ----
// Width is always 480. Height adapts to the screen's aspect ratio
// so the game fills the entire screen on any device.
const GAME_W = 480;
var GAME_H = 640;  // will be recalculated on resize
let W = GAME_W;
let H = GAME_H;

// Font scale — makes text readable on all screens
var FSCALE = 1.15;

// ============================================
//  Game State Management
// ============================================
// States: 'title', 'playing', 'gameover'
let gameState = 'title';

let score = 0;
let bonusScore = 0;       // points from collecting food
let highScore = 0;
let lives = 9;
const MAX_LIVES = 9;

// Invincibility after getting hit
let invincibleTimer = 0;
const INVINCIBLE_DURATION = 1.5; // seconds of invincibility after a hit
let invincibleFlashRate = 10;    // flashes per second

// ---- MEGA CHONK MODE ----
const CHONK_BURGERS_NEEDED = 4;
const CHONK_LASER_DURATION = 5;  // seconds of laser beams
let chonkBurgers = 0;            // 0-4 cheeseburgers collected
let chonkLevel = 0;              // 0-4 how round the cat is (visual)
let megaChonkActive = false;     // are lasers currently firing?
let megaChonkTimer = 0;          // countdown for laser duration
let chonkShrinkTimer = 0;        // brief shrink animation before lasers
const CHONK_SHRINK_DURATION = 0.4;
let chonkAnnouncementTimer = 0;  // "MEGA CHONK MODE" text display
const CHONK_ANNOUNCE_DURATION = 3;

// Laser beam explosion particles
const laserExplosions = [];

// Delta-time tracking
let lastFrameTime = 0;
const TARGET_FPS = 60;
const FRAME_DURATION = 1000 / TARGET_FPS;

// ============================================
//  High Score (localStorage)
// ============================================
const HIGHSCORE_KEY = 'catVsVacuums_highscore';
let savedHighScore = 0;

function loadHighScore() {
  try {
    var data = localStorage.getItem(HIGHSCORE_KEY);
    if (data) savedHighScore = parseInt(data, 10) || 0;
  } catch (e) {
    savedHighScore = 0;
  }
}

function saveHighScore(finalScore) {
  if (finalScore > savedHighScore) {
    savedHighScore = finalScore;
    try {
      localStorage.setItem(HIGHSCORE_KEY, String(savedHighScore));
    } catch (e) {}
  }
}

function isNewHighScore(finalScore) {
  return finalScore > savedHighScore;
}

loadHighScore();

// ============================================
//  Cat Skins — Color Unlock System
// ============================================
// Each skin has: name, body (primary), earInner/eye (accent),
// belly (lighter), paws (darker), and the score needed to unlock.
// 'rainbow' is special — body color cycles over time.
var CAT_SKINS = [
  { name: 'Gray',         body: '#8e99a4', accent: '#c8d0d8', belly: '#b8c2cc', paws: '#6b7580', score: 0 },
  { name: 'Pink',         body: '#ff6b9d', accent: '#ffd93d', belly: '#ffb3d0', paws: '#e0558a', score: 250 },
  { name: 'Bright Blue',  body: '#3dacf7', accent: '#a8e6ff', belly: '#8fd4ff', paws: '#2888d4', score: 500 },
  { name: 'Lime Green',   body: '#7ed321', accent: '#d4ff70', belly: '#aee868', paws: '#5ea318', score: 750 },
  { name: 'Purple',       body: '#9b59b6', accent: '#d7a8f0', belly: '#c49ddb', paws: '#7d3f99', score: 1000 },
  { name: 'Yellow',       body: '#f5c542', accent: '#fff5b0', belly: '#fce588', paws: '#d4a620', score: 1500 },
  { name: 'Tabby Orange', body: '#e8832a', accent: '#ffcc66', belly: '#f0a860', paws: '#c46a18', score: 2000 },
  { name: 'Rainbow',      body: 'rainbow',  accent: '#ffffff', belly: 'rainbow', paws: 'rainbow', score: 3000 }
];

var SKINS_KEY = 'catVsVacuums_skins';
var selectedSkinIndex = 0;
var unlockedSkins = [true]; // gray is always unlocked; rest loaded from storage

function loadSkins() {
  try {
    var data = localStorage.getItem(SKINS_KEY);
    if (data) {
      var parsed = JSON.parse(data);
      unlockedSkins = parsed.unlocked || [true];
      selectedSkinIndex = parsed.selected || 0;
      // Ensure array is the right length
      while (unlockedSkins.length < CAT_SKINS.length) unlockedSkins.push(false);
    } else {
      unlockedSkins = [];
      for (var i = 0; i < CAT_SKINS.length; i++) unlockedSkins.push(i === 0);
      selectedSkinIndex = 0;
    }
  } catch (e) {
    unlockedSkins = [true];
    selectedSkinIndex = 0;
  }
  // Validate selectedSkinIndex
  if (selectedSkinIndex < 0 || selectedSkinIndex >= CAT_SKINS.length) selectedSkinIndex = 0;
  if (!unlockedSkins[selectedSkinIndex]) selectedSkinIndex = 0;
}

function saveSkins() {
  try {
    localStorage.setItem(SKINS_KEY, JSON.stringify({
      unlocked: unlockedSkins,
      selected: selectedSkinIndex
    }));
  } catch (e) {}
}

// Called after each game — check if new skins should unlock
function checkSkinUnlocks(finalScore) {
  var newUnlock = false;
  for (var i = 0; i < CAT_SKINS.length; i++) {
    if (!unlockedSkins[i] && finalScore >= CAT_SKINS[i].score) {
      unlockedSkins[i] = true;
      newUnlock = true;
    }
  }
  if (newUnlock) saveSkins();
  return newUnlock;
}

// Get the current skin's colors (handles rainbow cycling)
function getSkinColors() {
  var skin = CAT_SKINS[selectedSkinIndex];
  if (skin.body === 'rainbow') {
    var t = Date.now() / 600;
    var r = Math.floor(128 + 127 * Math.sin(t));
    var g = Math.floor(128 + 127 * Math.sin(t + 2.094));
    var b = Math.floor(128 + 127 * Math.sin(t + 4.189));
    var bodyColor = 'rgb(' + r + ',' + g + ',' + b + ')';
    // Lighter belly
    var br = Math.min(255, r + 60);
    var bg = Math.min(255, g + 60);
    var bb = Math.min(255, b + 60);
    var bellyColor = 'rgb(' + br + ',' + bg + ',' + bb + ')';
    // Darker paws
    var pr = Math.max(0, r - 40);
    var pg = Math.max(0, g - 40);
    var pb = Math.max(0, b - 40);
    var pawColor = 'rgb(' + pr + ',' + pg + ',' + pb + ')';
    return { body: bodyColor, accent: skin.accent, belly: bellyColor, paws: pawColor };
  }
  return { body: skin.body, accent: skin.accent, belly: skin.belly, paws: skin.paws };
}

// Cycle to next unlocked skin (direction: 1 or -1)
function cycleSkin(direction) {
  var start = selectedSkinIndex;
  do {
    selectedSkinIndex += direction;
    if (selectedSkinIndex >= CAT_SKINS.length) selectedSkinIndex = 0;
    if (selectedSkinIndex < 0) selectedSkinIndex = CAT_SKINS.length - 1;
  } while (!unlockedSkins[selectedSkinIndex] && selectedSkinIndex !== start);
  saveSkins();
}

// Count how many skins are unlocked
function countUnlockedSkins() {
  var count = 0;
  for (var i = 0; i < unlockedSkins.length; i++) {
    if (unlockedSkins[i]) count++;
  }
  return count;
}

loadSkins();

// ============================================
//  Sound Engine (Web Audio API)
// ============================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type, volume, delay) {
  if (!audioCtx) return;
  type = type || 'square';
  volume = volume !== undefined ? volume : 0.1;
  delay = delay || 0;
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration);
}

function playNoise(duration, volume) {
  if (!audioCtx) return;
  volume = volume || 0.08;
  var bufferSize = audioCtx.sampleRate * duration;
  var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  var source = audioCtx.createBufferSource();
  source.buffer = buffer;
  var gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

function sfxMeow() {
  playTone(800, 0.12, 'sine', 0.12);
  playTone(600, 0.15, 'sine', 0.10, 0.08);
}

function sfxCollect() {
  playTone(880, 0.08, 'square', 0.08);
  playTone(1100, 0.08, 'square', 0.08, 0.06);
  playTone(1320, 0.12, 'square', 0.08, 0.12);
}

function sfxHit() {
  playNoise(0.15, 0.12);
  playTone(200, 0.2, 'sawtooth', 0.1);
}

function sfxHiss() {
  playNoise(0.4, 0.15);
  playTone(300, 0.3, 'sawtooth', 0.06);
  playTone(150, 0.4, 'sawtooth', 0.04, 0.1);
}

function sfxGameOver() {
  playTone(400, 0.2, 'square', 0.1);
  playTone(300, 0.2, 'square', 0.1, 0.2);
  playTone(200, 0.4, 'square', 0.1, 0.4);
}

function sfxWave() {
  playTone(523, 0.1, 'square', 0.08);
  playTone(659, 0.1, 'square', 0.08, 0.1);
  playTone(784, 0.15, 'square', 0.08, 0.2);
}

function sfxStart() {
  playTone(523, 0.1, 'square', 0.07);
  playTone(659, 0.1, 'square', 0.07, 0.1);
  playTone(784, 0.1, 'square', 0.07, 0.2);
  playTone(1047, 0.2, 'square', 0.07, 0.3);
}

function sfxBurgerCollect() {
  // Satisfying crunch + ascending "getting fatter" tone
  playNoise(0.08, 0.1);
  playTone(220 + chonkBurgers * 80, 0.15, 'square', 0.08);
  playTone(330 + chonkBurgers * 80, 0.15, 'square', 0.06, 0.1);
}

function sfxMegaChonk() {
  // Epic activation: descending "shrink" then ascending "POWER UP"
  playTone(600, 0.1, 'sine', 0.1);
  playTone(400, 0.1, 'sine', 0.1, 0.1);
  playTone(300, 0.1, 'sine', 0.1, 0.2);
  playTone(500, 0.1, 'sawtooth', 0.08, 0.35);
  playTone(700, 0.1, 'sawtooth', 0.08, 0.45);
  playTone(900, 0.15, 'sawtooth', 0.08, 0.55);
  playTone(1200, 0.2, 'sawtooth', 0.06, 0.65);
}

function sfxLaserZap() {
  playTone(1800 + Math.random() * 400, 0.06, 'sawtooth', 0.04);
  playTone(800, 0.08, 'square', 0.03, 0.03);
}

function sfxFart() {
  // Low rumbling "fart" — descending low-freq buzz + noise burst
  playTone(80, 0.35, 'sawtooth', 0.14);
  playTone(65, 0.25, 'square', 0.10, 0.05);
  playTone(50, 0.3, 'sawtooth', 0.08, 0.15);
  playNoise(0.2, 0.10);
  // Wobble for comedic effect
  playTone(90, 0.08, 'sawtooth', 0.06, 0.25);
  playTone(70, 0.08, 'sawtooth', 0.06, 0.30);
  playTone(55, 0.15, 'sawtooth', 0.05, 0.35);
}

function sfxAngryCatMeow() {
  // Aggressive yowl — fast rising screech then drops off
  playTone(400, 0.06, 'sawtooth', 0.12);
  playTone(900, 0.12, 'sawtooth', 0.14, 0.04);
  playTone(1100, 0.08, 'sine', 0.10, 0.10);
  playTone(700, 0.15, 'sawtooth', 0.12, 0.16);
  playTone(500, 0.12, 'sine', 0.08, 0.26);
  playNoise(0.06, 0.08); // hiss undertone
}

// ============================================
//  Canvas Resize — Adaptive Resolution
// ============================================
// Width stays at 480. Height adapts to fill the screen's aspect
// ratio so the game uses the full display on any device.
// On a phone (e.g. S24 at ~9:19.5) H becomes ~1040.
// On a 3:4 monitor, H stays ~640.

var isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// Helper: create a scaled font string
function sf(basePx) {
  return Math.round(basePx * FSCALE) + 'px "Press Start 2P", monospace';
}

function resizeCanvas() {
  var availW = window.innerWidth;
  var availH = window.innerHeight;

  // On desktop, account for title/hint text above canvas
  if (!isMobile) {
    var titleEl = document.getElementById('game-title');
    var hintEl = document.getElementById('game-hint');
    var extraH = 0;
    if (titleEl && titleEl.offsetHeight) extraH += titleEl.offsetHeight + 16;
    if (hintEl && hintEl.offsetHeight) extraH += hintEl.offsetHeight + 16;
    availH -= extraH;
  }

  // Calculate internal game height to match screen aspect ratio
  // Keep width at 480, scale height proportionally
  var screenAspect = availH / availW;
  GAME_H = Math.round(GAME_W * screenAspect);
  // Clamp to reasonable range
  if (GAME_H < 580) GAME_H = 580;
  if (GAME_H > 1200) GAME_H = 1200;

  W = GAME_W;
  H = GAME_H;

  // Set internal resolution
  canvas.width = W;
  canvas.height = H;

  // Set display size to fill screen
  // Calculate display size maintaining our computed aspect
  var displayAspect = W / H;
  var fitW = availW;
  var fitH = fitW / displayAspect;
  if (fitH > availH) {
    fitH = availH;
    fitW = fitH * displayAspect;
  }

  canvas.style.width = Math.floor(fitW) + 'px';
  canvas.style.height = Math.floor(fitH) + 'px';

  // Update hiss button position (it uses H)
  if (typeof updateHissBtnPosition === 'function') {
    updateHissBtnPosition();
  }

  // Rebuild stars for new dimensions
  if (typeof stars !== 'undefined' && stars.length > 0) {
    stars.length = 0;
    createStars();
  }

  // Reposition cat if it's off screen
  if (typeof cat !== 'undefined' && cat.y + CAT_SIZE > H) {
    cat.y = H - 80;
  }
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', function () {
  setTimeout(resizeCanvas, 150);
});

// ============================================
//  Fullscreen API
// ============================================
var isFullscreen = false;

function requestFullscreen() {
  var el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(function () {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen(); // Safari/iOS
  } else if (el.msRequestFullscreen) {
    el.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(function () {});
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    exitFullscreen();
  } else {
    requestFullscreen();
  }
}

function onFullscreenChange() {
  isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  setTimeout(resizeCanvas, 100);
}

document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

// Fullscreen button position (drawn on title screen)
var fullscreenBtn = { x: 0, y: 0, w: 0, h: 0 };

// Skin selector arrow hitboxes (title screen)
var skinArrowLeft = { x: 0, y: 0, w: 0, h: 0 };
var skinArrowRight = { x: 0, y: 0, w: 0, h: 0 };
var newSkinUnlocked = false; // set true on game over if new skin was unlocked

// ============================================
//  Input Tracking
// ============================================
const keys = {};
window.addEventListener('keydown', function (e) {
  keys[e.key] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
    e.preventDefault();
  }

  // Fullscreen toggle (F key) — works on any screen
  if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
    return;
  }

  // Title screen — arrow keys cycle skins
  if (gameState === 'title' && e.key === 'ArrowLeft') {
    cycleSkin(-1);
    return;
  }
  if (gameState === 'title' && e.key === 'ArrowRight') {
    cycleSkin(1);
    return;
  }

  // Title screen → start game
  if (e.key === 'Enter' && gameState === 'title') {
    initAudio();
    sfxStart();
    startGame();
    return;
  }

  // Game over → restart
  if (e.key === 'Enter' && gameState === 'gameover') {
    initAudio();
    restartGame();
    return;
  }

  // Spacebar activates Hiss Blast
  if (e.key === ' ' && gameState === 'playing') {
    initAudio();
    activateHissBlast();
  }
});
window.addEventListener('keyup', function (e) {
  keys[e.key] = false;
});

// ============================================
//  Mobile Touch Controls — Virtual Joystick
// ============================================
var touchState = { up: false, down: false, left: false, right: false };

// Joystick state
var joystick = {
  active: false,
  touchId: null,
  baseX: 0,       // center of joystick (game coords)
  baseY: 0,
  stickX: 0,      // current stick position (game coords)
  stickY: 0,
  dx: 0,          // normalized direction -1 to 1
  dy: 0,
  radius: 50,     // joystick outer radius
  deadzone: 8,    // minimum movement before registering
};

// Hiss button state (drawn on canvas)
var hissBtn = {
  x: 0, y: 0, radius: 35, pressed: false, touchId: null,
};

// Convert a touch's page coordinates to game (canvas) coordinates
function touchToGame(touch) {
  var rect = canvas.getBoundingClientRect();
  var scaleX = GAME_W / rect.width;
  var scaleY = GAME_H / rect.height;
  return {
    x: (touch.clientX - rect.left) * scaleX,
    y: (touch.clientY - rect.top) * scaleY,
  };
}

function updateHissBtnPosition() {
  hissBtn.x = W - 65;
  hissBtn.y = H - 75;
}
updateHissBtnPosition();

function isInsideHissBtn(gx, gy) {
  var dx = gx - hissBtn.x;
  var dy = gy - hissBtn.y;
  return (dx * dx + dy * dy) <= (hissBtn.radius + 10) * (hissBtn.radius + 10);
}

function handleTouchStart(e) {
  e.preventDefault();
  initAudio();

  for (var i = 0; i < e.changedTouches.length; i++) {
    var touch = e.changedTouches[i];
    var gp = touchToGame(touch);

    // Title screen
    if (gameState === 'title') {
      // Check fullscreen button
      if (gp.x >= fullscreenBtn.x && gp.x <= fullscreenBtn.x + fullscreenBtn.w &&
          gp.y >= fullscreenBtn.y && gp.y <= fullscreenBtn.y + fullscreenBtn.h) {
        toggleFullscreen();
        return;
      }
      // Check skin selector arrows
      if (countUnlockedSkins() > 1) {
        if (gp.x >= skinArrowLeft.x && gp.x <= skinArrowLeft.x + skinArrowLeft.w &&
            gp.y >= skinArrowLeft.y && gp.y <= skinArrowLeft.y + skinArrowLeft.h) {
          cycleSkin(-1);
          return;
        }
        if (gp.x >= skinArrowRight.x && gp.x <= skinArrowRight.x + skinArrowRight.w &&
            gp.y >= skinArrowRight.y && gp.y <= skinArrowRight.y + skinArrowRight.h) {
          cycleSkin(1);
          return;
        }
      }
      sfxStart();
      startGame();
      return;
    }

    // Game over — any tap restarts
    if (gameState === 'gameover') {
      restartGame();
      return;
    }

    // Playing state — check hiss button first (right side)
    if (gameState === 'playing') {
      if (isInsideHissBtn(gp.x, gp.y)) {
        hissBtn.pressed = true;
        hissBtn.touchId = touch.identifier;
        activateHissBlast();
        continue;
      }

      // Left side of screen = joystick zone
      if (!joystick.active && gp.x < W * 0.6) {
        joystick.active = true;
        joystick.touchId = touch.identifier;
        joystick.baseX = gp.x;
        joystick.baseY = gp.y;
        joystick.stickX = gp.x;
        joystick.stickY = gp.y;
        joystick.dx = 0;
        joystick.dy = 0;
      }
    }
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  for (var i = 0; i < e.changedTouches.length; i++) {
    var touch = e.changedTouches[i];

    if (joystick.active && touch.identifier === joystick.touchId) {
      var gp = touchToGame(touch);
      joystick.stickX = gp.x;
      joystick.stickY = gp.y;

      var rawDx = gp.x - joystick.baseX;
      var rawDy = gp.y - joystick.baseY;
      var dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

      if (dist < joystick.deadzone) {
        joystick.dx = 0;
        joystick.dy = 0;
      } else {
        // Clamp to joystick radius
        if (dist > joystick.radius) {
          rawDx = (rawDx / dist) * joystick.radius;
          rawDy = (rawDy / dist) * joystick.radius;
          joystick.stickX = joystick.baseX + rawDx;
          joystick.stickY = joystick.baseY + rawDy;
        }
        joystick.dx = rawDx / joystick.radius;
        joystick.dy = rawDy / joystick.radius;
      }
    }
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  for (var i = 0; i < e.changedTouches.length; i++) {
    var touch = e.changedTouches[i];

    if (joystick.active && touch.identifier === joystick.touchId) {
      joystick.active = false;
      joystick.touchId = null;
      joystick.dx = 0;
      joystick.dy = 0;
    }

    if (hissBtn.pressed && touch.identifier === hissBtn.touchId) {
      hissBtn.pressed = false;
      hissBtn.touchId = null;
    }
  }
}

canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

// Draw virtual joystick on canvas (called during game render)
function drawTouchControls() {
  if (!isMobile) return;
  if (gameState !== 'playing') return;

  ctx.save();

  // --- Joystick ---
  if (joystick.active) {
    // Outer ring
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystick.baseX, joystick.baseY, joystick.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner stick
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(joystick.stickX, joystick.stickY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Stick center dot
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ff6bef';
    ctx.beginPath();
    ctx.arc(joystick.stickX, joystick.stickY, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Show a subtle hint where to touch
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(90, H - 100, joystick.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffffff';
    ctx.font = sf(7);
    ctx.textAlign = 'center';
    ctx.fillText('TOUCH TO', 90, H - 105);
    ctx.fillText('MOVE', 90, H - 93);
  }

  // --- Hiss Blast Button ---
  var isReady = hissCooldownTimer <= 0;
  ctx.globalAlpha = isReady ? 0.5 : 0.2;

  // Button circle
  ctx.beginPath();
  ctx.arc(hissBtn.x, hissBtn.y, hissBtn.radius, 0, Math.PI * 2);

  if (isReady) {
    // Rainbow gradient fill when ready
    var grad = ctx.createRadialGradient(hissBtn.x, hissBtn.y, 0, hissBtn.x, hissBtn.y, hissBtn.radius);
    grad.addColorStop(0, '#FFD700');
    grad.addColorStop(0.5, '#FF6600');
    grad.addColorStop(1, '#FF006688');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = '#333355';
  }
  ctx.fill();

  // Button border
  ctx.globalAlpha = isReady ? 0.7 : 0.3;
  ctx.strokeStyle = isReady ? '#FFD700' : '#555577';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Button text
  ctx.globalAlpha = isReady ? 0.9 : 0.4;
  ctx.fillStyle = isReady ? '#FFFFFF' : '#888888';
  ctx.font = sf(8);
  ctx.textAlign = 'center';
  ctx.fillText('HISS', hissBtn.x, hissBtn.y - 2);
  ctx.font = sf(6);
  ctx.fillText('BLAST', hissBtn.x, hissBtn.y + 10);

  // Cooldown number overlay
  if (!isReady) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#00D4FF';
    ctx.font = sf(12);
    ctx.fillText(Math.ceil(hissCooldownTimer), hissBtn.x, hissBtn.y + 4);
  }

  ctx.restore();
}

// ============================================
//  Scrolling Starfield
// ============================================
const STAR_LAYERS = [
  { count: 40, speed: 0.3, size: 1, color: '#ffffff44' },
  { count: 25, speed: 0.8, size: 1.5, color: '#ffffff88' },
  { count: 15, speed: 1.6, size: 2, color: '#ffffffcc' },
];

const stars = [];

function createStars() {
  STAR_LAYERS.forEach(function (layer) {
    for (var i = 0; i < layer.count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: layer.speed,
        size: layer.size,
        color: layer.color,
      });
    }
  });
}

function updateStars() {
  stars.forEach(function (star) {
    star.y += star.speed;
    if (star.y > H) {
      star.y = 0;
      star.x = Math.random() * W;
    }
  });
}

function drawStars() {
  stars.forEach(function (star) {
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ============================================
//  Sparkles
// ============================================
const SPARKLE_COLORS = ['#ff6bef', '#45fffc', '#ffda45', '#6bff6b'];
const sparkles = [];

function spawnSparkle() {
  if (Math.random() < 0.02) {
    sparkles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      life: 1.0,
      color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    });
  }
}

function updateSparkles() {
  for (var i = sparkles.length - 1; i >= 0; i--) {
    sparkles[i].life -= 0.02;
    if (sparkles[i].life <= 0) sparkles.splice(i, 1);
  }
}

function drawSparkles() {
  sparkles.forEach(function (sp) {
    ctx.save();
    ctx.globalAlpha = sp.life;
    ctx.fillStyle = sp.color;
    var s = 3 * sp.life;
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y - s);
    ctx.lineTo(sp.x + s * 0.3, sp.y);
    ctx.lineTo(sp.x, sp.y + s);
    ctx.lineTo(sp.x - s * 0.3, sp.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sp.x - s, sp.y);
    ctx.lineTo(sp.x, sp.y + s * 0.3);
    ctx.lineTo(sp.x + s, sp.y);
    ctx.lineTo(sp.x, sp.y - s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

// ============================================
//  Cat Player
// ============================================
const CAT_SIZE = 40;
const CAT_SPEED = 300;

const cat = {
  x: 0, y: 0,
  w: CAT_SIZE, h: CAT_SIZE + 12,
  tailWag: 0,
};

function resetCat() {
  cat.x = W / 2 - CAT_SIZE / 2;
  cat.y = H - 80;
  cat.tailWag = 0;
}
resetCat();

function updateCat(dt) {
  // Keyboard input
  if (keys['ArrowLeft'])  cat.x -= CAT_SPEED * dt;
  if (keys['ArrowRight']) cat.x += CAT_SPEED * dt;
  if (keys['ArrowUp'])    cat.y -= CAT_SPEED * dt;
  if (keys['ArrowDown'])  cat.y += CAT_SPEED * dt;

  // Virtual joystick input (analog — speed scales with how far you drag)
  if (joystick.active) {
    cat.x += joystick.dx * CAT_SPEED * dt;
    cat.y += joystick.dy * CAT_SPEED * dt;
  }

  if (cat.x < 0) cat.x = 0;
  if (cat.x + CAT_SIZE > W) cat.x = W - CAT_SIZE;
  if (cat.y < 0) cat.y = 0;
  if (cat.y + CAT_SIZE > H) cat.y = H - CAT_SIZE;

  cat.tailWag += dt * 4;
}

function drawCat() {
  // Flash during invincibility
  if (invincibleTimer > 0) {
    if (Math.floor(invincibleTimer * invincibleFlashRate) % 2 === 0) return;
  }

  var sc = getSkinColors(); // current skin colors

  var cx = cat.x;
  var cy = cat.y;
  var midX = cx + CAT_SIZE / 2;

  // Chonk scale: body gets wider and rounder as burgers are eaten
  // chonkLevel 0 = normal, 1-3 = progressively fatter, 4 = max chonk (briefly before shrink)
  var chonkScale = 1 + chonkLevel * 0.15; // 1.0, 1.15, 1.3, 1.45, 1.6
  var bodyW = CAT_SIZE * chonkScale;
  var bodyH = CAT_SIZE * (1 + chonkLevel * 0.1);
  var bodyR = 8 + chonkLevel * 5; // gets rounder (more corner radius)
  if (bodyR > bodyW / 2) bodyR = bodyW / 2; // cap at circle
  var bodyX = midX - bodyW / 2;
  var bodyY = cy + (CAT_SIZE - bodyH) / 2; // center vertically

  // Tail
  ctx.save();
  ctx.strokeStyle = sc.body;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  var tailSwing = Math.sin(cat.tailWag) * 8;
  ctx.beginPath();
  ctx.moveTo(bodyX + bodyW - 2, bodyY + bodyH - 5);
  ctx.quadraticCurveTo(
    bodyX + bodyW + 15 + tailSwing, bodyY + bodyH - 15,
    bodyX + bodyW + 10 + tailSwing, bodyY + bodyH + 5
  );
  ctx.stroke();
  ctx.restore();

  // Ears (stay on top, scale slightly with chonk)
  var earSpread = 14 + chonkLevel * 2;
  ctx.fillStyle = sc.body;
  ctx.beginPath();
  ctx.moveTo(midX - earSpread, cy); ctx.lineTo(midX - earSpread - 6, cy - 14); ctx.lineTo(midX - earSpread + 8, cy - 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = sc.accent;
  ctx.beginPath();
  ctx.moveTo(midX - earSpread, cy + 1); ctx.lineTo(midX - earSpread - 4, cy - 10); ctx.lineTo(midX - earSpread + 5, cy - 2);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = sc.body;
  ctx.beginPath();
  ctx.moveTo(midX + earSpread, cy); ctx.lineTo(midX + earSpread + 6, cy - 14); ctx.lineTo(midX + earSpread - 8, cy - 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = sc.accent;
  ctx.beginPath();
  ctx.moveTo(midX + earSpread, cy + 1); ctx.lineTo(midX + earSpread + 4, cy - 10); ctx.lineTo(midX + earSpread - 5, cy - 2);
  ctx.closePath(); ctx.fill();

  // Body — gets rounder with each burger
  ctx.fillStyle = sc.body;
  // If fully chonked, draw as a circle for max roundness
  if (chonkLevel >= 4) {
    var circR = Math.max(bodyW, bodyH) / 2;
    ctx.beginPath();
    ctx.arc(midX, bodyY + bodyH / 2, circR, 0, Math.PI * 2);
    ctx.fill();
  } else {
    roundRect(bodyX, bodyY, bodyW, bodyH, bodyR);
  }

  // Chonk glow — pulsing outline when chonking up
  if (chonkLevel > 0 && !megaChonkActive) {
    ctx.save();
    var glowColors = ['#FFD700', '#FF8C00', '#FF4500', '#FF0000'];
    ctx.strokeStyle = glowColors[Math.min(chonkLevel - 1, 3)];
    ctx.lineWidth = 2;
    ctx.shadowColor = glowColors[Math.min(chonkLevel - 1, 3)];
    ctx.shadowBlur = 8 + Math.sin(Date.now() / 150) * 4;
    if (chonkLevel >= 4) {
      var circR2 = Math.max(bodyW, bodyH) / 2;
      ctx.beginPath();
      ctx.arc(midX, bodyY + bodyH / 2, circR2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = glowColors[Math.min(chonkLevel - 1, 3)];
      ctx.beginPath();
      ctx.moveTo(bodyX + bodyR, bodyY - 1);
      ctx.lineTo(bodyX + bodyW - bodyR, bodyY - 1);
      ctx.arcTo(bodyX + bodyW + 1, bodyY - 1, bodyX + bodyW + 1, bodyY + bodyR, bodyR);
      ctx.lineTo(bodyX + bodyW + 1, bodyY + bodyH - bodyR);
      ctx.arcTo(bodyX + bodyW + 1, bodyY + bodyH + 1, bodyX + bodyW - bodyR, bodyY + bodyH + 1, bodyR);
      ctx.lineTo(bodyX + bodyR, bodyY + bodyH + 1);
      ctx.arcTo(bodyX - 1, bodyY + bodyH + 1, bodyX - 1, bodyY + bodyH - bodyR, bodyR);
      ctx.lineTo(bodyX - 1, bodyY + bodyR);
      ctx.arcTo(bodyX - 1, bodyY - 1, bodyX + bodyR, bodyY - 1, bodyR);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Belly highlight (scales with body)
  ctx.fillStyle = sc.belly;
  var bellyW = (bodyW - 20) * 0.6;
  var bellyH = 16 + chonkLevel * 3;
  roundRect(midX - bellyW / 2, bodyY + bodyH * 0.45, bellyW, bellyH, 5);

  // Eyes — glow red during mega chonk laser mode!
  var eyeY = bodyY + bodyH * 0.3;
  var eyeSpread = 9 + chonkLevel * 1.5;

  if (megaChonkActive) {
    // LASER EYES! Red glowing
    ctx.fillStyle = '#FF0000';
    ctx.shadowColor = '#FF0000';
    ctx.shadowBlur = 12 + Math.sin(Date.now() / 80) * 4;
    ctx.beginPath(); ctx.arc(midX - eyeSpread, eyeY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(midX + eyeSpread, eyeY, 6, 0, Math.PI * 2); ctx.fill();
    // White hot center
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(midX - eyeSpread, eyeY, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(midX + eyeSpread, eyeY, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // Normal eyes
    ctx.fillStyle = sc.accent;
    ctx.beginPath(); ctx.arc(midX - eyeSpread, eyeY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(midX - eyeSpread, eyeY + 1, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(midX - eyeSpread + 2, eyeY - 1, 1.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = sc.accent;
    ctx.beginPath(); ctx.arc(midX + eyeSpread, eyeY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(midX + eyeSpread, eyeY + 1, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(midX + eyeSpread + 2, eyeY - 1, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // Nose
  var noseY = bodyY + bodyH * 0.5;
  ctx.fillStyle = sc.body;
  ctx.beginPath();
  ctx.moveTo(midX - 2, noseY); ctx.lineTo(midX + 2, noseY); ctx.lineTo(midX, noseY + 2);
  ctx.closePath(); ctx.fill();

  // Whiskers
  var whiskY = noseY;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(midX - 12, whiskY); ctx.lineTo(midX - 24 - chonkLevel * 2, whiskY - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(midX - 12, whiskY + 2); ctx.lineTo(midX - 24 - chonkLevel * 2, whiskY + 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(midX + 12, whiskY); ctx.lineTo(midX + 24 + chonkLevel * 2, whiskY - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(midX + 12, whiskY + 2); ctx.lineTo(midX + 24 + chonkLevel * 2, whiskY + 3); ctx.stroke();

  // Paws (at bottom of expanded body)
  ctx.fillStyle = sc.paws;
  ctx.beginPath(); ctx.arc(bodyX + 8, bodyY + bodyH, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(bodyX + bodyW - 8, bodyY + bodyH, 4, 0, Math.PI * 2); ctx.fill();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

// ============================================
//  Vacuums — Falling obstacles
// ============================================
const VACUUM_W = 36;
const VACUUM_H = 44;
const VACUUM_BASE_MIN_SPEED = 120;    // increased base speeds for more difficulty
const VACUUM_BASE_MAX_SPEED = 320;

let vacuumMinSpeed = VACUUM_BASE_MIN_SPEED;
let vacuumMaxSpeed = VACUUM_BASE_MAX_SPEED;

let vacuumSpawnTimer = 0;
let vacuumSpawnInterval = 0.8;        // start faster than before
const VACUUM_MIN_INTERVAL = 0.15;     // can get very hectic
const VACUUM_INTERVAL_DECAY = 0.008;  // ramps up faster
let vacuumSpawnRate = 0;

const vacuums = [];

function spawnVacuum() {
  var speed = vacuumMinSpeed + Math.random() * (vacuumMaxSpeed - vacuumMinSpeed);
  vacuums.push({
    x: Math.random() * (W - VACUUM_W),
    y: -VACUUM_H,
    w: VACUUM_W,
    h: VACUUM_H,
    speed: speed,
    wobble: Math.random() * Math.PI * 2,
  });
}

function updateVacuums(dt) {
  vacuumSpawnInterval = Math.max(
    VACUUM_MIN_INTERVAL,
    vacuumSpawnInterval - VACUUM_INTERVAL_DECAY * dt
  );
  vacuumSpawnRate = (1 / vacuumSpawnInterval).toFixed(1);

  // Gradually increase speeds over time
  vacuumMinSpeed = VACUUM_BASE_MIN_SPEED + score * 1.5;
  vacuumMaxSpeed = VACUUM_BASE_MAX_SPEED + score * 2;

  vacuumSpawnTimer += dt;
  if (vacuumSpawnTimer >= vacuumSpawnInterval) {
    vacuumSpawnTimer -= vacuumSpawnInterval;
    spawnVacuum();
  }

  for (var i = vacuums.length - 1; i >= 0; i--) {
    var v = vacuums[i];
    v.y += v.speed * dt;
    v.wobble += dt * 3;
    if (v.y > H + 10) {
      vacuums.splice(i, 1);
    }
  }
}

function drawVacuum(v) {
  var vx = v.x;
  var vy = v.y;
  var midX = vx + VACUUM_W / 2;
  var speedRatio = (v.speed - vacuumMinSpeed) / (vacuumMaxSpeed - vacuumMinSpeed + 1);
  var isFast = speedRatio > 0.5;
  var bodyColor = isFast ? '#FF0000' : '#808080';
  var darkShade = isFast ? '#cc0000' : '#606060';
  var lightShade = isFast ? '#ff4444' : '#a0a0a0';
  var accentColor = isFast ? '#FFD700' : '#c0c0c0';
  var wobbleX = Math.sin(v.wobble) * 2;

  ctx.save();
  ctx.translate(wobbleX, 0);

  ctx.fillStyle = darkShade;
  ctx.fillRect(midX - 3, vy, 6, 20);
  ctx.fillStyle = accentColor;
  roundRect(midX - 6, vy - 2, 12, 8, 3);
  ctx.fillStyle = bodyColor;
  roundRect(vx + 2, vy + 18, VACUUM_W - 4, 18, 4);
  ctx.fillStyle = lightShade;
  ctx.fillRect(vx + 6, vy + 22, VACUUM_W - 12, 4);
  ctx.fillStyle = '#333333';
  roundRect(vx, vy + 34, VACUUM_W, 8, 3);

  ctx.strokeStyle = isFast ? '#ff6666' : '#999999';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6 + Math.sin(v.wobble * 2) * 0.3;
  for (var line = 0; line < 3; line++) {
    var lx = vx + 8 + line * 10;
    ctx.beginPath();
    ctx.moveTo(lx, vy + 42);
    ctx.lineTo(lx, vy + 42 + 4 + Math.sin(v.wobble + line) * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(midX - 8, vy + 24, 4, 4);
  ctx.fillRect(midX + 4, vy + 24, 4, 4);
  if (isFast) {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(midX - 9, vy + 22, 6, 2);
    ctx.fillRect(midX + 3, vy + 22, 6, 2);
  }

  if (isFast) {
    ctx.shadowColor = '#FF0000';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#FF000044';
    ctx.lineWidth = 2;
    ctx.strokeRect(vx, vy + 17, VACUUM_W, 26);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawVacuums() {
  vacuums.forEach(drawVacuum);
}

function resetVacuums() {
  vacuums.length = 0;
  vacuumSpawnTimer = 0;
  vacuumSpawnInterval = 0.8;
  vacuumSpawnRate = 0;
  vacuumMinSpeed = VACUUM_BASE_MIN_SPEED;
  vacuumMaxSpeed = VACUUM_BASE_MAX_SPEED;
}

// ============================================
//  Collectible Food Items (Pizza & Donuts)
// ============================================
const collectibles = [];
let collectibleSpawnTimer = 0;
let collectibleSpawnInterval = 3.5; // seconds between spawns

const COLLECT_SIZE = 24;
const COLLECT_SPEED = 100; // fall speed

// Score popup texts
const scorePopups = [];

function spawnCollectible() {
  var roll = Math.random();
  var type, points;
  if (roll < 0.25 && chonkBurgers < CHONK_BURGERS_NEEDED && !megaChonkActive) {
    // 25% chance for cheeseburger (only if not already fully chonked or firing)
    type = 'burger';
    points = 40;
  } else if (roll < 0.625) {
    type = 'pizza';
    points = 50;
  } else {
    type = 'donut';
    points = 30;
  }
  collectibles.push({
    x: Math.random() * (W - COLLECT_SIZE),
    y: -COLLECT_SIZE,
    w: COLLECT_SIZE,
    h: COLLECT_SIZE,
    type: type,
    points: points,
    wobble: Math.random() * Math.PI * 2,
    speed: COLLECT_SPEED + Math.random() * 40,
  });
}

function updateCollectibles(dt) {
  collectibleSpawnTimer += dt;
  if (collectibleSpawnTimer >= collectibleSpawnInterval) {
    collectibleSpawnTimer -= collectibleSpawnInterval;
    spawnCollectible();
  }

  for (var i = collectibles.length - 1; i >= 0; i--) {
    var c = collectibles[i];
    c.y += c.speed * dt;
    c.wobble += dt * 3;

    // Check collision with cat
    if (checkAABBCollision(cat, c)) {
      bonusScore += c.points;

      if (c.type === 'burger') {
        sfxBurgerCollect();
        chonkBurgers++;
        chonkLevel = chonkBurgers;

        // Score popup with burger-specific text
        var burgerMsg = chonkBurgers < CHONK_BURGERS_NEEDED
          ? '+' + c.points + ' CHONK ' + chonkBurgers + '/' + CHONK_BURGERS_NEEDED
          : 'MEGA CHONK!';
        scorePopups.push({
          x: c.x + COLLECT_SIZE / 2,
          y: c.y,
          text: burgerMsg,
          life: 1.5,
          color: '#FF8C00',
        });

        // If we hit 4 burgers, trigger MEGA CHONK MODE!
        if (chonkBurgers >= CHONK_BURGERS_NEEDED) {
          activateMegaChonk();
        }
      } else {
        sfxCollect();
        scorePopups.push({
          x: c.x + COLLECT_SIZE / 2,
          y: c.y,
          text: '+' + c.points,
          life: 1.0,
          color: c.type === 'pizza' ? '#FFD700' : '#FF69B4',
        });
      }
      collectibles.splice(i, 1);
      continue;
    }

    if (c.y > H + 10) {
      collectibles.splice(i, 1);
    }
  }

  // Update score popups
  for (var j = scorePopups.length - 1; j >= 0; j--) {
    scorePopups[j].life -= dt * 1.5;
    scorePopups[j].y -= 40 * dt;
    if (scorePopups[j].life <= 0) scorePopups.splice(j, 1);
  }
}

function drawPizza(x, y, size, wobble) {
  var cx = x + size / 2;
  var cy = y + size / 2;
  var r = size / 2 - 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(wobble) * 0.1);
  ctx.translate(-cx, -cy);

  // Pizza slice triangle shape
  ctx.fillStyle = '#FFD700'; // cheese/crust
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy + r);
  ctx.lineTo(cx - r, cy + r);
  ctx.closePath();
  ctx.fill();

  // Sauce layer
  ctx.fillStyle = '#FF4500';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 4);
  ctx.lineTo(cx + r - 3, cy + r - 2);
  ctx.lineTo(cx - r + 3, cy + r - 2);
  ctx.closePath();
  ctx.fill();

  // Cheese on top
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 7);
  ctx.lineTo(cx + r - 5, cy + r - 4);
  ctx.lineTo(cx - r + 5, cy + r - 4);
  ctx.closePath();
  ctx.fill();

  // Pepperoni dots
  ctx.fillStyle = '#CC0000';
  ctx.beginPath(); ctx.arc(cx - 3, cy + 2, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 4, cy + 5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy + 8, 2, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawDonut(x, y, size, wobble) {
  var cx = x + size / 2;
  var cy = y + size / 2;
  var outerR = size / 2 - 2;
  var innerR = outerR * 0.35;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(wobble) * 0.15);
  ctx.translate(-cx, -cy);

  // Donut body (pink frosting)
  ctx.fillStyle = '#FF69B4';
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  // Donut hole
  ctx.fillStyle = '#0d0d24'; // match background
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();

  // Sprinkles!
  var sprinkleColors = ['#FF0000', '#00FF00', '#0088FF', '#FFD700', '#FF6600', '#AA00FF'];
  var sprinkleAngles = [0.3, 0.9, 1.5, 2.2, 2.8, 3.6, 4.2, 4.9, 5.5];
  for (var i = 0; i < sprinkleAngles.length; i++) {
    var a = sprinkleAngles[i] + wobble * 0.1;
    var sr = outerR * 0.65;
    var sx = cx + Math.cos(a) * sr;
    var sy = cy + Math.sin(a) * sr;
    ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a + 0.5);
    ctx.fillRect(-1.5, -0.8, 3, 1.6);
    ctx.restore();
  }

  ctx.restore();
}

function drawCheeseburger(x, y, size, wobble) {
  var cx = x + size / 2;
  var cy = y + size / 2;
  var r = size / 2 - 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(wobble) * 0.08);
  ctx.translate(-cx, -cy);

  // Golden glow around cheeseburger (it's special!)
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 8 + Math.sin(wobble * 2) * 3;

  // Top bun (rounded dome)
  ctx.fillStyle = '#D2691E';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.15, r * 0.85, Math.PI, 0);
  ctx.lineTo(cx + r * 0.85, cy - r * 0.05);
  ctx.lineTo(cx - r * 0.85, cy - r * 0.05);
  ctx.closePath();
  ctx.fill();

  // Sesame seeds on bun
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFF8DC';
  ctx.beginPath(); ctx.ellipse(cx - 3, cy - r * 0.4, 1.5, 1, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 4, cy - r * 0.35, 1.5, 1, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.55, 1.5, 1, 0, 0, Math.PI * 2); ctx.fill();

  // Lettuce (green wavy)
  ctx.fillStyle = '#32CD32';
  ctx.beginPath();
  for (var i = 0; i < 7; i++) {
    var lx = cx - r * 0.9 + (r * 1.8 / 7) * i;
    var ly = cy + r * 0.0 + Math.sin(i * 1.2 + wobble) * 1.5;
    if (i === 0) ctx.moveTo(lx, ly);
    else ctx.lineTo(lx, ly);
  }
  ctx.lineTo(cx + r * 0.9, cy + r * 0.1);
  ctx.lineTo(cx - r * 0.9, cy + r * 0.1);
  ctx.closePath();
  ctx.fill();

  // Cheese (yellow, slightly melty and overhanging)
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.95, cy + r * 0.05);
  ctx.lineTo(cx + r * 0.95, cy + r * 0.05);
  ctx.lineTo(cx + r * 0.9, cy + r * 0.25);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.3); // cheese drip
  ctx.lineTo(cx + r * 0.6, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.6, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.7, cy + r * 0.35); // cheese drip
  ctx.lineTo(cx - r * 0.85, cy + r * 0.25);
  ctx.closePath();
  ctx.fill();

  // Patty (brown)
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(cx - r * 0.75, cy + r * 0.15, r * 1.5, r * 0.25);

  // Bottom bun
  ctx.fillStyle = '#D2691E';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, cy + r * 0.35);
  ctx.lineTo(cx + r * 0.85, cy + r * 0.35);
  ctx.arc(cx, cy + r * 0.35, r * 0.85, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCollectibles() {
  collectibles.forEach(function (c) {
    if (c.type === 'pizza') {
      drawPizza(c.x, c.y, COLLECT_SIZE, c.wobble);
    } else if (c.type === 'donut') {
      drawDonut(c.x, c.y, COLLECT_SIZE, c.wobble);
    } else if (c.type === 'burger') {
      drawCheeseburger(c.x, c.y, COLLECT_SIZE, c.wobble);
    }
  });

  // Draw score popups
  scorePopups.forEach(function (p) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.font = sf(10);
    ctx.textAlign = 'center';
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  });
}

function resetCollectibles() {
  collectibles.length = 0;
  collectibleSpawnTimer = 0;
  scorePopups.length = 0;
}

// ============================================
//  Collision Detection (AABB)
// ============================================
const COLLISION_PADDING = 4;

function checkAABBCollision(a, b) {
  var ax = a.x + COLLISION_PADDING;
  var ay = a.y + COLLISION_PADDING;
  var aw = a.w - COLLISION_PADDING * 2;
  var ah = a.h - COLLISION_PADDING * 2;
  var bx = b.x + COLLISION_PADDING;
  var by = b.y + COLLISION_PADDING;
  var bw = b.w - COLLISION_PADDING * 2;
  var bh = b.h - COLLISION_PADDING * 2;

  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function checkAllCollisions() {
  if (invincibleTimer > 0) return; // can't be hit during invincibility

  for (var i = 0; i < vacuums.length; i++) {
    if (checkAABBCollision(cat, vacuums[i])) {
      lives--;
      sfxHit();
      sfxAngryCatMeow();

      // Remove the vacuum that hit us
      vacuums.splice(i, 1);

      if (lives <= 0) {
        triggerGameOver();
      } else {
        // Start invincibility window
        invincibleTimer = INVINCIBLE_DURATION;
        collisionFlashTimer = COLLISION_FLASH_DURATION;
        canvas.classList.add('shake');
        setTimeout(function () { canvas.classList.remove('shake'); }, 200);
      }
      return;
    }
  }
}

// ============================================
//  Collision Flash Effect
// ============================================
let collisionFlashTimer = 0;
const COLLISION_FLASH_DURATION = 0.35;

function drawCollisionFlash() {
  if (collisionFlashTimer > 0) {
    var alpha = collisionFlashTimer / COLLISION_FLASH_DURATION;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 110, ' + (alpha * 0.5) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ============================================
//  Wave / Milestone System
// ============================================
const WAVES = [
  { time: 0,  name: 'Wave 1', subtitle: 'Warm Up!', color: '#00FF41' },
  { time: 10, name: 'Wave 2', subtitle: 'Getting Hairy!', color: '#45fffc' },
  { time: 25, name: 'Wave 3', subtitle: 'Vacuum Frenzy!', color: '#FFD700' },
  { time: 45, name: 'Wave 4', subtitle: 'Turbo Suction!', color: '#FF6600' },
  { time: 70, name: 'Wave 5', subtitle: 'MAXIMUM CHAOS!', color: '#FF0066' },
  { time: 100, name: 'Wave 6', subtitle: 'Cat Legend Mode!', color: '#AA00FF' },
  { time: 140, name: 'Wave 7', subtitle: 'IMPOSSIBLE!', color: '#FF0000' },
];

let currentWave = 0;
let waveAnnouncementTimer = 0;
const WAVE_ANNOUNCE_DURATION = 4; // seconds the wave text shows (with fade)
let waveAnnounceName = '';
let waveAnnounceSubtitle = '';
let waveAnnounceColor = '';

function checkWaveProgress() {
  if (currentWave < WAVES.length - 1) {
    var nextWave = WAVES[currentWave + 1];
    if (score >= nextWave.time) {
      currentWave++;
      waveAnnouncementTimer = WAVE_ANNOUNCE_DURATION;
      waveAnnounceName = nextWave.name;
      waveAnnounceSubtitle = nextWave.subtitle;
      waveAnnounceColor = nextWave.color;
      sfxWave();
    }
  }
}

function updateWaveAnnouncement(dt) {
  if (waveAnnouncementTimer > 0) {
    waveAnnouncementTimer -= dt;
  }
}

function drawWaveAnnouncement() {
  if (waveAnnouncementTimer <= 0) return;

  var alpha;
  // Fade in for first 0.5s, stay for 2s, fade out for last 1.5s
  if (waveAnnouncementTimer > WAVE_ANNOUNCE_DURATION - 0.5) {
    alpha = (WAVE_ANNOUNCE_DURATION - waveAnnouncementTimer) / 0.5;
  } else if (waveAnnouncementTimer > 1.5) {
    alpha = 1;
  } else {
    alpha = waveAnnouncementTimer / 1.5;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // Wave name (big)
  ctx.fillStyle = waveAnnounceColor;
  ctx.font = sf(18);
  ctx.textAlign = 'center';
  ctx.shadowColor = waveAnnounceColor;
  ctx.shadowBlur = 20;
  ctx.fillText(waveAnnounceName, W / 2, H / 2 - 30);

  // Subtitle
  ctx.font = sf(10);
  ctx.fillText(waveAnnounceSubtitle, W / 2, H / 2);

  ctx.restore();
}

function resetWaves() {
  currentWave = 0;
  waveAnnouncementTimer = WAVE_ANNOUNCE_DURATION;
  waveAnnounceName = WAVES[0].name;
  waveAnnounceSubtitle = WAVES[0].subtitle;
  waveAnnounceColor = WAVES[0].color;
}

// ============================================
//  Hiss Blast — Rainbow Shockwave!
// ============================================
const HISS_COOLDOWN = 8;
let hissCooldownTimer = 0;
let hissBlastActive = false;

const hissRings = [];
const hissParticles = [];

const RAINBOW_COLORS = ['#FF0000', '#FF7700', '#FFDD00', '#00FF41', '#0088FF', '#4400FF', '#8800FF'];
const HISS_PARTICLE_COLORS = ['#FF0000', '#FF7700', '#FFDD00', '#00FF41', '#0088FF', '#8800FF', '#FF1493'];

function activateHissBlast() {
  if (gameState !== 'playing') return;
  if (hissCooldownTimer > 0) return;

  sfxHiss();
  hissBlastActive = true;
  hissCooldownTimer = HISS_COOLDOWN;

  var catCenterX = cat.x + CAT_SIZE / 2;
  var catCenterY = cat.y + CAT_SIZE / 2;

  // Create rainbow rings — one ring per rainbow color
  for (var i = 0; i < RAINBOW_COLORS.length; i++) {
    hissRings.push({
      x: catCenterX,
      y: catCenterY,
      radius: 8 + i * 6,
      maxRadius: 400,
      life: 1.0,
      speed: 350 + i * 40,
      lineWidth: 5 - i * 0.4,
      color: RAINBOW_COLORS[i],
    });
  }

  // Burst particles in rainbow colors
  for (var j = 0; j < 30; j++) {
    var angle = (Math.PI * 2 / 30) * j + (Math.random() - 0.5) * 0.3;
    var speed = 200 + Math.random() * 300;
    hissParticles.push({
      x: catCenterX,
      y: catCenterY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      size: 3 + Math.random() * 4,
      color: HISS_PARTICLE_COLORS[Math.floor(Math.random() * HISS_PARTICLE_COLORS.length)],
    });
  }

  // Destroy all vacuums!
  vacuums.length = 0;

  canvas.classList.add('shake');
  setTimeout(function () { canvas.classList.remove('shake'); }, 200);
}

function updateHissBlast(dt) {
  if (hissCooldownTimer > 0) {
    hissCooldownTimer -= dt;
    if (hissCooldownTimer < 0) hissCooldownTimer = 0;
  }

  for (var i = hissRings.length - 1; i >= 0; i--) {
    var ring = hissRings[i];
    ring.radius += ring.speed * dt;
    ring.life -= dt * 1.5;
    if (ring.life <= 0 || ring.radius > ring.maxRadius) {
      hissRings.splice(i, 1);
    }
  }

  for (var j = hissParticles.length - 1; j >= 0; j--) {
    var p = hissParticles[j];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 2.0;
    p.size *= 0.98;
    if (p.life <= 0) {
      hissParticles.splice(j, 1);
    }
  }

  if (hissBlastActive && hissRings.length === 0 && hissParticles.length === 0) {
    hissBlastActive = false;
  }
}

function drawHissBlast() {
  // Draw rainbow rings
  for (var i = 0; i < hissRings.length; i++) {
    var ring = hissRings[i];
    ctx.save();
    ctx.globalAlpha = ring.life * 0.85;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.lineWidth * ring.life;
    ctx.shadowColor = ring.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner glow ring
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = ring.lineWidth * ring.life * 0.3;
    ctx.globalAlpha = ring.life * 0.3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius * 0.97, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw particles
  for (var j = 0; j < hissParticles.length; j++) {
    var p = hissParticles[j];
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCooldownBar() {
  var barW = 180;
  var barH = 14;
  var barX = W / 2 - barW / 2;
  var barY = H - 28;

  var fillRatio = 1 - (hissCooldownTimer / HISS_COOLDOWN);
  var isReady = hissCooldownTimer <= 0;

  ctx.save();

  // Background
  ctx.fillStyle = '#1a1a3e';
  roundRect(barX, barY, barW, barH, 4);
  ctx.strokeStyle = '#333366';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(barX + 4, barY);
  ctx.lineTo(barX + barW - 4, barY);
  ctx.arcTo(barX + barW, barY, barX + barW, barY + 4, 4);
  ctx.lineTo(barX + barW, barY + barH - 4);
  ctx.arcTo(barX + barW, barY + barH, barX + barW - 4, barY + barH, 4);
  ctx.lineTo(barX + 4, barY + barH);
  ctx.arcTo(barX, barY + barH, barX, barY + barH - 4, 4);
  ctx.lineTo(barX, barY + 4);
  ctx.arcTo(barX, barY, barX + 4, barY, 4);
  ctx.closePath();
  ctx.stroke();

  // Fill bar — rainbow gradient when charging!
  if (fillRatio > 0) {
    var fillW = Math.max(0, (barW - 4) * fillRatio);
    var grad = ctx.createLinearGradient(barX + 2, 0, barX + 2 + fillW, 0);
    grad.addColorStop(0, '#FF0000');
    grad.addColorStop(0.16, '#FF7700');
    grad.addColorStop(0.33, '#FFDD00');
    grad.addColorStop(0.5, '#00FF41');
    grad.addColorStop(0.66, '#0088FF');
    grad.addColorStop(0.83, '#4400FF');
    grad.addColorStop(1, '#8800FF');
    ctx.fillStyle = grad;

    if (isReady) {
      ctx.shadowColor = '#FF69B4';
      ctx.shadowBlur = 12 + Math.sin(Date.now() / 200) * 4;
    }

    ctx.beginPath();
    var fR = 3;
    var fx = barX + 2;
    var fy = barY + 2;
    var fh = barH - 4;
    ctx.moveTo(fx + fR, fy);
    ctx.lineTo(fx + fillW - fR, fy);
    ctx.arcTo(fx + fillW, fy, fx + fillW, fy + fR, fR);
    ctx.lineTo(fx + fillW, fy + fh - fR);
    ctx.arcTo(fx + fillW, fy + fh, fx + fillW - fR, fy + fh, fR);
    ctx.lineTo(fx + fR, fy + fh);
    ctx.arcTo(fx, fy + fh, fx, fy + fh - fR, fR);
    ctx.lineTo(fx, fy + fR);
    ctx.arcTo(fx, fy, fx + fR, fy, fR);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Label
  ctx.font = sf(8);
  ctx.textAlign = 'right';
  if (isReady) {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 8 + Math.sin(Date.now() / 300) * 3;
    ctx.fillStyle = '#FFD700';
    ctx.fillText('HISS BLAST', barX - 8, barY + 11);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#666688';
    ctx.fillText('HISS BLAST', barX - 8, barY + 11);
  }

  // Timer / Ready
  ctx.font = sf(7);
  ctx.textAlign = 'left';
  if (isReady) {
    if (Math.floor(Date.now() / 400) % 2 === 0) {
      ctx.fillStyle = '#00FF41';
      ctx.shadowColor = '#00FF41';
      ctx.shadowBlur = 6;
      ctx.fillText('READY!', barX + barW + 8, barY + 11);
      ctx.shadowBlur = 0;
    }
  } else {
    ctx.fillStyle = '#00D4FF';
    ctx.fillText(Math.ceil(hissCooldownTimer) + 's', barX + barW + 8, barY + 11);
  }

  ctx.restore();
}

function resetHissBlast() {
  hissCooldownTimer = 0;
  hissBlastActive = false;
  hissRings.length = 0;
  hissParticles.length = 0;
}

// ============================================
//  MEGA CHONK MODE — Laser Eye Beams!
// ============================================

function activateMegaChonk() {
  sfxMegaChonk();
  sfxFart();
  // Brief shrink animation before lasers start
  chonkShrinkTimer = CHONK_SHRINK_DURATION;
  chonkAnnouncementTimer = CHONK_ANNOUNCE_DURATION;

  canvas.classList.add('shake');
  setTimeout(function () { canvas.classList.remove('shake'); }, 300);
}

function startLasers() {
  megaChonkActive = true;
  megaChonkTimer = CHONK_LASER_DURATION;
  chonkLevel = 0; // body shrinks back to normal
  chonkBurgers = 0; // reset burger count
}

function updateMegaChonk(dt) {
  // Handle shrink animation before laser activation
  if (chonkShrinkTimer > 0) {
    chonkShrinkTimer -= dt;
    // Animate chonk level shrinking from 4 to 0
    chonkLevel = Math.ceil(4 * (chonkShrinkTimer / CHONK_SHRINK_DURATION));
    if (chonkShrinkTimer <= 0) {
      chonkShrinkTimer = 0;
      startLasers();
    }
    return;
  }

  if (!megaChonkActive) return;

  megaChonkTimer -= dt;
  if (megaChonkTimer <= 0) {
    megaChonkActive = false;
    megaChonkTimer = 0;
    return;
  }

  // Laser beam collision with vacuums — two beams going straight up from eyes
  var midX = cat.x + CAT_SIZE / 2;
  var eyeSpread = 9;
  var laserLeftX = midX - eyeSpread;
  var laserRightX = midX + eyeSpread;
  var laserWidth = 10; // beam width for collision
  var eyeY = cat.y + CAT_SIZE * 0.3;

  for (var i = vacuums.length - 1; i >= 0; i--) {
    var v = vacuums[i];
    var vacMidX = v.x + VACUUM_W / 2;
    var vacBottom = v.y + VACUUM_H;

    // Check if vacuum is above the cat and in the beam path
    if (vacBottom < eyeY + 5) {
      var hitLeft = Math.abs(vacMidX - laserLeftX) < (VACUUM_W / 2 + laserWidth / 2);
      var hitRight = Math.abs(vacMidX - laserRightX) < (VACUUM_W / 2 + laserWidth / 2);

      if (hitLeft || hitRight) {
        // Vacuum destroyed by laser!
        sfxLaserZap();
        bonusScore += 10; // bonus for laser kills

        // Create explosion particles at vacuum position
        for (var p = 0; p < 8; p++) {
          var angle = (Math.PI * 2 / 8) * p;
          laserExplosions.push({
            x: v.x + VACUUM_W / 2,
            y: v.y + VACUUM_H / 2,
            vx: Math.cos(angle) * (100 + Math.random() * 100),
            vy: Math.sin(angle) * (100 + Math.random() * 100),
            life: 1.0,
            size: 3 + Math.random() * 3,
            color: ['#FF4444', '#FF8800', '#FFDD00', '#FFFFFF'][Math.floor(Math.random() * 4)],
          });
        }

        // Score popup
        scorePopups.push({
          x: v.x + VACUUM_W / 2,
          y: v.y,
          text: '+10 ZAP!',
          life: 0.8,
          color: '#FF4444',
        });

        vacuums.splice(i, 1);
      }
    }
  }

  // Update laser explosion particles
  for (var j = laserExplosions.length - 1; j >= 0; j--) {
    var ex = laserExplosions[j];
    ex.x += ex.vx * dt;
    ex.y += ex.vy * dt;
    ex.life -= dt * 2.5;
    ex.size *= 0.97;
    if (ex.life <= 0) laserExplosions.splice(j, 1);
  }

  // Update announcement
  if (chonkAnnouncementTimer > 0) {
    chonkAnnouncementTimer -= dt;
  }
}

function drawLaserBeams() {
  if (!megaChonkActive) return;

  var midX = cat.x + CAT_SIZE / 2;
  var eyeSpread = 9;
  var eyeY = cat.y + CAT_SIZE * 0.3;

  // Flickering beam intensity
  var flicker = 0.7 + Math.sin(Date.now() / 30) * 0.15 + Math.sin(Date.now() / 17) * 0.15;

  ctx.save();

  // Left laser beam
  var leftEyeX = midX - eyeSpread;
  var grad1 = ctx.createLinearGradient(leftEyeX, eyeY, leftEyeX, 0);
  grad1.addColorStop(0, 'rgba(255, 0, 0, ' + flicker + ')');
  grad1.addColorStop(0.3, 'rgba(255, 80, 0, ' + (flicker * 0.8) + ')');
  grad1.addColorStop(1, 'rgba(255, 0, 0, 0.1)');

  // Outer glow (wide)
  ctx.fillStyle = grad1;
  ctx.shadowColor = '#FF0000';
  ctx.shadowBlur = 20;
  ctx.fillRect(leftEyeX - 6, 0, 12, eyeY);

  // Core beam (narrow, bright white-hot)
  var grad1inner = ctx.createLinearGradient(leftEyeX, eyeY, leftEyeX, 0);
  grad1inner.addColorStop(0, 'rgba(255, 255, 255, ' + flicker + ')');
  grad1inner.addColorStop(0.5, 'rgba(255, 200, 100, ' + (flicker * 0.6) + ')');
  grad1inner.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  ctx.fillStyle = grad1inner;
  ctx.shadowBlur = 8;
  ctx.fillRect(leftEyeX - 2, 0, 4, eyeY);

  // Right laser beam
  var rightEyeX = midX + eyeSpread;
  var grad2 = ctx.createLinearGradient(rightEyeX, eyeY, rightEyeX, 0);
  grad2.addColorStop(0, 'rgba(255, 0, 0, ' + flicker + ')');
  grad2.addColorStop(0.3, 'rgba(255, 80, 0, ' + (flicker * 0.8) + ')');
  grad2.addColorStop(1, 'rgba(255, 0, 0, 0.1)');

  ctx.fillStyle = grad2;
  ctx.shadowColor = '#FF0000';
  ctx.shadowBlur = 20;
  ctx.fillRect(rightEyeX - 6, 0, 12, eyeY);

  var grad2inner = ctx.createLinearGradient(rightEyeX, eyeY, rightEyeX, 0);
  grad2inner.addColorStop(0, 'rgba(255, 255, 255, ' + flicker + ')');
  grad2inner.addColorStop(0.5, 'rgba(255, 200, 100, ' + (flicker * 0.6) + ')');
  grad2inner.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  ctx.fillStyle = grad2inner;
  ctx.shadowBlur = 8;
  ctx.fillRect(rightEyeX - 2, 0, 4, eyeY);

  ctx.shadowBlur = 0;

  // Draw laser explosion particles
  for (var i = 0; i < laserExplosions.length; i++) {
    var ex = laserExplosions[i];
    ctx.globalAlpha = ex.life;
    ctx.fillStyle = ex.color;
    ctx.shadowColor = ex.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawChonkAnnouncement() {
  if (chonkAnnouncementTimer <= 0) return;

  var alpha;
  if (chonkAnnouncementTimer > CHONK_ANNOUNCE_DURATION - 0.3) {
    alpha = (CHONK_ANNOUNCE_DURATION - chonkAnnouncementTimer) / 0.3;
  } else if (chonkAnnouncementTimer > 1) {
    alpha = 1;
  } else {
    alpha = chonkAnnouncementTimer;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // Shaking text effect
  var shakeX = Math.sin(Date.now() / 40) * 3;
  var shakeY = Math.cos(Date.now() / 35) * 2;

  // "MEGA CHONK MODE" in big red glowing text
  ctx.fillStyle = '#FF4400';
  ctx.font = sf(14);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#FF0000';
  ctx.shadowBlur = 25;
  ctx.fillText('MEGA CHONK', W / 2 + shakeX, H / 2 - 40 + shakeY);
  ctx.fillText('MODE!', W / 2 + shakeX, H / 2 - 18 + shakeY);

  // Timer remaining
  if (megaChonkActive) {
    ctx.font = sf(8);
    ctx.fillStyle = '#FFDD00';
    ctx.shadowColor = '#FFDD00';
    ctx.shadowBlur = 8;
    ctx.fillText(Math.ceil(megaChonkTimer) + 's remaining', W / 2, H / 2 + 5);
  }

  ctx.restore();
}

function drawChonkHUD() {
  // Burger progress indicator at bottom-left
  if (megaChonkActive || chonkBurgers > 0 || chonkShrinkTimer > 0) {
    ctx.save();

    var hudX = 12;
    var hudY = H - 52;

    ctx.fillStyle = '#FF8C00';
    ctx.font = sf(7);
    ctx.textAlign = 'left';

    if (megaChonkActive) {
      // Show laser timer
      ctx.shadowColor = '#FF0000';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#FF4444';
      if (Math.floor(Date.now() / 200) % 2 === 0) {
        ctx.fillText('LASERS! ' + Math.ceil(megaChonkTimer) + 's', hudX, hudY);
      }
    } else if (chonkShrinkTimer > 0) {
      ctx.fillStyle = '#FF4400';
      ctx.shadowColor = '#FF4400';
      ctx.shadowBlur = 10;
      ctx.fillText('ACTIVATING...', hudX, hudY);
    } else {
      ctx.fillText('CHONK', hudX, hudY);
      // Draw 4 burger slots
      for (var i = 0; i < CHONK_BURGERS_NEEDED; i++) {
        var slotX = hudX + i * 16;
        var slotY = hudY + 5;
        if (i < chonkBurgers) {
          // Filled burger slot — mini burger
          ctx.fillStyle = '#D2691E';
          ctx.fillRect(slotX, slotY, 12, 4);
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(slotX + 1, slotY + 4, 10, 3);
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(slotX, slotY + 3, 12, 2);
          ctx.fillStyle = '#D2691E';
          ctx.fillRect(slotX, slotY + 7, 12, 3);
        } else {
          // Empty slot
          ctx.strokeStyle = '#555555';
          ctx.lineWidth = 1;
          ctx.strokeRect(slotX, slotY, 12, 10);
        }
      }
    }

    ctx.restore();
  }
}

function resetChonk() {
  chonkBurgers = 0;
  chonkLevel = 0;
  megaChonkActive = false;
  megaChonkTimer = 0;
  chonkShrinkTimer = 0;
  chonkAnnouncementTimer = 0;
  laserExplosions.length = 0;
}

// ============================================
//  HUD — Score, Lives, Bonus
// ============================================

function drawHUD() {
  ctx.save();

  // Score label
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#00ff88';
  ctx.font = sf(10);
  ctx.textAlign = 'left';
  ctx.fillText('TIME', 12, 20);

  // Score number
  ctx.shadowColor = '#ffd60a';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffd60a';
  ctx.font = sf(14);
  ctx.fillText(Math.floor(score) + 's', 12, 38);

  // Bonus score
  ctx.shadowColor = '#FF69B4';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#FF69B4';
  ctx.font = sf(8);
  ctx.fillText('BONUS: ' + bonusScore, 12, 52);

  // Total score
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#45fffc';
  ctx.font = sf(7);
  ctx.fillText('TOTAL: ' + (Math.floor(score) + bonusScore), 12, 64);

  // Lives — draw cat face icons
  ctx.shadowBlur = 0;
  ctx.fillStyle = getSkinColors().body;
  ctx.font = sf(8);
  ctx.textAlign = 'right';
  ctx.fillText('LIVES', W - 12, 20);

  // Draw tiny cat faces for each life
  for (var i = 0; i < lives; i++) {
    var lx = W - 16 - (i % 5) * 18;
    var ly = 24 + Math.floor(i / 5) * 16;
    drawMiniCatFace(lx, ly);
  }

  // Vacuum spawn rate
  ctx.fillStyle = '#FF6B6B';
  ctx.font = sf(7);
  ctx.textAlign = 'right';
  ctx.fillText('Vac/s: ' + vacuumSpawnRate, W - 10, lives > 5 ? 58 : 48);

  ctx.restore();
}

function drawMiniCatFace(x, y) {
  // Tiny 12x10 cat face
  var msc = getSkinColors();
  ctx.fillStyle = msc.body;
  ctx.fillRect(x, y, 12, 10);
  // Ears
  ctx.beginPath();
  ctx.moveTo(x + 1, y); ctx.lineTo(x - 1, y - 4); ctx.lineTo(x + 4, y);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 8, y); ctx.lineTo(x + 13, y - 4); ctx.lineTo(x + 11, y);
  ctx.closePath(); ctx.fill();
  // Eyes
  ctx.fillStyle = msc.accent;
  ctx.fillRect(x + 2, y + 3, 3, 3);
  ctx.fillRect(x + 7, y + 3, 3, 3);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 3, y + 4, 1, 1);
  ctx.fillRect(x + 8, y + 4, 1, 1);
}

// ============================================
//  Title Screen
// ============================================
let titleBounce = 0;

function drawTitleScreen() {
  titleBounce += 0.03;

  ctx.save();

  // Big cat in the center (use drawCat temporarily positioned)
  var titleCatX = W / 2 - CAT_SIZE / 2;
  var titleCatY = H / 2 - 60 + Math.sin(titleBounce) * 8;

  // Temporarily move cat to draw it
  var savedX = cat.x, savedY = cat.y, savedWag = cat.tailWag;
  cat.x = titleCatX;
  cat.y = titleCatY;
  cat.tailWag = titleBounce * 4;
  invincibleTimer = 0; // ensure cat is visible
  drawCat();
  cat.x = savedX; cat.y = savedY; cat.tailWag = savedWag;

  // Skin selector arrows (only show if more than 1 skin unlocked)
  if (countUnlockedSkins() > 1) {
    var arrowY = titleCatY + CAT_SIZE / 2; // vertically centered on cat
    var hitSize = 40; // bigger hitbox for easy tapping

    // Left arrow
    var leftArrowX = titleCatX - 45;
    skinArrowLeft.x = leftArrowX - hitSize / 2;
    skinArrowLeft.y = arrowY - hitSize / 2;
    skinArrowLeft.w = hitSize;
    skinArrowLeft.h = hitSize;

    ctx.fillStyle = '#45fffc';
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(Date.now() / 400);
    ctx.beginPath();
    ctx.moveTo(leftArrowX + 6, arrowY - 10);
    ctx.lineTo(leftArrowX - 8, arrowY);
    ctx.lineTo(leftArrowX + 6, arrowY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Right arrow
    var rightArrowX = titleCatX + CAT_SIZE + 45;
    skinArrowRight.x = rightArrowX - hitSize / 2;
    skinArrowRight.y = arrowY - hitSize / 2;
    skinArrowRight.w = hitSize;
    skinArrowRight.h = hitSize;

    ctx.fillStyle = '#45fffc';
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(Date.now() / 400);
    ctx.beginPath();
    ctx.moveTo(rightArrowX - 6, arrowY - 10);
    ctx.lineTo(rightArrowX + 8, arrowY);
    ctx.lineTo(rightArrowX - 6, arrowY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Skin name below cat
    ctx.fillStyle = '#ffffff';
    ctx.font = sf(6);
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.8;
    ctx.fillText(CAT_SKINS[selectedSkinIndex].name, W / 2, titleCatY + CAT_SIZE + 16);
    ctx.globalAlpha = 1;
  }

  // Title text
  ctx.fillStyle = '#ffda45';
  ctx.font = sf(20);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff6bef';
  ctx.shadowBlur = 20;
  ctx.fillText('CAT vs', W / 2, H / 2 - 120);
  ctx.fillText('VACUUMS', W / 2, H / 2 - 92);
  ctx.shadowBlur = 0;

  // Start prompt (blinking)
  if (Math.floor(Date.now() / 600) % 2 === 0) {
    ctx.fillStyle = '#00FF41';
    ctx.font = sf(10);
    ctx.shadowColor = '#00FF41';
    ctx.shadowBlur = 8;
    ctx.fillText(isMobile ? 'Tap to Start' : 'Press ENTER to Start', W / 2, H / 2 + 50);
    ctx.shadowBlur = 0;
  }

  // Controls hint
  ctx.fillStyle = '#45fffc';
  ctx.font = sf(7);
  ctx.globalAlpha = 0.7;
  if (isMobile) {
    ctx.fillText('Drag to Move', W / 2, H / 2 + 80);
    ctx.fillText('HISS button for Blast', W / 2, H / 2 + 95);
  } else {
    ctx.fillText('Arrow Keys to Move', W / 2, H / 2 + 80);
    ctx.fillText('SPACE for Hiss Blast', W / 2, H / 2 + 95);
  }

  // High score on title screen
  if (savedHighScore > 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFD700';
    ctx.font = sf(8);
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 6;
    ctx.fillText('BEST: ' + savedHighScore, W / 2, H / 2 + 130);
    ctx.shadowBlur = 0;
  }

  // Fullscreen button
  ctx.globalAlpha = 0.8;
  var fsBtnW = 180;
  var fsBtnH = 30;
  var fsBtnX = W / 2 - fsBtnW / 2;
  var fsBtnY = H - 60;
  fullscreenBtn.x = fsBtnX;
  fullscreenBtn.y = fsBtnY;
  fullscreenBtn.w = fsBtnW;
  fullscreenBtn.h = fsBtnH;

  ctx.strokeStyle = '#45fffc';
  ctx.lineWidth = 2;
  ctx.strokeRect(fsBtnX, fsBtnY, fsBtnW, fsBtnH);
  ctx.fillStyle = 'rgba(69, 255, 252, 0.1)';
  ctx.fillRect(fsBtnX, fsBtnY, fsBtnW, fsBtnH);

  ctx.fillStyle = '#45fffc';
  ctx.font = sf(7);
  ctx.fillText(isFullscreen ? '[ EXIT FULLSCREEN ]' : '[ FULLSCREEN ]', W / 2, fsBtnY + 20);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ============================================
//  Game Over Screen
// ============================================
function drawGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 10, 46, 0.75)';
  ctx.fillRect(0, 0, W, H);

  var finalScore = Math.floor(score) + bonusScore;

  // Title
  ctx.shadowColor = '#ff006e';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ff006e';
  ctx.font = sf(22);
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 90);
  ctx.shadowBlur = 0;

  // Survived time
  ctx.fillStyle = '#ffffff';
  ctx.font = sf(9);
  ctx.fillText('You survived', W / 2, H / 2 - 55);

  ctx.shadowColor = '#ffd60a';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffd60a';
  ctx.font = sf(22);
  ctx.fillText(Math.floor(score) + 's', W / 2, H / 2 - 28);
  ctx.shadowBlur = 0;

  // Bonus
  ctx.fillStyle = '#FF69B4';
  ctx.font = sf(9);
  ctx.fillText('Bonus: ' + bonusScore, W / 2, H / 2 - 5);

  // Total
  ctx.fillStyle = '#45fffc';
  ctx.font = sf(12);
  ctx.shadowColor = '#45fffc';
  ctx.shadowBlur = 8;
  ctx.fillText('TOTAL: ' + finalScore, W / 2, H / 2 + 20);
  ctx.shadowBlur = 0;

  // High score message
  if (isNewHighScore(finalScore)) {
    if (Math.floor(Date.now() / 300) % 2 === 0) {
      ctx.fillStyle = '#FFD700';
      ctx.font = sf(10);
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 50);
      ctx.shadowBlur = 0;
    }
  }

  // Best score
  if (savedHighScore > 0) {
    ctx.fillStyle = '#8338ec';
    ctx.font = sf(8);
    ctx.fillText('BEST: ' + savedHighScore, W / 2, H / 2 + 80);
  }

  // New skin unlocked notification
  if (newSkinUnlocked) {
    if (Math.floor(Date.now() / 400) % 2 === 0) {
      ctx.fillStyle = '#00FF41';
      ctx.font = sf(8);
      ctx.shadowColor = '#00FF41';
      ctx.shadowBlur = 10;
      ctx.fillText('NEW SKIN UNLOCKED!', W / 2, H / 2 + 100);
      ctx.shadowBlur = 0;
    }
  }

  // Restart hint
  ctx.fillStyle = '#00ff88';
  ctx.font = sf(8);
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 6;
    ctx.fillText(isMobile ? 'Tap to restart' : 'ENTER to restart', W / 2, H / 2 + 120);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ============================================
//  Game Start / Restart
// ============================================

function startGame() {
  gameState = 'playing';
  newSkinUnlocked = false;
  score = 0;
  bonusScore = 0;
  lives = MAX_LIVES;
  invincibleTimer = 0;
  collisionFlashTimer = 0;
  resetCat();
  resetVacuums();
  resetHissBlast();
  resetCollectibles();
  resetWaves();
  resetChonk();
}

function restartGame() {
  gameState = 'title';
  score = 0;
  bonusScore = 0;
  lives = MAX_LIVES;
  invincibleTimer = 0;
  collisionFlashTimer = 0;
  resetCat();
  resetVacuums();
  resetHissBlast();
  resetCollectibles();
  resetChonk();
  currentWave = 0;
  waveAnnouncementTimer = 0;
}

function triggerGameOver() {
  if (gameState !== 'playing') return;
  gameState = 'gameover';

  // Save high score and check skin unlocks
  var finalScore = Math.floor(score) + bonusScore;
  saveHighScore(finalScore);
  newSkinUnlocked = checkSkinUnlocks(finalScore);

  sfxGameOver();

  collisionFlashTimer = COLLISION_FLASH_DURATION;
  canvas.classList.add('shake');
  setTimeout(function () { canvas.classList.remove('shake'); }, 300);
}

// ============================================
//  Main Loop
// ============================================

function clearCanvas() {
  ctx.fillStyle = '#0d0d24';
  ctx.fillRect(0, 0, W, H);
}

function gameLoop(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;
  var dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;

  // Always update background
  clearCanvas();
  updateStars();
  drawStars();
  spawnSparkle();
  updateSparkles();
  drawSparkles();

  // ---- State machine ----
  if (gameState === 'title') {
    drawTitleScreen();

  } else if (gameState === 'playing') {
    score += dt;

    // Update invincibility
    if (invincibleTimer > 0) {
      invincibleTimer -= dt;
      if (invincibleTimer < 0) invincibleTimer = 0;
    }

    // Collision flash
    if (collisionFlashTimer > 0) {
      collisionFlashTimer -= dt;
    }

    updateCat(dt);

    // Draw laser beams BEHIND the cat (so beams go upward from eyes)
    updateMegaChonk(dt);
    drawLaserBeams();

    drawCat();

    updateVacuums(dt);
    drawVacuums();

    updateCollectibles(dt);
    drawCollectibles();

    checkAllCollisions();

    updateHissBlast(dt);
    drawHissBlast();
    drawCooldownBar();

    checkWaveProgress();
    updateWaveAnnouncement(dt);
    drawWaveAnnouncement();

    drawChonkAnnouncement();
    drawCollisionFlash();
    drawHUD();
    drawChonkHUD();
    drawTouchControls();

  } else if (gameState === 'gameover') {
    drawLaserBeams();
    drawCat();
    drawVacuums();
    drawCollectibles();

    updateHissBlast(dt);
    drawHissBlast();

    // Let chonk explosions finish
    updateMegaChonk(dt);

    if (collisionFlashTimer > 0) {
      collisionFlashTimer -= dt;
      drawCollisionFlash();
    }

    drawHUD();
    drawGameOver();

  }

  requestAnimationFrame(gameLoop);
}

// ============================================
//  Start the engine!
// ============================================
resizeCanvas();
createStars();
requestAnimationFrame(gameLoop);
