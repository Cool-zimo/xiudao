/** 区块（Chunk）流式加载测试 —— Minecraft 式懒加载 */
let pass = 0, fail = 0;
const check = (l, c, e = '') => {
    if (c) { pass++; console.log(`  ✓ ${l}`); }
    else { fail++; console.log(`  ✗ ${l} ${e}`); }
};

const { World, WORLD_SIZE, CHUNK_SIZE, CHUNKS_PER_SIDE } = await import('./src/systems/world.js');
const { RNG } = await import('./src/core/rng.js');
const { fbm, ridge, hash3, valueNoise } = await import('./src/systems/noise.js');

console.log('═══════ 区块流式加载测试 ═══════\n');

console.log('【噪声函数】');
// 确定性
check('同参数噪声一致', valueNoise(3.7, 9.2, 42) === valueNoise(3.7, 9.2, 42));
check('不同种子噪声不同', valueNoise(3.7, 9.2, 42) !== valueNoise(3.7, 9.2, 43));
// 值域
let inRange = true, ridgeInRange = true;
for (let i = 0; i < 500; i++) {
    const x = Math.random() * 200, y = Math.random() * 200;
    const v = fbm(x, y, 7, 4);
    if (v < 0 || v > 1) inRange = false;
    const r = ridge(x, y, 7, 4);
    if (r < 0 || r > 1) ridgeInRange = false;
}
check('fbm 输出在 [0,1]', inRange);
check('ridge 输出在 [0,1]', ridgeInRange);
// 连续性：相邻采样不应突变
let maxJump = 0;
for (let i = 0; i < 300; i++) {
    const x = Math.random() * 100, y = Math.random() * 100;
    const a = fbm(x, y, 7, 4), b = fbm(x + 0.05, y, 7, 4);
    maxJump = Math.max(maxJump, Math.abs(a - b));
}
check('噪声连续（无突变）', maxJump < 0.15, `最大跳变 ${maxJump.toFixed(3)}`);
// hash 分布
const buckets = new Array(10).fill(0);
for (let i = 0; i < 10000; i++) {
    buckets[Math.floor(hash3(i % 100, (i / 100) | 0, 5) * 10)]++;
}
const avg = 1000, maxDev = Math.max(...buckets.map(b => Math.abs(b - avg) / avg));
check('hash3 分布均匀（偏差<15%）', maxDev < 0.15, `最大偏差 ${(maxDev * 100).toFixed(1)}%`);

console.log('\n【懒加载：按需生成】');
const w = new World(new RNG(2468));
check('构造后零区块', w.chunks.size === 0, `${w.chunks.size}`);
check('区块总数为 256（16×16）', CHUNKS_PER_SIDE * CHUNKS_PER_SIDE === 256);

// 读一格 → 只应生成 1 个区块
w.get(130, 130);
check('读 1 格只生成 1 个区块', w.chunks.size === 1, `${w.chunks.size}`);

// 预热周围
const S = w.sectRect;
const spawn = { x: S.x + (S.w >> 1), y: S.y + (S.h >> 1) };
w.ensureAround(spawn.x, spawn.y, 2);
check('预热后生成 25 个区块（5×5）', w.chunks.size === 25, `${w.chunks.size}`);

// 未触碰的区域仍是空的
check('远处区块仍未加载', !w.isChunkLoaded(0, 0), '角落区块不该被加载');
check('探索数 = 区块数', w.explored.size === w.chunks.size);

console.log('\n【区块生成性能】');
const w2 = new World(new RNG(1));
const t0 = Date.now();
for (let cy = 0; cy < CHUNKS_PER_SIDE; cy++)
    for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) w2.getChunk(cx, cy);
const full = Date.now() - t0;
check('全图 256 区块生成 <500ms', full < 500, `${full}ms`);
console.log(`  全图生成耗时: ${full}ms（约 ${(full / 256).toFixed(2)}ms/区块）`);

// 单区块生成耗时（决定移动时会不会卡）
const w3 = new World(new RNG(2));
const t1 = Date.now();
for (let i = 0; i < 100; i++) w3.getChunk(i % 16, (i / 16) | 0);
const per = (Date.now() - t1) / 100;
check('单区块生成 <5ms（移动不卡）', per < 5, `${per.toFixed(2)}ms`);

console.log('\n【卸载与重建一致性】');
const w4 = new World(new RNG(31337));
w4.ensureAround(128, 128, 2);
const snapA = [], snapB = [];
for (let y = 100; y < 160; y++) for (let x = 100; x < 160; x++) {
    snapA.push(w4.get(x, y));
    snapB.push(w4.qiAt(x, y));
}
const loadedBefore = w4.chunks.size;
w4.chunks.clear();
check('清空后区块数为 0', w4.chunks.size === 0);
const snapA2 = [], snapB2 = [];
for (let y = 100; y < 160; y++) for (let x = 100; x < 160; x++) {
    snapA2.push(w4.get(x, y));
    snapB2.push(w4.qiAt(x, y));
}
check('重建后地形完全一致', snapA.join() === snapA2.join());
check('重建后灵气完全一致', snapB.join() === snapB2.join());
check('探索记录未丢失（仍记得来过）', w4.explored.size === loadedBefore, `${w4.explored.size} vs ${loadedBefore}`);

