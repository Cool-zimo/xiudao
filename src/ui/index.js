import { HUD } from './hud.js';
import { DungeonMap } from './dungeon-map.js';
import { MethodPanel } from './method-panel.js';
import { TribulationCanvas } from './tribulation-canvas.js';
import { WorldCanvas } from './world-canvas.js';
import { bus, EV } from '../core/event-bus.js';
import { GameState } from '../core/store.js';
import { RNG } from '../core/rng.js';
import { SCENES, preloadArt } from './art.js';
import { World } from '../systems/world.js';
import { TimeSystem } from '../systems/time.js';
import { NPCSystem } from '../systems/npc.js';
import { RES_DEFS, tileDef } from '../data/terrain.js';

/**
 * UI 总入口 —— 唯一触碰 DOM 的层
 *
 * 原则：
 *   1. UI 不写游戏逻辑，只渲染 + 把用户操作抛给 Game
 *   2. 通过订阅 EventBus 自动刷新，不手动到处调用 render
 */
export class UI {
    constructor(game, dom) {
        this.game = game;
        this.dom = dom;              // { hud, panel, canvas, log }
        this.rng = new RNG();
        this.currentEvent = null;
        this.panelMode = 'none';     // none | methods | dungeon | event | tribulation

        // 日志队列必须在首次 render 前初始化（render → renderLog 会读它）
        this.logs = [];

        /** 待决断事件（如走火入魔）；为真时阻塞所有推进类操作 */
        this.pendingDeviation = false;

        this.hud = new HUD(dom.hud, game, { onAction: a => this.handleAction(a) });
        this.dungeonMap = new DungeonMap(dom.panel, {
            onNodeClick: () => this.advanceDungeon()
        });
        this.methodPanel = new MethodPanel(dom.panel, game, {
            onChange: () => this.log('功法已更换')
        });
        this.tribCanvas = null;

        // 开放世界：按存档种子生成，保证同一存档世界一致
        const seed = game.state.player?.metadata?.createTime
            ? this._hashSeed(game.state.player.metadata.createTime)
            : 20240907;
        this.world = new World(new RNG(seed));

        // P2：时间流转 + NPC 与门派（让世界自己活起来）
        this.time = new TimeSystem(1, 6);
        this.npcSystem = new NPCSystem(this.world, new RNG(seed + 1), this.time);
        this.npcSystem.populate({ npcCount: 24, sectCount: 3 });

        this.worldCanvas = null;

        this._subscribe();
        this.render();
        // 预加载立绘与场景图，避免首次切换闪白
        preloadArt();
    }

    /**
     * 设置面板背景图（按当前界面切换场景）
     * @param {string} sceneKey - SCENES 的键
     */
    setScene(sceneKey) {
        const url = SCENES[sceneKey];
        if (!url || !this.dom.panel) return;
        this.dom.panel.style.backgroundImage = `linear-gradient(rgba(15,23,42,.82), rgba(15,23,42,.88)), url('${url}')`;
        this.dom.panel.style.backgroundSize = 'cover';
        this.dom.panel.style.backgroundPosition = 'center';
    }

    clearScene() {
        if (this.dom.panel) this.dom.panel.style.backgroundImage = '';
    }

    /**
     * 应用所选角色的视觉主题（灵气主色）
     * @param {Object} char - characters.js 中的角色定义
     */
    applyCharacter(char) {
        if (!char) return;
        this.character = char;
        const root = document.documentElement;
        root.style.setProperty('--char-aura', char.aura);
        root.style.setProperty('--char-aura-rgb', char.auraRgb);
        this.log(`🌀 灵气属性：${char.aura}`, 'info');
    }

