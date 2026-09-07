import { getCharacter } from '../data/characters.js';

/**
 * 主页修炼场景 —— 玩家选定的角色盘腿修炼的无限循环动画
 *
 * 三层构成：
 *   1. 底部法阵光晕（CSS 呼吸）
 *   2. 角色打坐立绘（CSS 上下缓浮 + 微缩放，模拟呼吸吐纳）
 *   3. 灵气粒子层（Canvas，自下向上涌动，颜色跟随角色灵气主色）
 *
 * 性能：粒子数量按屏幕宽度自适应，页面隐藏时自动暂停 rAF
 */
export class HomeScene {
    constructor(container, opts = {}) {
        this.container = container;
        this.characterId = opts.characterId || 'swordsman';
        this.onEnter = opts.onEnter || (() => {});

        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.running = false;
        this.rafId = null;
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        this._build();
        this._bindVisibility();
    }

    _build() {
        const c = getCharacter(this.characterId);
        this.container.innerHTML = `
            <div class="home-scene" style="--aura:${c.aura};--aura-rgb:${c.auraRgb}">
                <canvas class="hs-canvas"></canvas>

                <div class="hs-circle hs-circle-1"></div>
                <div class="hs-circle hs-circle-2"></div>
                <div class="hs-circle hs-circle-3"></div>

                <div class="hs-figure">
                    <img class="hs-portrait" src="${c.sit}" alt="${this._esc(c.name)}修练中"
                         onerror="this.style.display='none';this.parentNode.classList.add('no-img')">
                    <div class="hs-figure-fallback">🧘</div>
                </div>

                <div class="hs-info">
                    <div class="hs-name">${this._esc(c.name)}</div>
                    <div class="hs-title">${this._esc(c.title)} · 打坐吐纳</div>
                </div>

                <button class="hs-enter">进入洞府</button>
            </div>
        `;

        this.canvas = this.container.querySelector('.hs-canvas');
        this.ctx = this.canvas?.getContext('2d');
        this._resize();

        window.addEventListener('resize', () => this._resize());

        this.container.querySelector('.hs-enter')
            ?.addEventListener('click', () => this.onEnter());
    }

    _resize() {
        if (!this.canvas) return;
        const rect = this.container.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        this.w = rect.width || 480;
        this.h = rect.height || 520;
        this.canvas.width = this.w * dpr;
        this.canvas.height = this.h * dpr;
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

        // 粒子数按面积自适应，移动端减半
        const target = Math.floor((this.w * this.h) / 9000);
        this.maxParticles = Math.max(18, Math.min(70, target));
        this._seedParticles();
    }

    _seedParticles() {
        const c = getCharacter(this.characterId);
        const rgb = c.auraRgb;
        this.particles = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this._makeParticle(rgb, true));
        }
    }

    _makeParticle(rgb, spread = false) {
        const cx = this.w / 2;
        return {
            // 大部分粒子从角色周围的环形区域升起
            x: cx + (Math.random() - 0.5) * this.w * 0.72,
            y: spread
                ? this.h * (0.25 + Math.random() * 0.75)
                : this.h + Math.random() * 40,
            r: 1 + Math.random() * 2.6,
            vy: -(0.18 + Math.random() * 0.55),
            // 轻微横向摆动
            sway: 0.3 + Math.random() * 0.9,
            phase: Math.random() * Math.PI * 2,
            life: 0,
            maxLife: 220 + Math.random() * 260,
            alpha: 0.12 + Math.random() * 0.45,
            rgb
        };
    }

    setCharacter(id) {
        this.characterId = id;
        this._build();
        if (this.running) this.start();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this._loop();
    }

    stop() {
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    _loop() {
        if (!this.running) return;
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this._update(dt);
        this._render();

        this.rafId = requestAnimationFrame(() => this._loop());
    }

    _update(dt) {
        const c = getCharacter(this.characterId);
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.life += dt * 60;
            p.y += p.vy * dt * 60;
            p.phase += dt * p.sway;
            p.x += Math.sin(p.phase) * 0.35;

            // 粒子消散后从底部重生，形成无限涌动
            if (p.y < -20 || p.life > p.maxLife) {
                this.particles[i] = this._makeParticle(c.auraRgb, false);
            }
        }
    }

    _render() {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this.w, this.h);

        const cx = this.w / 2;
        const cy = this.h * 0.62;

        // 中心柔和光晕（呼吸感）
        const t = performance.now() / 1000;
        const pulse = 0.5 + Math.sin(t * 0.9) * 0.5;
        const g = ctx.createRadialGradient?.(cx, cy, 10, cx, cy, this.w * 0.55);
        if (g) {
            g.addColorStop(0, `rgba(${this.particles[0]?.rgb || '125,211,252'},${0.10 + pulse * 0.07})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, this.w, this.h);
        }

        // 灵气粒子
        for (const p of this.particles) {
            const fadeIn = Math.min(1, p.life / 40);
            const fadeOut = 1 - Math.max(0, (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
            const a = p.alpha * fadeIn * Math.max(0, fadeOut);

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.rgb},${a})`;
            ctx.fill();

            // 部分粒子带光晕
            if (p.r > 2) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.rgb},${a * 0.16})`;
                ctx.fill();
            }
        }
    }

    /** 页面切到后台时暂停，省电 */
    _bindVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.stop();
            else if (this.container.isConnected) this.start();
        });
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
