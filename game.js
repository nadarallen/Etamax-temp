const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
const STATE = {
    MENU: 0,
    PLAYING: 1,
    GAMEOVER: 2,
    SURPRISE: 3,
    EGG_INTERACTION: 4
};

let currentState = STATE.MENU;
let animationId;
let lastTime = 0;
let score = 0;
let obstacles = [];
let eggs = [];
let particles = [];
let shards = [];

// Configuration
const CONFIG = {
    orbitRadius: 120, // Distance from center
    playerSpeed: 2.5, // Radians per second
    obstacleSpawnRate: 800,
    obstacleSpeedBase: 100, // Speed towards center
    starCount: 150
};

let lastSpawnTime = 0;
let difficultyMultiplier = 1;
let centerX = canvas.width / 2;
let centerY = canvas.height / 2;

// Resize
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    // Scale orbit radius for mobile/desktop
    CONFIG.orbitRadius = Math.min(canvas.width, canvas.height) * 0.35;
}
window.addEventListener('resize', resize);
resize();

// --- Input ---
// --- Input ---
function handleInput(e) {
    if (currentState === STATE.MENU) {
        startGame();
    } else if (currentState === STATE.PLAYING) {
        player.flipDirection();
    } else if (currentState === STATE.GAMEOVER) {
        resetGame();
    } else if (currentState === STATE.EGG_INTERACTION) {
        // Check if click/tap is on the egg
        // Egg is at center (centerX, centerY) with radius ~80
        let clientX, clientY;
        if (e.type === 'touchstart') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) { // Hitbox slightly larger than visual
            triggerSurprise();
        }
    }
}


window.addEventListener('mousedown', (e) => handleInput(e));
window.addEventListener('touchstart', (e) => {
    // Check if touching a button or interactive element
    if (e.target.closest('button') || e.target.closest('a')) {
        return; // Allow default behavior (click)
    }
    e.preventDefault();
    handleInput(e);
}, { passive: false });


// --- Entities ---
class Player {
    constructor() {
        this.angle = 0; // Radians
        this.radius = 12; // Visual size
        this.orbitR = CONFIG.orbitRadius;
        this.direction = 1; // 1 (CW) or -1 (CCW)
        this.color = '#00ffff';
        this.trail = [];
        this.x = 0;
        this.y = 0;
    }

    flipDirection() {
        this.direction *= -1;
        Sound.flip();
    }

    update(dt) {
        // Move along orbit
        this.angle += this.direction * CONFIG.playerSpeed * dt;

        // Calculate Cartesian Calc
        this.x = centerX + Math.cos(this.angle) * this.orbitR;
        this.y = centerY + Math.sin(this.angle) * this.orbitR;

        // Trail
        this.trail.push({ x: this.x, y: this.y, age: 0 });
        if (this.trail.length > 30) this.trail.shift();
        for (let t of this.trail) t.age += dt;
        this.trail = this.trail.filter(t => t.age < 0.2); // Trail lifetime
    }

    draw(ctx) {
        // Calculate orientation (Tangent to orbit)
        const rotation = this.angle + (this.direction * Math.PI / 2);

        // Draw Trail (Engine Wake)
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (this.trail.length > 1) {
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = `rgba(0, 255, 255, 0.3)`;
            ctx.lineWidth = this.radius * 0.5;
            ctx.stroke();
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(rotation);

        // Engine Flame
        const flicker = Math.random() * 0.4 + 0.8;
        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.8, 0);
        ctx.lineTo(-this.radius * 2 * flicker, this.radius * 0.3);
        ctx.lineTo(-this.radius * 2 * flicker, -this.radius * 0.3);
        ctx.fill();

        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.8, 0);
        ctx.lineTo(-this.radius * 1.5 * flicker, this.radius * 0.15);
        ctx.lineTo(-this.radius * 1.5 * flicker, -this.radius * 0.15);
        ctx.fill();

        // Rocket Body
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#111';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(this.radius * 1.5, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.ellipse(this.radius * 0.2, 0, this.radius * 0.3, this.radius * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Obstacle {
    constructor() {
        this.distance = Math.max(canvas.width, canvas.height) * 0.8;
        this.angle = Math.random() * Math.PI * 2;
        this.radius = 15 + Math.random() * 10;
        this.speed = (CONFIG.obstacleSpeedBase + Math.random() * 50) * difficultyMultiplier;

        const colors = ['#39ff14', '#bc13fe', '#00ffff'];
        this.color = colors[Math.floor(Math.random() * colors.length)];

        this.rotation = Math.random() * Math.PI * 2;
        this.wobblePhase = Math.random() * Math.PI * 2;

        this.x = 0;
        this.y = 0;
        this.updatePos();
    }