    /** 订阅事件 → 自动刷新（无需各处手动调 render） */
    _subscribe() {
        bus.on(EV.CULTIVATE, () => this.render());
        bus.on(EV.REALM_UP, ({ realm }) => this.log(`🎉 突破至【${realm}】！`, 'levelup'));
        bus.on(EV.KARMA_CHANGE, () => this.render());
        bus.on('karma:tier', ({ to }) => this.log(`心境变化：${to.name} — ${to.desc}`, 'karma'));
        bus.on(EV.CULTIVATE_QI_DEVIATION, ({ damage }) => {
            this.log('🔥 走火入魔！真气逆冲经脉', 'danger');
            this.showDeviationChoice();
        });
        bus.on(EV.TRIBULATION_END, ({ result }) => {
            this.log(result.message, result.success ? 'levelup' : 'danger');
            this.panelMode = 'none';
            this.render();
        });
        bus.on(EV.EXPLORE_ENTER, ({ floor }) => {
            this.log(`🗺️ 进入秘境第 ${floor} 层`, 'info');
            this.panelMode = 'dungeon';
            this.render();
        });
        bus.on(EV.EXPLORE_NODE, ({ result }) => {
            if (result?.text) this.log(result.text, 'info');
            this.render();
        });
        bus.on(EV.EXPLORE_EXIT, ({ summary }) => {
            this.log(`🏁 秘境结算：通过 ${summary.cleared}/${summary.total} 节点，获得 ${summary.bonusExp} 修为`, 'reward');
            this.panelMode = 'none';
            this.render();
        });
        bus.on(EV.EVENT_CHOICE, ({ result }) => {
            if (result?.text) this.log(result.text, 'story');
            this.panelMode = 'none';
            this.render();
        });
        bus.on(EV.DEATH, () => this.log('💀 道消身殒……', 'danger'));
        bus.on('battle:won', () => this.log('⚔️ 战斗胜利！', 'reward'));
        bus.on('battle:lost', () => this.log('💀 战败……', 'danger'));
    }

    render() {
        this.hud.render();
        switch (this.panelMode) {
            case 'methods': this.methodPanel.render(); this.clearScene(); break;
            case 'dungeon': {
                const prog = this.game.dungeon.getProgress();
                if (prog) this.dungeonMap.render(prog);
                this.setScene('dungeon');
                break;
            }
            case 'event': this.renderEvent(); this.clearScene(); break;
            case 'world':
                // 已渲染则跳过，避免事件频繁触发 render 时重建地图丢失玩家位置
                if (!this.dom.panel.querySelector('.wc-root')) this.openWorld();
                break;
            case 'tribulation': this.setScene('tribulation'); break;
            case 'cultivating': this.setScene('cultivate'); break;
            case 'deviation':
                // 保持弹窗不被其他事件触发的 render 覆盖
                if (!this.dom.panel.querySelector('.deviation-box')) {
                    this.showDeviationChoice();
                }
                this.clearScene();
                break;
            default: this.dom.panel.innerHTML = this.renderLog(); this.clearScene(); break;
        }
    }

    /** 处理主界面按钮 */
    handleAction(action) {
        const p = this.game.state.player;
        if (!p) return;

        // 兜底拦截：即使按钮被绕过（键盘、脚本），待决断期间也不允许推进游戏
        const ADVANCE_ACTIONS = ['cultivate', 'tribulation', 'dungeon', 'event', 'forbidden'];
        if (this.pendingDeviation && ADVANCE_ACTIONS.includes(action)) {
            this.log('🔥 真气逆冲未平，先化解走火入魔！', 'danger');
            this._flashDeviationWarning();
            return;
        }

        switch (action) {
            case 'cultivate': {
                const r = this.game.cultivate();
                if (r) {
                    this.log(`🧘 修炼，获得 ${r.expGain} 点修为`, 'normal');
                    // 未走火入魔时展示打坐修炼场景
                    if (!r.deviation) this.panelMode = 'cultivating';
                    this.render();
                }
                break;
            }
            case 'world': this.openWorld(); break;
            case 'tribulation': this.startTribulationUI(); break;
            case 'dungeon': {
                const floor = (this.game.dungeon.current?.floor || 0) + 1;
                const res = this.game.enterDungeon(floor);
                if (!res.ok) this.log(res.reason, 'danger');
                break;
            }
            case 'event': {
                const evt = this.game.triggerEvent();
                if (evt) { this.currentEvent = evt; this.panelMode = 'event'; this.render(); }
                else this.log('机缘未至……', 'normal');
                break;
            }
            case 'methods':
                this.panelMode = 'methods';
                this.render();
                break;
            case 'purify': {
                const r = this.game.purify(10);
                this.log(r.message, 'karma');
                this.render();
                break;
            }
            case 'forbidden': {
                const r = this.game.exchangeForbidden(20);
                this.log(r.ok ? r.message : r.reason, r.ok ? 'reward' : 'danger');
                this.render();
                break;
            }
        }
    }

