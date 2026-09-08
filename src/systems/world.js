import { TILE, TILE_DEFS, RES, tileDef } from '../data/terrain.js';

/**
 * 世界生成 —— 48×48 修仙界
 *
 * 布局思路（区域化 + 种子随机，保证可复现）：
 *   · 外围一圈云海，形成天然边界
 *   · 中央偏北：山门（宗门，安全区）
 *   · 山门四周散布：洞府石台（可建洞府）
 *   · 灵脉：3 条蜿蜒地脉，是争夺焦点
 *   · 妖兽林：大片连续，占据东南
 *   · 灵石矿脉：零星嵌在岩地
 *   · 青芜坡：填充其余
 *
 * 同时生成灵气场（qiField）：每格的实际灵气 = 地形基础值 + 灵脉扩散加成。
 * 这让灵脉的影响有衰减半径，而非只有踩在上面才有效。
 */

export const WORLD_SIZE = 48;
const TILE_PX = 72;   // 一格 72px：瓦片贴图 256px 缩到 72px 显示，细节充分保留

export class World {
    constructor(rng) {
        this.rng = rng;
        this.size = WORLD_SIZE;
        this.tiles = [];
        this.qiField = [];
        this.resources = new Map();   // "x,y" -> { type, amount }
        this.buildings = new Map();   // "x,y" -> { type, ... }
        this.generate();
    }

    idx(x, y) { return y * this.size + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }

    get(x, y) {
        if (!this.inBounds(x, y)) return TILE.CLOUD;
        return this.tiles[this.idx(x, y)];
    }
    set(x, y, t) {
        if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = t;
    }
    qiAt(x, y) {
        if (!this.inBounds(x, y)) return 0;
        return this.qiField[this.idx(x, y)];
    }
    walkable(x, y) {
        return this.inBounds(x, y) && tileDef(this.get(x, y)).walk;
    }

