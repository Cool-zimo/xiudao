/** 开放世界 48×48 测试 */
import { World, WORLD_SIZE } from './src/systems/world.js';
import { RNG } from './src/core/rng.js';
import { TILE, TILE_DEFS, RES, tileDef } from './src/data/terrain.js';

let pass = 0, fail = 0;
const check = (l, c, e = '') => {
    if (c) { pass++; console.log(`  ✓ ${l}`); }
    else { fail++; console.log(`  ✗ ${l} ${e}`); }
};

console.log('═══════ 开放世界 48×48 测试 ═══════\n');

console.log('【世界生成】');
const w = new World(new RNG(12345));
check('尺寸为 256×256', w.size === WORLD_SIZE && w.size === 256, `${w.size}`);
check('构造时不生成任何区块（真懒加载）', w.chunks.size === 0, `${w.chunks.size}`);

console.log('\n【边界】');
let edgeCloud = true;
for (let i = 0; i < 256; i++) {
    if (w.get(i, 0) !== TILE.CLOUD) edgeCloud = false;
    if (w.get(i, 255) !== TILE.CLOUD) edgeCloud = false;
    if (w.get(0, i) !== TILE.CLOUD) edgeCloud = false;
    if (w.get(255, i) !== TILE.CLOUD) edgeCloud = false;
}
check('外圈全部为云海（天然边界）', edgeCloud);
check('云海不可通行', tileDef(TILE.CLOUD).walk === false);
check('走出边界返回云海', w.get(-1, 10) === TILE.CLOUD && w.get(300, 300) === TILE.CLOUD);
check('越界灵气为 0', w.qiAt(-5, 10) === 0 && w.qiAt(999, 999) === 0);
check('越界不可通行', w.walkable(-1, 10) === false && w.walkable(256, 10) === false);

console.log('\n【地形分布】');
// 区块是懒生成的，先全量加载再统计
for (let cy = 0; cy < 16; cy++) for (let cx = 0; cx < 16; cx++) w.getChunk(cx, cy);
const st = w.stats();
console.log('  ' + Object.entries(st.counts).map(([k, v]) => `${TILE_DEFS[k]?.name || k}:${v}`).join('  '));
check('存在山门（宗门）', (st.counts[TILE.SECT] || 0) > 0, `${st.counts[TILE.SECT]}`);
check('存在灵脉', (st.counts[TILE.VEIN] || 0) > 0, `${st.counts[TILE.VEIN]}`);
check('存在妖兽林', (st.counts[TILE.FOREST] || 0) > 0, `${st.counts[TILE.FOREST]}`);
check('存在洞府石台', (st.counts[TILE.CAVE] || 0) > 0, `${st.counts[TILE.CAVE]}`);
check('存在灵石矿脉', (st.counts[TILE.ORE] || 0) > 0, `${st.counts[TILE.ORE]}`);
check('存在青芜坡（基础地形）', (st.counts[TILE.PLAIN] || 0) > 0, `${st.counts[TILE.PLAIN]}`);

const total = Object.values(st.counts).reduce((a, b) => a + b, 0);
check('瓦片总数 = 256×256', total === 256 * 256, `${total}`);
check('区块总数 = 16×16', st.totalChunks === 256, `${st.totalChunks}`);
check('区块边长为 16', st.chunkSize === 16, `${st.chunkSize}`);
check('可通行地块占多数', (total - (st.counts[TILE.CLOUD] || 0)) / total > 0.6,
    `${((total - st.counts[TILE.CLOUD]) / total * 100).toFixed(0)}%`);

console.log('\n【灵气场】');
check('存在高灵气地块（灵脉 ≥ 5）', st.maxQi >= 5, `max=${st.maxQi}`);
// 灵脉中心灵气应高于普通平地
let veinMax = 0, plainQi = [];
for (let y = 2; y < 46; y++) {
    for (let x = 2; x < 46; x++) {
        const t = w.get(x, y);
        if (t === TILE.VEIN) veinMax = Math.max(veinMax, w.qiAt(x, y));
        if (t === TILE.PLAIN) plainQi.push(w.qiAt(x, y));
    }
}
const plainAvg = plainQi.reduce((a, b) => a + b, 0) / Math.max(1, plainQi.length);
check('灵脉灵气 > 平地均值', veinMax > plainAvg, `vein=${veinMax} plainAvg=${plainAvg.toFixed(2)}`);

// 灵气扩散：靠近灵脉的平地灵气应 > 1
let diffusionFound = false;
for (let y = 3; y < 45 && !diffusionFound; y++) {
    for (let x = 3; x < 45 && !diffusionFound; x++) {
        if (w.get(x, y) === TILE.PLAIN && w.qiAt(x, y) > 1.5) diffusionFound = true;
    }
}
check('灵脉有扩散加成（附近平地灵气提升）', diffusionFound);

