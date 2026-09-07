/**
 * 战斗系统 + UI 层验证
 * UI 依赖 DOM，这里用轻量 stub 模拟，重点验证渲染不抛异常
 */
import { CombatSystem, SKILLS, COMBOS, ELEMENT_COUNTER } from './src/systems/combat.js';
import { RNG } from './src/core/rng.js';

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
    if (cond) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label} ${extra}`); }
};

console.log('═══════ 战斗系统 + UI 层验证 ═══════\n');

// ---------- 轻量 DOM stub ----------
class El {
    constructor(tag = 'div') {
        this.tagName = tag; this.children = []; this.dataset = {};
        this.style = {}; this.classList = {
            _s: new Set(),
            add(...c) { c.forEach(x => this._s.add(x)); },
            remove(...c) { c.forEach(x => this._s.delete(x)); },
            toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); },
            contains(c) { return this._s.has(c); }
        };
        this._html = '';
    }
    set innerHTML(v) { this._html = v; }
    get innerHTML() { return this._html; }
    set textContent(v) { this._text = v; }
    get textContent() { return this._text || ''; }
    appendChild(c) { this.children.push(c); return c; }
    addEventListener() {}
    querySelectorAll() { return []; }
    querySelector() { return new El(); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 480, height: 640 }; }
    getContext() { return new Proxy({}, { get: () => () => {} }); }
}

globalThis.window = { addEventListener() {} };
globalThis.document = {
    getElementById: () => new El(),
    createElement: (t) => new El(t),
    addEventListener() {}
};
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = () => {};

console.log('【技能与连招配置】');
check('技能数量充足', SKILLS.length >= 6, `实有 ${SKILLS.length}`);
check('技能覆盖多元素', new Set(SKILLS.map(s => s.element)).size >= 5);
check('连招已定义', COMBOS.length >= 3);
check('元素克制表完整', Object.keys(ELEMENT_COUNTER).length >= 6);

// ---------- 战斗 ----------
console.log('\n【半即时战斗】');
const state = {
    player: {
        name: '测试', faction: '正道', karma: 10,
        attributes: { hp: 200, maxHp: 200, mp: 100, maxMp: 100, attack: 30, defense: 10, speed: 15, luck: 15 }
    }
};
const combat = new CombatSystem(state);
const rng = new RNG(42);
const enemy = {
    name: '青狼', maxHp: 300, hp: 300, attack: 18, defense: 5,
    speed: 12, element: '木', weakness: '金'
};

const b = combat.start(state.player, enemy, rng);
check('战斗可开始', !!b);
check('敌人血量初始化', b.enemy.hp === 300);

const r1 = combat.useSkill(state.player, 'sk_qijian');
check('可释放技能', r1.ok, r1.reason);
check('技能造成伤害', r1.damage > 0, `伤害 ${r1.damage}`);
check('金克木触发弱点加成', r1.isWeakness === true, `弱点=${r1.isWeakness}`);
check('技能消耗法力', state.player.attributes.mp < 100, `剩余 ${state.player.attributes.mp}`);

const cd = combat.getState().cooldowns['sk_qijian'];
check('技能进入冷却', cd > 0, `剩余 ${cd} 回合`);
const r2 = combat.useSkill(state.player, 'sk_qijian');
check('冷却期间无法再次释放', r2.ok === false, r2.reason);

// 连招
console.log('\n【连招机制】');
const s2 = {
    player: { name: 't', karma: 0, attributes: { hp: 500, maxHp: 500, mp: 300, maxMp: 300, attack: 40, defense: 10, speed: 15, luck: 10 } }
};
const c2 = new CombatSystem(s2);
const rng2 = new RNG(7);
c2.start(s2.player, { name: '木桩', maxHp: 9999, hp: 9999, attack: 1, defense: 0, speed: 1, weakness: null }, rng2);

const a1 = c2.useSkill(s2.player, 'sk_qijian');
c2.useSkill(s2.player, 'sk_liehuo'); // 触发 金火交攻
const lastLog = c2.battle.log[c2.battle.log.length - 1];
check('按顺序释放可触发连招', lastLog.combo?.name === '金火交攻', `实为 ${lastLog.combo?.name}`);
check('连招提升伤害', lastLog.damage > a1.damage, `${a1.damage} → ${lastLog.damage}`);

// 元素克制
console.log('\n【元素克制与闪避】');
check('火克金', ELEMENT_COUNTER['火'] === '金');
const s3 = {
    player: { name: 'x', karma: 0, attributes: { hp: 300, maxHp: 300, mp: 200, maxMp: 200, attack: 50, defense: 5, speed: 30, luck: 10 } }
};
const c3 = new CombatSystem(s3);
c3.start(s3.player, { name: '慢怪', maxHp: 500, hp: 500, attack: 20, defense: 0, speed: 2, weakness: null }, new RNG(3));
c3.useSkill(s3.player, 'sk_qingfeng'); // 提升闪避
let dodges = 0;
for (let i = 0; i < 12; i++) {
    const r = c3.useSkill(s3.player, 'sk_qijian');
    if (r.counter?.dodged) dodges++;
}
check('高身法可闪避敌人攻击', dodges > 0, `12 回合闪避 ${dodges} 次`);

// 敌人击败
console.log('\n【战斗结束】');
const s4 = {
    player: { name: 'y', karma: 0, attributes: { hp: 999, maxHp: 999, mp: 999, maxMp: 999, attack: 500, defense: 50, speed: 20, luck: 10 } }
};
const c4 = new CombatSystem(s4);
c4.start(s4.player, { name: '弱鸡', maxHp: 10, hp: 10, attack: 1, defense: 0, speed: 1, weakness: '金' }, new RNG(1));
const kill = c4.useSkill(s4.player, 'sk_qijian');
check('可击败敌人', kill.enemyDefeated === true, `剩余 HP ${kill.enemyHp}`);
check('击败后不再反击', kill.counter === undefined);

// ---------- UI 层冒烟测试 ----------
console.log('\n【UI 层冒烟测试（DOM stub）】');
const { HUD } = await import('./src/ui/hud.js');
const { DungeonMap } = await import('./src/ui/dungeon-map.js');
const { MethodPanel } = await import('./src/ui/method-panel.js');
const { TribulationCanvas } = await import('./src/ui/tribulation-canvas.js');
const { Game } = await import('./src/game.js');

const game = new Game();
const p = game.createCharacter({ name: '道友', faction: '正道', profession: '锻造师', talent: '运气' });

const hudEl = new El();
const hud = new HUD(hudEl, game, { onAction: () => {} });
let hudOk = true, hudErr = '';
try { hud.render(); } catch (e) { hudOk = false; hudErr = e.message; }
check('HUD 渲染不抛异常', hudOk, hudErr);
check('HUD 输出包含角色名', hudEl.innerHTML.includes('道友'));
check('HUD 包含心魔显示', hudEl.innerHTML.includes('心魔'));

const panelEl = new El();
const mp = new MethodPanel(panelEl, game, {});
let mpOk = true, mpErr = '';
try { mp.render(); } catch (e) { mpOk = false; mpErr = e.message; }
check('功法面板渲染不抛异常', mpOk, mpErr);
check('功法面板包含主修位', panelEl.innerHTML.includes('主修'));
check('功法面板包含连招说明', panelEl.innerHTML.includes('连招'));

const dmEl = new El();
const dm = new DungeonMap(dmEl, {});
let dmOk = true, dmErr = '';
try {
    dm.render({
        floor: 1, position: 0,
        nodes: [
            { id: 'n1', type: 'monster', name: '妖兽', icon: '👹', cleared: false, revealed: true },
            { id: 'n2', type: 'treasure', name: '宝箱', icon: '📦', cleared: false, revealed: false },
            { id: 'n3', type: 'boss', name: '秘境之主', icon: '🐉', cleared: false, revealed: true }
        ]
    });
} catch (e) { dmOk = false; dmErr = e.message; }
check('秘境地图渲染不抛异常', dmOk, dmErr);
check('地图显示当前层', dmEl.innerHTML.includes('第 1 层'));
check('未探索节点显示为未知', dmEl.innerHTML.includes('未知'));

const canvasEl = new El('canvas');
let tcOk = true, tcErr = '';
try {
    const tc = new TribulationCanvas(canvasEl, {
        config: { lightning: 5, speed: 1.2, duration: 10, realm: '练气期', nextRealm: '筑基期' }
    });
    check('天劫 Canvas 可初始化', !!tc);
    check('天劫参数正确注入', tc.lightning === 5 && tc.duration === 10);
    tc._update(0.016);
    tc._update(0.016);
    check('天劫逻辑更新不抛异常', true);
} catch (e) { tcOk = false; tcErr = e.message; }
check('天劫 Canvas 运行正常', tcOk, tcErr);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail > 0 ? 1 : 0);
