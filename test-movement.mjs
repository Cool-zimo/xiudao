/** 移动手感测试：平滑插值 / 触控 / 自动寻路 */
class ClassList {
    constructor() { this._s = new Set(); }
    add(...c) { c.forEach(x => this._s.add(x)); }
    remove(...c) { c.forEach(x => this._s.delete(x)); }
    toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); }
    contains(c) { return this._s.has(c); }
}
class El {
    constructor(tag = 'div', id = '') {
        this.tagName = tag; this.id = id; this.children = []; this.dataset = {};
        this.classList = new ClassList(); this.style = { setProperty() { } };
        this._html = ''; this._listeners = {}; this._parsed = [];
        this.clientWidth = 720; this.offsetWidth = 100; this.disabled = false;
    }
    set innerHTML(v) {
        this._html = v; this._parsed = [];
        const re = /<(\w+)([^>]*)>/g; let m;
        while ((m = re.exec(v))) {
            const [, tag, attrs] = m; const c = new El(tag);
            const cls = /class="([^"]*)"/.exec(attrs);
            if (cls) cls[1].split(/\s+/).forEach(x => x && c.classList.add(x));
            const idm = /id="([^"]*)"/.exec(attrs); if (idm) c.id = idm[1];
            let d; const dm = /data-([\w-]+)="([^"]*)"/g;
            while ((d = dm.exec(attrs))) c.dataset[d[1]] = d[2];
            const da = /data-dir="([^"]*)"/.exec(attrs); if (da) c.dataset.dir = da[1];
            const ac = /data-act="([^"]*)"/.exec(attrs); if (ac) c.dataset.action = ac[1];
            this._parsed.push(c);
        }
    }
    get innerHTML() { return this._html; }
    set textContent(v) { this._text = v; } get textContent() { return this._text || ''; }
    appendChild(c) { this.children.push(c); return c; }
    addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn); }
    dispatch(t, e = {}) { (this._listeners[t] || []).forEach(fn => fn(e)); }
    click() { this.dispatch('click', { target: this, preventDefault() { } }); }
    setPointerCapture() { }
    querySelector(s) { return this.querySelectorAll(s)[0] || null; }
    querySelectorAll(s) {
        const out = []; const parts = s.split(',').map(x => x.trim());
        const match = (el, p) => {
            if (p.startsWith('.')) return el.classList.contains(p.slice(1));
            if (p.startsWith('#')) return el.id === p.slice(1);
            if (p.includes('[data-act')) return el.dataset.action !== undefined;
            if (p.includes('[data-')) { const k = p.match(/data-([\w-]+)/)?.[1]; return k && el.dataset[k] !== undefined; }
            return el.tagName === p;
        };
        const walk = n => { for (const c of (n._parsed || [])) { if (parts.some(p => match(c, p))) out.push(c); } };
        walk(this); return out;
    }
    getBoundingClientRect() { return { width: 720, height: 720, left: 0, top: 0 }; }
    getContext() {
        return new Proxy({}, {
            get: (t, k) => String(k).includes('Gradient') ? () => ({ addColorStop() { } }) : () => { }
        });
    }
}

let pass = 0, fail = 0;
const check = (l, c, e = '') => {
    if (c) { pass++; console.log(`  ✓ ${l}`); }
    else { fail++; console.log(`  ✗ ${l} ${e}`); }
};

