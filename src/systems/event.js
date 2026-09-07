import { bus, EV } from '../core/event-bus.js';
import eventsData from '../data/events.js';

/**
 * 随机事件系统
 *
 * 事件有多个选项，不同选择有不同后果（影响心魔/道心、修为、物品）
 * 心魔高的玩家会触发专属事件（如"心魔低语"）
 */
export class EventSystem {
    constructor(state) {
        this.state = state;
        this.events = eventsData.events;
    }

    /**
     * 随机抽取一个事件
     * @param {Object} player
     * @param {RNG} rng
     * @param {Array} excludeIds - 本次探索已触发过的事件
     */
    draw(player, rng, excludeIds = []) {
        const karma = player.karma || 0;
        const pool = this.events.filter(e => {
            if (excludeIds.includes(e.id)) return false;
            if (e.requireKarma && karma < e.requireKarma) return false;
            return true;
        });

        if (pool.length === 0) return null;
        return rng.weighted(pool);
    }

    /**
     * 做出选择并结算
     * @param {Object} player
     * @param {Object} event
     * @param {number} choiceIndex
     * @param {RNG} rng
     * @param {Object} ctx - 上下文（如遗物效果）
     */
    resolve(player, event, choiceIndex, rng, ctx = {}) {
        const choice = event.choices[choiceIndex];
        if (!choice) return { ok: false, reason: '无效选择' };

        const out = choice.outcome || {};
        const applied = {};

        // 经验
        if (out.exp) {
            applied.exp = out.exp;
        }
        // 生命
        if (out.hp) {
            const before = player.attributes.hp;
            player.attributes.hp = Math.max(
                1,
                Math.min(player.attributes.maxHp, before + out.hp)
            );
            applied.hpDelta = player.attributes.hp - before;
        }
        if (out.maxHpBonus) {
            player.attributes.maxHp += out.maxHpBonus;
            applied.maxHpBonus = out.maxHpBonus;
        }
        if (out.attackBonus) {
            player.attributes.attack += out.attackBonus;
            applied.attackBonus = out.attackBonus;
        }
        if (out.defenseBonus) {
            player.attributes.defense += out.defenseBonus;
            applied.defenseBonus = out.defenseBonus;
        }
        // 灵石
        if (out.gold) {
            player.gold = Math.max(0, (player.gold || 0) + out.gold);
            applied.gold = out.gold;
        }
        // 心魔
        if (out.karma) {
            bus.emit(EV.KARMA_CHANGE, { delta: out.karma, reason: event.name });
            applied.karma = out.karma;
        }
        // 加入宗门
        if (out.sectJoin && ctx.sectSystem) {
            applied.sectJoin = ctx.sectSystem.join(player);
        }

        // 随机奖励（功法/物品/遗物）
        if (out.possibleReward) {
            applied.reward = this._rollReward(out.possibleReward, rng, ctx);
        }

        const result = {
            ok: true,
            eventId: event.id,
            eventName: event.name,
            choiceText: choice.text,
            text: choice.resultText,
            applied
        };

        bus.emit(EV.EVENT_CHOICE, { player, event, choiceIndex, result });
        return result;
    }

    _rollReward(kind, rng, ctx) {
        switch (kind) {
            case 'method':
                return { kind: 'method', hint: '获得一卷功法残篇' };
            case 'item':
                return { kind: 'item', hint: '获得一枚丹药' };
            case 'relic':
                return { kind: 'relic', hint: '获得一件遗物' };
            default:
                return { kind: 'unknown' };
        }
    }
}
