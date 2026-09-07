/**
 * 天劫 Canvas 小游戏 —— 弹幕躲避
 *
 * 为什么用 Canvas 而不是 DOM：
 *   天劫同时有几十道雷电 + 粒子特效，DOM 节点开销大且动画卡顿。
 *   Canvas 单画布重绘，60fps 稳定。
 *
 * 玩法：
 *   1. 顶部持续降下落雷，落雷前有一道预警光柱（给玩家反应时间）
 *   2. 玩家用 ←→ 或 A/D 或拖拽移动底部的「元婴小人」
 *   3. 被劈中扣血，血条清空则渡劫失败
 *   4. 撑满 duration 秒即结算，闪避率越高成功率越高
 */
export class TribulationCanvas {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = opts.width || 480;
        this.height = opts.height || 640;
        canvas.width = this.width;
        canvas.height = this.height;

        this.onUpdate = opts.onUpdate || (() => {});
        this.onEnd = opts.onEnd || (() => {});

        this.reset(opts.config || {});
        this._bindInput();
    }

    reset(cfg) {
        this.lightning = cfg.lightning || 5;
        this.speed = cfg.speed || 1.2;
        this.duration = cfg.duration || 15;
        this.baseChance = cfg.baseChance ?? 0.6;
        this.realmName = cfg.realm || '';
        this.nextRealm = cfg.nextRealm || '';

        this.bolts = [];
        this.particles = [];
        this.elapsed = 0;
        this.dodgedThisSecond = 0;
        this.hitsThisSecond = 0;
        this.totalDodged = 0;
        this.totalIncoming = 0;
        this.hits = 0;
        this.hpRatio = 1.0;
        this.running = false;
        this.finished = false;

        // 玩家（元婴小人）
        this.playerX = this.width / 2;
        this.playerY = this.height - 90;
        this.playerW = 26;
        this.playerH = 40;
        this.playerSpeed = 300 + (cfg.playerSpeed || 0);

        this.keys = { left: false, right: false };
        this.lastTickSecond = 0;
        this.lastFrameTime = 0;
        this.spawnAccumulator = 0;
    }

    _bindInput() {
        if (this._bound) return;
        this._bound = true;

        window.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
        });
        window.addEventListener('keyup', e => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
        });

        // 触摸/鼠标拖拽
        const moveTo = (clientX) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (clientX - rect.left) * (this.width / rect.width);
            this.playerX = Math.max(this.playerW / 2, Math.min(this.width - this.playerW / 2, x));
        };
        this.canvas.addEventListener('pointerdown', e => { this.dragging = true; moveTo(e.clientX); });
        this.canvas.addEventListener('pointermove', e => { if (this.dragging) moveTo(e.clientX); });
        window.addEventListener('pointerup', () => { this.dragging = false; });
    }

    start() {
        this.running = true;
        this.finished = false;
        this.lastFrameTime = performance.now();
        this._loop();
    }

    stop() {
        this.running = false;
    }

    _loop() {
        if (!this.running) return;
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;

        this._update(dt);
        this._render();

        if (this.finished) {
            this.running = false;
            this.onEnd(this.getResult());
            return;
        }
        requestAnimationFrame(() => this._loop());
    }

    _update(dt) {
        // 玩家移动
        let dx = 0;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;
        if (dx !== 0) {
            this.playerX = Math.max(
                this.playerW / 2,
                Math.min(this.width - this.playerW / 2, this.playerX + dx * this.playerSpeed * dt)
            );
        }

        // 生成落雷：每秒 lightning 道，均匀分布在时间轴上
        this.elapsed += dt;
        const spawnRate = this.lightning * this.speed;
        this.spawnAccumulator += dt * spawnRate;
        while (this.spawnAccumulator >= 1) {
            this.spawnAccumulator -= 1;
            this._spawnBolt();
        }

        // 更新落雷
        for (const b of this.bolts) {
            b.warnTime -= dt;
            if (b.warnTime <= 0 && !b.struck) {
                b.struck = true;
                b.strikeAnim = 0;
                this.totalIncoming++;
                // 判定：玩家是否在雷击范围内
                const half = this.playerW / 2;
                const hit = Math.abs(b.x - this.playerX) < (b.width / 2 + half * 0.6);
                if (hit) {
                    this.hits++;
                    this.hitsThisSecond++;
                    this.hpRatio = Math.max(0, this.hpRatio - (0.08 + this.speed * 0.02));
                    this._spawnParticles(b.x, this.playerY, '#ef4444', 18);
                } else {
                    this.totalDodged++;
                    this.dodgedThisSecond++;
                    this._spawnParticles(b.x, this.height - 20, '#3b82f6', 8);
                }
            }
            if (b.struck) b.strikeAnim += dt;
        }
        this.bolts = this.bolts.filter(b => !b.struck || b.strikeAnim < 0.4);

        // 粒子
        for (const p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        // 每秒上报一次给 TribulationSystem
        const sec = Math.floor(this.elapsed);
        if (sec > this.lastTickSecond) {
            const dodges = this.dodgedThisSecond;
            this.dodgedThisSecond = 0;
            this.hitsThisSecond = 0;
            this.lastTickSecond = sec;
            this.onUpdate(dodges);
        }

        // 结束条件
        if (this.elapsed >= this.duration || this.hpRatio <= 0) {
            this.finished = true;
        }
    }

    _spawnBolt() {
        const width = 40 + Math.random() * 30;
        this.bolts.push({
            x: width / 2 + Math.random() * (this.width - width),
            width,
            warnTime: 0.55 + Math.random() * 0.35,  // 预警时间：给玩家反应窗口
            struck: false,
            strikeAnim: 0
        });
    }

    _spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 140;
            this.particles.push({
                x, y, color,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4 + Math.random() * 0.4,
                size: 2 + Math.random() * 3
            });
        }
    }

    _render() {
        const ctx = this.ctx;
        const W = this.width, H = this.height;

        // 背景：雷云渐变
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#1e1b4b');
        bg.addColorStop(0.5, '#312e81');
        bg.addColorStop(1, '#0f172a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // 翻涌的云层（简单正弦波）
        ctx.fillStyle = 'rgba(99,102,241,0.15)';
        for (let i = 0; i < 3; i++) {
            const y = 60 + i * 40;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= W; x += 20) {
                ctx.lineTo(x, y + Math.sin(x * 0.02 + this.elapsed * (1 + i * 0.3)) * 12);
            }
            ctx.lineTo(W, y + 60);
            ctx.lineTo(0, y + 60);
            ctx.closePath();
            ctx.fill();
        }

        // 落雷：预警光柱 + 劈下
        for (const b of this.bolts) {
            if (!b.struck) {
                // 预警：半透明红色光柱 + 闪烁
                const alpha = 0.25 + Math.sin(this.elapsed * 20) * 0.12;
                ctx.fillStyle = `rgba(239,68,68,${alpha})`;
                ctx.fillRect(b.x - b.width / 2, 0, b.width, H);
                // 地面警示圈
                ctx.strokeStyle = `rgba(248,113,113,${alpha + 0.3})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(b.x, H - 20, b.width / 2, 8, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // 劈下：锯齿闪电
                const t = b.strikeAnim / 0.4;
                ctx.strokeStyle = `rgba(250,250,210,${1 - t})`;
                ctx.lineWidth = 4 - t * 2;
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#fef08a';
                ctx.beginPath();
                ctx.moveTo(b.x, 0);
                let y = 0;
                while (y < H - 20) {
                    y += 25;
                    ctx.lineTo(b.x + (Math.random() - 0.5) * 22, Math.min(y, H - 20));
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }

        // 粒子
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 玩家：元婴小人（发光球体 + 光晕）
        const glow = ctx.createRadialGradient(
            this.playerX, this.playerY, 2,
            this.playerX, this.playerY, 34
        );
        glow.addColorStop(0, 'rgba(167,243,208,0.95)');
        glow.addColorStop(0.5, 'rgba(52,211,153,0.5)');
        glow.addColorStop(1, 'rgba(16,185,129,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.playerX, this.playerY, 34, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#a7f3d0';
        ctx.beginPath();
        ctx.arc(this.playerX, this.playerY, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#064e3b';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('元', this.playerX, this.playerY + 4);

        // HUD：血条 + 倒计时
        const barW = W - 60, barH = 10;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(30, 20, barW, barH);
        const hpColor = this.hpRatio > 0.5 ? '#22c55e' : this.hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillStyle = hpColor;
        ctx.fillRect(30, 20, barW * this.hpRatio, barH);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(30, 20, barW, barH);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`道体 ${Math.ceil(this.hpRatio * 100)}%`, 30, 50);
        ctx.textAlign = 'right';
        const remain = Math.max(0, this.duration - this.elapsed);
        ctx.fillText(`剩余 ${remain.toFixed(1)}s`, W - 30, 50);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#a5b4fc';
        ctx.font = '13px sans-serif';
        ctx.fillText(`${this.realmName} → ${this.nextRealm}`, W / 2, 50);

        // 闪避统计
        ctx.textAlign = 'left';
        ctx.fillStyle = '#7dd3fc';
        ctx.font = '12px sans-serif';
        ctx.fillText(`闪避 ${this.totalDodged} / 被劈 ${this.hits}`, 30, 72);
        ctx.textAlign = 'start';
    }

    getResult() {
        const total = Math.max(1, this.totalIncoming);
        return {
            duration: this.duration,
            elapsed: this.elapsed,
            dodged: this.totalDodged,
            hits: this.hits,
            dodgeRate: this.totalDodged / total,
            hpRatio: this.hpRatio,
            survived: this.hpRatio > 0
        };
    }
}