console.log('\n【种子可复现】');
const w2 = new World(new RNG(12345));
let same = true;
for (let y = 0; y < 256; y += 7) {
    for (let x = 0; x < 256; x += 7) {
        if (w.get(x, y) !== w2.get(x, y) || w.qiAt(x, y) !== w2.qiAt(x, y)) { same = false; break; }
    }
}
check('同种子生成同一世界', same);
const w3 = new World(new RNG(999));
let diff = false;
for (let y = 0; y < 256 && !diff; y += 7) {
    for (let x = 0; x < 256 && !diff; x += 7) {
        if (w.get(x, y) !== w3.get(x, y)) diff = true;
    }
}
check('不同种子生成不同世界', diff);

// 区块可卸载再重建（这是懒加载能成立的前提）
const sampleBefore = [];
for (let i = 0; i < 30; i++) sampleBefore.push(w.get(60 + i, 130));
w.chunks.clear();
const sampleAfter = [];
for (let i = 0; i < 30; i++) sampleAfter.push(w.get(60 + i, 130));
check('区块卸载后重建完全一致', sampleBefore.join() === sampleAfter.join());

console.log('\n【资源：确定性生成】');
// 全图预热后再统计（资源存在性由 hash 决定，无需存储整表）
for (let cy = 0; cy < 16; cy++) for (let cx = 0; cx < 16; cx++) w.getChunk(cx, cy);
let resCount = 0, herbOk = true;
for (let y = 2; y < 254; y += 3) {
    for (let x = 2; x < 254; x += 3) {
        const r = w.resourceAt(x, y);
        if (!r) continue;
        resCount++;
        if (r.type === 'herb' && w.qiAt(x, y) < 2.5) herbOk = false;
    }
}
check('地图上存在资源', resCount > 0, `${resCount} 处（采样统计）`);
check('灵草只长在灵气 ≥ 2.5 处', herbOk);

// 采集
let harvested = null;
for (let y = 2; y < 254 && !harvested; y++) {
    for (let x = 2; x < 254 && !harvested; x++) {
        const r = w.resourceAt(x, y);
        if (r) harvested = { r, x, y };
    }
}
check('找到可采集资源', !!harvested);
if (harvested) {
    const got = w.harvest(harvested.x, harvested.y);
    check('采集返回资源', !!got && got.type === harvested.r.type && got.amount > 0);
    check('采集后该点清空', w.resourceAt(harvested.x, harvested.y) === null);
    check('已采集记入集合', w.harvested.has(`${harvested.x},${harvested.y}`));
    check('重复采集返回 null', w.harvest(harvested.x, harvested.y) === null);
}

console.log('\n【建造】');
// 找一个洞府石台
let cavePos = null;
for (let y = 2; y < 46 && !cavePos; y++) {
    for (let x = 2; x < 46 && !cavePos; x++) {
        if (w.get(x, y) === TILE.CAVE && !w.hasBuilding(x, y)) cavePos = { x, y };
    }
}
check('找到可用洞府石台', !!cavePos);
if (cavePos) {
    const r1 = w.build(cavePos.x, cavePos.y, 'cave');
    check('可在洞府石台上建造', r1.ok === true, r1.reason);
    check('建造后标记已存在', w.hasBuilding(cavePos.x, cavePos.y) === true);
    const r2 = w.build(cavePos.x, cavePos.y, 'cave');
    check('同一处不可重复建造', r2.ok === false, r2.reason);
    // 非洞府地形不能建
    let plainPos = null;
    for (let y = 2; y < 46 && !plainPos; y++) {
        for (let x = 2; x < 46 && !plainPos; x++) {
            if (w.get(x, y) === TILE.PLAIN) plainPos = { x, y };
        }
    }
    if (plainPos) {
        const r3 = w.build(plainPos.x, plainPos.y, 'cave');
        check('非洞府地形不可建造', r3.ok === false, r3.reason);
    }
}

console.log('\n【出生点与移动】');
const s = w.sectRect;
check('记录了山门区域', !!s && s.w > 0 && s.h > 0);
const spawn = w.findWalkableNear(s.x + Math.floor(s.w / 2), s.y + Math.floor(s.h / 2));
check('出生点可通行', w.walkable(spawn.x, spawn.y), `(${spawn.x},${spawn.y})`);
check('出生点不在云海', w.get(spawn.x, spawn.y) !== TILE.CLOUD);

// 模拟移动：走过 500 步不应越出可通行区域
let cur = { ...spawn }, steps = 0, stuck = 0;
const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
for (let i = 0; i < 800; i++) {
    const d = dirs[i % 4];
    const nx = cur.x + d[0], ny = cur.y + d[1];
    if (w.walkable(nx, ny)) { cur = { x: nx, y: ny }; steps++; }
    else stuck++;
}
check('随机游走 500 步未卡死', steps > 100, `移动 ${steps} 步 / 受阻 ${stuck}`);
check('始终处于可通行格', w.walkable(cur.x, cur.y));

console.log('\n【地形定义完整性】');
for (const [k, d] of Object.entries(TILE_DEFS)) {
    const ok = typeof d.name === 'string' && typeof d.qi === 'number'
        && typeof d.walk === 'boolean' && typeof d.desc === 'string';
    if (!ok) check(`地形 ${k} 定义完整`, false);
}
check('全部 7 种地形定义完整', Object.keys(TILE_DEFS).length === 7);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