    /** 由存档创建时间派生世界种子 */
    _hashSeed(str) {
        let h = 2166136261;
        for (let i = 0; i < String(str).length; i++) {
            h ^= String(str).charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return Math.abs(h % 1000000);
    }

    // ---------- 开放世界 ----------

    /** 进入世界地图 */
    openWorld() {
        this.panelMode = 'world';
        this.clearScene();
        // 玩家出生在山门
        if (!this._worldInited) {
            const s = this.world.sectRect;
            const cx = s.x + Math.floor(s.w / 2);
            const cy = s.y + Math.floor(s.h / 2);
            this._spawn = this.world.findWalkableNear(cx, cy);
            this._worldInited = true;
        }

        this.worldCanvas = new WorldCanvas(this.dom.panel, this.world, {
            onTileInfo: (x, y, act) => this.handleWorldTile(x, y, act),
            onMove: (r) => this.handleWorldMove(r),
            npcSystem: this.npcSystem,
            time: this.time
        });
        this.worldCanvas.playerKarma = this.game.state.player?.karma ?? 0;
        // 玩家在世界中的坐标（NPC 寻仇用）
        const p = this.game.state.player;
        if (p) { p.worldX = this._spawn.x; p.worldY = this._spawn.y; }
        this.worldCanvas.setPlayer(this._spawn.x, this._spawn.y);
    }

    /** 移动一格：推进世界时间 + NPC 行动 + 妖兽遭遇 */
    handleWorldMove(r) {
        if (!r.ok) { this.log(`🚫 ${r.reason}`, 'normal'); return; }

        const p = this.game.state.player;
        // 玩家坐标同步给 NPC 系统（寻仇 / 遭遇判定用）
        if (p) { p.worldX = r.x; p.worldY = r.y; }

        // 世界推进一个刻：时间流逝 + 全体 NPC 决策一次
        this.npcSystem.tick(p);

        // 玩家所在格若有 NPC，触发交互
        const here = this.npcSystem.npcAt(r.x, r.y);
        if (here) {
            this.log(`👤 ${here.name}${here.sectId ? `（${this.npcSystem.sects.get(here.sectId)?.name}）` : '散修'} — ${here.lastThought || '在此修行'}`, 'info');
        }

        const def = tileDef(r.tile);
        // 妖兽林：按 danger 概率遭遇
        if (def.danger > 0 && this.rng.next() < def.danger * 0.35) {
            this._worldEncounter(r.x, r.y, def);
        }
    }

    /**
     * 世界遭遇：P1 阶段用轻量快速结算
     * （完整半即时战斗 UI 属 P2 范围，这里先保证"世界有危险"的反馈闭环）
     */
    _worldEncounter(x, y, def) {
        const p = this.game.state.player;
        if (!p) return;

        const beasts = ['青纹狼', '赤眼狐', '铁背熊', '噬灵蟒', '幽林豹'];
        const beast = this.rng.pick(beasts);

        const power = (p.attributes.attack || 10)
            + (p.attributes.defense || 5) * 0.5
            + (p.cultivation?.level || 1) * 2
            + (p.cultivation?.realmIndex || 0) * 8;
        const beastPower = Math.floor(power * (0.45 + this.rng.next() * 0.6));

        if (power >= beastPower) {
            const exp = 15 + Math.floor(this.rng.next() * 25);
            this.game._gainExp?.(exp);
            this.log(`⚔️ 击退${beast}，获得 ${exp} 点修为`, 'reward');
            if (this.rng.next() < 0.35) {
                this._addItem(p, '妖兽内丹', 1);
                this.log('💎 拾得妖兽内丹 ×1', 'reward');
            }
            bus.emit('battle:won', { player: p });
        } else {
            const dmg = Math.max(3, Math.floor((beastPower - power) * 1.5 + this.rng.next() * 8));
            p.attributes.hp = Math.max(1, p.attributes.hp - dmg);
            this.log(`🩸 不敌${beast}，受伤 ${dmg} 点`, 'danger');
            if (p.attributes.hp <= 1) {
                this.log('💀 险些殒命，勉强逃回山门', 'danger');
                const s = this.world.sectRect;
                const hx = s.x + Math.floor(s.w / 2), hy = s.y + Math.floor(s.h / 2);
                this.worldCanvas.setPlayer(hx, hy);
                if (p) { p.worldX = hx; p.worldY = hy; }
            }
        }
        this.hud.render();
    }

    /** 世界内交互：采集 / 查看 */
    handleWorldTile(x, y, action) {
        const p = this.game.state.player;
        if (!p) return;

        // 只允许操作玩家所在格
        if (x !== this.worldCanvas.player.x || y !== this.worldCanvas.player.y) {
            const def = tileDef(this.world.get(x, y));
            const q = this.world.qiAt(x, y);
            this.log(`🔍 ${def.name}（${x}, ${y}）灵气 ${q} — ${def.desc}`, 'info');
            return;
        }

        if (action !== 'harvest') return;

        // 采集
        const got = this.world.harvest(x, y);
        if (got) {
            const def = RES_DEFS[got.type];
            this._addItem(p, def.name, got.amount);
            this.log(`⛏️ 采集到 ${def.name} ×${got.amount}`, 'reward');
        } else if (this.world.get(x, y) === 'cave' && !this.world.hasBuilding(x, y)) {
            // 洞府石台：开辟洞府
            const r = this.world.build(x, y, 'cave');
            if (r.ok) this.log(`🏠 于（${x}, ${y}）开辟洞府！此地灵气 ${this.world.qiAt(x, y)}`, 'levelup');
            else this.log(r.reason, 'normal');
        } else {
            const q = this.world.qiAt(x, y);
            this.log(`此处无事可做（灵气 ${q}）。灵气越高，在此修炼越快。`, 'normal');
        }
        this.worldCanvas.render();
    }

    /** 简易背包：同名物品堆叠 */
    _addItem(player, name, count) {
        player.inventory = player.inventory || [];
        const slot = player.inventory.find(i => i.name === name);
        if (slot) slot.count = (slot.count || 0) + count;
        else player.inventory.push({ name, count });
    }

    /**
     * 待决断期间被强制操作时，在弹窗上给出可见反馈
     * （面板当前被弹窗占用，日志看不到，所以直接闪一下提示）
     */
    _flashDeviationWarning() {
        const box = this.dom.panel?.querySelector('.deviation-box');
        if (!box) { this.showDeviationChoice(); return; }

        let tip = box.querySelector('.deviation-warn');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'deviation-warn';
            box.appendChild(tip);
        }
        tip.textContent = '🔥 真气逆冲未平，先做出决断！';
        tip.classList.remove('shake');
        void tip.offsetWidth;          // 强制重排，使动画可重复触发
        tip.classList.add('shake');
    }

