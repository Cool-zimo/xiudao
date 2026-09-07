import { bus, EV } from '../core/event-bus.js';
import realmsData from '../data/realms.js';

/**
 * 天劫系统 —— 突破时的小游戏（弹幕躲避 / QTE 抽象）
 *
 * 1.x：渡劫就是一次概率判定，成功升境界失败掉经验，毫无操作感
 * 2.0：渡劫是一个可交互过程，玩家的操作水平直接影响结果
 *
 * 小游戏模型（与具体 UI 解耦，便于替换实现）：
 *   - 持续 duration 秒，每秒判定一次
 *   - 每波生成 lightning 道雷，玩家通过 dodge(moves) 闪避
 *   - 闪避率 = 反应窗口 / 雷速，受身法（speed）影响
 *   - 全程未命中 → 完美渡劫，额外奖励
 */
export class TribulationSystem {
    constructor(state) {
        this.state = state;
        this.realms = realmsData.realms;
        this.active = null;
    }

    /** 当前境界是否可渡劫 */
    canAttempt(player) {
        const c = player.cultivation;
        return c && c.level >= c.maxLevel && c.realmIndex < this.realms.length - 1;
    }

    /**
     * 开始渡劫
     * @param {Object} player
     * @returns {Object} 天劫会话
     */
    begin(player) {
        if (!this.canAttempt(player)) {
            return { ok: false, reason: '需当前境界圆满才能渡劫' };
        }
        const realm = this.realms[player.cultivation.realmIndex];
        const cfg = realm.tribulation;
        const nextRealm = this.realms[player.cultivation.realmIndex + 1];

        // 心魔加重天劫
        const karma = player.karma || 0;
        const karmaPenalty = Math.min(0.3, karma * 0.002);

        this.active = {
            realm: realm.name,
            nextRealm: nextRealm.name,
            lightning: cfg.lightning,
            speed: cfg.speed,
            duration: cfg.duration,
            baseChance: Math.max(0.05, cfg.baseChance - karmaPenalty),
            elapsed: 0,
            hits: 0,        // 被雷劈中次数
            dodged: 0,      // 成功闪避次数
            hpRatio: 1.0
        };

        bus.emit(EV.TRIBULATION_START, { player, session: this.active });
        return { ok: true, session: this.active };
    }

    /**
     * 推进一秒（由 UI 的 tick 调用）
     * @param {number} dodges - 本秒玩家成功闪避的次数（0~当期雷数）
     * @param {RNG} rng
     * @returns {Object} 本轮结果
     */
    tick(dodges, rng) {
        if (!this.active) return { done: true };
        const s = this.active;
        s.elapsed++;

        const incoming = s.lightning;
        const evaded = Math.min(dodges, incoming);
        const hit = incoming - evaded;

        s.dodged += evaded;
        s.hits += hit;

        // 每次被劈中损失生命
        const hpLossPerHit = 0.08 + s.speed * 0.02;
        s.hpRatio = Math.max(0, s.hpRatio - hit * hpLossPerHit);

        const round = {
            elapsed: s.elapsed,
            incoming,
            evaded,
            hit,
            hpRatio: s.hpRatio,
            done: s.elapsed >= s.duration || s.hpRatio <= 0
        };

        if (round.done) {
            round.result = this._finish(rng);
        }
        return round;
    }

    _finish(rng) {
        const s = this.active;
        const player = this.state.player;

        // 结算：闪避率决定成功率
        const totalIncoming = s.lightning * s.duration;
        const dodgeRate = totalIncoming > 0 ? s.dodged / totalIncoming : 0;

        // 最终成功率 = 基础 × (0.5 + 闪避表现)
        const finalChance = Math.min(0.95, s.baseChance * (0.5 + dodgeRate * 1.2));
        const success = s.hpRatio > 0 && rng.chance(finalChance);

        let result;
        if (success) {
            const perfect = s.hits === 0;
            this._promote(player);
            result = {
                success: true,
                perfect,
                newRealm: s.nextRealm,
                dodgeRate: (dodgeRate * 100).toFixed(1),
                message: perfect
                    ? `✨ 完美渡劫！毫发无伤，晋升【${s.nextRealm}】！道心大增`
                    : `🎉 渡劫成功！晋升【${s.nextRealm}】`
            };
            if (perfect) {
                bus.emit(EV.KARMA_CHANGE, { delta: -15, reason: '完美渡劫' });
            }
        } else {
            // 失败：掉境界 + 重伤，但获得心魔值（可兑换特殊能力）
            const karmaGain = Math.floor(10 + s.hits * 2);
            this._demote(player);
            result = {
                success: false,
                karmaGain,
                newRealm: player.cultivation.realm,
                dodgeRate: (dodgeRate * 100).toFixed(1),
                message: `💥 天劫未渡！境界跌落至【${player.cultivation.realm}】，但心魔 +${karmaGain}，可换取禁忌之力`
            };
            bus.emit(EV.KARMA_CHANGE, { delta: karmaGain, reason: '渡劫失败' });
        }

        bus.emit(EV.TRIBULATION_END, { player, result });
        this.active = null;
        return result;
    }

    _promote(player) {
        const c = player.cultivation;
        c.realmIndex += 1;
        const nr = this.realms[c.realmIndex];
        c.realm = nr.name;
        c.realmId = nr.id;
        c.level = 1;
        c.maxLevel = nr.maxLevel;
        c.experience = 0;
        c.expToNext = nr.baseExp;

        // 属性跃升
        const a = player.attributes;
        a.maxHp = Math.floor(a.maxHp * 1.6);
        a.maxMp = Math.floor(a.maxMp * 1.6);
        a.attack = Math.floor(a.attack * 1.5);
        a.defense = Math.floor(a.defense * 1.5);
        a.hp = a.maxHp;
        a.mp = a.maxMp;

        bus.emit(EV.REALM_UP, { player, realm: nr.name });
    }

    _demote(player) {
        const c = player.cultivation;
        if (c.realmIndex > 0) {
            c.realmIndex -= 1;
            const pr = this.realms[c.realmIndex];
            c.realm = pr.name;
            c.realmId = pr.id;
            c.maxLevel = pr.maxLevel;
            c.level = pr.maxLevel; // 跌回该境界圆满
            c.expToNext = pr.baseExp;
        }
        const a = player.attributes;
        a.hp = Math.max(1, Math.floor(a.maxHp * 0.15));
    }

    /** 获取当前会话（UI 渲染用） */
    getSession() {
        return this.active;
    }
}
