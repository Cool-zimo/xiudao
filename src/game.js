import { bus, EV } from './core/event-bus.js';
import { RNG, rng as globalRng } from './core/rng.js';
import { StateMachine, GameState } from './core/store.js';
import { MethodSystem } from './systems/method.js';
import { TribulationSystem } from './systems/tribulation.js';
import { DungeonSystem } from './systems/dungeon.js';
import { EventSystem } from './systems/event.js';
import { KarmaSystem } from './systems/karma.js';
import { CombatSystem } from './systems/combat.js';
import { migrateSave, createNewSave, CURRENT_SAVE_VERSION } from './save/migrate.js';
import realmsData from './data/realms.js';

/**
 * 修仙模拟器 2.0 —— 主控制器
 *
 * 架构原则：
 *   1. systems 层只处理逻辑，不碰 DOM
 *   2. 系统间通过 EventBus 通信，互不直接依赖
 *   3. 所有数值配置在 data/*.json，改数值不改代码
 *   4. 存档带版本号，支持老档迁移
 */
export class Game {
    constructor() {
        this.state = { player: null };
        this.fsm = new StateMachine(GameState.BOOT);
        this.realms = realmsData.realms;

        // 系统装配（顺序重要：Karma 需先订阅事件总线）
        this.karma = new KarmaSystem(this.state);
        this.methods = new MethodSystem(this.state);
        this.tribulation = new TribulationSystem(this.state);
        this.dungeon = new DungeonSystem(this.state);
        this.events = new EventSystem(this.state);
        this.combat = new CombatSystem(this.state);
        this.sectSystem = null; // 宗门系统留待后续扩展
        this.rng = globalRng;

        this._setupAchievementTracking();
    }

    /**
     * 成就统计：1.x 的致命问题是 recordStat 零调用
     * 2.0 改为订阅事件总线，任何系统触发事件都会被统计到
     */
    _setupAchievementTracking() {
        const stat = (key, amount = 1) => {
            const p = this.state.player;
            if (!p) return;
            p.stats = p.stats || {};
            p.stats[key] = (p.stats[key] || 0) + amount;
        };

        bus.on(EV.CULTIVATE, () => stat('totalCultivations'));
        bus.on(EV.BATTLE_START, () => stat('battlesTotal'));
        bus.on('battle:won', () => stat('battlesWon'));
        bus.on('battle:lost', () => stat('battlesLost'));
        bus.on(EV.REALM_UP, () => stat('realmUps'));
        bus.on(EV.TRIBULATION_END, ({ result }) => {
            if (result.success) stat('tribulationsPassed');
            if (result.perfect) stat('perfectTribulations');
        });
        bus.on(EV.EXPLORE_ENTER, () => stat('dungeonsEntered'));
        bus.on(EV.CULTIVATE_QI_DEVIATION, () => stat('deviations'));
        bus.on(EV.ITEM_GAIN, ({ kind }) => {
            if (kind === 'relic') stat('relicsFound');
        });
    }

    /** 创建新角色 */
    createCharacter(data) {
        const save = createNewSave(data);
        this.state.player = save.player;
        // 走完整路径：boot → create → playing
        this.fsm.transition(GameState.CREATE);
        this.fsm.transition(GameState.PLAYING);
        bus.emit('game:start', { player: this.state.player });
        return this.state.player;
    }

    /** 载入存档（自动迁移老版本） */
    loadSave(rawSave) {
        const { save, migrated, from, to } = migrateSave(rawSave);
        if (!save) return { ok: false, reason: '存档为空' };
        this.state.player = save.player;
        this.fsm.transition(GameState.PLAYING);
        return { ok: true, migrated, from, to };
    }

    /** 修炼一回合 */
    cultivate() {
        const p = this.state.player;
        if (!p) return null;

        const relicEffects = this.dungeon.getRelicEffects(p);
        const result = this.methods.cultivate(p, this.rng, relicEffects);

        // 应用经验
        this._gainExp(result.expGain);

        if (result.deviation) {
            this.fsm.transition(GameState.CULTIVATING);
        }
        return result;
    }

    /** 化解走火入魔 */
    resolveDeviation(choice) {
        const p = this.state.player;
        const res = this.methods.resolveDeviation(p, choice, this.rng);
        p.attributes.hp = Math.max(1, p.attributes.hp - res.hpLoss);
        if (res.expLoss) {
            p.cultivation.experience = Math.max(0, p.cultivation.experience - res.expLoss);
        }
        if (p.attributes.hp <= 1) {
            this.fsm.transition(GameState.DEAD);
            bus.emit(EV.DEATH, { player: p });
        } else {
            this.fsm.transition(GameState.PLAYING);
        }
        return res;
    }

