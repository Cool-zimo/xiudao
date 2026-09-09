import { TILE, TILE_DEFS, TILE_IMGS, RES_DEFS, tileDef } from '../data/terrain.js';
import { World, TILE_PX, CHUNK_SIZE, CHUNKS_PER_SIDE } from '../systems/world.js';
import { TimeSystem } from '../systems/time.js';
import { NPCSystem } from '../systems/npc.js';

/**
 * 世界地图渲染（Canvas）
 *
 * 移动手感：
 *   逻辑坐标（整数格）与渲染坐标（浮点）分离，每帧做指数插值，
 *   所以移动是平滑滑动而非逐格跳变。相机同样平滑跟随并带阻尼。
 *
 * 触控：
 *   · 虚拟方向键（支持长按连续移动、滑动切向）
 *   · 点击地图自动寻路（BFS），不用一格格点
 *   · 独立的采集按钮，替代空格
 *
 * 性能：
 *   整张地图预渲染到离屏 canvas，每帧只做一次视口裁剪拷贝。
 */
const MOVE_INTERVAL = 155;   // 连续移动时每步间隔（ms）
const SMOOTH = 14;           // 插值刚度，越大越跟手

export class WorldCanvas {
    constructor(container, world, opts = {}) {
        this.container = container;
        this.world = world;
        this.onTileInfo = opts.onTileInfo || (() => { });
        this.onMove = opts.onMove || (() => { });

        this.tilePx = TILE_PX;

        // 视口按容器宽度自适应：小屏少显示几格，保证每格不小于 56px
        const avail = (container.clientWidth || 720) - 8;
        const cols = Math.max(7, Math.min(13, Math.floor(avail / this.tilePx)));
        this.viewCols = opts.viewCols || cols;

        // 逻辑格坐标（整数）与渲染坐标（浮点，用于插值）
        this.player = { x: 24, y: 10, rx: 24, ry: 10 };
        this.facing = { x: 0, y: -1 };      // 朝向，用于绘制指示三角

        // 相机：当前值与目标值分离，每帧向目标插值
        this.camX = 0; this.camY = 0;
        this.camTX = 0; this.camTY = 0;

        this.showQi = false;
        this.images = new Map();
        this.loaded = false;

        /** 外部注入：NPC 系统与时间系统 */
        this.npcSystem = opts.npcSystem || null;
        this.time = opts.time || null;

        /** 连续移动状态 */
        this._held = null;          // 当前按住的方向
        this._moveTimer = null;
        this._lastMoveAt = 0;
        this._path = null;          // 自动寻路队列
        this._raf = null;
        this._lastFrame = 0;

        /** P3：小地图（迷雾：只显示走过的区块） */
        this.minimap = null;
        this.minimapBg = null;
        this.showMinimap = true;

        /** P3：御剑飞行 */
        this.flying = false;
        this.flyCost = 2;           // 每步灵力消耗
        this.onNpcClick = opts.onNpcClick || (() => { });
        this.onFlyChange = opts.onFlyChange || (() => { });
        this.getPlayer = opts.getPlayer || (() => null);

        this._build();
        this._startLoop();
    }

