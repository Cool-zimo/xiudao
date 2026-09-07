/**
 * 角色选择 + 主页修炼动画 验证
 */
import { CHARACTERS, getCharacter, getByGender } from './src/data/characters.js';
import { getPortrait, getPortraitStage } from './src/ui/art.js';
import fs from 'fs';

// DOM stub
class El {
    constructor(tag = 'div') {
        this.tagName = tag; this.children = []; this.dataset = {};
        this.style = { setProperty() {} };
        this._html = '';
        this.classList = {
            _s: new Set(),
            add(...c) { c.forEach(x => this._s.add(x)); },
            remove(...c) { c.forEach(x => this._s.delete(x)); },
            toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); },
            contains(c) { return this._s.has(c); }
        };
    }
    set innerHTML(v) { this._html = v; }
    get innerHTML() { return this._html; }
    appendChild(c) { this.children.push(c); return c; }
    addEventListener() {}
    querySelectorAll() { return []; }
    querySelector() { return new El(); }
    getBoundingClientRect() { return { width: 480, height: 520, left: 0, top: 0 }; }
    getContext() {
        return new Proxy({}, {
            get: (t, k) => {
                if (k === 'createRadialGradient' || k === 'createLinearGradient') {
                    return () => ({ addColorStop() {} });
                }
                return () => {};
            }
        });
    }
}
globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
globalThis.document = {
    getElementById: () => new El(),
    createElement: t => new El(t),
    addEventListener() {},
    documentElement: { style: { setProperty() {} } },
    hidden: false
};
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = () => {};
globalThis.cancelAnimationFrame = () => {};
globalThis.MutationObserver = class { observe() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

let pass = 0, fail = 0;
const check = (l, c, e = '') => {
    if (c) { pass++; console.log(`  ✓ ${l}`); }
    else { fail++; console.log(`  ✗ ${l} ${e}`); }
};

console.log('═══════ 角色选择 + 主页动画 验证 ═══════\n');

console.log('【角色库】');
check('共 4 位可选角色', CHARACTERS.length === 4, `实有 ${CHARACTERS.length}`);
check('男性 2 位', getByGender('male').length === 2);
check('女性 2 位', getByGender('female').length === 2);
check('覆盖性别选择需求', getByGender('male').length > 0 && getByGender('female').length > 0);

console.log('\n【路线差异化】');
const ids = CHARACTERS.map(c => c.id);
check('角色 id 唯一', new Set(ids).size === 4);
check('修行路线各不相同', new Set(CHARACTERS.map(c => c.title)).size === 4);
const bonusKeys = CHARACTERS.map(c => Object.keys(c.bonus).sort().join(','));
check('初始属性加成各不相同', new Set(bonusKeys).size >= 3, bonusKeys.join(' | '));
check('妖修初始心魔 40（邪修路线）',
    getCharacter('fox').bonus.karma === 40);
check('正道角色无初始心魔加成',
    !getCharacter('swordsman').bonus.karma && !getCharacter('ice').bonus.karma);

console.log('\n【立绘资源】');
for (const c of CHARACTERS) {
    check(`${c.name} 站立立绘存在`, fs.existsSync(c.stand.replace('assets/art/', './assets/art/')) || fs.existsSync(c.stand), c.stand);
    check(`${c.name} 打坐立绘存在`, fs.existsSync(c.sit), c.sit);
}
check('每位角色都有独立打坐图（主页动画用）',
    new Set(CHARACTERS.map(c => c.sit)).size === 4);

console.log('\n【立绘与角色绑定】');
const p1 = { characterId: 'swordsman', karma: 5, faction: '正道', cultivation: { realmIndex: 0 } };
check('所选角色立绘优先于境界立绘', getPortrait(p1) === getCharacter('swordsman').stand);
check('阶段名显示修行路线', getPortraitStage(p1) === '剑修', getPortraitStage(p1));

const p2 = { characterId: 'fox', karma: 40, faction: '邪修', cultivation: { realmIndex: 0 } };
check('妖修立绘正确', getPortrait(p2) === getCharacter('fox').stand);
check('妖修阶段名为妖修', getPortraitStage(p2) === '妖修');

const p3 = { characterId: 'ice', karma: 88, faction: '正道', cultivation: { realmIndex: 3 } };
check('心魔 88 → 正道角色也显魔相', getPortrait(p3) === 'assets/art/char_demon.jpg');
check('心魔 88 → 阶段名走火入魔', getPortraitStage(p3) === '走火入魔');

const p4 = { characterId: 'fox', karma: 88, faction: '邪修', cultivation: { realmIndex: 3 } };
check('邪修心魔满仍用本角色立绘（本就是魔道）', getPortrait(p4) === getCharacter('fox').stand);

console.log('\n【灵气主题色】');
check('每位角色有独立灵气色', new Set(CHARACTERS.map(c => c.aura)).size === 4);
check('灵气色格式正确', CHARACTERS.every(c => /^#[0-9a-f]{6}$/i.test(c.aura)));
check('灵气 RGB 格式正确', CHARACTERS.every(c => /^\d+,\d+,\d+$/.test(c.auraRgb)));

console.log('\n【主页动画模块】');
const { HomeScene } = await import('./src/ui/home-scene.js');
const { CharacterSelect } = await import('./src/ui/character-select.js');

const homeEl = new El();
let hsOk = true, hsErr = '';
try {
    const hs = new HomeScene(homeEl, { characterId: 'ice' });
    hs.start();
    hs._update(0.016);
    hs._render();
    hs.setCharacter('fox');
    hs.stop();
} catch (e) { hsOk = false; hsErr = e.message; }
check('HomeScene 初始化/启动/切换/停止 无异常', hsOk, hsErr);
check('主页容器已渲染内容', homeEl.innerHTML.includes('home-scene'));
check('主页含打坐角色图', homeEl.innerHTML.includes('sit_'));
check('主页含灵气 Canvas', homeEl.innerHTML.includes('hs-canvas'));
check('主页含进入按钮', homeEl.innerHTML.includes('hs-enter'));

console.log('\n【角色选择界面】');
const selEl = new El();
let csOk = true, csErr = '';
let confirmed = null;
try {
    const cs = new CharacterSelect(selEl, {
        initialId: 'bodycult',
        onConfirm: (c) => { confirmed = c; }
    });
    cs.render();
    const html = selEl.innerHTML;
    check('渲染 4 张角色卡', (html.match(/cs-card/g) || []).length >= 4);
    check('含性别筛选标签', html.includes('男修') && html.includes('女修'));
    check('含角色路线标题', html.includes('剑修') && html.includes('体修') && html.includes('冰修') && html.includes('妖修'));
    check('含属性加成展示', html.includes('cs-b'));
    check('含初始心魔说明', html.includes('初始心魔'));
} catch (e) { csOk = false; csErr = e.message; }
check('CharacterSelect 渲染无异常', csOk, csErr);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
