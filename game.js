// Головний об'єкт гри
const game = {
    canvas: null,
    ctx: null,
    gameState: 'menu',
    selectedCharacter: null,
    
    player: {
        x: 0,
        y: 0,
        health: 100,
        maxHealth: 100,
        alive: true
    },
    
    shooting: false,
    targetX: 0,
    targetY: 0,
    lastShotTime: 0,
    fireRate: 300,
    
    bullets: [],
    bulletSpeed: 12, // Трохи прискорив для динаміки
    bulletDamage: 20,
    
    enemies: [],
    enemySpawnRate: 1500, // Швидший спавн
    lastEnemySpawn: 0,
    
    currentWave: 1,
    enemiesInWave: 10, // ТЕПЕР 10 ВОРОГІВ ДЛЯ ХВИЛІ
    enemiesKilled: 0,
    waveInProgress: false,
    
    coins: 0,
    upgrades: {
        damage: 1,
        fireRate: 1,
        health: 1
    },
    
    bestWave: 0,
    particles: [],
    isPaused: false,
    lastFrameTime: 0,
    
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
        this.loadGameData();
        this.updateShopDisplay();
        this.updateBestWaveDisplay();
        
        // Input listeners
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), {passive: false});
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), {passive: false});
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), {passive: false});
    },
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 100;
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },
    
    showMainMenu() {
        this.gameState = 'menu';
        this.showScreen('mainMenu');
        this.updateBestWaveDisplay();
    },

    showCharacterSelect() {
        this.gameState = 'characterSelect';
        this.showScreen('characterSelect');
    },
    
    showShop() {
        this.gameState = 'shop';
        this.showScreen('shop');
        this.updateShopDisplay();
    },
    
    selectCharacter(character) {
        this.selectedCharacter = character;
        this.startGame();
    },

    startGame() {
        this.gameState = 'playing';
        this.showScreen('gameScreen');
        this.currentWave = 1;
        this.enemiesKilled = 0;
        this.enemiesInWave = 10; // Початкова кількість
        this.waveInProgress = true;
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        
        this.player.maxHealth = 100 + (this.upgrades.health - 1) * 25;
        this.player.health = this.player.maxHealth;
        this.player.alive = true;
        this.bulletDamage = 20 + (this.upgrades.damage - 1) * 10;
        this.fireRate = Math.max(100, 300 - (this.upgrades.fireRate - 1) * 30);
        
        this.updateHUD();
        this.lastFrameTime = Date.now();
        this.gameLoop();
    },

    gameLoop() {
        if (this.gameState !== 'playing' || this.isPaused) {
            if (this.gameState === 'playing') requestAnimationFrame(() => this.gameLoop());
            return;
        }
        const now = Date.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.update(deltaTime);
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    },

    update(deltaTime) {
        if (!this.player.alive) return;
        const now = Date.now();

        if (this.shooting && now - this.lastShotTime > this.fireRate) {
            this.shoot();
            this.lastShotTime = now;
        }

        this.bullets = this.bullets.filter(bullet => {
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            return bullet.x > 0 && bullet.x < this.canvas.width && bullet.y > 0 && bullet.y < this.canvas.height;
        });

        // Спавн ворогів (обмежуємо кількість на екрані, але не загальну кількість вбитих)
        if (this.waveInProgress && now - this.lastEnemySpawn > this.enemySpawnRate) {
            if (this.enemies.length < 5 + Math.floor(this.currentWave / 2)) {
                this.spawnEnemy();
                this.lastEnemySpawn = now;
            }
        }

        this.enemies.forEach(enemy => {
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 50) {
                enemy.x += (dx / distance) * enemy.speed;
                enemy.y += (dy / distance) * enemy.speed;
            } else if (now - enemy.lastAttack > enemy.attackRate) {
                this.player.health -= enemy.damage;
                enemy.lastAttack = now;
                this.createParticles(this.player.x, this.player.y, '#ff0000', 5);
                if (this.player.health <= 0) {
                    this.player.health = 0;
                    this.player.alive = false;
                    this.gameOver();
                }
                this.updateHUD();
            }
        });

        // Обробка зіткнень та ПЕРЕВІРКА ХВИЛІ
        this.bullets = this.bullets.filter(bullet => {
            let bulletHit = false;
            this.enemies = this.enemies.filter(enemy => {
                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < enemy.radius + 5) {
                    enemy.health -= this.bulletDamage;
                    bulletHit = true;
                    this.createParticles(enemy.x, enemy.y, enemy.color, 5);
                    
                    if (enemy.health <= 0) {
                        this.enemiesKilled++; // РАХУЄМО ВБИТОГО
                        this.coins += enemy.reward;
                        this.createParticles(enemy.x, enemy.y, '#ffd700', 15);
                        this.updateHUD();
                        
                        // ЯКЩО ВБИЛИ 10 — НОВА ХВИЛЯ
                        if (this.enemiesKilled >= 10) {
                            this.nextWave();
                        }
                        return false;
                    }
                    return true;
                }
                return true;
            });
            return !bulletHit;
        });

        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--; p.alpha -= 0.02;
            return p.life > 0 && p.alpha > 0;
        });
    },

    nextWave() {
        this.currentWave++;
        this.enemiesKilled = 0; // Скидаємо лічильник для нової хвилі
        
        // Очищаємо залишки ворогів з екрану гарним ефектом
        this.enemies.forEach(e => this.createParticles(e.x, e.y, e.color, 10));
        this.enemies = [];
        
        if (this.currentWave > this.bestWave) {
            this.bestWave = this.currentWave;
            this.saveGameData();
        }
        
        this.updateHUD();
        this.showWaveTransition();
        this.saveGameData();
    },

    render() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawStars();
        this.enemies.forEach(enemy => this.drawEnemy(enemy));
        
        this.ctx.fillStyle = '#ffff00';
        this.bullets.forEach(bullet => {
            this.ctx.beginPath();
            this.ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
        this.drawPlayer();
    },

    drawStars() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = 0; i < 30; i++) {
            const x = (i * 150) % this.canvas.width;
            const y = (i * 250) % this.canvas.height;
            this.ctx.fillRect(x, y, 2, 2);
        }
    },

    drawPlayer() {
        const x = this.player.x;
        const y = this.player.y;
        
        // Малюємо основу
        this.ctx.fillStyle = '#34495e';
        this.ctx.fillRect(x - 20, y, 40, 20);
        
        // Ствол, що дивиться на ціль
        const angle = Math.atan2(this.targetY - y, this.targetX - x);
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.fillRect(0, -5, 40, 10);
        this.ctx.restore();

        if (this.selectedCharacter) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.selectedCharacter, x, y + 40);
        }
    },

    drawEnemy(enemy) {
        this.ctx.fillStyle = enemy.color;
        this.ctx.beginPath();
        this.ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Смужка здоров'я ворога
        const bw = enemy.radius * 2;
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, bw, 4);
        this.ctx.fillStyle = 'lime';
        this.ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, bw * (enemy.health / enemy.maxHealth), 4);
    },

    shoot() {
        const dx = this.targetX - this.player.x;
        const dy = this.targetY - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.bullets.push({
            x: this.player.x,
            y: this.player.y,
            vx: (dx / dist) * this.bulletSpeed,
            vy: (dy / dist) * this.bulletSpeed
        });
    },

    spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = Math.random() * this.canvas.width; y = -30; }
        else if (side === 1) { x = this.canvas.width + 30; y = Math.random() * this.canvas.height; }
        else if (side === 2) { x = Math.random() * this.canvas.width; y = this.canvas.height + 30; }
        else { x = -30; y = Math.random() * this.canvas.height; }

        const h = 30 + this.currentWave * 10;
        this.enemies.push({
            x, y,
            health: h, maxHealth: h,
            speed: 1 + Math.min(this.currentWave * 0.1, 2),
            damage: 5 + Math.floor(this.currentWave / 2),
            reward: 10,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            radius: 15 + Math.random() * 10,
            lastAttack: 0,
            attackRate: 1000
        });
    },

    showWaveTransition() {
        const div = document.createElement('div');
        div.style.cssText = `position:fixed; top:40%; left:50%; transform:translate(-50%,-50%); 
            color:#ffd700; font-size:4rem; font-weight:bold; text-shadow:0 0 20px #000; 
            z-index:1000; pointer-events:none; animation:fadeInOut 2s forwards;`;
        div.textContent = `ХВИЛЯ ${this.currentWave}`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2000);
    },

    createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color, size: Math.random() * 3 + 1,
                life: 30, alpha: 1
            });
        }
    },

    handleMouseDown(e) { this.shooting = true; this.updateMousePos(e); },
    handleMouseMove(e) { this.updateMousePos(e); },
    handleMouseUp() { this.shooting = false; },
    handleTouchStart(e) { e.preventDefault(); this.shooting = true; this.updateTouchPos(e); },
    handleTouchMove(e) { e.preventDefault(); this.updateTouchPos(e); },
    handleTouchEnd() { this.shooting = false; },
    updateMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.targetX = e.clientX - rect.left;
        this.targetY = e.clientY - rect.top;
    },
    updateTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.targetX = e.touches[0].clientX - rect.left;
        this.targetY = e.touches[0].clientY - rect.top;
    },

    updateHUD() {
        document.getElementById('waveDisplay').textContent = this.currentWave;
        document.getElementById('coinsDisplay').textContent = this.coins;
        const hp = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('healthBar').style.width = hp + '%';
        // Додатково оновлюємо прогрес вбивств у консолі або можна додати в HTML
    },

    updateShopDisplay() {
        document.getElementById('shopCoins').textContent = this.coins;
        document.getElementById('damageLevel').textContent = this.upgrades.damage;
        document.getElementById('damagePrice').textContent = 50 * this.upgrades.damage;
        document.getElementById('fireRateLevel').textContent = this.upgrades.fireRate;
        document.getElementById('fireRatePrice').textContent = 75 * this.upgrades.fireRate;
        document.getElementById('healthLevel').textContent = this.upgrades.health;
        document.getElementById('healthPrice').textContent = 100 * this.upgrades.health;
    },

    buyUpgrade(type) {
        let price = type === 'damage' ? 50 * this.upgrades.damage : 
                    type === 'fireRate' ? 75 * this.upgrades.fireRate : 100 * this.upgrades.health;
        if (this.coins >= price) {
            this.coins -= price;
            this.upgrades[type]++;
            this.updateShopDisplay();
            this.saveGameData();
        }
    },

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pauseMenu').classList.toggle('active', this.isPaused);
        if (!this.isPaused) { this.lastFrameTime = Date.now(); this.gameLoop(); }
    },

    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('finalWave').textContent = this.currentWave;
        document.getElementById('finalCoins').textContent = this.coins;
        document.getElementById('gameOver').classList.add('active');
    },

    restartGame() {
        document.getElementById('gameOver').classList.remove('active');
        this.startGame();
    },

    quitToMenu() {
        this.gameState = 'menu';
        this.showMainMenu();
    },

    saveGameData() {
        const data = { coins: this.coins, upgrades: this.upgrades, bestWave: this.bestWave };
        localStorage.setItem('monsterShooterData', JSON.stringify(data));
    },

    loadGameData() {
        const saved = localStorage.getItem('monsterShooterData');
        if (saved) {
            const data = JSON.parse(saved);
            this.coins = data.coins || 0;
            this.upgrades = data.upgrades || { damage: 1, fireRate: 1, health: 1 };
            this.bestWave = data.bestWave || 0;
        }
    },
    
    updateBestWaveDisplay() {
        document.getElementById('bestWave').textContent = this.bestWave;
    }
};

window.addEventListener('DOMContentLoaded', () => game.init());