console.log('\n【内存占用】');
// 每个区块：tiles 256B + qi 1KB = 1.25KB
const st = w2.stats();
const bytes = st.loadedChunks * (CHUNK_SIZE * CHUNK_SIZE * (1 + 4));
check('全图地形内存 <1MB', bytes < 1024 * 1024, `${(bytes / 1024).toFixed(0)}KB`);
console.log(`  全图 256 区块：地形 ${(st.loadedChunks * 256 / 1024).toFixed(0)}KB + 灵气 ${(st.loadedChunks * 1024 / 1024).toFixed(0)}KB`);

// 对比：若用整图 canvas 预渲染会占多少
const canvasBytes = WORLD_SIZE * 72 * WORLD_SIZE * 72 * 4;
console.log(`  若整图预渲染：${(canvasBytes / 1024 / 1024 / 1024).toFixed(2)}GB（浏览器必崩，所以必须分块）`);
check('整图预渲染方案不可行（>1GB）', canvasBytes > 1024 * 1024 * 1024);

console.log('\n【存档：只存变化量】');
const w5 = new World(new RNG(777));
w5.ensureAround(128, 128, 3);
// 采一些资源、建一个洞府
let picked = 0;
for (let y = 100; y < 160 && picked < 30; y++)
    for (let x = 100; x < 160 && picked < 30; x++)
        if (w5.resourceAt(x, y) && w5.harvest(x, y)) picked++;
let built = false;
for (let y = 100; y < 160 && !built; y++)
    for (let x = 100; x < 160 && !built; x++)
        if (w5.get(x, y) === 'cave') built = w5.build(x, y, 'cave').ok;

const sd = w5.serialize();
const size = JSON.stringify(sd).length;
check('存档含已采集记录', sd.harvested.length === 30, `${sd.harvested.length}`);
check('存档含建筑', sd.buildings.length >= 1, `${sd.buildings.length}`);
check('存档含探索区块', sd.explored.length > 0, `${sd.explored.length}`);
check('存档 <50KB', size < 50 * 1024, `${(size / 1024).toFixed(1)}KB`);
console.log(`  存档体积: ${(size / 1024).toFixed(1)}KB（地形靠种子重建）`);

// 往返
const w6 = new World(new RNG(777));
w6.deserialize(sd);
check('恢复后已采集数一致', w6.harvested.size === 30, `${w6.harvested.size}`);
check('恢复后建筑一致', w6.buildings.size === w5.buildings.size);
check('恢复后探索区块一致', w6.explored.size === w5.explored.size);
// 恢复后原处应已采空
let stillThere = 0;
for (const k of [...w5.harvested].slice(0, 10)) {
    const [x, y] = k.split(',').map(Number);
    if (w6.resourceAt(x, y)) stillThere++;
}
check('恢复后已采点仍为空', stillThere === 0, `${stillThere} 处复活`);

console.log('\n【连通性：世界不能走不通】');
const w7 = new World(new RNG(20240907));
for (let cy = 0; cy < CHUNKS_PER_SIDE; cy++)
    for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) w7.getChunk(cx, cy);
const sp = { x: w7.sectRect.x + (w7.sectRect.w >> 1), y: w7.sectRect.y + (w7.sectRect.h >> 1) };
const seen = new Set([sp.x + ',' + sp.y]);
const q = [[sp.x, sp.y]];
let head = 0;
while (head < q.length) {
    const [x, y] = q[head++];
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || !w7.walkable(nx, ny)) continue;
        seen.add(k); q.push([nx, ny]);
    }
}
const st7 = w7.stats();
const walkable = 65536 - (st7.counts.cloud || 0);
check('从山门可达 >95% 可通行区域', seen.size / walkable > 0.95,
    `${seen.size}/${walkable} = ${(seen.size / walkable * 100).toFixed(1)}%`);

console.log('\n【地形多样性】');
for (const seed of [12345, 999, 20240907]) {
    const wx = new World(new RNG(seed));
    for (let cy = 0; cy < CHUNKS_PER_SIDE; cy++)
        for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) wx.getChunk(cx, cy);
    const s = wx.stats();
    const kinds = Object.keys(s.counts).length;
    check(`种子 ${seed} 含 ≥5 种地形`, kinds >= 5, `${kinds} 种: ${Object.keys(s.counts).join(',')}`);
}

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
