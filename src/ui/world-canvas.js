import { TILE, TILE_DEFS, TILE_IMGS, RES_DEFS, tileDef } from '../data/terrain.js';
import { World, TILE_PX } from '../systems/world.js';
import { TimeSystem } from '../systems/time.js';
import { NPCSystem } from '../systems/npc.js';

/**
 * 世界地图渲染（Canvas）
 *
 * 性能策略：
 *   1. 整张地图（48×48，每格 48px = 2304px）预渲染到离屏 canvas
 *   2. 每帧只做一次 drawImage 的视口裁剪拷贝
 *   3. 动态元素（玩家、资源、灵气热力）单独绘制在上方
 * 这样即使世界扩大到 128×128 也不会掉帧。
 */
export class WorldCanvas {
    constructor(container, world, opts = {}) {
        this.container = container;
        this.world = world;
        this.onTileInfo = opts.onTileInfo || (() => { });
        this.onMove = opts.onMove || (() => { });

        this.tilePx = TILE_PX;
        // 72px 一格，视口 11 格 ≈ 792px，兼顾清晰度与一屏能看到的地形范围
        this.viewCols = opts.viewCols || 11;
        this.zoom = opts.zoom || 1;

        this.camX = 0;      // 视口左上角对应的世界格坐标（可为小数，用于平滑）
        this.camY = 0;

        this.player = { x: 24, y: 10, px: 24, py: 10 };  // px/py 为渲染插值坐标
        this.showQi = false;
        this.images = new Map();
        this.loaded = false;

        /** 外部注入：NPC 系统与时间系统（P2 动态世界） */
        this.npcSystem = opts.npcSystem || null;
        this.time = opts.time || null;

        this._build();
    }

