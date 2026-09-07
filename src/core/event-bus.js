/**
 * 事件总线 —— 系统间解耦的核心
 *
 * 设计目的：1.x 中成就系统失效的根因是「逻辑层不知道发生了什么」，
 * 所有统计都靠各处手动调用。2.0 改为事件驱动：
 *   systems 只管 emit 事件，不关心谁在听
 *   成就/统计/日志/UI 各自 on 订阅，互不耦合
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
        this.wildcards = new Map();
        this.history = [];
        this.historyLimit = 200;
    }

    /**
     * 订阅事件
     * @param {string} event - 事件名，支持 'a:*' 通配
     * @param {Function} handler
     * @returns {Function} 取消订阅函数
     */
    on(event, handler) {
        if (event.includes('*')) {
            const prefix = event.replace(/\*+$/, '');
            if (!this.wildcards.has(prefix)) this.wildcards.set(prefix, new Set());
            this.wildcards.get(prefix).add(handler);
            return () => this.wildcards.get(prefix)?.delete(handler);
        }
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event).add(handler);
        return () => this.listeners.get(event)?.delete(handler);
    }

    /** 一次性订阅 */
    once(event, handler) {
        const off = this.on(event, (payload) => {
            off();
            handler(payload);
        });
        return off;
    }

    /**
     * 发布事件
     * @param {string} event
     * @param {*} payload
     */
    emit(event, payload) {
        this.history.push({ event, payload, at: Date.now() });
        if (this.history.length > this.historyLimit) this.history.shift();

        this.listeners.get(event)?.forEach(h => this._safeCall(h, payload, event));

        // 通配匹配：'battle:*' 能收到 'battle:won'
        for (const [prefix, handlers] of this.wildcards) {
            if (event.startsWith(prefix)) {
                handlers.forEach(h => this._safeCall(h, payload, event));
            }
        }
    }

    _safeCall(handler, payload, event) {
        try {
            handler(payload, event);
        } catch (e) {
            // 单个订阅者出错不应中断其他订阅者
            console.error(`[EventBus] 处理 ${event} 时出错:`, e);
        }
    }

    /** 清空所有订阅（测试用） */
    reset() {
        this.listeners.clear();
        this.wildcards.clear();
        this.history = [];
    }
}

/** 全局单例 */
export const bus = new EventBus();

/** 事件名常量，避免拼写错误 */
export const EV = {
    CULTIVATE: 'cultivate',            // 修炼
    CULTIVATE_QI_DEVIATION: 'cultivate:deviation', // 走火入魔
    BATTLE_START: 'battle:start',
    BATTLE_END: 'battle:end',
    SKILL_USED: 'battle:skill',
    REALM_UP: 'realm:up',              // 境界提升
    TRIBULATION_START: 'tribulation:start',
    TRIBULATION_END: 'tribulation:end',
    EXPLORE_ENTER: 'explore:enter',    // 进入秘境
    EXPLORE_NODE: 'explore:node',      // 秘境节点
    EXPLORE_EXIT: 'explore:exit',
    EVENT_CHOICE: 'event:choice',      // 随机事件选择
    KARMA_CHANGE: 'karma:change',      // 心魔/道心变化
    SECT_JOIN: 'sect:join',
    ITEM_GAIN: 'item:gain',
    DEATH: 'player:death'
};
