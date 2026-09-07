import { TILE, TILE_DEFS, TILE_IMGS, RES_DEFS, tileDef } from '../data/terrain.js';
import { World, TILE_PX } from '../systems/world.js';

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
        this.viewCols = opts.viewCols || 15;    // 视口可见格数
        this.zoom = opts.zoom || 1;

        this.camX = 0;      // 视口左上角对应的世界格坐标（可为小数，用于平滑）
        this.camY = 0;

        this.player = { x: 24, y: 10, px: 24, py: 10 };  // px/py 为渲染插值坐标
        this.showQi = false;
        this.images = new Map();
        this.loaded = false;

        this._build();
    }

    _build() {
        const vw = this.viewCols * this.tilePx;
        this.container.innerHTML = `
            <div class="wc-root" style="--tw:${vw}px">
                <div class="wc-toolbar">
                    <button class="wc-btn" data-act="qi">🌫️ 灵气图</button>
                    <button class="wc-btn" data-act="legend">🗺️ 图例</button>
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
                // 网格线（极淡，帮助定位）
                c.strokeStyle = 'rgba(0,0,0,.10)';
                c.lineWidth = 1;
                c.strokeRect(x * t + .5, y * t + .5, t, t);
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

        // 5. 视口边框
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
    }

    destroy() {
        if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
    }
}