    generate() {
        const N = this.size;
        const R = this.rng;

        // 1. 全部铺青芜坡
        this.tiles = new Array(N * N).fill(TILE.PLAIN);

        // 2. 外围云海边界（2 格厚）
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2) this.set(x, y, TILE.CLOUD);
            }
        }

        // 3. 山门：中央偏北的矩形广场
        const sect = { x: 17, y: 5, w: 14, h: 9 };
        this.sectRect = sect;
        for (let y = sect.y; y < sect.y + sect.h; y++) {
            for (let x = sect.x; x < sect.x + sect.w; x++) this.set(x, y, TILE.SECT);
        }

        // 4. 洞府：山门南侧散布的石台（7 处）
        const caveSpots = [
            [14, 16], [22, 17], [30, 15], [12, 24],
            [26, 26], [33, 23], [19, 30]
        ];
        this.caveSpots = [];
        for (const [cx, cy] of caveSpots) {
            const r = 2;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy <= r * r) {
                        const x = cx + dx, y = cy + dy;
                        if (this.get(x, y) === TILE.PLAIN) this.set(x, y, TILE.CAVE);
                    }
                }
            }
            this.caveSpots.push({ x: cx, y: cy });
        }

        // 5. 妖兽林：东南大片，用随机游走生成有机边界
        for (let i = 0; i < 4; i++) {
            this._growForest(
                Math.floor(R.next() * 12) + 28,
                Math.floor(R.next() * 10) + 32,
                Math.floor(R.next() * 70) + 150
            );
        }
        // 北方也有一小片，避免地图南北过于单调
        this._growForest(6, 12, 70);

        // 6. 灵脉：3 条蜿蜒地脉
        this.veins = [];
        const veins = [
            { x: 8, y: 30, len: 16, dir: [1, -0.3] },
            { x: 20, y: 40, len: 14, dir: [0.8, -0.6] },
            { x: 36, y: 12, len: 12, dir: [-0.2, 1] }
        ];
        for (const v of veins) this._growVein(v);

        // 7. 灵石矿脉：零星分布
        for (let i = 0; i < 48; i++) {
            const x = Math.floor(R.next() * (N - 8)) + 4;
            const y = Math.floor(R.next() * (N - 8)) + 4;
            if (this.get(x, y) === TILE.PLAIN) this.set(x, y, TILE.ORE);
        }

        // 8. 计算灵气场（灵脉扩散）
        this._computeQi();

        // 9. 撒资源点
        this._scatterResources();
    }

    /** 随机游走生长森林 */
    _growForest(sx, sy, steps) {
        const R = this.rng;
        let x = sx, y = sy;
        for (let i = 0; i < steps; i++) {
            if (this.inBounds(x, y) && this.get(x, y) === TILE.PLAIN) {
                this.set(x, y, TILE.FOREST);
                // 顺便加厚，形成团块
                const nx = x + (R.next() < 0.5 ? 1 : 0);
                const ny = y + (R.next() < 0.5 ? 1 : 0);
                if (this.get(nx, ny) === TILE.PLAIN) this.set(nx, ny, TILE.FOREST);
            }
            x += Math.floor(R.next() * 3) - 1;
            y += Math.floor(R.next() * 3) - 1;
            x = Math.max(3, Math.min(this.size - 4, x));
            y = Math.max(3, Math.min(this.size - 4, y));
        }
    }

    /** 生长一条灵脉 */
    _growVein({ x, y, len, dir }) {
        const R = this.rng;
        const path = [];
        for (let i = 0; i < len; i++) {
            const px = Math.round(x), py = Math.round(y);
            if (this.inBounds(px, py) && this.get(px, py) !== TILE.CLOUD
                && this.get(px, py) !== TILE.SECT) {
                this.set(px, py, TILE.VEIN);
                path.push({ x: px, y: py });
            }
            x += dir[0] + (R.next() - 0.5) * 0.9;
            y += dir[1] + (R.next() - 0.5) * 0.9;
        }
        this.veins.push(path);
    }

    /**
     * 灵气场：地形基础值 + 灵脉的距离衰减加成
     * 这让"靠近灵脉"也有收益，形成选址策略
     */
    _computeQi() {
        const N = this.size;
        this.qiField = new Array(N * N).fill(0);

        // 基础值
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                this.qiField[this.idx(x, y)] = tileDef(this.get(x, y)).qi;
            }
        }

        // 灵脉扩散：半径 3，线性衰减
        const R = 3;
        for (const path of this.veins) {
            for (const p of path) {
                for (let dy = -R; dy <= R; dy++) {
                    for (let dx = -R; dx <= R; dx++) {
                        const x = p.x + dx, y = p.y + dy;
                        if (!this.inBounds(x, y)) continue;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        if (d > R) continue;
                        const bonus = (1 - d / (R + 1)) * 2.5;
                        const i = this.idx(x, y);
                        this.qiField[i] = Math.max(this.qiField[i], bonus);
                    }
                }
            }
        }

        // 取整到 1 位小数
        for (let i = 0; i < this.qiField.length; i++) {
            this.qiField[i] = Math.round(this.qiField[i] * 10) / 10;
        }
    }

    /** 撒资源：灵草长在高灵气处，灵石长在矿脉上 */
    _scatterResources() {
        const R = this.rng;
        const N = this.size;

        for (let y = 2; y < N - 2; y++) {
            for (let x = 2; x < N - 2; x++) {
                const t = this.get(x, y);
                const q = this.qiAt(x, y);
                const key = `${x},${y}`;

                // 灵草：灵气 ≥ 2.5 的可通行地块，概率随灵气增长
                if (t !== TILE.CLOUD && t !== TILE.SECT && q >= 2.5) {
                    if (R.next() < 0.10 + q * 0.03) {
                        this.resources.set(key, { type: RES.HERB, amount: 1 + Math.floor(R.next() * 3) });
                    }
                }

                // 灵石：矿脉上必出，别处偶有
                if (t === TILE.ORE) {
                    if (R.next() < 0.55) {
                        this.resources.set(key, { type: RES.STONE, amount: 2 + Math.floor(R.next() * 4) });
                    }
                } else if (t !== TILE.CLOUD && R.next() < 0.012) {
                    this.resources.set(key, { type: RES.STONE, amount: 1 });
                }
            }
        }
    }

    // ---------- 交互 ----------

    /** 采集：返回资源或 null */
    harvest(x, y) {
        const key = `${x},${y}`;
        const r = this.resources.get(key);
        if (!r) return null;
        this.resources.delete(key);
        return r;
    }

    /** 建造洞府（仅洞府地形，且未被占用） */
    build(x, y, type = 'cave') {
        if (this.get(x, y) !== TILE.CAVE) {
            return { ok: false, reason: '只有洞府石台才能开辟洞府' };
        }
        const key = `${x},${y}`;
        if (this.buildings.has(key)) {
            return { ok: false, reason: '此处已有建筑' };
        }
        this.buildings.set(key, { type, builtAt: Date.now() });
        return { ok: true };
    }

    hasBuilding(x, y) { return this.buildings.has(`${x},${y}`); }

    /** 找最近的可通行格（用于放置玩家） */
    findWalkableNear(x, y, maxR = 8) {
        for (let r = 0; r <= maxR; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = x + dx, ny = y + dy;
                    if (this.walkable(nx, ny)) return { x: nx, y: ny };
                }
            }
        }
        return { x: 24, y: 10 };   // 兜底：山门中心
    }

    /** 统计信息（UI 展示） */
    stats() {
        const counts = {};
        for (const t of this.tiles) counts[t] = (counts[t] || 0) + 1;
        return {
            size: this.size,
            counts,
            resources: this.resources.size,
            buildings: this.buildings.size,
            maxQi: Math.max(...this.qiField)
        };
    }
}

export { TILE_PX };
