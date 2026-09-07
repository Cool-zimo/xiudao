import { bus, EV } from '../core/event-bus.js';

/**
 * 半即时战斗系统
 *
 * 1.x：纯回合制，你点一下我点一下，无操作感
 * 2.0：灵力（MP）随时间自然恢复 → 攒够就放技能
 *      - 技能有消耗/冷却/元素属性
 *      - 敌人有元素弱点，打对弱点伤害翻倍
 *      - 连招：在窗口期内按特定顺序释放，触发额外效果
 *      - 闪避/格挡/暴击 都有明确反馈
 */

export const ELEMENTS = ['金', '木', '水', '火', '土', '雷'];

/** 元素克制：key 克 value */
export const ELEMENT_COUNTER = {
    '金': '木', '木': '土', '土': '水', '水': '火', '火': '金', '雷': '水'
};

export const SKILLS = [
    {
        id: 'sk_qijian', name: '气剑诀', element: '金',
        mpCost: 15, cooldown: 2, multiplier: 1.4,
        desc: '凝聚剑气，中距离斩击'
    },
    {
        id: 'sk_liehuo', name: '烈火掌', element: '火',
        mpCost: 20, cooldown: 3, multiplier: 1.8,
        desc: '掌心生火，爆发伤害'
    },
    {
        id: 'sk_bingfeng', name: '冰封术', element: '水',
        mpCost: 18, cooldown: 3, multiplier: 1.2,
        desc: '冻结敌人，降低其速度',
        effect: { slow: 0.4 }
    },
    {
        id: 'sk_leifu', name: '雷符', element: '雷',
        mpCost: 25, cooldown: 4, multiplier: 2.2,
        desc: '引动天雷，高额单体伤害'
    },
    {
        id: 'sk_huti', name: '虎啸山林', element: '土',
        mpCost: 12, cooldown: 5, multiplier: 0.8,
        desc: '震慑敌人，提升自身防御',
        effect: { selfDefense: 10 }
    },
    {
        id: 'sk_qingfeng', name: '青风步', element: '木',
        mpCost: 10, cooldown: 2, multiplier: 0.9,
        desc: '身法飘忽，提升闪避',
        effect: { selfDodge: 0.25 }
    }
];

/** 连招定义：在 window 秒内按顺序释放，触发 combo */
export const COMBOS = [
    {
        id: 'combo_jin_huo', name: '金火交攻',
        sequence: ['sk_qijian', 'sk_liehuo'], window: 4,
        bonus: { multiplier: 1.5 }, desc: '剑气引燃，伤害提升 50%'
    },
    {
        id: 'combo_shui_lei', name: '水电交加',
        sequence: ['sk_bingfeng', 'sk_leifu'], window: 4,
        bonus: { multiplier: 1.8 }, desc: '冰霜导电，伤害提升 80%'
    },
    {
        id: 'combo_sanlian', name: '三才归一',
        sequence: ['sk_qingfeng', 'sk_qijian', 'sk_leifu'], window: 6,
        bonus: { multiplier: 2.2 }, desc: '三技连发，伤害提升 120%'
    }
];

export class CombatSystem {
    constructor(state) {
        this.state = state;
        this.battle = null;
    }

    /**
     * 开始战斗
     * @param {Object} player
     * @param {Object} enemy - { name, hp, maxHp, attack, defense, speed, element, weakness, isBoss }
     * @param {RNG} rng
     */
    start(player, enemy, rng) {
        const karmaBonus = this._getKarmaBonus(player);

        this.battle = {
            enemy: {
                ...enemy,
                hp: enemy.hp ?? enemy.maxHp,
                statusEffects: []
            },
            playerCooldowns: {},   // skillId -> 剩余冷却
            comboChain: [],        // 最近释放的技能序列
            comboLastAt: 0,
            turn: 0,
            mpRegen: 8,            // 每回合恢复的法力
            playerBuffs: { defense: 0, dodge: 0 },
            karmaBonus,
            rng,
            log: []
        };

        bus.emit(EV.BATTLE_START, { player, enemy: this.battle.enemy });
        return this.battle;
    }

    _getKarmaBonus(player) {
        const k = player.karma ?? 0;
        return {
            attack: Math.floor(k * 0.6),
            speed: Math.floor(k * 0.2),
            critRate: k * 0.004
        };
    }

    /**
     * 释放技能
     * @param {string} skillId
     * @returns {Object} 释放结果
     */
    useSkill(player, skillId) {
        const b = this.battle;
        if (!b) return { ok: false, reason: '当前不在战斗中' };

        const skill = SKILLS.find(s => s.id === skillId);
        if (!skill) return { ok: false, reason: '未知技能' };

        // 冷却检查
        const cd = b.playerCooldowns[skillId] || 0;
        if (cd > 0) return { ok: false, reason: `${skill.name} 冷却中（${cd} 回合）` };

        // 法力检查
        if (player.attributes.mp < skill.mpCost) {
            return { ok: false, reason: '法力不足' };
        }

        player.attributes.mp -= skill.mpCost;
        b.playerCooldowns[skillId] = skill.cooldown;

        // 伤害计算
        const dmg = this._calcDamage(player, skill, b.enemy, b.rng);

        // 连招判定
        const comboResult = this._checkCombo(skillId, b);

        let finalDamage = dmg.damage;
        if (comboResult.triggered) {
            finalDamage = Math.floor(finalDamage * comboResult.bonus.multiplier);
        }

        b.enemy.hp = Math.max(0, b.enemy.hp - finalDamage);

        // 技能附带效果
        if (skill.effect?.slow) {
            b.enemy.statusEffects.push({ type: 'slow', value: skill.effect.slow, turns: 2 });
        }
        if (skill.effect?.selfDefense) {
            b.playerBuffs.defense += skill.effect.selfDefense;
        }
        if (skill.effect?.selfDodge) {
            b.playerBuffs.dodge += skill.effect.selfDodge;
        }

        const result = {
            ok: true,
            skill,
            damage: finalDamage,
            isCrit: dmg.isCrit,
            isWeakness: dmg.isWeakness,
            combo: comboResult.triggered ? comboResult : null,
            enemyHp: b.enemy.hp,
            enemyDefeated: b.enemy.hp <= 0
        };

        b.log.push(result);

        // 敌人反击
        if (!result.enemyDefeated) {
            result.counter = this._enemyTurn(player);
        } else {
            bus.emit('battle:won', { player, enemy: b.enemy });
        }

        bus.emit(EV.SKILL_USED, { player, skill, result });
        return result;
    }

