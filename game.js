// Web Audio API Sound Synthesizer
class SoundController {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  jump() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  scorePoint() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.08, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + (i + 1) * 0.06);
    });
  }

  hit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

// Particle System for Jump & Crash Effects
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, color, count = 8, speed = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = (Math.random() * 0.8 + 0.2) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: Math.random() * 3 + 2,
        color,
        alpha: 1,
        life: 1
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // Gravity
      p.life -= dt * 1.5;
      p.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Game Implementation
class DinoGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundController();
    this.particles = new ParticleSystem();

    // Responsive Canvas dimensions
    this.width = 900;
    this.height = 300;
    this.groundY = 240;

    // Game States
    this.state = 'START'; // 'START' | 'RUNNING' | 'GAMEOVER'
    this.score = 0;
    this.hiScore = parseInt(localStorage.getItem('dino_hi_score') || '0', 10);
    this.gameSpeed = 6;
    this.baseSpeed = 6;
    this.lastTime = 0;
    this.distanceTraveled = 0;

    // Dino Properties
    this.dino = {
      x: 60,
      y: this.groundY - 50,
      width: 44,
      height: 52,
      vy: 0,
      gravity: 0.85,
      jumpForce: -13.5,
      isGrounded: true,
      isDucking: false,
      runFrame: 0,
      frameTimer: 0,
      canDoubleJump: true
    };

    // Obstacles & Environment
    this.obstacles = [];
    this.obstacleSpawnTimer = 0;
    this.clouds = [
      { x: 150, y: 50, speed: 0.5, scale: 1 },
      { x: 500, y: 70, speed: 0.7, scale: 0.8 },
      { x: 800, y: 35, speed: 0.4, scale: 1.2 }
    ];
    this.groundOffset = 0;

    // UI Elements
    this.scoreValEl = document.getElementById('scoreVal');
    this.hiScoreValEl = document.getElementById('hiScoreVal');
    this.speedValEl = document.getElementById('speedVal');
    this.overlayScreen = document.getElementById('overlayScreen');
    this.startCard = document.getElementById('startCard');
    this.gameOverCard = document.getElementById('gameOverCard');
    this.finalScoreText = document.getElementById('finalScoreText');
    this.newHighScoreNotice = document.getElementById('newHighScoreNotice');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundStatusEl = document.getElementById('soundStatus');

    this.updateHUD();
    this.initEvents();
    this.gameLoop = this.gameLoop.bind(this);
    requestAnimationFrame(this.gameLoop);
  }

  initEvents() {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        this.handleJump();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        this.setDucking(true);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowDown', 'KeyS'].includes(e.code)) {
        this.setDucking(false);
      }
    });

    // Button controls
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this.startGame());

    // Mobile / Touch controls
    const touchJump = document.getElementById('touchJumpBtn');
    const touchDuck = document.getElementById('touchDuckBtn');

    touchJump.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleJump(); });
    touchJump.addEventListener('mousedown', (e) => { e.preventDefault(); this.handleJump(); });

    touchDuck.addEventListener('touchstart', (e) => { e.preventDefault(); this.setDucking(true); });
    touchDuck.addEventListener('touchend', (e) => { e.preventDefault(); this.setDucking(false); });
    touchDuck.addEventListener('mousedown', (e) => { e.preventDefault(); this.setDucking(true); });
    touchDuck.addEventListener('mouseup', (e) => { e.preventDefault(); this.setDucking(false); });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      this.soundStatusEl.innerText = this.sound.enabled ? 'ON' : 'OFF';
      document.getElementById('soundIcon').innerText = this.sound.enabled ? '🔊' : '🔇';
    });
  }

  handleJump() {
    if (this.state === 'START' || this.state === 'GAMEOVER') {
      this.startGame();
      return;
    }
    if (this.state !== 'RUNNING') return;

    if (this.dino.isGrounded) {
      this.dino.vy = this.dino.jumpForce;
      this.dino.isGrounded = false;
      this.dino.canDoubleJump = true;
      this.sound.jump();
      this.particles.spawn(this.dino.x + 20, this.groundY, '#00f0ff', 6, 2.5);
    } else if (this.dino.canDoubleJump) {
      this.dino.vy = this.dino.jumpForce * 0.85;
      this.dino.canDoubleJump = false;
      this.sound.jump();
      this.particles.spawn(this.dino.x + 20, this.dino.y + 30, '#ff007f', 8, 3);
    }
  }

  setDucking(isDucking) {
    if (this.state !== 'RUNNING') return;
    this.dino.isDucking = isDucking;
    if (isDucking && !this.dino.isGrounded) {
      // Fast drop
      this.dino.vy += 4.5;
    }
  }

  startGame() {
    this.state = 'RUNNING';
    this.score = 0;
    this.gameSpeed = this.baseSpeed;
    this.distanceTraveled = 0;
    this.obstacles = [];
    this.obstacleSpawnTimer = 60;
    this.dino.y = this.groundY - 50;
    this.dino.vy = 0;
    this.dino.isGrounded = true;
    this.dino.isDucking = false;

    this.overlayScreen.classList.remove('visible');
    this.startCard.classList.add('hidden');
    this.gameOverCard.classList.add('hidden');
    this.newHighScoreNotice.classList.add('hidden');
    this.sound.init();
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.sound.hit();

    // Collision burst
    this.particles.spawn(this.dino.x + 20, this.dino.y + 20, '#ff007f', 24, 6);

    let isNewHigh = false;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      localStorage.setItem('dino_hi_score', this.hiScore);
      isNewHigh = true;
    }

    this.finalScoreText.innerText = `Final Score: ${this.formatScore(this.score)}`;
    if (isNewHigh) {
      this.newHighScoreNotice.classList.remove('hidden');
    }

    this.overlayScreen.classList.add('visible');
    this.gameOverCard.classList.remove('hidden');
    this.updateHUD();
  }

  spawnObstacle() {
    // Cacti types or Pterodactyls
    const isBird = this.score > 250 && Math.random() < 0.35;

    if (isBird) {
      // Birds spawn at 2 heights: low (duck required) or mid (jump required)
      const birdHeights = [this.groundY - 48, this.groundY - 78];
      const y = birdHeights[Math.floor(Math.random() * birdHeights.length)];
      this.obstacles.push({
        type: 'bird',
        x: this.width + 20,
        y,
        width: 40,
        height: 28,
        frame: 0,
        frameTimer: 0
      });
    } else {
      // Cacti
      const count = Math.random() < 0.4 ? 2 : 1;
      const cactusWidth = count === 2 ? 38 : 22;
      this.obstacles.push({
        type: 'cactus',
        x: this.width + 20,
        y: this.groundY - 44,
        width: cactusWidth,
        height: 44,
        count
      });
    }
  }

  update(dt) {
    this.particles.update(dt);

    if (this.state !== 'RUNNING') return;

    // Score & Speed progress
    this.distanceTraveled += this.gameSpeed;
    const oldScore = this.score;
    this.score = Math.floor(this.distanceTraveled / 8);

    // Score milestone sound every 100 points
    if (Math.floor(this.score / 100) > Math.floor(oldScore / 100) && this.score > 0) {
      this.sound.scorePoint();
    }

    // Dynamic speed curve
    this.gameSpeed = this.baseSpeed + Math.min(8.5, Math.floor(this.score / 150) * 0.7);
    this.updateHUD();

    // Dino Physics
    if (!this.dino.isGrounded) {
      this.dino.vy += this.dino.gravity;
      this.dino.y += this.dino.vy;

      const currentHeight = this.dino.isDucking ? 30 : 50;
      if (this.dino.y >= this.groundY - currentHeight) {
        this.dino.y = this.groundY - currentHeight;
        this.dino.vy = 0;
        this.dino.isGrounded = true;
      }
    } else {
      const currentHeight = this.dino.isDucking ? 30 : 50;
      this.dino.y = this.groundY - currentHeight;
    }

    // Dino animation
    this.dino.frameTimer += dt;
    if (this.dino.frameTimer > 0.08) {
      this.dino.runFrame = (this.dino.runFrame + 1) % 4;
      this.dino.frameTimer = 0;
    }

    // Ground scroll
    this.groundOffset = (this.groundOffset + this.gameSpeed) % 40;

    // Obstacle spawning
    this.obstacleSpawnTimer -= this.gameSpeed * 0.12;
    if (this.obstacleSpawnTimer <= 0) {
      this.spawnObstacle();
      const minDistance = Math.max(45, 95 - this.gameSpeed * 2.5);
      this.obstacleSpawnTimer = minDistance + Math.random() * 40;
    }

    // Update Obstacles & Collision check
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.gameSpeed;

      if (obs.type === 'bird') {
        obs.frameTimer = (obs.frameTimer || 0) + dt;
        if (obs.frameTimer > 0.15) {
          obs.frame = (obs.frame + 1) % 2;
          obs.frameTimer = 0;
        }
      }

      // Hitbox logic
      const dinoWidth = this.dino.isDucking ? 52 : 36;
      const dinoHeight = this.dino.isDucking ? 28 : 46;
      const dinoX = this.dino.x + 4;
      const dinoY = this.dino.y + 4;

      if (
        dinoX < obs.x + obs.width - 6 &&
        dinoX + dinoWidth > obs.x + 6 &&
        dinoY < obs.y + obs.height - 4 &&
        dinoY + dinoHeight > obs.y + 4
      ) {
        this.gameOver();
        break;
      }

      if (obs.x + obs.width < -10) {
        this.obstacles.splice(i, 1);
      }
    }

    // Cloud parallax
    this.clouds.forEach(cloud => {
      cloud.x -= cloud.speed;
      if (cloud.x < -100) cloud.x = this.width + 50;
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Background Gradient Sky
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.groundY);
    skyGrad.addColorStop(0, '#0a0f1d');
    skyGrad.addColorStop(1, '#131b2e');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Clouds
    this.drawClouds();

    // Ground line & Grid details
    this.drawGround();

    // Obstacles
    this.drawObstacles();

    // Dino
    this.drawDino();

    // Particles
    this.particles.draw(this.ctx);
  }

  drawClouds() {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (const c of this.clouds) {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, 16 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(c.x + 18 * c.scale, c.y - 6 * c.scale, 22 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(c.x + 40 * c.scale, c.y, 18 * c.scale, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawGround() {
    // Neon Horizon Line
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.groundY);
    this.ctx.lineTo(this.width, this.groundY);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Moving ground ticks
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    this.ctx.lineWidth = 1.5;
    for (let x = -this.groundOffset; x < this.width; x += 30) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.groundY + 3);
      this.ctx.lineTo(x + 10, this.groundY + 16);
      this.ctx.stroke();
    }
  }

  drawDino() {
    const d = this.dino;
    this.ctx.save();

    // Dino Glow
    this.ctx.shadowColor = '#10b981';
    this.ctx.shadowBlur = 12;
    this.ctx.fillStyle = '#10b981';

    if (d.isDucking) {
      // Ducking Dino
      this.ctx.fillRect(d.x, d.y + 6, 48, 22); // Main body
      this.ctx.fillRect(d.x + 44, d.y + 12, 12, 10); // Snout
      // Eye
      this.ctx.fillStyle = '#05070c';
      this.ctx.fillRect(d.x + 40, d.y + 10, 3, 3);
      this.ctx.fillStyle = '#10b981';

      // Ducking Legs
      const legStep = d.runFrame % 2;
      this.ctx.fillRect(d.x + 8 + (legStep * 10), d.y + 26, 8, 4);
      this.ctx.fillRect(d.x + 28 - (legStep * 10), d.y + 26, 8, 4);
    } else {
      // Standing / Running Dino
      // Body
      this.ctx.fillRect(d.x + 6, d.y + 14, 28, 26);
      // Head & Snout
      this.ctx.fillRect(d.x + 20, d.y, 20, 18);
      this.ctx.fillRect(d.x + 38, d.y + 6, 6, 12);
      // Eye
      this.ctx.fillStyle = '#05070c';
      this.ctx.fillRect(d.x + 32, d.y + 4, 4, 4);
      this.ctx.fillStyle = '#10b981';
      // Tail
      this.ctx.fillRect(d.x, d.y + 20, 6, 14);
      // Arms
      this.ctx.fillRect(d.x + 32, d.y + 22, 6, 4);

      // Running Legs
      if (d.isGrounded) {
        if (d.runFrame % 2 === 0) {
          this.ctx.fillRect(d.x + 12, d.y + 40, 6, 12);
          this.ctx.fillRect(d.x + 24, d.y + 40, 6, 6);
        } else {
          this.ctx.fillRect(d.x + 12, d.y + 40, 6, 6);
          this.ctx.fillRect(d.x + 24, d.y + 40, 6, 12);
        }
      } else {
        // Jumping legs
        this.ctx.fillRect(d.x + 10, d.y + 40, 6, 8);
        this.ctx.fillRect(d.x + 22, d.y + 40, 6, 8);
      }
    }

    this.ctx.restore();
  }

  drawObstacles() {
    this.ctx.save();
    for (const obs of this.obstacles) {
      if (obs.type === 'cactus') {
        this.ctx.fillStyle = '#ff007f';
        this.ctx.shadowColor = '#ff007f';
        this.ctx.shadowBlur = 10;

        // Cactus stem & arms
        if (obs.count === 1) {
          this.ctx.fillRect(obs.x + 6, obs.y, 10, obs.height);
          this.ctx.fillRect(obs.x, obs.y + 12, 6, 14);
          this.ctx.fillRect(obs.x + 16, obs.y + 8, 6, 16);
        } else {
          // Double cactus
          this.ctx.fillRect(obs.x + 4, obs.y + 8, 8, obs.height - 8);
          this.ctx.fillRect(obs.x + 22, obs.y, 10, obs.height);
          this.ctx.fillRect(obs.x + 16, obs.y + 12, 6, 12);
          this.ctx.fillRect(obs.x + 32, obs.y + 10, 6, 12);
        }
      } else if (obs.type === 'bird') {
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 10;

        // Body
        this.ctx.fillRect(obs.x + 10, obs.y + 10, 20, 10);
        // Beak
        this.ctx.fillRect(obs.x, obs.y + 12, 10, 6);
        // Wings flapping
        if (obs.frame === 0) {
          this.ctx.fillRect(obs.x + 14, obs.y, 10, 10); // Wing UP
        } else {
          this.ctx.fillRect(obs.x + 14, obs.y + 20, 10, 10); // Wing DOWN
        }
      }
    }
    this.ctx.restore();
  }

  formatScore(n) {
    return n.toString().padStart(5, '0');
  }

  updateHUD() {
    this.scoreValEl.innerText = this.formatScore(this.score);
    this.hiScoreValEl.innerText = this.formatScore(this.hiScore);
    this.speedValEl.innerText = (this.gameSpeed / this.baseSpeed).toFixed(1) + 'x';
  }

  gameLoop(time) {
    if (!this.lastTime) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.gameLoop);
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  new DinoGame();
});
