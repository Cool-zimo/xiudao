import { TILE, TILE_DEFS, RES, tileDef } from '../data/terrain.js';
import { fbm, ridge, hash3 } from './noise.js';

/**
 * 世界 —— 256×256，区块（Chunk）流式生成
 *
 * 为什么不能沿用 48×48 的整图方案：
 *   256 格 × 72px = 18432px 见方的离屏 canvas，
 *   显存占用 18432² × 4B ≈ 1.3GB，浏览器直接崩。
 *
 * 所以改成 Minecraft 式：
 *   · 地图切成 16×16 格的区块（共 16×16 = 256 个）
 *   · 只有玩家靠近的区块才会被生成（懒加载）
 *   · 渲染不再预渲染整图，而是每帧只画视口内的格子
 *   · 地形由噪声函数决定，同一坐标永远得到同一结果
 *     → 区块可以先卸载、之后再生成回来，内容完全一致
 *
 * 存档因此极小：地形靠种子重建，只存「被采走的资源」与「玩家建筑」。
 */

export const WORLD_SIZE = 256;
export const CHUNK_SIZE = 16;
export const CHUNKS_PER_SIDE = WORLD_SIZE / CHUNK_SIZE;   // 16
const TILE_PX = 72;

/** 山门（宗门）：地图中央偏北，安全区与出生点 */
const SECT_RECT = { x: 118, y: 96, w: 20, h: 16 };
/** 世界边缘的云海厚度 */
const EDGE = 3;

/** 活跃半径：玩家周围多少格内的 NPC 全速模拟 */
export const ACTIVE_RADIUS = 44;

class Chunk {
    constructor(cx, cy) {
        this.cx = cx; this.cy = cy;
        this.tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
        this.qi = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
    }
}

// 地形枚举 → 数值（Uint8Array 存不了字符串）
const TILE_IDS = [TILE.PLAIN, TILE.VEIN, TILE.FOREST, TILE.SECT, TILE.CAVE, TILE.ORE, TILE.CLOUD];
const ID_TO_TILE = TILE_IDS;

export class World {
    constructor(rng) {
        this.rng = rng;
        this.seed = (rng?.seed ?? 20240907) >>> 0;
        this.size = WORLD_SIZE;

        this.chunks = new Map();
        this.explored = new Set();      // 已生成过的区块（迷雾地图用）
        this._dirty = [];               // 新生成的区块，供小地图增量绘制

        /** 被采走的资源坐标 —— 地形是确定的，只有「采没采」需要记 */
        this.harvested = new Set();
        /** 玩家建筑 */
        this.buildings = new Map();

        this.sectRect = { ...SECT_RECT };
    }

    // ---------- 坐标 ----------

    idx(x, y) { return y * this.size + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }

    /** 区块内偏移（位运算，CHUNK_SIZE 必须为 2 的幂） */
    _off(x, y) { return (y & (CHUNK_SIZE - 1)) * CHUNK_SIZE + (x & (CHUNK_SIZE - 1)); }

    // ---------- 区块：懒加载 ----------

    /**
     * 取区块，不存在则生成
     * 这是整个流式系统的入口：任何读取都会自动触发周边生成
     */
    getChunk(cx, cy) {
        const key = cx + ',' + cy;
        let c = this.chunks.get(key);
        if (c) return c;

        c = new Chunk(cx, cy);
        this._generate(c);
        this.chunks.set(key, c);
        this.explored.add(key);
        this._dirty.push(key);
        this.genCount = (this.genCount || 0) + 1;
        return c;
    }

    /** 该区块是否已生成（未触碰过就是未探索） */
    isChunkLoaded(cx, cy) { return this.chunks.has(cx + ',' + cy); }

    /** 取走"新生成"的区块列表（小地图增量绘制用） */
    consumeDirty() {
        if (!this._dirty.length) return null;
        const d = this._dirty;
        this._dirty = [];
        return d;
    }