    _calcDamage(player, skill, enemy, rng) {
        const a = player.attributes;
        const kb = this.battle.karmaBonus;

        let base = (a.attack + (kb?.attack || 0)) * skill.multiplier;

        // 元素克制：打中弱点翻倍
        let isWeakness = false;
        if (enemy.weakness && skill.element === enemy.weakness) {
            base *= 2;
            isWeakness = true;
        } else if (enemy.element && ELEMENT_COUNTER[skill.element] === enemy.element) {
            base *= 1.5;
            isWeakness = true;
        }

        // 暴击
        const critRate = 0.1 + (kb?.critRate || 0) + (a.luck - 10) * 0.005;
        const isCrit = rng.chance(Math.min(0.75, critRate));
        if (isCrit) base *= 1.8;

        // 防御减免
        const defense = enemy.defense || 0;
        const reduced = Math.max(1, base - defense * 0.5);

        return {
            damage: Math.floor(reduced),
            isCrit,
            isWeakness
        };
    }

    _checkCombo(skillId, b) {
        const now = b.turn;
        // 超出窗口则重置连招链
        if (now - b.comboLastAt > 6) b.comboChain = [];

        b.comboChain.push(skillId);
        b.comboLastAt = now;

        for (const combo of COMBOS) {
            const len = combo.sequence.length;
            if (b.comboChain.length < len) continue;
            const tail = b.comboChain.slice(-len);
            if (tail.every((s, i) => s === combo.sequence[i])) {
                b.comboChain = []; // 触发后重置
                return { triggered: true, name: combo.name, desc: combo.desc, bonus: combo.bonus };
            }
        }
        return { triggered: false };
    }

    /** 敌人回合 */
    _enemyTurn(player) {
        const b = this.battle;
        const e = b.enemy;
        const rng = b.rng;

        // 减速状态
        const slow = e.statusEffects.find(s => s.type === 'slow');
        const speedFactor = slow ? (1 - slow.value) : 1;

        // 玩家闪避：身法 +  buff
        const dodgeChance = Math.min(0.6, (player.attributes.speed || 10) * 0.01 + b.playerBuffs.dodge);
        if (rng.chance(dodgeChance * speedFactor)) {
            this._tickStatus();
            return { dodged: true, damage: 0 };
        }

        let dmg = (e.attack || 10) * (0.9 + rng.next() * 0.2);

        // 格挡：防御减伤
        const defense = (player.attributes.defense || 0) + b.playerBuffs.defense;
        const blocked = Math.max(0, dmg - defense * 0.6);

        // 暴击
        const isCrit = rng.chance(0.08);
        if (isCrit) blocked * 1.5;

        const final = Math.max(1, Math.floor(blocked));
        player.attributes.hp = Math.max(0, player.attributes.hp - final);

        this._tickStatus();

        const dead = player.attributes.hp <= 0;
        if (dead) bus.emit('battle:lost', { player, enemy: e });

        return { dodged: false, damage: final, isCrit, playerHp: player.attributes.hp, dead };
    }

    _tickStatus() {
        const b = this.battle;
        b.turn++;
        // 冷却递减
        for (const k of Object.keys(b.playerCooldowns)) {
            if (b.playerCooldowns[k] > 0) b.playerCooldowns[k]--;
        }
        // 状态效果递减
        b.enemy.statusEffects = b.enemy.statusEffects
            .map(s => ({ ...s, turns: s.turns - 1 }))
            .filter(s => s.turns > 0);
        // 法力恢复
        const p = this.state.player;
        if (p) {
            p.attributes.mp = Math.min(p.attributes.maxMp, p.attributes.mp + b.mpRegen);
        }
    }

    /** 逃跑 */
    attemptFlee(player) {
        const b = this.battle;
        if (!b) return { ok: false };
        const e = b.enemy;
        const playerSpeed = (player.attributes.speed || 10) + (b.karmaBonus?.speed || 0);
        const chance = playerSpeed / (playerSpeed + (e.speed || 10));
        const ok = b.rng.chance(chance);
        if (ok) bus.emit(EV.BATTLE_END, { player, fled: true });
        return { ok, chance };
    }

    /** 结束战斗 */
    end() {
        const b = this.battle;
        this.battle = null;
        bus.emit(EV.BATTLE_END, { battle: b });
        return b;
    }

    /** 获取战斗状态（UI 渲染用） */
    getState() {
        const b = this.battle;
        if (!b) return null;
        return {
            enemy: b.enemy,
            cooldowns: { ...b.playerCooldowns },
            comboChain: [...b.comboChain],
            buffs: { ...b.playerBuffs },
            turn: b.turn
        };
    }
}