    /** 走火入魔化解抉择 */
    showDeviationChoice() {
        const options = ['强压魔念（风险高，收益高）', '散功重修（稳妥）', '顺势而为（心魔大涨，力量提升）'];

        // 锁定推进类操作：真气逆冲期间不能继续修炼/渡劫/下秘境
        this.pendingDeviation = true;
        this.hud?.setBlocked(true, '走火入魔未化解，无法继续修炼或历练');
        this.panelMode = 'deviation';
        this.hud?.render();

        this.dom.panel.innerHTML = `
            <div class="deviation-box">
                <h3>🔥 走火入魔！</h3>
                <p>真气逆冲经脉，需立刻决断：</p>
                ${options.map((o, i) =>
                    `<button class="deviation-opt" data-choice="${i}">${o}</button>`
                ).join('')}
                <p class="deviation-lock">⚠️ 未化解前无法修炼、渡劫或历练</p>
            </div>
        `;
        this.dom.panel.querySelectorAll('.deviation-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const res = this.game.resolveDeviation(parseInt(btn.dataset.choice, 10));

                // 解除锁定
                this.pendingDeviation = false;
                this.hud?.setBlocked(false);

                this.log(
                    res.success
                        ? `✅ ${res.optionName}成功，化解魔念（损失 ${res.hpLoss} 生命）`
                        : `❌ ${res.optionName}失败！伤势加重（损失 ${res.hpLoss} 生命，心魔暴涨）`,
                    res.success ? 'normal' : 'danger'
                );
                this.panelMode = 'none';
                this.render();
            });
        });
    }

    /** 启动天劫 Canvas */
    startTribulationUI() {
        const res = this.game.startTribulation();
        if (!res.ok) { this.log(res.reason, 'danger'); return; }

        const s = res.session;
        this.panelMode = 'tribulation';

        this.dom.panel.innerHTML = `
            <div class="tribulation-wrap">
                <canvas id="trib-canvas"></canvas>
                <div class="trib-tip">← → 或 A/D 移动，也可直接拖动 · 躲避落雷</div>
                <div id="trib-result" class="trib-result"></div>
            </div>
        `;
        const canvas = this.dom.panel.querySelector('#trib-canvas');

        this.tribCanvas = new TribulationCanvas(canvas, {
            width: 480, height: 640,
            config: {
                lightning: s.lightning,
                speed: s.speed,
                duration: s.duration,
                baseChance: s.baseChance,
                realm: s.realm,
                nextRealm: s.nextRealm
            },
            // 每秒把本秒闪避数回传给逻辑层
            onUpdate: (dodges) => {
                const round = this.game.tickTribulation(dodges);
                if (round.done && round.result) {
                    this.dom.panel.querySelector('#trib-result').innerHTML =
                        `<div class="${round.result.success ? 'success' : 'failed'}">
                            <h3>${round.result.message}</h3>
                            <p>闪避率 ${round.result.dodgeRate}%</p>
                            <button id="trib-close">返回</button>
                         </div>`;
                    this.dom.panel.querySelector('#trib-close')
                        .addEventListener('click', () => {
                            this.panelMode = 'none';
                            this.render();
                        });
                }
            },
            onEnd: () => {}
        });

        this.tribCanvas.start();
    }

    /** 推进秘境 */
    advanceDungeon() {
        const r = this.game.advanceDungeon();
        if (!r.ok) { this.log(r.reason, 'normal'); return; }
        // 遇到怪物 → 简易自动战斗
        if (['monster', 'elite', 'boss'].includes(r.node.type)) {
            this.autoBattle(r.node);
        }
        this.render();
    }

    /** 秘境遇敌：简易自动战斗（完整半即时战斗 UI 另开面板） */
    autoBattle(node) {
        const p = this.game.state.player;
        const power = p.attributes.attack + (p.karma || 0) * 0.6;
        const enemyPower = node.type === 'boss' ? power * 1.6 : node.type === 'elite' ? power * 1.1 : power * 0.7;
        const win = this.rng.chance(Math.min(0.92, power / (power + enemyPower)));

        if (win) {
            bus.emit('battle:won', { player: p, node });
            const exp = Math.floor((node.type === 'boss' ? 500 : 150) * (1 + (p.karma || 0) * 0.002));
            this.game._gainExp(exp);
        } else {
            bus.emit('battle:lost', { player: p, node });
            p.attributes.hp = Math.max(1, Math.floor(p.attributes.hp * 0.5));
        }
    }

    /** 渲染随机事件 */
    renderEvent() {
        const evt = this.currentEvent;
        if (!evt) { this.panelMode = 'none'; this.render(); return; }
        this.dom.panel.innerHTML = `
            <div class="event-box">
                <h3>${this._esc(evt.name)}</h3>
                <p class="event-desc">${this._esc(evt.desc)}</p>
                <div class="event-choices">
                    ${evt.choices.map((c, i) =>
                        `<button class="event-choice" data-idx="${i}">${this._esc(c.text)}</button>`
                    ).join('')}
                </div>
            </div>
        `;
        this.dom.panel.querySelectorAll('.event-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                this.game.chooseEvent(evt, parseInt(btn.dataset.idx, 10));
                this.currentEvent = null;
            });
        });
    }

    renderLog() {
        const logs = this.logs || [];
        if (!logs.length) {
            return `<div class="log-panel"><div class="log-line normal">道途已启，点击左侧按钮开始修行。</div></div>`;
        }
        return `<div class="log-panel">${logs.map(l =>
            `<div class="log-line ${l.type}">${this._esc(l.text)}</div>`
        ).join('')}</div>`;
    }

    log(text, type = 'normal') {
        this.logs = this.logs || [];
        this.logs.unshift({ text, type, at: Date.now() });
        if (this.logs.length > 60) this.logs.pop();
        if (this.panelMode === 'none' && this.dom.panel) {
            this.dom.panel.innerHTML = this.renderLog();
        }
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
