import { bus, EV } from '../core/event-bus.js';

/**
 * 心魔 / 道心系统
 *
 * 1.x：正邪是开局选死的阵营字符串
 * 2.0：道心(0) ←→ 心魔(100) 连续轴，行为实时改变这个轴
 *
 * 影响：
 *   - 心魔高 → 天劫更强、走火入魔概率更高、触发魔道专属事件
 *   - 心魔高但可兑换禁忌能力（攻击加成），形成风险收益权衡
 */
export const KARMA_TIERS = [
    { min: 0, max: 15, name: '道心通明', color: '#10b981', desc: '心如明镜，万法不侵' },
    { min: 15, max: 35, name: '心有尘埃', color: '#84cc16', desc: '偶有杂念，尚能自持' },
    { min: 35, max: 60, name: '魔念滋生', color: '#f59e0b', desc: '心魔渐长，需常诵清心咒' },
    { min: 60, max: 85, name: '道心蒙尘', color: '#ef4444', desc: '一念之差，万劫不复' },
    { min: 85, max: 100, name: '走火入魔', color: '#7c2d12', desc: '已堕魔道，禁忌之力可得' }
];

export class KarmaSystem {
    constructor(state) {
        this.state = state;
        // 订阅所有心魔变动，统一收口，避免各处直接改数值
        bus.on(EV.KARMA_CHANGE, ({ delta, reason }) => {
            this.apply(delta, reason);
        });
    }

    /**
     * 应用心魔变化
     * @param {number} delta - 正为增加心魔，负为净化
     * @param {string} reason
     */
    apply(delta, reason = '') {
        const player = this.state.player;
        if (!player || !delta) return null;

        const before = player.karma ?? 0;
        const after = Math.max(0, Math.min(100, before + delta));
        player.karma = after;

        const beforeTier = this.getTier(before);
        const afterTier = this.getTier(after);

        const result = { before, after, delta: after - before, reason, tierChanged: false };

        if (beforeTier.name !== afterTier.name) {
            result.tierChanged = true;
            result.fromTier = beforeTier.name;
            result.toTier = afterTier.name;
            bus.emit('karma:tier', { player, from: beforeTier, to: afterTier });
        }

        return result;
    }

    /** 获取当前心境层级 */
    getTier(value) {
        const v = value ?? this.state.player?.karma ?? 0;
        return KARMA_TIERS.find(t => v >= t.min && v < t.max) || KARMA_TIERS[KARMA_TIERS.length - 1];
    }

    /**
     * 心魔带来的战斗加成（高风险高回报）
     * @returns {Object} 属性加成
     */
    getKarmaBonus(player) {
        const k = player.karma ?? 0;
        return {
            attack: Math.floor(k * 0.6),      // 满心魔 +60 攻击
            speed: Math.floor(k * 0.2),       // 满心魔 +20 速度
            critRate: k * 0.004,              // 满心魔 +40% 暴击
            riskDelta: k * 0.0015,            // 但走火入魔概率同步上升
            tribulationPenalty: k * 0.002     // 天劫更难
        };
    }

    /** 消耗心魔兑换禁忌能力（永久提升，代价是心境难返） */
    exchangeForbidden(player, cost = 20) {
        if ((player.karma ?? 0) < cost) {
            return { ok: false, reason: `心魔不足，需要 ${cost} 点` };
        }
        const a = player.attributes;
        a.maxHp += 100;
        a.attack += 25;
        a.hp = a.maxHp;

        const res = this.apply(-cost, '兑换禁忌之力');
        return {
            ok: true,
            gained: { maxHp: 100, attack: 25 },
            karmaAfter: res.after,
            message: `🔮 以 ${cost} 点心魔换取禁忌之力：生命上限 +100，攻击 +25`
        };
    }

    /** 诵经净化 */
    purify(player, amount = 10) {
        const res = this.apply(-amount, '诵经净化');
        return {
            ok: true,
            purified: res ? res.before - res.after : 0,
            karmaAfter: player.karma,
            message: res && res.before - res.after > 0
                ? `📿 诵经静心，心魔 -${res.before - res.after}`
                : '📿 道心已明，无需净化'
        };
    }
}