    _build() {
        const vw = this.viewCols * this.tilePx;
        this.vw = vw;

        this.container.innerHTML = `
            <div class="wc-root" style="--tw:${vw}px">
                <div class="wc-toolbar">
                    <button class="wc-btn" data-act="qi">🌫️ 灵气图</button>
                    <button class="wc-btn" data-act="legend">🗺️ 图例</button>
                    <button class="wc-btn" data-act="chronicle">📜 天下事</button>
                    <button class="wc-btn on" data-act="minimap">🗺️ 舆图</button>
                    <button class="wc-btn" data-act="fly" id="wc-fly" title="消耗灵力快速移动，可跨越云海">🗡️ 御剑</button>
                    <span class="wc-time" id="wc-time">—</span>
                    <span class="wc-pos" id="wc-pos">—</span>
                </div>

                <div class="wc-stage">
                    <canvas class="wc-canvas" width="${vw}" height="${vw}"></canvas>
                    <div class="wc-loading" id="wc-loading">地图生成中…</div>
                    <div class="wc-minimap" id="wc-minimap">
                        <canvas width="${this.world.size}" height="${this.world.size}"></canvas>
                        <span class="wcm-label">天下舆图</span>
                    </div>
                    <div class="wc-chunkinfo" id="wc-chunkinfo">—</div>
                </div>

                <!-- 触控操作区：方向键 + 功能键 -->
                <div class="wc-pad">
                    <div class="wc-dpad">
                        <button class="wc-dir up"    data-dir="0,-1" aria-label="上">▲</button>
                        <button class="wc-dir left"  data-dir="-1,0" aria-label="左">◀</button>
                        <button class="wc-dir right" data-dir="1,0"  aria-label="右">▶</button>
                        <button class="wc-dir down"  data-dir="0,1"  aria-label="下">▼</button>
                        <div class="wc-dir-center">🧘</div>
                    </div>
                    <div class="wc-acts">
                        <button class="wc-act" data-act="harvest">⛏️ 采集</button>
                        <button class="wc-act" data-act="center">🎯 归位</button>
                    </div>
                </div>

                <div class="wc-hint2">点击地图自动寻路 · 方向键/摇杆移动</div>

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
        this.ctx = this.canvas?.getContext('2d');

        // 工具栏
        this.container.querySelector('[data-act="qi"]')?.addEventListener('click', (e) => {
            this.showQi = !this.showQi;
            e.target.classList.toggle('on', this.showQi);
        });
        this.container.querySelector('[data-act="legend"]')?.addEventListener('click', () => {
            this.container.querySelector('#wc-legend')?.classList.toggle('hidden');
        });
        this.container.querySelector('[data-act="chronicle"]')?.addEventListener('click', () => {
            this.container.querySelector('#wc-chronicle')?.classList.toggle('hidden');
        });
        this.container.querySelector('[data-act="minimap"]')?.addEventListener('click', (e) => {
            this.showMinimap = !this.showMinimap;
            e.target.classList.toggle('on', this.showMinimap);
            this.container.querySelector('#wc-minimap')?.classList.toggle('hidden', !this.showMinimap);
            this.container.querySelector('#wc-chunkinfo')?.classList.toggle('hidden', !this.showMinimap);
        });
        this.container.querySelector('[data-act="harvest"]')?.addEventListener('click', () => {
            this.onTileInfo(this.player.x, this.player.y, 'harvest');
        });
        this.container.querySelector('[data-act="center"]')?.addEventListener('click', () => {
            this._clampCam(true);
        });
        this.container.querySelector('[data-act="fly"]')?.addEventListener('click', () => {
            this.toggleFly();
        });

        this._bindInput();

        this._loadImages().then(() => {
            this.loaded = true;
            this._prepareTiles();
            this._initMinimap();
            this.container.querySelector('#wc-loading')?.classList.add('done');
            this.render();
        });

        // 立即渲染首帧，不等 rAF（否则首屏会空白一帧）
        this.render();
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

    /**
     * 瓦片预缩放
     * 256×256 的地图不可能整图预渲染（18432px canvas ≈ 1.3GB 显存），
     * 改为把每张 256px 瓦片缩放到格子尺寸一次，
     * 之后每帧 drawImage 都是 1:1 拷贝 —— 最快路径。
     */
    _prepareTiles() {
        const t = this.tilePx;
        this.tileCache = new Map();
        for (const [k, img] of this.images) {
            if (!img.width) continue;
            const c = document.createElement('canvas');
            c.width = t; c.height = t;
            const g = c.getContext('2d');
            if (g) g.drawImage(img, 0, 0, t, t);
            this.tileCache.set(k, c);
        }
    }

    /** 画视口内的地形（只画可见格，取代整图预渲染） */
    _drawTerrain(ctx, sx, sy) {
        const t = this.tilePx;
        const c0 = Math.floor(this.camX) - 1;
        const c1 = Math.ceil(this.camX + this.viewCols) + 1;
        const r0 = Math.floor(this.camY) - 1;
        const r1 = Math.ceil(this.camY + this.viewCols) + 1;

        for (let y = Math.max(0, r0); y <= Math.min(this.world.size - 1, r1); y++) {
            for (let x = Math.max(0, c0); x <= Math.min(this.world.size - 1, c1); x++) {
                const tile = this.world.get(x, y);
                const img = this.tileCache?.get(tile);
                if (img) {
                    ctx.drawImage(img, sx(x), sy(y));
                } else {
                    ctx.fillStyle = tileDef(tile).color;
                    ctx.fillRect(sx(x), sy(y), t, t);
                }
            }
        }
    }

    // ---------- 输入 ----------

    _bindInput() {
        // 键盘：按住可连续移动
        const down = (e) => {
            const m = this._keyMap(e.key);
            if (m) {
                e.preventDefault();
                this._startHold(m[0], m[1]);
                return;
            }
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.onTileInfo(this.player.x, this.player.y, 'harvest');
            }
        };
        const up = (e) => {
            if (this._keyMap(e.key)) this._stopHold();
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        this._keyDown = down; this._keyUp = up;

        // 虚拟方向键：pointer 事件同时覆盖鼠标与触摸
        this.container.querySelectorAll('.wc-dir').forEach(btn => {
            const [dx, dy] = btn.dataset.dir.split(',').map(Number);
            const start = (e) => {
                e.preventDefault();
                btn.setPointerCapture?.(e.pointerId);
                this._startHold(dx, dy);
            };
            const end = () => this._stopHold();
            btn.addEventListener('pointerdown', start);
            btn.addEventListener('pointerup', end);
            btn.addEventListener('pointercancel', end);
            btn.addEventListener('pointerleave', end);
            // 兜底：不支持 pointer 事件的旧浏览器
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); this._startHold(dx, dy); }, { passive: false });
            btn.addEventListener('touchend', end);
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); this._startHold(dx, dy); });
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
            // 阻止长按弹出系统菜单
            btn.addEventListener('contextmenu', e => e.preventDefault());
        });

        this.container.querySelector('#wc-minimap canvas')?.addEventListener('click', (e) => {
            this._onMinimapClick(e);
        });

        // 点击地图 → 优先交互 NPC，其次自动寻路
        this.canvas?.addEventListener('click', (e) => {
            const p = this._screenToWorld(e.clientX, e.clientY);
            if (!p) return;

            // 点中 NPC（或 NPC 就在旁边）→ 打开交互
            const npc = this.npcAt(p.x, p.y);
            if (npc) {
                const dist = Math.abs(npc.x - this.player.x) + Math.abs(npc.y - this.player.y);
                if (dist <= 1) { this.onNpcClick(npc); return; }
            }

            this._path = this.findPath(this.player.x, this.player.y, p.x, p.y);
            if (!this._path) this.onTileInfo(p.x, p.y, 'inspect');
        });
    }

    _keyMap(key) {
        return {
            ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
            w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
            W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0]
        }[key] || null;
    }

    _screenToWorld(clientX, clientY) {
        if (!this.canvas) return null;
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width) return null;
        const scale = this.vw / rect.width;
        const sx = (clientX - rect.left) * scale;
        const sy = (clientY - rect.top) * scale;
        const wx = Math.floor(this.camX + sx / this.tilePx);
        const wy = Math.floor(this.camY + sy / this.tilePx);
        if (!this.world.inBounds(wx, wy)) return null;
        return { x: wx, y: wy };
    }

    /** 开始持续移动（按下即走一步，之后按间隔连走） */
    _startHold(dx, dy) {
        this._path = null;               // 手动操作打断自动寻路
        this._held = { dx, dy };
        this.move(dx, dy);
        if (this._moveTimer) clearInterval(this._moveTimer);
        this._moveTimer = setInterval(() => {
            if (this._held) this.move(this._held.dx, this._held.dy);
        }, MOVE_INTERVAL);
    }

    _stopHold() {
        this._held = null;
        if (this._moveTimer) { clearInterval(this._moveTimer); this._moveTimer = null; }
    }

    // ---------- 御剑飞行 ----------

    /** 切换飞行状态；条件不足时返回失败原因 */
    toggleFly() {
        const p = this.getPlayer();
        if (this.flying) {
            this.flying = false;
            this._syncFlyBtn();
            this.onFlyChange(false);
            return { ok: true, flying: false };
        }

        const c = p?.cultivation;
        if ((c?.realmIndex ?? 0) < 1) {
            return { ok: false, reason: '需筑基期方可御剑飞行' };
        }
        const mp = p?.attributes?.mp ?? 0;
        if (mp < this.flyCost * 3) {
            return { ok: false, reason: '灵力不足，无法御剑' };
        }

        this.flying = true;
        this._syncFlyBtn();
        this.onFlyChange(true);
        return { ok: true, flying: true };
    }

    _syncFlyBtn() {
        const b = this.container.querySelector('#wc-fly');
        if (b) {
            b.classList.toggle('on', this.flying);
            b.textContent = this.flying ? '🗡️ 落地' : '🗡️ 御剑';
        }
    }

    /** 该格是否可进入（飞行时可跨越云海） */
    _canEnter(x, y) {
        if (!this.world.inBounds(x, y)) return false;
        return this.flying ? true : this.world.walkable(x, y);
    }

    // ---------- 移动 ----------

    move(dx, dy) {
        const nx = this.player.x + dx;
        const ny = this.player.y + dy;
        this.facing = { x: dx, y: dy };

        // 飞行时消耗灵力
        if (this.flying) {
            const p = this.getPlayer();
            const mp = p?.attributes?.mp ?? 0;
            if (mp < this.flyCost) {
                this.flying = false;
                this._syncFlyBtn();
                this.onFlyChange(false, '灵力耗尽，已落地');
                const why = '灵力耗尽，已落地';
                this.onMove({ ok: false, reason: why });
                return { ok: false, reason: why };
            }
            p.attributes.mp = mp - this.flyCost;
        }

        if (!this._canEnter(nx, ny)) {
            const why = this.world.get(nx, ny) === 'cloud' ? '前方是云海，无法涉足' : '此路不通';
            this.onMove({ ok: false, reason: why });
            return { ok: false, reason: why };
        }

        this.player.x = nx;
        this.player.y = ny;
        this._clampCam();

        const res = {
            ok: true, x: nx, y: ny,
            tile: this.world.get(nx, ny),
            qi: this.world.qiAt(nx, ny),
            flying: this.flying
        };
        this.onMove(res);
        return res;
    }

    setPlayer(x, y) {
        this.player.x = x; this.player.y = y;
        this.player.rx = x; this.player.ry = y;   // 立即就位，不做插值
        this._clampCam(true);
    }

    /** 相机目标：让玩家居中；snap=true 时相机瞬间就位 */
    _clampCam(snap = false) {
        const half = (this.viewCols - 1) / 2;
        const max = Math.max(0, this.world.size - this.viewCols);
        this.camTX = Math.max(0, Math.min(max, this.player.x - half));
        this.camTY = Math.max(0, Math.min(max, this.player.y - half));
        if (snap) { this.camX = this.camTX; this.camY = this.camTY; }
    }

    /** 该格上的存活 NPC */
    npcAt(x, y) {
        if (!this.npcSystem) return null;
        for (const n of this.npcSystem.npcs.values()) {
            if (n.alive && n.x === x && n.y === y) return n;
        }
        return null;
    }

    /** BFS 寻路：返回不含起点的格子数组，不可达返回 null */
    findPath(sx, sy, tx, ty) {
        if (sx === tx && sy === ty) return [];
        if (!this._canEnter(tx, ty)) return null;

        const key = (x, y) => `${x},${y}`;
        const prev = new Map();
        const q = [[sx, sy]];
        const seen = new Set([key(sx, sy)]);
        const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        let head = 0;

        while (head < q.length) {
            const [cx, cy] = q[head++];
            if (cx === tx && cy === ty) {
                // 回溯
                const path = [];
                let cur = key(tx, ty);
                while (cur !== key(sx, sy)) {
                    const [px, py] = cur.split(',').map(Number);
                    path.unshift({ x: px, y: py });
                    cur = prev.get(cur);
                    if (!cur) return null;
                }
                return path;
            }
            for (const [dx, dy] of DIRS) {
                const nx = cx + dx, ny = cy + dy;
                const nk = key(nx, ny);
                if (seen.has(nk) || !this._canEnter(nx, ny)) continue;
                seen.add(nk);
                prev.set(nk, key(cx, cy));
                q.push([nx, ny]);
            }
            if (q.length > 4000) break;   // 保险：防止极端情况卡死
        }
        return null;
    }

    // ---------- 渲染循环 ----------

    _startLoop() {
        if (this._raf) return;
        const step = (now) => {
            const dt = Math.min(0.05, ((now || 0) - this._lastFrame) / 1000 || 0.016);
            this._lastFrame = now || 0;
            this._update(dt);
            this.render();
            this._raf = requestAnimationFrame(step);
        };
        this._raf = requestAnimationFrame(step);

        // 页面切到后台时停帧，省电
        this._visHandler = () => {
            if (document.hidden) {
                if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
            } else if (!this._raf) {
                this._startLoop();
            }
        };
        document.addEventListener('visibilitychange', this._visHandler);
    }

    _update(dt) {
        // 玩家坐标：指数插值，帧率无关
        const k = 1 - Math.exp(-SMOOTH * dt);
        const p = this.player;
        p.rx += (p.x - p.rx) * k;
        p.ry += (p.y - p.ry) * k;
        if (Math.abs(p.x - p.rx) < 0.002) p.rx = p.x;
        if (Math.abs(p.y - p.ry) < 0.002) p.ry = p.y;

        // 相机平滑跟随（比玩家稍慢，产生轻微跟随感）
        // 残差足够小时直接吸附，避免指数逼近拖出亚像素抖动
        const ck = 1 - Math.exp(-9 * dt);
        this.camX += (this.camTX - this.camX) * ck;
        this.camY += (this.camTY - this.camY) * ck;
        if (Math.abs(this.camTX - this.camX) < 0.004) this.camX = this.camTX;
        if (Math.abs(this.camTY - this.camY) < 0.004) this.camY = this.camTY;

        // 自动寻路：走完一步再走下一步
        if (this._path && this._path.length) {
            const atTarget = Math.abs(p.rx - p.x) < 0.06 && Math.abs(p.ry - p.y) < 0.06;
            const now = performance.now();
            if (atTarget && now - this._lastMoveAt >= MOVE_INTERVAL) {
                const next = this._path.shift();
                const dx = next.x - p.x, dy = next.y - p.y;
                if (Math.abs(dx) + Math.abs(dy) === 1) {
                    this._lastMoveAt = now;
                    const r = this.move(dx, dy);
                    if (!r.ok) this._path = null;   // 路被挡住则放弃
                } else {
                    this._path = null;              // 路径不连续，重新点
                }
            }
        } else if (this._path && !this._path.length) {
            this._path = null;
        }
    }

    render() {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this.vw, this.vw);

        const t = this.tilePx;
        const ox = -this.camX * t;
        const oy = -this.camY * t;

        const sx = (wx) => (wx - this.camX) * t;
        const sy = (wy) => (wy - this.camY) * t;

        // 1. 地图底图：只画视口内的格子
        if (this.tileCache) {
            this._drawTerrain(ctx, sx, sy);
        } else {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, this.vw, this.vw);
        }

        // 2. 灵气热力图
        if (this.showQi) {
            const c0 = Math.floor(this.camX), c1 = Math.ceil(this.camX + this.viewCols);
            const r0 = Math.floor(this.camY), r1 = Math.ceil(this.camY + this.viewCols);
            for (let y = r0; y <= r1; y++) {
                for (let x = c0; x <= c1; x++) {
                    if (!this.world.inBounds(x, y)) continue;
                    const q = this.world.qiAt(x, y);
                    if (q <= 0) continue;
                    ctx.fillStyle = `rgba(56,189,248,${Math.min(0.55, q / 12)})`;
                    ctx.fillRect(sx(x), sy(y), t, t);
                }
            }
        }

        // 3. 资源图标：只扫描视口，不再遍历整张资源表
        const half = t * 0.32;
        const rc0 = Math.max(0, Math.floor(this.camX) - 1);
        const rc1 = Math.min(this.world.size - 1, Math.ceil(this.camX + this.viewCols) + 1);
        const rr0 = Math.max(0, Math.floor(this.camY) - 1);
        const rr1 = Math.min(this.world.size - 1, Math.ceil(this.camY + this.viewCols) + 1);
        for (let ry = rr0; ry <= rr1; ry++) {
            for (let rx = rc0; rx <= rc1; rx++) {
                const r = this.world.resourceAt(rx, ry);
                if (!r) continue;
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

        // 5. NPC
        if (this.npcSystem) {
            for (const n of this.npcSystem.npcs.values()) {
                if (!n.alive) continue;
                if (n.x < this.camX - 1 || n.y < this.camY - 1 ||
                    n.x > this.camX + this.viewCols || n.y > this.camY + this.viewCols) continue;
                const cx = sx(n.x) + t / 2, cy = sy(n.y) + t / 2;
                const col = n.def.color;

                ctx.beginPath();
                ctx.arc(cx, cy, t * 0.24, 0, Math.PI * 2);
                ctx.fillStyle = col;
                ctx.globalAlpha = 0.25;
                ctx.fill();
                ctx.globalAlpha = 1;

                ctx.beginPath();
                ctx.arc(cx, cy, t * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = col;
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = n.isEvil ? '#7f1d1d' : '#0f172a';
                ctx.stroke();

                if (n.sectId) {
                    ctx.fillStyle = '#f8fafc';
                    ctx.beginPath();
                    ctx.arc(cx, cy, t * 0.05, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 6. 昼夜滤镜
        if (this.time) {
            const d = this.time.daylight();
            const dark = 1 - d;
            if (dark > 0.02) {
                ctx.fillStyle = `rgba(15,23,66,${dark * 0.55})`;
                ctx.fillRect(0, 0, this.vw, this.vw);
            }
            if (d > 0.05 && d < 0.6) {
                ctx.fillStyle = `rgba(251,146,60,${(1 - Math.abs(d - 0.3)) * 0.10})`;
                ctx.fillRect(0, 0, this.vw, this.vw);
            }
        }

        // 7. 视口边框
        ctx.strokeStyle = 'rgba(148,163,184,.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, this.vw - 2, this.vw - 2);

        // 8. 玩家（用插值坐标，平滑滑动）
        const px = sx(this.player.rx) + t / 2;
        const py = sy(this.player.ry) + t / 2;
        const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;

        // 御剑飞行：脚下剑光 + 拖影
        if (this.flying) {
            const ang = Math.atan2(this.facing.y, this.facing.x);
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(ang);
            ctx.fillStyle = 'rgba(125,211,252,.85)';
            ctx.beginPath();
            ctx.moveTo(t * 0.42, 0);
            ctx.lineTo(-t * 0.18, -t * 0.07);
            ctx.lineTo(-t * 0.10, 0);
            ctx.lineTo(-t * 0.18, t * 0.07);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.strokeStyle = 'rgba(125,211,252,.35)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, t * 0.34 + pulse * 3, 0, Math.PI * 2);
            ctx.stroke();
        }

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

        // 朝向指示：跟随移动方向旋转
        const ang = Math.atan2(this.facing.y, this.facing.x);
        const tipX = px + Math.cos(ang) * t * 0.38;
        const tipY = py + Math.sin(ang) * t * 0.38;
        const nx2 = -Math.sin(ang) * 5, ny2 = Math.cos(ang) * 5;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(px + nx2, py + ny2);
        ctx.lineTo(px - nx2, py - ny2);
        ctx.closePath();
        ctx.fill();

        // 9. 信息栏
        const pos = this.container.querySelector('#wc-pos');
        if (pos) {
            const q = this.world.qiAt(this.player.x, this.player.y);
            pos.textContent = `(${this.player.x}, ${this.player.y}) · ${tileDef(this.world.get(this.player.x, this.player.y)).name} · 灵气 ${q}`;
        }
        if (this.time) {
            const tEl = this.container.querySelector('#wc-time');
            if (tEl) {
                const mul = this.time.cultivationMul(this.playerKarma ?? 0);
                tEl.textContent = `${this.time.display()} · 修炼 ×${mul}`;
                tEl.title = `${this.time.shichen().name}｜${this.time.season().desc}`;
            }
        }
        this._renderChronicle();
        this._updateMinimap();
    }

    _renderChronicle() {
        if (!this.npcSystem) return;
        const panel = this.container.querySelector('#wc-chronicle');
        // 面板隐藏时不必重排 DOM
        if (panel && panel.classList.contains('hidden')) return;

        const list = this.container.querySelector('#wcc-list');
        const sum = this.container.querySelector('#wcc-summary');
        if (!list) return;

        const s = this.npcSystem.summary();
        if (sum) {
            const sectTxt = Object.entries(s.sects)
                .map(([n, v]) => `${n} ${v.members}人`).join(' · ');
            sum.textContent = `在世 ${s.alive} 人 · 陨落 ${s.dead} 人 ｜ ${sectTxt}`;
        }
        list.innerHTML = s.chronicle.length
            ? s.chronicle.map(c =>
                `<div class="wcc-item"><span class="wcc-at">${c.at}</span>${c.text}</div>`).join('')
            : '<div class="wcc-empty">天下暂无大事</div>';
    }


    // ---------- 小地图（迷雾） ----------

    /**
     * 初始化小地图
     * 底图按区块增量绘制：只有生成过的区块才会被画上去，
     * 没去过的地方保持暗色 —— 这就是迷雾效果，也避免了
     * 一次性采样六万格造成的卡顿。
     */
    _initMinimap() {
        const host = this.container.querySelector('#wc-minimap canvas');
        if (!host) return;
        this.minimap = host;
        this.minimapCtx = host.getContext('2d');

        // 底图离屏：与显示尺寸同分辨率（256×256，1 格 1 像素）
        const bg = document.createElement('canvas');
        bg.width = this.world.size;
        bg.height = this.world.size;
        this.minimapBg = bg;
        this.minimapBgCtx = bg.getContext('2d');

        const bc = this.minimapBgCtx;
        if (bc) {
            bc.fillStyle = '#0b1220';
            bc.fillRect(0, 0, bg.width, bg.height);
        }

        // 已探索区块（读档后）需要补画
        for (const key of this.world.explored) {
            const [cx, cy] = key.split(',').map(Number);
            this._paintChunk(cx, cy);
        }
        this.world.consumeDirty();
    }

    /** 把单个区块画到小地图底图（16×16 像素） */
    _paintChunk(cx, cy) {
        const bc = this.minimapBgCtx;
        if (!bc) return;
        const bx = cx * CHUNK_SIZE, by = cy * CHUNK_SIZE;
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                const wx = bx + lx, wy = by + ly;
                if (!this.world.inBounds(wx, wy)) continue;
                const t = this.world.get(wx, wy);
                bc.fillStyle = tileDef(t).color;
                bc.fillRect(wx, wy, 1, 1);
            }
        }
    }

    /** 增量绘制新生成的区块，然后刷新小地图 */
    _updateMinimap() {
        if (!this.minimap || !this.showMinimap) return;

        const dirty = this.world.consumeDirty();
        if (dirty) {
            for (const key of dirty) {
                const [cx, cy] = key.split(',').map(Number);
                this._paintChunk(cx, cy);
            }
        }

        const ctx = this.minimapCtx;
        const N = this.world.size;
        if (!ctx) return;

        ctx.clearRect(0, 0, N, N);
        if (this.minimapBg) ctx.drawImage(this.minimapBg, 0, 0);

        // 玩家（亮点 + 光晕，方便在暗色迷雾中定位）
        const p = this.player;
        ctx.fillStyle = 'rgba(250,250,210,.35)';
        ctx.fillRect(p.x - 3, p.y - 3, 7, 7);
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(p.x - 1, p.y - 1, 3, 3);

        // 宗门（山门）：金框，作为归位参照
        const S = this.world.sectRect;
        if (S) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.strokeRect(S.x + .5, S.y + .5, S.w, S.h);
        }

        // 视口框
        ctx.strokeStyle = 'rgba(148,163,184,.55)';
        ctx.strokeRect(this.camX + .5, this.camY + .5, this.viewCols, this.viewCols);

        // 区块加载信息
        const info = this.container.querySelector('#wc-chunkinfo');
        if (info) {
            const st = this.world.stats();
            info.textContent = `区块 ${st.loadedChunks}/${st.totalChunks} · 已探 ${st.explored}`;
        }
    }

    /** 点击小地图：若该区块已探索则把镜头移过去（快速跳转） */
    _onMinimapClick(e) {
        if (!this.minimap) return;
        const rect = this.minimap.getBoundingClientRect();
        if (!rect.width) return;
        const N = this.world.size;
        const mx = Math.floor((e.clientX - rect.left) / rect.width * N);
        const my = Math.floor((e.clientY - rect.top) / rect.height * N);
        if (!this.world.inBounds(mx, my)) return;
        // 未探索区域不允许跳转（保持迷雾规则）
        if (!this.world.isChunkLoaded(mx >> 4, my >> 4)) return;
        const max = Math.max(0, this.world.size - this.viewCols);
        this.camTX = Math.max(0, Math.min(max, mx - (this.viewCols >> 1)));
        this.camTY = Math.max(0, Math.min(max, my - (this.viewCols >> 1)));
    }

    destroy() {
        this._stopHold();
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
        if (this._keyDown) window.removeEventListener('keydown', this._keyDown);
        if (this._keyUp) window.removeEventListener('keyup', this._keyUp);
        if (this._visHandler) document.removeEventListener('visibilitychange', this._visHandler);
    }
}