    _generate(c) {
        const bx = c.cx * CHUNK_SIZE, by = c.cy * CHUNK_SIZE;
        const s = this.seed;

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                const wx = bx + lx, wy = by + ly;
                const i = ly * CHUNK_SIZE + lx;

                const id = this._genTileId(wx, wy, s);
                c.tiles[i] = id;
                c.qi[i] = this._genQi(wx, wy, id, s);
            }
        }
    }

    /**
     * 地形判定：纯函数，只依赖 (x, y, seed)
     * 这是"可卸载再重建"的前提
     */
    _genTileId(x, y, s) {
        // 1. 世界边缘：云海
        if (x < EDGE || y < EDGE || x >= this.size - EDGE || y >= this.size - EDGE) {
            return TILE_IDS.indexOf(TILE.CLOUD);
        }

        // 2. 山门（宗门）
        const S = SECT_RECT;
        if (x >= S.x && x < S.x + S.w && y >= S.y && y < S.y + S.h) {
            return TILE_IDS.indexOf(TILE.SECT);
        }

        // 3. 灵脉：脊线噪声形成蜿蜒脉络，而非一片一片的色块
        const v = ridge(x / 16, y / 16, s + 2, 4);
        if (v > 0.75) return TILE_IDS.indexOf(TILE.VEIN);

        // 4. 大地貌：fbm 低频决定山地与平原
        const h = fbm(x / 30, y / 30, s, 4);

        // 5. 高山：绝壁（不可通行）。控制在很小比例，避免切断地图
        if (h > 0.80) return TILE_IDS.indexOf(TILE.CLOUD);

        // 6. 灵石矿脉（山地）
        if (h > 0.62) return TILE_IDS.indexOf(TILE.ORE);

        // 7. 妖兽林
        const f = fbm(x / 12, y / 12, s + 5, 3);
        if (f > 0.58) return TILE_IDS.indexOf(TILE.FOREST);

        // 8. 洞府石台：稀疏散布，与灵气相关
        if (hash3(x, y, s + 9) < 0.018) return TILE_IDS.indexOf(TILE.CAVE);

        return TILE_IDS.indexOf(TILE.PLAIN);
    }

    /**
     * 灵气场：地形基础值 + 灵脉的连续扩散
     * 用 ridge 的连续值做加成，所以不需要邻域搜索 —— 任意坐标可独立计算
     */
    _genQi(x, y, tileId, s) {
        const base = tileDef(ID_TO_TILE[tileId]).qi;
        if (base <= 0) return 0;

        const v = ridge(x / 16, y / 16, s + 2, 4);
        const bonus = v > 0.62 ? (v - 0.62) * 10 : 0;
        return Math.round((base + bonus) * 10) / 10;
    }

    // ---------- 读取 ----------

    get(x, y) {
        if (!this.inBounds(x, y)) return TILE.CLOUD;
        const c = this.getChunk(x >> 4, y >> 4);
        return ID_TO_TILE[c.tiles[this._off(x, y)]];
    }

    set(x, y, t) {
        if (!this.inBounds(x, y)) return;
        const id = TILE_IDS.indexOf(t);
        if (id < 0) return;
        const c = this.getChunk(x >> 4, y >> 4);
        c.tiles[this._off(x, y)] = id;
    }

    qiAt(x, y) {
        if (!this.inBounds(x, y)) return 0;
        const c = this.getChunk(x >> 4, y >> 4);
        return c.qi[this._off(x, y)];
    }

    walkable(x, y) {
        return this.inBounds(x, y) && tileDef(this.get(x, y)).walk;
    }

    /** 生成玩家附近的所有区块（避免首次渲染时集中生成造成卡顿） */
    ensureAround(x, y, r = 2) {
        const c0 = ((x - r * CHUNK_SIZE) >> 4), c1 = ((x + r * CHUNK_SIZE) >> 4);
        const r0 = ((y - r * CHUNK_SIZE) >> 4), r1 = ((y + r * CHUNK_SIZE) >> 4);
        for (let cy = Math.max(0, r0); cy <= Math.min(CHUNKS_PER_SIDE - 1, r1); cy++) {
            for (let cx = Math.max(0, c0); cx <= Math.min(CHUNKS_PER_SIDE - 1, c1); cx++) {
                this.getChunk(cx, cy);
            }
        }
    }

    // ---------- 资源：确定性生成 + 采集记录 ----------

    /**
     * 该格是否有资源（未采走的前提下）
     * 存在性由 hash 决定 → 无需存储整张资源表
     */
    resourceAt(x, y) {
        if (!this.inBounds(x, y)) return null;
        const key = x + ',' + y;
        if (this.harvested.has(key)) return null;

        const t = this.get(x, y);
        if (t === TILE.CLOUD || t === TILE.SECT) return null;

        const s = this.seed;
        const q = this.qiAt(x, y);

        // 灵草：长在高灵气处
        if (q >= 2.5 && hash3(x, y, s + 11) < 0.10 + q * 0.03) {
            return { type: RES.HERB, amount: 1 + Math.floor(hash3(x, y, s + 13) * 3) };
        }
        // 灵石：矿脉上富集
        if (t === TILE.ORE && hash3(x, y, s + 17) < 0.55) {
            return { type: RES.STONE, amount: 2 + Math.floor(hash3(x, y, s + 19) * 4) };
        }
        return null;
    }

    hasResource(x, y) { return this.resourceAt(x, y) !== null; }

    /** 采集：返回资源，同时记入已采集合 */
    harvest(x, y) {
        const r = this.resourceAt(x, y);
        if (!r) return null;
        this.harvested.add(x + ',' + y);
        return r;
    }

    // ---------- 建造 ----------

    build(x, y, type = 'cave') {
        if (this.get(x, y) !== TILE.CAVE) {
            return { ok: false, reason: '只有洞府石台才能开辟洞府' };
        }
        const key = x + ',' + y;
        if (this.buildings.has(key)) {
            return { ok: false, reason: '此处已有建筑' };
        }
        this.buildings.set(key, { type, builtAt: Date.now() });
        return { ok: true };
    }

    hasBuilding(x, y) { return this.buildings.has(x + ',' + y); }

    // ---------- 工具 ----------

    findWalkableNear(x, y, maxR = 12) {
        if (this.walkable(x, y)) return { x, y };
        for (let r = 1; r <= maxR; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = x + dx, ny = y + dy;
                    if (this.walkable(nx, ny)) return { x: nx, y: ny };
                }
            }
        }
        // 兜底：山门中心
        const S = this.sectRect;
        return { x: S.x + (S.w >> 1), y: S.y + (S.h >> 1) };
    }

    // ---------- 存档 ----------

    serialize() {
        return {
            harvested: [...this.harvested],
            buildings: [...this.buildings].map(([k, v]) => [k, v.type, v.builtAt]),
            explored: [...this.explored]
        };
    }

    deserialize(data) {
        if (!data) return;
        this.harvested = new Set(data.harvested || []);
        this.buildings = new Map(
            (data.buildings || []).map(([k, type, builtAt]) => [k, { type, builtAt }])
        );
        this.explored = new Set(data.explored || []);
        // 已探索区块需要重新绘制到小地图
        this._dirty = [...this.explored];
    }

    // ---------- 统计 ----------

    stats() {
        const counts = {};
        let maxQi = 0;
        for (const c of this.chunks.values()) {
            for (let i = 0; i < c.tiles.length; i++) {
                const t = ID_TO_TILE[c.tiles[i]];
                counts[t] = (counts[t] || 0) + 1;
                if (c.qi[i] > maxQi) maxQi = c.qi[i];
            }
        }
        return {
            size: this.size,
            chunkSize: CHUNK_SIZE,
            loadedChunks: this.chunks.size,
            totalChunks: CHUNKS_PER_SIDE * CHUNKS_PER_SIDE,
            explored: this.explored.size,
            counts,
            harvested: this.harvested.size,
            buildings: this.buildings.size,
            maxQi
        };
    }
}

export { TILE_PX };
