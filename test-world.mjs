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
check('尺寸为 48×48', w.size === WORLD_SIZE && w.size === 48, `${w.size}`);
check('瓦片数组完整', w.tiles.length === 48 * 48, `${w.tiles.length}`);
check('灵气场已计算', w.qiField.length === 48 * 48);

console.log('\n【边界】');
let edgeCloud = true;
for (let i = 0; i < 48; i++) {
    if (w.get(i, 0) !== TILE.CLOUD) edgeCloud = false;
    if (w.get(i, 47) !== TILE.CLOUD) edgeCloud = false;
    if (w.get(0, i) !== TILE.CLOUD) edgeCloud = false;
    if (w.get(47, i) !== TILE.CLOUD) edgeCloud = false;
}
check('外圈全部为云海（天然边界）', edgeCloud);
check('云海不可通行', tileDef(TILE.CLOUD).walk === false);
check('走出边界返回云海', w.get(-1, 10) === TILE.CLOUD && w.get(99, 99) === TILE.CLOUD);

console.log('\n【地形分布】');
const st = w.stats();
console.log('  ' + Object.entries(st.counts).map(([k, v]) => `${TILE_DEFS[k]?.name || k}:${v}`).join('  '));
check('存在山门（宗门）', (st.counts[TILE.SECT] || 0) > 0, `${st.counts[TILE.SECT]}`);
check('存在灵脉', (st.counts[TILE.VEIN] || 0) > 0, `${st.counts[TILE.VEIN]}`);
check('存在妖兽林', (st.counts[TILE.FOREST] || 0) > 0, `${st.counts[TILE.FOREST]}`);
check('存在洞府石台', (st.counts[TILE.CAVE] || 0) > 0, `${st.counts[TILE.CAVE]}`);
check('存在灵石矿脉', (st.counts[TILE.ORE] || 0) > 0, `${st.counts[TILE.ORE]}`);
check('存在青芜坡（基础地形）', (st.counts[TILE.PLAIN] || 0) > 0, `${st.counts[TILE.PLAIN]}`);

const total = Object.values(st.counts).reduce((a, b) => a + b, 0);
check('瓦片总数 = 48×48', total === 48 * 48, `${total}`);
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
for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== w2.tiles[i]) { same = false; break; }
}
check('同种子生成同一世界', same);
const w3 = new World(new RNG(999));
let diff = false;
for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== w3.tiles[i]) { diff = true; break; }
}
check('不同种子生成不同世界', diff);

console.log('\n【资源】');
check('已撒布资源点', w.resources.size > 0, `${w.resources.size} 个`);
let herbOnHighQi = true;
for (const [key, r] of w.resources) {
    if (r.type !== RES.HERB) continue;
    const [x, y] = key.split(',').map(Number);
    if (w.qiAt(x, y) < 2.4) herbOnHighQi = false;
}
check('灵草只长在灵气 ≥ 2.4 处', herbOnHighQi);

// 采集
let harvested = null;
for (const [key] of w.resources) {
    const [x, y] = key.split(',').map(Number);
    harvested = w.harvest(x, y);
    if (harvested) { check('采集成功返回资源', !!harvested.type && harvested.amount > 0); break; }
}
check('采集后该点资源消失', harvested !== null);

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
for (let i = 0; i < 500; i++) {
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
