/**
 * 启动流程验证 —— 模拟浏览器加载 index.html + src/main.js
 * 不依赖 jsdom，用自建 DOM stub 还原 index.html 结构
 */

// ---------- 完整 DOM stub ----------
class ClassList {
    constructor(el) { this.el = el; this._s = new Set(); }
    add(...c) { c.forEach(x => this._s.add(x)); }
    remove(...c) { c.forEach(x => this._s.delete(x)); }
    toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); }
    contains(c) { return this._s.has(c); }
}
class El {
    constructor(tag = 'div', id = '') {
        this.tagName = tag; this.id = id;
        this.children = []; this.dataset = {}; this.attrs = {};
        this.classList = new ClassList(this);
        this.style = { setProperty() {} };
        this._html = ''; this._text = '';
        this._listeners = {};
        this.isConnected = true;
    }
    set innerHTML(v) {
        this._html = v;
        // 极简解析：抽出 class / data-* / src / id，生成子元素以便 querySelector 工作
        this._parsed = [];
        const re = /<(\w+)([^>]*)>/g;
        let m;
        while ((m = re.exec(v))) {
            const [, tag, attrs] = m;
            const child = new El(tag);
            const cls = /class="([^"]*)"/.exec(attrs);
            if (cls) cls[1].split(/\s+/).forEach(c => c && child.classList.add(c));
            const idm = /id="([^"]*)"/.exec(attrs);
            if (idm) child.id = idm[1];
            const dm = /data-([\w-]+)="([^"]*)"/g;
            let d;
            while ((d = dm.exec(attrs))) child.dataset[d[1]] = d[2];
            const src = /src="([^"]*)"/.exec(attrs);
            if (src) child.src = src[1];
            child._html = v.slice(m.index);
            this._parsed.push(child);
        }
    }
    get innerHTML() { return this._html; }
    set textContent(v) { this._text = v; }
    get textContent() { return this._text; }
    appendChild(c) { this.children.push(c); return c; }
    addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn); }
    dispatch(t, e = {}) { (this._listeners[t] || []).forEach(fn => fn(e)); }
    click() { this.dispatch('click', { target: this }); }
    querySelector(sel) {
        const all = this.querySelectorAll(sel);
        return all[0] || null;
    }
    querySelectorAll(sel) {
        const out = [];
        const match = (el, s) => {
            if (s.startsWith('.')) return el.classList.contains(s.slice(1));
            if (s.startsWith('#')) return el.id === s.slice(1);
            if (s.startsWith('[') && s.endsWith(']')) {
                const [k, v] = s.slice(1, -1).split('=');
                return el.attrs[k] === (v || '').replace(/"/g, '');
            }
            if (s.includes('[data-')) {
                const [tag, rest] = s.split('[');
                const key = rest.match(/data-([\w-]+)/)?.[1];
                return (tag === '' || el.tagName === tag) && key && el.dataset[key] !== undefined;
            }
            return el.tagName === s;
        };
        // 多选择器（逗号分隔）
        const parts = sel.split(',').map(s => s.trim());
        const walk = (node) => {
            for (const c of node._parsed || []) {
                if (parts.some(p => match(c, p))) out.push(c);
                walk(c);
            }
            for (const c of node.children || []) {
                if (parts.some(p => match(c, p))) out.push(c);
                walk(c);
            }
        };
        walk(this);
        return out;
    }
    getBoundingClientRect() { return { width: 480, height: 520, left: 0, top: 0 }; }
    getContext() {
        return new Proxy({}, {
            get: (t, k) => {
                if (String(k).includes('Gradient')) return () => ({ addColorStop() {} });
                return () => {};
            }
        });
    }
}

// 还原 index.html 的关键节点
const nodes = {};
const IDS = ['app','btn-home','btn-save','btn-new',
             'screen-login','screen-home','screen-select','screen-main',
             'login-container','home-container','select-container','hud-container','panel-container',
             'modal','modal-close','modal-body'];
for (const id of IDS) nodes[id] = new El(id.startsWith('btn') ? 'button' : 'div', id);
// 还原 index.html 中初始就带 hidden 类的节点
nodes['btn-home'].classList.add('hidden');
nodes['btn-save'].classList.add('hidden');
nodes['btn-new'].classList.add('hidden');
nodes['screen-home'].classList.add('hidden');
nodes['screen-select'].classList.add('hidden');
nodes['screen-main'].classList.add('hidden');