    _gainExp(exp) {
        const p = this.state.player;
        const c = p.cultivation;
        c.experience += exp;

        let leveledUp = false;
        while (c.experience >= c.expToNext) {
            if (c.level >= c.maxLevel) {
                // 圆满，停止升级，等待渡劫
                c.experience = c.expToNext;
                break;
            }
            c.experience -= c.expToNext;
            c.level++;
            leveledUp = true;
            c.expToNext = Math.floor(c.expToNext * 1.15);
        }
        if (leveledUp) bus.emit('level:up', { player: p, level: c.level });
        return leveledUp;
    }

    /** 开始渡劫 */
    startTribulation() {
        if (!this.tribulation.canAttempt(this.state.player)) {
            return { ok: false, reason: '境界未满，无法渡劫' };
        }
        this.fsm.transition(GameState.TRIBULATION);
        return this.tribulation.begin(this.state.player);
    }

    /** 渡劫推进（每秒调用） */
    tickTribulation(dodges) {
        const round = this.tribulation.tick(dodges, this.rng);
        if (round.done) {
            this.fsm.transition(GameState.PLAYING);
        }
        return round;
    }

    /** 进入秘境 */
    enterDungeon(floor = 1, seed) {
        const res = this.dungeon.enter(this.state.player, floor, seed ?? Date.now());
        if (res.ok) this.fsm.transition(GameState.DUNGEON);
        return res;
    }

    /** 秘境前进一步 */
    advanceDungeon() {
        return this.dungeon.advance(this.state.player);
    }

    /** 退出秘境 */
    exitDungeon() {
        const res = this.dungeon.exit(this.state.player);
        if (res.ok) {
            this.fsm.transition(GameState.PLAYING);
            if (res.summary.bonusExp) this._gainExp(res.summary.bonusExp);
        }
        return res;
    }

    /** 触发随机事件 */
    triggerEvent(excludeIds = []) {
        const p = this.state.player;
        const evt = this.events.draw(p, this.rng, excludeIds);
        if (!evt) return null;
        this.fsm.transition(GameState.EVENT);
        return evt;
    }

    /** 对事件做出选择 */
    chooseEvent(evt, choiceIndex) {
        const res = this.events.resolve(this.state.player, evt, choiceIndex, this.rng, {
            sectSystem: this.sectSystem
        });
        if (res.ok && res.applied?.exp) this._gainExp(res.applied.exp);
        this.fsm.transition(GameState.PLAYING);
        return res;
    }

    /** 开始一场战斗 */
    startBattle(enemy) {
        const res = this.combat.start(this.state.player, enemy, this.rng);
        if (res) this.fsm.transition(GameState.BATTLE);
        return res;
    }

    /** 战斗中使用技能 */
    useSkill(skillId) {
        const r = this.combat.useSkill(this.state.player, skillId);
        if (r?.ok && r.enemyDefeated) this.fsm.transition(GameState.PLAYING);
        if (this.state.player.attributes.hp <= 0) {
            this.fsm.transition(GameState.DEAD);
            bus.emit(EV.DEATH, { player: this.state.player });
        }
        return r;
    }

    /** 结束当前战斗 */
    endBattle() {
        const b = this.combat.end();
        if (this.fsm.is(GameState.BATTLE)) this.fsm.transition(GameState.PLAYING);
        return b;
    }

    /** 兑换禁忌之力 */
    exchangeForbidden(cost = 20) {
        return this.karma.exchangeForbidden(this.state.player, cost);
    }

    /** 诵经净化 */
    purify(amount = 10) {
        return this.karma.purify(this.state.player, amount);
    }

    /** 序列化存档 */
    toSave() {
        const p = this.state.player;
        if (!p) return null;
        p.metadata.lastSaveTime = new Date().toISOString();
        return { saveVersion: CURRENT_SAVE_VERSION, player: p };
    }

    /** 获取玩家面板数据（UI 用） */
    getProfile() {
        const p = this.state.player;
        if (!p) return null;
        const relicEffects = this.dungeon.getRelicEffects(p);
        const profile = this.methods.getCultivationProfile(p, relicEffects);
        const tier = this.karma.getTier(p.karma);
        return {
            player: p,
            cultivationProfile: profile,
            karmaTier: tier,
            relicEffects,
            canTribulate: this.tribulation.canAttempt(p),
            dungeonProgress: this.dungeon.getProgress()
        };
    }
}
