import { HUD } from './hud.js';
import { DungeonMap } from './dungeon-map.js';
import { MethodPanel } from './method-panel.js';
import { TribulationCanvas } from './tribulation-canvas.js';
import { bus, EV } from '../core/event-bus.js';
import { GameState } from '../core/store.js';
import { RNG } from '../core/rng.js';
import { SCENES, preloadArt } from './art.js';

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

        this.hud = new HUD(dom.hud, game, { onAction: a => this.handleAction(a) });
        this.dungeonMap = new DungeonMap(dom.panel, {
            onNodeClick: () => this.advanceDungeon()
        });
        this.methodPanel = new MethodPanel(dom.panel, game, {
            onChange: () => this.log('功法已更换')
        });
        this.tribCanvas = null;

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
            case 'tribulation': this.setScene('tribulation'); break;
            case 'cultivating': this.setScene('cultivate'); break;
            default: this.dom.panel.innerHTML = this.renderLog(); this.clearScene(); break;
        }
    }

    /** 处理主界面按钮 */
    handleAction(action) {
        const p = this.game.state.player;
        if (!p) return;

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

    /** 走火入魔化解抉择 */
    showDeviationChoice() {
        const options = ['强压魔念（风险高，收益高）', '散功重修（稳妥）', '顺势而为（心魔大涨，力量提升）'];
        this.dom.panel.innerHTML = `
            <div class="deviation-box">
                <h3>🔥 走火入魔！</h3>
                <p>真气逆冲经脉，需立刻决断：</p>
                ${options.map((o, i) =>
                    `<button class="deviation-opt" data-choice="${i}">${o}</button>`
                ).join('')}
            </div>
        `;
        this.dom.panel.querySelectorAll('.deviation-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const res = this.game.resolveDeviation(parseInt(btn.dataset.choice, 10));
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
        return `<div class="log-panel">${this.logs.map(l =>
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