global.document = {
    getElementById: id => nodes[id] || (nodes[id] = new El('div', id)),
    createElement: t => new El(t),
    addEventListener() {},
    documentElement: new El('html'),
    hidden: false
};
const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
};
global.window = {
    addEventListener() {}, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false })
};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.confirm = () => true;
global.alert = () => {};
global.MutationObserver = class { observe() {} };
global.Image = class { set src(v) { this._src = v; if (this.onload) this.onload(); } };

// ---------- 执行验证 ----------
let pass = 0, fail = 0;
const check = (l, c, e = '') => {
    if (c) { pass++; console.log(`  ✓ ${l}`); }
    else { fail++; console.log(`  ✗ ${l} ${e}`); }
};

console.log('═══════ 启动流程验证（模拟浏览器加载）═══════\n');

console.log('【模块加载】');
let loadErr = null;
try { await import('./src/main.js'); }
catch (e) { loadErr = e.message; }
check('src/main.js 及其依赖链全部加载成功', !loadErr, loadErr || '');

await new Promise(r => setTimeout(r, 60));

console.log('\n【登录页渲染】');
check('登录页可见', !nodes['screen-login'].classList.contains('hidden'));
check('登录卡片已渲染', nodes['login-container'].innerHTML.includes('login-root'));
check('包含令牌输入框', nodes['login-container'].innerHTML.includes('token-input'));
check('包含获取令牌指引', nodes['login-container'].innerHTML.includes('如何获取令牌'));
check('包含本地试玩入口', nodes['login-container'].innerHTML.includes('btn-skip'));
check('登录页时主页隐藏', nodes['screen-home'].classList.contains('hidden'));
check('登录页时主界面隐藏', nodes['screen-main'].classList.contains('hidden'));

console.log('\n【跳过登录 → 主页】');
const skipBtn = nodes['login-container'].querySelector('#btn-skip');
check('找到「本地试玩」按钮', !!skipBtn);
if (skipBtn) {
    skipBtn.click();
    await new Promise(r => setTimeout(r, 80));
    check('已跳转到主页', !nodes['screen-home'].classList.contains('hidden'));
    check('主页渲染出修炼场景', nodes['home-container'].innerHTML.includes('home-scene'));
    check('主页含 Canvas 层', nodes['home-container'].innerHTML.includes('hs-canvas'));
    check('主页含角色打坐图', /sit_\w+\.jpg/.test(nodes['home-container'].innerHTML));
    check('主页含「进入洞府」按钮', nodes['home-container'].innerHTML.includes('hs-enter'));
    check('主页顶栏显示游客状态', nodes['home-container'].innerHTML.includes('本地试玩'));
    check('主页显示云存档未连接', nodes['home-container'].innerHTML.includes('未同步'));
}

console.log('\n【点击「进入洞府」→ 角色选择（无存档时）】');
const enterBtn = nodes['home-container'].querySelector('#hs-enter');
check('找到「进入洞府」按钮', !!enterBtn);
if (enterBtn) {
    enterBtn.click();
    await new Promise(r => setTimeout(r, 60));
    check('跳转到角色选择页', !nodes['screen-select'].classList.contains('hidden'));
    check('角色选择页已渲染', nodes['select-container'].innerHTML.includes('cs-root'));
    check('渲染 4 张角色卡', (nodes['select-container'].innerHTML.match(/cs-card/g) || []).length >= 4);
}

console.log('\n【1.x 老存档兼容】');
// 模拟 1.x 存档（裸 player 对象）
store['xiudao_save'] = JSON.stringify({
    name: '老道友',
    faction: '邪修',
    cultivation: { realm: '筠仙期', realmIndex: 5, level: 8, experience: 500, expToNext: 5000000 },
    attributes: { hp: 100, maxHp: 100, mp: 50, maxMp: 50, attack: 10, defense: 5, speed: 10, luck: 10 }
});
const { migrateSave } = await import('./src/save/migrate.js');
const mig = migrateSave(JSON.parse(store['xiudao_save']));
check('1.x 裸 player 存档被自动识别包装', !!mig.save?.player, JSON.stringify(mig).slice(0,80));
check('老档境界「筠仙期」→ 大乘期', mig.save?.player?.cultivation?.realm === '大乘期',
      mig.save?.player?.cultivation?.realm);
check('邪修老档心魔 40', mig.save?.player?.karma === 40, String(mig.save?.player?.karma));
check('标记为已迁移', mig.migrated === true && mig.from === 1);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
