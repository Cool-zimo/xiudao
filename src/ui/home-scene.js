import { getCharacter, CHARACTERS } from '../data/characters.js';

/**
 * 主页 —— 登录后看到的核心画面
 *
 * 玩家所选角色盘腿打坐修炼，无限循环动画：
 *   1. CSS 上下缓浮（6s，±16px）+ 呼吸缩放，模拟吐纳起伏
 *   2. 三层法阵光环（正转 / 反转 / 呼吸缩放）
 *   3. Canvas 灵气粒子自下向上涌动，颜色跟随角色灵气主色，消散后底部重生
 *
 * 顶部显示登录账号与云存档状态，「进入洞府」直达游戏主界面。
 */
export class HomeScene {
    constructor(container, opts = {}) {
        this.container = container;
        this.characterId = opts.characterId || CHARACTERS[0].id;
        this.onEnter = opts.onEnter || (() => { });
        this.onSwitchChar = opts.onSwitchChar || (() => { });
        this.onLogout = opts.onLogout || (() => { });
        this.onSave = opts.onSave || null;          // 手动同步回调
        this.onRestore = opts.onRestore || null;    // 备份恢复回调

        this.user = opts.user || null;              // { login, name, avatar }
        this.cloudReady = !!opts.cloudReady;
        this.saveInfo = opts.saveInfo || null;      // { realm, level, savedAt, source }

        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.running = false;
        this.rafId = null;

        this._build();
        this._bindVisibility();
    }

    _build() {
        const c = getCharacter(this.characterId);
        const u = this.user;
        const si = this.saveInfo;

        // 存档摘要行
        const saveLine = si
            ? `<span class="hs-sv-realm">${this._esc(si.realm)}</span>
               <span class="hs-sv-lv">Lv ${si.level ?? 1}</span>
               ${si.savedAt ? `<span class="hs-sv-time">${this._relTime(si.savedAt)}</span>` : ''}`
            : `<span class="hs-sv-new">尚未开辟洞天</span>`;

        this.container.innerHTML = `
            <div class="home-scene" style="--aura:${c.aura};--aura-rgb:${c.auraRgb}">

                <!-- 顶部：账号 + 云存档状态 -->
                <div class="hs-topbar">
                    ${u ? `
                        <div class="hs-user">
                            <img class="hs-avatar" src="${this._esc(u.avatar)}" alt=""
                                 onerror="this.style.display='none'">
                            <div class="hs-user-txt">
                                <div class="hs-user-name">${this._esc(u.name)}</div>
                                <div class="hs-user-sub">@${this._esc(u.login)}</div>
                            </div>
                        </div>
                    ` : `
                        <div class="hs-user guest">
                            <div class="hs-avatar-fb">👤</div>
                            <div class="hs-user-txt">
                                <div class="hs-user-name">本地试玩</div>
                                <div class="hs-user-sub">未连接云存档</div>
                            </div>
                        </div>
                    `}

                    <div class="hs-cloud ${this.cloudReady ? 'on' : 'off'}">
                        <span class="hs-dot"></span>
                        ${this.cloudReady
                        ? `云存档已连接 · <code>xiudao-save</code>`
                        : `本地存档（未同步）`}
                    </div>

                    <div class="hs-topbar-actions">
                        ${this.onRestore ? '<button class="hs-mini" id="hs-restore">备份</button>' : ''}
                        ${this.onSave ? '<button class="hs-mini" id="hs-sync">同步</button>' : ''}
                        <button class="hs-mini" id="hs-switch">换角色</button>
                        ${u ? '<button class="hs-mini danger" id="hs-logout">退出</button>' : ''}
                    </div>
                </div>

                <canvas class="hs-canvas"></canvas>

                <div class="hs-circle hs-circle-1"></div>
                <div class="hs-circle hs-circle-2"></div>
                <div class="hs-circle hs-circle-3"></div>

                <div class="hs-figure">
                    <img class="hs-portrait" src="${c.sit}" alt="${this._esc(c.name)}修炼中"
                         onerror="this.style.display='none';this.parentNode.classList.add('no-img')">
                    <div class="hs-figure-fallback">🧘</div>
                </div>

                <div class="hs-info">
                    <div class="hs-name">${this._esc(c.name)}</div>
                    <div class="hs-title">${this._esc(c.title)} · 打坐吐纳</div>
                    <div class="hs-save">${saveLine}</div>
                </div>

                <button class="hs-enter" id="hs-enter">进 入 洞 府</button>
            </div>
        `;

        this.canvas = this.container.querySelector('.hs-canvas');
        this.ctx = this.canvas?.getContext('2d');
        this._resize();

        // 事件绑定（每次 _build 重建，用事件委托更稳，这里直接绑到存在节点）
        this.container.querySelector('#hs-enter')
            ?.addEventListener('click', () => this.onEnter());
        this.container.querySelector('#hs-switch')
            ?.addEventListener('click', () => this.onSwitchChar());
        this.container.querySelector('#hs-logout')
            ?.addEventListener('click', () => {
                if (confirm('退出登录？本地令牌会被清除（存档仍在仓库中）。')) this.onLogout();
            });
        this.container.querySelector('#hs-sync')
            ?.addEventListener('click', () => this.onSave?.());
        this.container.querySelector('#hs-restore')
            ?.addEventListener('click', () => this.onRestore?.());

        if (this.running) this.start();
    }

    /** 更新外部传入的状态并重建 UI */
    update(opts = {}) {
        Object.assign(this, opts);
        this._build();
    }

    _relTime(iso) {
        try {
            const d = new Date(iso);
            const diff = Date.now() - d.getTime();
            const m = Math.floor(diff / 60000);
            if (m < 1) return '刚刚';
            if (m < 60) return `${m} 分钟前`;
            const h = Math.floor(m / 60);
            if (h < 24) return `${h} 小时前`;
            return `${Math.floor(h / 24)} 天前`;
        } catch { return ''; }
    }

    setCharacter(id) {
        this.characterId = id;
        this._build();
        if (this.running) this.start();
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
            x: cx + (Math.random() - 0.5) * this.w * 0.72,
            y: spread
                ? this.h * (0.25 + Math.random() * 0.75)
                : this.h + Math.random() * 40,
            r: 1 + Math.random() * 2.6,
            vy: -(0.18 + Math.random() * 0.55),
            sway: 0.3 + Math.random() * 0.9,
            phase: Math.random() * Math.PI * 2,
            life: 0,
            maxLife: 220 + Math.random() * 260,
            alpha: 0.12 + Math.random() * 0.45,
            rgb
        };
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

        const t = performance.now() / 1000;
        const pulse = 0.5 + Math.sin(t * 0.9) * 0.5;
        const g = ctx.createRadialGradient?.(cx, cy, 10, cx, cy, this.w * 0.55);
        if (g) {
            g.addColorStop(0, `rgba(${this.particles[0]?.rgb || '125,211,252'},${0.10 + pulse * 0.07})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, this.w, this.h);
        }

        for (const p of this.particles) {
            const fadeIn = Math.min(1, p.life / 40);
            const fadeOut = 1 - Math.max(0, (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
            const a = p.alpha * fadeIn * Math.max(0, fadeOut);

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.rgb},${a})`;
            ctx.fill();

            if (p.r > 2) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.rgb},${a * 0.16})`;
                ctx.fill();
            }
        }
    }

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