// ---- 环境 stub ----
const store = {};
global.localStorage = { getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const winListeners = {};
global.window = {
    addEventListener: (t, fn) => { (winListeners[t] ||= []).push(fn); },
    removeEventListener: () => { },
    devicePixelRatio: 1, matchMedia: () => ({ matches: false })
};
global.document = {
    getElementById: id => (global.__nodes[id] ||= new El('div', id)),
    createElement: t => new El(t),
    addEventListener: () => { }, removeEventListener: () => { },
    documentElement: new El('html'), hidden: false
};
global.__nodes = {};
global.performance = { now: () => Date.now() };
let rafCount = 0;
global.requestAnimationFrame = () => { rafCount++; return 1; };   // 不自动跑，手动驱动
global.cancelAnimationFrame = () => { };
global.Image = class { set src(v) { this._src = v; this.width = 128; this.height = 128; } };

const { World } = await import('./src/systems/world.js');
const { RNG } = await import('./src/core/rng.js');
const { TimeSystem } = await import('./src/systems/time.js');
const { NPCSystem } = await import('./src/systems/npc.js');
const { WorldCanvas } = await import('./src/ui/world-canvas.js');

console.log('═══════ 移动手感 / 触控 / 寻路 测试 ═══════\n');

const world = new World(new RNG(2468));
const time = new TimeSystem(1, 6);
const npcs = new NPCSystem(world, new RNG(2469), time);
npcs.populate({ npcCount: 12, sectCount: 3 });

const root = new El('div', 'wc-test');
root.clientWidth = 720;

const moves = [];
const wc = new WorldCanvas(root, world, {
    npcSystem: npcs, time,
    onMove: r => moves.push(r)
});

console.log('【初始化】');
check('已创建渲染循环', rafCount > 0, `rAF 调用 ${rafCount} 次`);
check('玩家渲染坐标已初始化', wc.player.rx === 24 && wc.player.ry === 10);
check('触控方向键有 4 个', root.querySelectorAll('.wc-dir').length === 4);
check('含采集按钮', !!root.querySelector('[data-act="harvest"]'));

console.log('\n【平滑插值：逻辑坐标 vs 渲染坐标】');
wc.setPlayer(24, 10);
check('setPlayer 立即就位（无插值残影）', wc.player.rx === 24 && wc.player.ry === 10);

// 向右走一格：逻辑坐标立刻变，渲染坐标应仍接近旧值
wc.move(1, 0);
check('逻辑坐标立即更新', wc.player.x === 25 && wc.player.y === 10, `(${wc.player.x},${wc.player.y})`);
check('渲染坐标尚未跟上（不再瞬移）', Math.abs(wc.player.rx - 24) < 0.01, `rx=${wc.player.rx}`);

// 手动驱动若干帧，渲染坐标应逐步逼近
const trace = [];
for (let i = 0; i < 40; i++) { wc._update(1 / 60); trace.push(wc.player.rx); }
check('渲染坐标逐步逼近目标', trace[0] < 24.5 && trace[trace.length - 1] > 24.9,
    `${trace[0].toFixed(3)} → ${trace[trace.length - 1].toFixed(3)}`);
check('最终收敛到整数格', Math.abs(wc.player.rx - 25) < 0.01, `rx=${wc.player.rx}`);

// 中间过程应该是连续的小数，而不是直接跳变
const mid = trace.slice(1, 12);
const allBetween = mid.every(v => v > 24 && v < 25);
check('移动过程是连续插值而非跳变', allBetween, `${mid.slice(0, 4).map(v => v.toFixed(2)).join(',')}…`);

console.log('\n【插值与帧率无关】');
// 用大 dt 少帧数，应同样收敛
wc.setPlayer(24, 10);
wc.move(1, 0);
for (let i = 0; i < 6; i++) wc._update(1 / 10);   // 10 FPS
check('低帧率下也能收敛', Math.abs(wc.player.rx - 25) < 0.05, `rx=${wc.player.rx.toFixed(3)}`);

console.log('\n【相机平滑跟随】');
wc.setPlayer(10, 10);
const camStart = wc.camX;
wc.move(1, 0); wc.move(1, 0); wc.move(1, 0);
check('相机目标已更新', wc.camTX !== camStart, `${camStart} → ${wc.camTX}`);
const camNow = wc.camX;
for (let i = 0; i < 20; i++) wc._update(1 / 60);
check('相机平滑移动而非瞬移', Math.abs(wc.camX - camNow) > 0.01 && Math.abs(wc.camX - wc.camTX) < 0.2,
    `${camNow.toFixed(2)} → ${wc.camX.toFixed(2)}`);
// 约 1.5 秒后应完全到位（含吸附，不残留亚像素抖动）
for (let i = 0; i < 70; i++) wc._update(1 / 60);
check('相机最终精确到位', wc.camX === wc.camTX && wc.camY === wc.camTY,
    `${wc.camX.toFixed(4)} vs ${wc.camTX}`);

console.log('\n【BFS 自动寻路】');
wc.setPlayer(20, 20);
const p1 = wc.findPath(20, 20, 23, 20);
check('可找到直线路径', Array.isArray(p1) && p1.length === 3, `${p1?.length} 步`);
check('路径终点正确', p1 && p1[p1.length - 1].x === 23 && p1[p1.length - 1].y === 20);
check('路径每步都是单格相邻', p1 && p1.every((s, i) => {
    const prev = i === 0 ? { x: 20, y: 20 } : p1[i - 1];
    return Math.abs(s.x - prev.x) + Math.abs(s.y - prev.y) === 1;
}));

const p2 = wc.findPath(20, 20, 0, 0);
check('走到云海（不可通行）返回 null', p2 === null, String(p2));

const p3 = wc.findPath(20, 20, 20, 20);
check('原地返回空路径', Array.isArray(p3) && p3.length === 0);

// 路径不应穿墙
let pathOk = true;
const p4 = wc.findPath(24, 10, 24, 30);
if (p4) {
    for (const s of p4) if (!world.walkable(s.x, s.y)) pathOk = false;
    check('路径全部落在可通行格', pathOk);
    check('跨距离寻路成功', p4.length > 5, `${p4.length} 步`);
} else {
    check('跨距离寻路成功', false, '返回 null');
}

console.log('\n【触控：点击地图触发寻路】');
// 直接调用内部：模拟点击后应生成路径
wc._path = wc.findPath(wc.player.x, wc.player.y, 24, 12);
check('点击后生成路径队列', Array.isArray(wc._path) && wc._path.length > 0, `${wc._path?.length} 步`);

const beforeX = wc.player.x;
for (let i = 0; i < 400; i++) { wc._update(1 / 60); }
check('自动沿路径前进', wc.player.x !== beforeX || wc.player.y !== 10,
    `(${beforeX},10) → (${wc.player.x},${wc.player.y})`);

console.log('\n【连续移动节流】');
const cnt0 = moves.length;
wc._startHold(1, 0);
check('按下立即走一步', moves.length === cnt0 + 1);
check('已启动连续移动定时器', wc._moveTimer !== null);
wc._stopHold();
check('松开后定时器已清理', wc._moveTimer === null && wc._held === null);

console.log('\n【不可通行阻挡】');
// 找到云海边上的格子，朝云海走应失败
let edge = null;
for (let y = 2; y < 46 && !edge; y++) {
    for (let x = 2; x < 46 && !edge; x++) {
        if (world.walkable(x, y) && !world.walkable(x - 1, y)) edge = { x, y };
    }
}
if (edge) {
    wc.setPlayer(edge.x, edge.y);
    const r = wc.move(-1, 0);
    check('撞云海返回失败', r.ok === false, JSON.stringify(r));
    check('失败时逻辑坐标不变', wc.player.x === edge.x, `x=${wc.player.x}`);
    check('失败原因可读', /云海|不通/.test(r.reason), r.reason);
}

console.log('\n【资源清理】');
let destroyed = false;
try { wc.destroy(); destroyed = true; } catch (e) { destroyed = false; }
check('destroy 不抛异常', destroyed);
check('destroy 后定时器已停', wc._moveTimer === null);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