    _build() {
        const vw = this.viewCols * this.tilePx;
        this.container.innerHTML = `
            <div class="wc-root" style="--tw:${vw}px">
                <div class="wc-toolbar">
                    <button class="wc-btn" data-act="qi">🌫️ 灵气图</button>
                    <button class="wc-btn" data-act="legend">🗺️ 图例</button>
                    <button class="wc-btn" data-act="chronicle">📜 天下事</button>
                    <span class="wc-time" id="wc-time">—</span>
                    <span class="wc-pos" id="wc-pos">—</span>
                    <span class="wc-hint">方向键 / WASD 移动 · 空格采集</span>
                </div>
                <canvas class="wc-canvas" width="${vw}" height="${vw}"></canvas>
                <div class="wc-legend hidden" id="wc-legend">
                    ${Object.entries(TILE_DEFS).map(([k, d]) => `
                        <div class="wc-lg">
                            <i style="background:${d.color}"></i>
                            <b>${d.name}</b>
                            <span>灵气 ${d.qi}${d.walk ? '' : ' · 不可通行'}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="wc-chronicle hidden" id="wc-chronicle">
                    <div class="wcc-head">
                        <b>📜 天下大事记</b>
                        <span id="wcc-summary"></span>
                    </div>
                    <div class="wcc-list" id="wcc-list"></div>
                </div>
            </div>
        `;

        this.canvas = this.container.querySelector('.wc-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.vw = vw;

        // 工具栏
        this.container.querySelector('[data-act="qi"]')?.addEventListener('click', (e) => {
            this.showQi = !this.showQi;
            e.target.classList.toggle('on', this.showQi);
            this.render();
        });
        this.container.querySelector('[data-act="legend"]')?.addEventListener('click', () => {
            this.container.querySelector('#wc-legend')?.classList.toggle('hidden');
        });
        this.container.querySelector('[data-act="chronicle"]')?.addEventListener('click', () => {
            this.container.querySelector('#wc-chronicle')?.classList.toggle('hidden');
        });

        this._loadImages().then(() => {
            this.loaded = true;
            this._prerender();
            this.render();
        });
        this._bindInput();
    }

    _loadImages() {
        const tasks = [];
        for (const [k, src] of Object.entries(TILE_IMGS)) {
            tasks.push(new Promise(res => {
                const img = new Image();
                img.onload = img.onerror = () => { this.images.set(k, img); res(); };
                img.src = src;
            }));
        }
        for (const [k, d] of Object.entries(RES_DEFS)) {
            tasks.push(new Promise(res => {
                const img = new Image();
                img.onload = img.onerror = () => { this.images.set(k, img); res(); };
                img.src = d.img;
            }));
        }
        return Promise.all(tasks);
    }

    /** 把整张地图画到离屏 canvas */
    _prerender() {
        const N = this.world.size;
        const t = this.tilePx;
        const off = document.createElement('canvas');
        off.width = N * t;
        off.height = N * t;
        const c = off.getContext('2d');

        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const tile = this.world.get(x, y);
                const img = this.images.get(tile);
                if (img && img.width) {
                    c.drawImage(img, x * t, y * t, t, t);
                } else {
                    c.fillStyle = tileDef(tile).color;
                    c.fillRect(x * t, y * t, t, t);
                }
                // 不再画生硬网格线：靠瓦片自身的明暗层次区分地块，
                // 只在地块四角点一个极淡的定位点，避免整体显得廉价
            }
        }
        this.offscreen = off;
    }

    _bindInput() {
        const handler = (e) => {
            const map = {
                ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
                w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
                W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0]
            };
            const m = map[e.key];
            if (m) { e.preventDefault(); this.move(m[0], m[1]); return; }
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.onTileInfo(this.player.x, this.player.y, 'harvest');
            }
        };
        window.addEventListener('keydown', handler);
        this._keyHandler = handler;

        // 点击地图移动/查看
        this.canvas?.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const sx = (e.clientX - rect.left) / (rect.width / this.vw);
            const sy = (e.clientY - rect.top) / (rect.height / this.vw);
            const wx = Math.floor(this.camX + sx / this.tilePx);
            const wy = Math.floor(this.camY + sy / this.tilePx);
            // 点到相邻格就走一步，否则只查看信息
            const dx = wx - this.player.x, dy = wy - this.player.y;
            if (Math.abs(dx) + Math.abs(dy) === 1) this.move(dx, dy);
            else this.onTileInfo(wx, wy, 'inspect');
        });
    }

    /** 玩家移动（返回移动结果，供上层触发事件） */
    move(dx, dy) {
        const nx = this.player.x + dx;
        const ny = this.player.y + dy;
        if (!this.world.walkable(nx, ny)) {
            const why = this.world.get(nx, ny) === 'cloud' ? '前方是云海，无法涉足' : '此路不通';
            this.onMove({ ok: false, reason: why });
            return { ok: false, reason: why };
        }
        this.player.x = nx;
        this.player.y = ny;
        this._clampCam();
        this.render();
        const res = { ok: true, x: nx, y: ny, tile: this.world.get(nx, ny), qi: this.world.qiAt(nx, ny) };
        this.onMove(res);
        return res;
    }

    setPlayer(x, y) {
        this.player.x = x; this.player.y = y;
        this.player.px = x; this.player.py = y;
        this._clampCam();
        this.render();
    }

    _clampCam() {
        const half = Math.floor(this.viewCols / 2);
        this.camX = Math.max(0, Math.min(this.world.size - this.viewCols, this.player.x - half));
        this.camY = Math.max(0, Math.min(this.world.size - this.viewCols, this.player.y - half));
    }

    render() {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this.vw, this.vw);

        const t = this.tilePx;
        const ox = -this.camX * t;
        const oy = -this.camY * t;

        // 1. 地图底图
        if (this.offscreen) {
            ctx.drawImage(this.offscreen, ox, oy);
        } else {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, this.vw, this.vw);
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.fillText('地图加载中…', 20, 30);
        }

        const sx = (wx) => (wx - this.camX) * t;
        const sy = (wy) => (wy - this.camY) * t;

        // 2. 灵气热力图（叠加）
        if (this.showQi) {
            const c0 = Math.floor(this.camX), c1 = Math.ceil(this.camX + this.viewCols);
            const r0 = Math.floor(this.camY), r1 = Math.ceil(this.camY + this.viewCols);
            for (let y = r0; y <= r1; y++) {
                for (let x = c0; x <= c1; x++) {
                    if (!this.world.inBounds(x, y)) continue;
                    const q = this.world.qiAt(x, y);
                    if (q <= 0) continue;
                    const a = Math.min(0.55, q / 12);
                    ctx.fillStyle = `rgba(56,189,248,${a})`;
                    ctx.fillRect(sx(x), sy(y), t, t);
                }
            }
        }

        // 3. 资源图标
        const half = t * 0.32;
        for (const [key, r] of this.world.resources) {
            const [rx, ry] = key.split(',').map(Number);
            if (rx < this.camX - 1 || ry < this.camY - 1 ||
                rx > this.camX + this.viewCols || ry > this.camY + this.viewCols) continue;
            const img = this.images.get(r.type);
            const cx = sx(rx) + t / 2, cy = sy(ry) + t / 2;
            if (img && img.width) {
                ctx.drawImage(img, cx - half, cy - half, half * 2, half * 2);
            } else {
                ctx.fillStyle = r.type === 'herb' ? '#4ade80' : '#c084fc';
                ctx.beginPath();
                ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 4. 建筑标记
        for (const [key] of this.world.buildings) {
            const [bx, by] = key.split(',').map(Number);
            if (bx < this.camX - 1 || by < this.camY - 1 ||
                bx > this.camX + this.viewCols || by > this.camY + this.viewCols) continue;
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(sx(bx) + t * 0.3, sy(by) + t * 0.25, t * 0.4, t * 0.45);
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(sx(bx) + t * 0.42, sy(by) + t * 0.5, t * 0.16, t * 0.2);
        }

        // 4.5 NPC（P2 动态世界）
        if (this.npcSystem) {
            for (const n of this.npcSystem.npcs.values()) {
                if (!n.alive) continue;
                if (n.x < this.camX - 1 || n.y < this.camY - 1 ||
                    n.x > this.camX + this.viewCols || n.y > this.camY + this.viewCols) continue;
                const cx = sx(n.x) + t / 2, cy = sy(n.y) + t / 2;
                const col = n.def.color;

                // 外圈（邪修用红光示警）
                ctx.beginPath();
                ctx.arc(cx, cy, t * 0.24, 0, Math.PI * 2);
                ctx.fillStyle = col;
                ctx.globalAlpha = 0.25;
                ctx.fill();
                ctx.globalAlpha = 1;

                // 本体
                ctx.beginPath();
                ctx.arc(cx, cy, t * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = col;
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = n.isEvil ? '#7f1d1d' : '#0f172a';
                ctx.stroke();

                // 宗门弟子加个小标记
                if (n.sectId) {
                    ctx.fillStyle = '#f8fafc';
                    ctx.beginPath();
                    ctx.arc(cx, cy, t * 0.05, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 5. 昼夜滤镜
        if (this.time) {
            const d = this.time.daylight();
            // d=1 白天无滤镜；d=0 夜晚深蓝压暗
            const dark = 1 - d;
            if (dark > 0.02) {
                ctx.fillStyle = `rgba(15,23,66,${dark * 0.55})`;
                ctx.fillRect(0, 0, this.vw, this.vw);
            }
            // 黄昏/黎明暖色调
            if (d > 0.05 && d < 0.6) {
                ctx.fillStyle = `rgba(251,146,60,${(1 - Math.abs(d - 0.3)) * 0.10})`;
                ctx.fillRect(0, 0, this.vw, this.vw);
            }
        }

        // 6. 视口边框
        ctx.strokeStyle = 'rgba(148,163,184,.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, this.vw - 2, this.vw - 2);

        // 6. 玩家（光晕 + 本体）
        const px = sx(this.player.x) + t / 2;
        const py = sy(this.player.y) + t / 2;
        const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;

        const g = ctx.createRadialGradient(px, py, 2, px, py, t * 0.55);
        if (g) {
            g.addColorStop(0, `rgba(250,250,210,${0.35 + pulse * 0.2})`);
            g.addColorStop(1, 'rgba(250,250,210,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px, py, t * 0.55, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(px, py, t * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = '#fef9c3';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();

        // 玩家朝向指示（小三角）
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(px, py - t * 0.36);
        ctx.lineTo(px - 4, py - t * 0.24);
        ctx.lineTo(px + 4, py - t * 0.24);
        ctx.closePath();
        ctx.fill();

        // 7. 位置信息
        const pos = this.container.querySelector('#wc-pos');
        if (pos) {
            const q = this.world.qiAt(this.player.x, this.player.y);
            pos.textContent = `(${this.player.x}, ${this.player.y}) · ${tileDef(this.world.get(this.player.x, this.player.y)).name} · 灵气 ${q}`;
        }

        // 8. 时间与编年史
        if (this.time) {
            const tEl = this.container.querySelector('#wc-time');
            if (tEl) {
                const s = this.time.shichen();
                const sea = this.time.season();
                const mul = this.time.cultivationMul(
                    this.playerKarma ?? 0);
                tEl.textContent = `${this.time.display()} · 修炼 ×${mul}`;
                tEl.title = `${s.name}｜${sea.desc}`;
            }
        }
        this._renderChronicle();
    }

    /** 渲染天下大事记 */
    _renderChronicle() {
        if (!this.npcSystem) return;
        const list = this.container.querySelector('#wcc-list');
        const sum = this.container.querySelector('#wcc-summary');
        if (!list) return;

        const s = this.npcSystem.summary();
        if (sum) {
            const sectTxt = Object.entries(s.sects)
                .map(([n, v]) => `${n} ${v.members}人`)
                .join(' · ');
            sum.textContent = `在世 ${s.alive} 人 · 陨落 ${s.dead} 人 ｜ ${sectTxt}`;
        }
        list.innerHTML = s.chronicle.length
            ? s.chronicle.map(c =>
                `<div class="wcc-item"><span class="wcc-at">${c.at}</span>${c.text}</div>`
            ).join('')
            : '<div class="wcc-empty">天下暂无大事</div>';
    }

    destroy() {
        if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
    }
}