    updatePos() {
        this.x = centerX + Math.cos(this.angle) * this.distance;
        this.y = centerY + Math.sin(this.angle) * this.distance;
    }

    update(dt) {
        this.distance -= this.speed * dt;
        this.rotation = this.angle + Math.PI + Math.sin(gameTime * 5 + this.wobblePhase) * 0.3;
        this.updatePos();
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = this.color;

        const pulse = 1 + Math.sin(gameTime * 10 + this.wobblePhase) * 0.05;
        ctx.scale(pulse, pulse);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, Math.PI, 0);
        const tentacleCount = 3;
        const width = this.radius * 2;
        const segment = width / tentacleCount;
        for (let i = 0; i <= tentacleCount; i++) {
            const wiggle = Math.sin(gameTime * 15 + i + this.wobblePhase) * 3;
            ctx.lineTo(this.radius - segment * i, this.radius * 0.5 + wiggle);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(-this.radius * 0.4, -this.radius * 0.1, this.radius * 0.2, this.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.ellipse(this.radius * 0.4, -this.radius * 0.1, this.radius * 0.2, this.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(-this.radius * 0.4, -this.radius * 0.2, this.radius * 0.08, 0, Math.PI * 2);
        ctx.arc(this.radius * 0.4, -this.radius * 0.2, this.radius * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    isConsumed() {
        return this.distance < 30; // Sucked into black hole
    }
}
class EasterEgg {
    constructor() {
        this.distance = Math.max(canvas.width, canvas.height) * 0.5; // Starts closer
        this.angle = Math.random() * Math.PI * 2;
        this.radius = 25; // Even larger
        this.speed = 150; // Faster
        this.color = '#fffbe6'; // Egg shell color
        this.rotation = 0;
        this.x = 0;
        this.y = 0;
        console.log("🥚 Easter Egg Spawned!");
        this.updatePos();
    }

    updatePos() {
        this.x = centerX + Math.cos(this.angle) * this.distance;
        this.y = centerY + Math.sin(this.angle) * this.distance;
    }

    update(dt) {
        this.distance -= this.speed * dt;
        this.rotation += dt;
        this.updatePos();
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2); // Point towards center

        // Glow
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;

        // Egg Shape (Oval)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 0.8, this.radius, 0, 0, Math.PI * 2);
        ctx.fill();

        // Question mark?
        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 0);

        ctx.restore();
    }

    isConsumed() {
        return this.distance < 30; // Missed it
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 100 + 50;
        this.vx = Math.cos(a) * s;
        this.vy = Math.sin(a) * s;
        this.life = 1.0;
        this.decay = Math.random() * 2 + 1;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
    }
    draw(ctx) {
        // Simple circle for performance
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Shard {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 200 + 100; // Fast explosion
        this.vx = Math.cos(a) * s;
        this.vy = Math.sin(a) * s;
        this.life = 1.0;
        this.decay = Math.random() * 1.5 + 0.5;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 10;
        this.size = Math.random() * 5 + 3;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
        this.rotation += this.rotSpeed * dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;

        // Draw jagged shard (triangle)
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.8, this.size);
        ctx.lineTo(-this.size * 0.8, this.size);
        ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1;
    }
}

// Particle System Limit
const MAX_PARTICLES = 100;

class Star {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.5;
        this.alpha = Math.random() * 0.5 + 0.1;
    }
    draw(ctx) {
        // Skip drawing if alpha is too low for cheap "culling"
        if (this.alpha < 0.15) return;
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        // Rects are faster than arcs
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

// UI Helpers
function returnToTitle(e) {
    if (e) e.stopPropagation();
    window.location.reload(); // Force reload to ensure clean state
}

function resetToMenu(e) {
    if (e) e.stopPropagation();
    console.log("Resetting to Menu...");
    document.body.classList.remove('shake-effect');
    document.body.classList.remove('invert-effect');
    document.getElementById('win-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('surprise-overlay').classList.add('hidden'); // Hide surprise
    currentState = STATE.MENU;
    score = 0;
    gameTime = 0;
    disclaimerShown = false;
    hasSpawnedEgg = false;
    obstacles = [];
    eggs = [];
    particles = [];
    shards = [];
    document.getElementById('score').style.display = 'block';
    updateUI();
}

function triggerWin() {
    currentState = STATE.WIN;
    Sound.win();
    document.body.classList.add('shake-effect');
    setTimeout(() => document.body.classList.add('invert-effect'), 500);
    setTimeout(() => {
        document.body.classList.remove('shake-effect');
        document.getElementById('win-screen').classList.remove('hidden');
    }, 2000);
}

function triggerSurprise() {
    currentState = STATE.SURPRISE; // New State: Game Freezes, but Animation continues
    // Audio & Haptics
    Sound.win();
    if (navigator.vibrate) navigator.vibrate([200, 50, 200, 50, 200]); // Strong vibration pattern

    // Screen Shake Effect (Like crash)
    document.body.classList.add('shake-effect');
    setTimeout(() => {
        document.body.classList.remove('shake-effect');
    }, 500);

    // Crack Animation (Shards + White Particles)
    // White flash/boom particles
    for (let i = 0; i < 150; i++) {
        // Explosion from CENTER (where the big egg was)
        particles.push(new Particle(centerX, centerY, '#ffffff'));
    }
    // Shell Shards
    for (let i = 0; i < 30; i++) {
        // Explosion from CENTER
        shards.push(new Shard(centerX, centerY, '#fffbe6')); // Egg color
    }

    // Create White Flash Overlay covering WHOLE screen
    const flash = document.createElement('div');
    flash.className = 'flash-white-effect';
    document.body.appendChild(flash);

    // Hide UI elements immediately
    document.getElementById('score').style.display = 'none';

    // Show Overlay after 3 seconds
    setTimeout(() => {
        document.getElementById('surprise-overlay').classList.remove('hidden');

        // Clean up flash element
        if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, 3000); // 3 seconds delay
}

// Ensure global access for button click
window.resetToMenu = resetToMenu;
window.returnToTitle = returnToTitle;

// Explicitly handle touch on the button to bypass any global prevention



// --- Audio & Haptics ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMuted = false;

// Background Music
// Background Music
const bgm = new Audio('instrument.mp3');
bgm.loop = true;
bgm.volume = 1.0;

const Sound = {
    playTone: (freq, type, duration, vol = 0.1) => {
        if (isMuted) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // Ensure BGM is playing (browser policy requires interaction)
        if (bgm.paused) bgm.play().catch(e => console.log("Audio play blocked:", e));

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },

    flip: () => {
        Sound.playTone(600, 'sine', 0.1, 0.1);
        Sound.playTone(800, 'square', 0.05, 0.05); // Technod blip
    },

    gameOver: () => {
        Sound.playTone(150, 'sawtooth', 0.5, 0.2);
        Sound.playTone(100, 'square', 0.8, 0.2);
        // Haptic
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    },

    win: () => {
        if (isMuted) return;
        // Simple arpeggio
        [440, 554, 659, 880].forEach((freq, i) => {
            setTimeout(() => Sound.playTone(freq, 'sine', 0.2, 0.1), i * 100);
        });
    }
};

// Mobile Audio Unlock
let audioUnlocked = false;

function checkAudioContext() {
    if (audioUnlocked) return;

    // Resume context
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log("AudioContext Resumed");
        });
    }

    // Try to unlock BGM tag
    // We only pause if we are still in the menu. 
    // If the user just clicked "Start", we don't want to kill the vibe.
    bgm.play().then(() => {
        if (currentState === STATE.MENU) {
            bgm.pause();
            bgm.currentTime = 0;
        }
        audioUnlocked = true;
        console.log("Audio Unlocked Successfully");
    }).catch(e => {
        console.log("Audio Unlock Prevented (Normal until interaction):", e);
    });

    // Remove listeners once unlocked
    if (audioUnlocked) {
        window.removeEventListener('touchstart', checkAudioContext);
        window.removeEventListener('click', checkAudioContext);
    }
}

window.addEventListener('touchstart', checkAudioContext, { passive: true });
window.addEventListener('click', checkAudioContext);

// Button Event Listeners
const startBtn = document.getElementById('start-btn');
if (startBtn) startBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    // Force Resume & Play immediately on this interaction
    if (audioCtx.state === 'suspended') audioCtx.resume();
    bgm.currentTime = 0;
    bgm.play().catch(e => console.error("Start BGM Fail:", e));

    startGame();
});



