import { bus, EV } from '../core/event-bus.js';
import methodsData from '../data/methods.json' with { type: 'json' };

/**
 * 功法系统 —— 主修 + 辅修，组合产生化学反应
 *
 * 1.x 的问题：修炼就是无脑点按钮，没有策略深度
 * 2.0：功法决定修炼速度、属性加成、走火入魔风险，主辅搭配有额外 combo
 */
export class MethodSystem {
    constructor(state) {
        this.state = state;
        this.data = methodsData;
    }

    /** 获取玩家已装配的功法（主修 / 辅修） */
    getEquipped(player) {
        const main = this.data.methods.find(m => m.id === player.methods?.main) || null;
        const support = this.data.methods.find(m => m.id === player.methods?.support) || null;
        return { main, support };
    }

    /**
     * 计算主辅组合效果
     * @returns {Object} 组合加成
     */
    getCombo(player) {
        const { main, support } = this.getEquipped(player);
        if (!main || !support) return null;
        return this.data.combos.find(c => c.main === main.id && c.support === support.id) || null;
    }

    /**
     * 汇总当前修炼参数（速度、风险、属性加成）
     * @param {Object} player
     * @param {Object} relicEffects - 秘境遗物带来的加成
     */
    getCultivationProfile(player, relicEffects = {}) {
        const { main, support } = this.getEquipped(player);
        const combo = this.getCombo(player);

        // 速度以「主修功法」为基准倍率（青云诀 1.0 = 标准速度），
        // 无主修时按 1.0 算；辅修与组合作为增量叠加
        let speed = main ? (main.speed ?? 1.0) : 1.0;
        let risk = 0.05; // 基础走火入魔概率 5%
        const bonus = { maxHp: 0, maxMp: 0, attack: 0, defense: 0, luck: 0 };
        let karmaPerCultivate = 0;

        for (const m of [main, support]) {
            if (!m) continue;
            // 主修的 speed 已作为基准计入，此处只叠加辅修增量
            if (m !== main) speed += (m.speed || 0);
            risk += (m.risk || 0);
            for (const [k, v] of Object.entries(m.bonus || {})) {
                bonus[k] = (bonus[k] || 0) + v;
            }
            karmaPerCultivate += (m.karmaPerCultivate || 0);
        }

        // 组合加成
        if (combo?.effect) {
            const e = combo.effect;
            speed += (e.speedDelta || 0);
            risk += (e.riskDelta || 0);
            bonus.attack = (bonus.attack || 0) + (e.attackDelta || 0);
            bonus.maxMp = (bonus.maxMp || 0) + (e.maxMpDelta || 0);
        }

        // 遗物加成
        speed += (relicEffects.speedDelta || 0);
        risk += (relicEffects.riskDelta || 0);
        bonus.attack += (relicEffects.attack || 0);
        bonus.defense += (relicEffects.defense || 0);
        bonus.maxHp += (relicEffects.maxHp || 0);

        // 心魔越高越易失控
        const karma = player.karma || 0;
        risk += karma * 0.0015;

        // 境界越高越易走火入魔
        risk += (player.cultivation?.realmIndex || 0) * 0.01;

        return {
            speed: Math.max(0.2, speed),
            risk: Math.max(0, Math.min(0.85, risk)), // 上限 85%，永远保留翻盘可能
            bonus,
            karmaPerCultivate,
            combo,
            main,
            support
        };
    }

    /**
     * 修炼一次
     * @param {Object} player
     * @param {RNG} rngInstance
     * @param {Object} relicEffects
     * @returns {Object} 修炼结果
     */
    cultivate(player, rngInstance, relicEffects = {}) {
        const profile = this.getCultivationProfile(player, relicEffects);
        const baseExp = 10 * profile.speed;
        const luckBonus = (player.attributes?.luck || 10) > 10 ? 5 : 0;
        const expGain = Math.floor(baseExp + luckBonus);

        const result = {
            expGain,
            deviation: false,
            profile
        };

        // 走火入魔判定
        if (rngInstance.chance(profile.risk)) {
            result.deviation = true;
            const damage = Math.floor((player.attributes?.maxHp || 100) * 0.2);

            bus.emit(EV.CULTIVATE_QI_DEVIATION, { player, damage, profile });

            // 心魔增长
            if (profile.karmaPerCultivate > 0) {
                bus.emit(EV.KARMA_CHANGE, {
                    delta: profile.karmaPerCultivate,
                    reason: '功法反噬'
                });
            }
        }

        bus.emit(EV.CULTIVATE, { player, expGain, deviation: result.deviation });
        return result;
    }

    /**
     * 尝试化解走火入魔 —— 小游戏（简化为三选一抉择）
     * @param {number} choice - 0/1/2
     * @returns {Object} 化解结果
     */
    resolveDeviation(player, choice, rngInstance) {
        const options = [
            { name: '强压魔念', successRate: 0.45, hpCost: 0.25, karmaDelta: 3 },
            { name: '散功重修', successRate: 0.75, hpCost: 0.05, expLoss: 0.3, karmaDelta: 0 },
            { name: '顺势而为', successRate: 0.6, hpCost: 0.15, karmaDelta: 8 }
        ];
        const opt = options[choice] || options[1];

        const success = rngInstance.chance(opt.successRate);
        const result = {
            success,
            optionName: opt.name,
            hpLoss: Math.floor((player.attributes?.maxHp || 100) * opt.hpCost)
        };

        if (!success) {
            // 失败：伤势加重，心魔暴涨
            result.hpLoss = Math.floor(result.hpLoss * 1.5);
            bus.emit(EV.KARMA_CHANGE, { delta: (opt.karmaDelta || 0) + 10, reason: '走火入魔失控' });
        } else if (opt.karmaDelta) {
            bus.emit(EV.KARMA_CHANGE, { delta: opt.karmaDelta, reason: opt.name });
        }

        if (opt.expLoss && success) {
            result.expLoss = Math.floor((player.cultivation?.experience || 0) * opt.expLoss);
        }

        return result;
    }

    /** 装配功法 */
    equip(player, methodId, slot = 'main') {
        const m = this.data.methods.find(x => x.id === methodId);
        if (!m) return { ok: false, reason: '功法不存在' };
        if (m.type !== slot && m.type !== 'support') {
            return { ok: false, reason: `${m.name} 不能装配到 ${slot} 位` };
        }
        if (m.requireFaction && player.faction !== m.requireFaction) {
            return { ok: false, reason: `${m.name} 需要${m.requireFaction}身份` };
        }
        player.methods = player.methods || {};
        player.methods[slot] = methodId;
        return { ok: true, method: m };
    }

    /** 获取可学功法列表 */
    getAvailableMethods(player) {
        return this.data.methods.filter(
            m => !m.requireFaction || player.faction === m.requireFaction
        );
    }
}