// Assets
const planetImg = new Image();
let planetImgLoaded = false;
planetImg.onload = () => { planetImgLoaded = true; };
planetImg.onerror = () => { console.error("Failed to load Saturn.png"); };
planetImg.src = 'Saturn.png';
// --- Logic ---
let player = new Player();
let stars = []; // Restored variable
// stars is already defined above in some versions or usually here. 
// checking context: line 359 says `let stars = [];`
// effectively replacing surrounding lines to be safe.

let disclaimerShown = false;
let hasSpawnedEgg = false;

function showDisclaimer() {
    const msg = document.createElement('div');
    msg.style.position = 'absolute';
    msg.style.top = '20%';
    msg.style.left = '50%';
    msg.style.transform = 'translate(-50%, -50%)';
    msg.style.background = 'rgba(0, 0, 0, 0.9)';
    msg.style.border = '2px solid #ff0055';
    msg.style.padding = '20px';
    msg.style.color = '#00ffff';
    msg.style.fontFamily = "'Courier New', Courier, monospace";
    msg.style.textAlign = 'center';
    msg.style.zIndex = '1000';
    msg.style.pointerEvents = 'none';
    msg.innerHTML = `<h2 style="color:#ff0055; margin-bottom:10px">⚠️ SYSTEM ALERT</h2>
                     <p>You survived 500 points.</p>
                     <p>The aliens have filed a formal complaint.</p>
                     <p style="margin-top:10px; font-weight:bold">ENTERING ENDLESS MODE</p>`;

    document.body.appendChild(msg);

    // Glitch effect briefly
    document.body.classList.add('glitch-effect');
    setTimeout(() => document.body.classList.remove('glitch-effect'), 500);

    // Remove message after 4s
    setTimeout(() => {
        msg.style.transition = 'opacity 1s';
        msg.style.opacity = '0';
        setTimeout(() => {
            if (msg.parentNode) msg.parentNode.removeChild(msg);
        }, 1000);
    }, 4000);
}

function init() {
    for (let i = 0; i < CONFIG.starCount; i++) stars.push(new Star());
    updateUI();
}

function startGame() {
    currentState = STATE.PLAYING;
    score = 0;

    // Start Music (Backup call)
    if (bgm.paused) {
        bgm.currentTime = 0;
        bgm.play().catch(e => console.log("Audio Error:", e));
    }

    gameTime = 0;
    chaosLevel = 0;
    difficultyMultiplier = 1;
    obstacles = [];
    eggs = [];
    particles = [];
    shards = [];
    hasSpawnedEgg = false;
    player = new Player();
    // Default configs reset
    CONFIG.playerSpeed = 2.5;

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('surprise-overlay').classList.add('hidden');
    updateUI();
}

function resetGame() {
    startGame();
}

function gameOver() {
    currentState = STATE.GAMEOVER;
    Sound.gameOver();
    bgm.pause(); // Stop Music

    // Screen Effects
    document.body.classList.add('shake-effect');
    const flash = document.createElement('div');
    flash.className = 'flash-red-effect';
    document.body.appendChild(flash);

    setTimeout(() => {
        document.body.classList.remove('shake-effect');
        if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, 500);

    // Boom - Massive particle explosion
    for (let i = 0; i < 100; i++) {
        particles.push(new Particle(player.x, player.y, Math.random() > 0.5 ? '#ff0000' : '#ffffff'));
    }

    document.getElementById('final-score').innerText = `Score: ${Math.floor(score)}`;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function updateUI() {
    document.getElementById('score').innerText = `Score: ${Math.floor(score)}`;
}

function checkCollision(p, obs) {
    const dx = p.x - obs.x;
    const dy = p.y - obs.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (p.radius + obs.radius);
}

// Game timer for difficulty
let gameTime = 0;
let chaosLevel = 0;

function update(dt) {
    if (dt > 0.1) dt = 0.1;

    // Particles always update
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);

    // Shards update
    shards.forEach(s => s.update(dt));
    shards = shards.filter(s => s.life > 0);

    // Hard cap to maintain FPS
    if (particles.length > MAX_PARTICLES) {
        particles.splice(0, particles.length - MAX_PARTICLES);
    }

    if (currentState === STATE.PLAYING) {
        player.update(dt);

        // Time based scoring
        score += 10 * dt;
        gameTime += dt;
        updateUI();

        // Achievement / Disclaimer at 500 replaced by Surprise
        /*
        if (score >= 500.0 && !disclaimerShown) {
            showDisclaimer();
            disclaimerShown = true;
        }
        */

        // Trigger Easter Egg Interaction at Score 500
        if (score >= 500.0) {
            currentState = STATE.EGG_INTERACTION;
            // Clear existing obstacles for cleanliness or keep them frozen
            // Let's clear them so visual focus is on the egg
            obstacles = [];
            return; // Stop updating game logic
        }

        // Chaos Progression every 10 seconds
        const currentLevel = Math.floor(gameTime / 10);
        if (currentLevel > chaosLevel) {
            chaosLevel = currentLevel;
            // Ramp up difficulty
            difficultyMultiplier += 0.2; // Significant jump
            CONFIG.playerSpeed += 0.1; // Orbital speed increases

            // Flash effect or notification could go here
            console.log("Chaos Level Up!", chaosLevel);
        }

        // Spawn Logic with unpredictable gaps
        // Base rate gets faster with difficulty
        const currentSpawnRate = CONFIG.obstacleSpawnRate / (1 + chaosLevel * 0.5);

        if (Date.now() - lastSpawnTime > currentSpawnRate) {
            // Random chance to skip a spawn or DOUBLE spawn for chaos
            if (Math.random() > 0.1) {
                obstacles.push(new Obstacle());
            }
            if (chaosLevel > 2 && Math.random() > 0.7) {
                // Double spawn!
                setTimeout(() => obstacles.push(new Obstacle()), 200);
            }

            // Add some random jitter to the next spawn time
            lastSpawnTime = Date.now() + (Math.random() - 0.5) * 200;
        }

        // Update Obstacles
        obstacles.forEach(obs => {
            obs.update(dt);
            if (checkCollision(player, obs)) {
                gameOver();
            }
        });

        // Cleanup
        obstacles = obstacles.filter(obs => !obs.isConsumed());
    }
}

function draw() {
    // BG
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    stars.forEach(s => s.draw(ctx));

    // Saturn Planet Image
    if (planetImgLoaded) {
        ctx.save();
        ctx.translate(centerX, centerY);

        // Add Glow
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#00ffff'; // Cyan glow matches the theme

        // Scale to fit (Target approx 180px width)
        const scale = 180 / planetImg.width;
        ctx.scale(scale, scale);

        ctx.drawImage(planetImg, -planetImg.width / 2, -planetImg.height / 2);
        ctx.restore();
    } else {
        // Fallback loading placeholder (Golden circle)
        ctx.fillStyle = '#d6c68b';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a69050';
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    // Orbit Path (faint visual guide)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.orbitRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Entities
    obstacles.forEach(o => o.draw(ctx));
    // eggs.forEach(egg => egg.draw(ctx)); // Draw eggs (No longer needed)

    if (currentState === STATE.EGG_INTERACTION) {
        // Draw Big Pulsing Egg at Center
        ctx.save();
        ctx.translate(centerX, centerY);

        const pulse = 1 + Math.sin(Date.now() / 200) * 0.05;
        ctx.scale(pulse, pulse);

        // Glow
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 30; // Stronger glow

        // Egg Shape (3D Gradient)
        // Light source top-left (-20, -20)
        const gradient = ctx.createRadialGradient(-20, -20, 10, 0, 0, 80);
        gradient.addColorStop(0, '#ffffff');      // Highlight
        gradient.addColorStop(0.3, '#fffbe5');    // Base light
        gradient.addColorStop(0.9, '#e6d8b3');    // Shadowy base
        gradient.addColorStop(1, '#c2b280');      // Darkest edge

        ctx.fillStyle = gradient;
        ctx.beginPath();
        // Big Egg Size ~ 70x90
        ctx.ellipse(0, 0, 70, 90, 0, 0, Math.PI * 2);
        ctx.fill();

        // Extra rim light adjustment for realism
        ctx.shadowBlur = 0; // Turn off global shadow before drawing details

        // Question Mark
        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 60px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 0);

        // Text Hint
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00ffff';
        ctx.font = '20px Courier New';
        ctx.fillText('CLICK ME!', 0, 120);

        ctx.restore();
    }

    if (currentState === STATE.PLAYING || currentState === STATE.INTERCEPTED || currentState === STATE.SURPRISE) {
        player.draw(ctx);
    }
    particles.forEach(p => p.draw(ctx));
    shards.forEach(s => s.draw(ctx));
}

function loop(t) {
    const dt = (t - lastTime) / 1000;
    lastTime = t;
    update(dt);
    draw();
    animationId = requestAnimationFrame(loop);
}

init();
animationId = requestAnimationFrame(loop);
