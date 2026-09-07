import { bus } from './event-bus.js';

/**
 * 游戏状态机
 *
 * 1.x 只有 isPlaying 布尔值，屏幕切换散落在 UI 各处
 * 2.0 显式状态机：明确合法转换，避免"在主界面弹战斗框"这类脏状态
 */
export const GameState = {
    BOOT: 'boot',
    HOME: 'home',
    CREATE: 'create',
    PLAYING: 'playing',
    CULTIVATING: 'cultivating',
    BATTLE: 'battle',
    TRIBULATION: 'tribulation',
    DUNGEON: 'dungeon',
    EVENT: 'event',
    DEAD: 'dead'
};

/** 合法状态转换表 */
const TRANSITIONS = {
    [GameState.BOOT]: [GameState.HOME, GameState.CREATE, GameState.PLAYING],
    [GameState.HOME]: [GameState.CREATE, GameState.PLAYING],
    [GameState.CREATE]: [GameState.PLAYING, GameState.HOME],
    [GameState.PLAYING]: [
        GameState.CULTIVATING, GameState.BATTLE,
        GameState.TRIBULATION, GameState.DUNGEON, GameState.EVENT,
        GameState.DEAD, GameState.HOME, GameState.CREATE
    ],
    [GameState.CULTIVATING]: [GameState.PLAYING, GameState.DEAD],
    [GameState.BATTLE]: [GameState.PLAYING, GameState.DEAD],
    [GameState.TRIBULATION]: [GameState.PLAYING, GameState.DEAD],
    [GameState.DUNGEON]: [GameState.BATTLE, GameState.EVENT, GameState.PLAYING, GameState.DEAD],
    [GameState.EVENT]: [GameState.PLAYING, GameState.DUNGEON],
    [GameState.DEAD]: [GameState.HOME, GameState.PLAYING]
};

export class StateMachine {
    constructor(initial = GameState.BOOT) {
        this.current = initial;
        this.previous = null;
    }

    /**
     * 尝试转换状态
     * @returns {boolean} 是否转换成功
     */
    transition(next) {
        if (this.current === next) return true;
        const allowed = TRANSITIONS[this.current] || [];
        const ok = allowed.includes(next);
        if (!ok) {
            console.warn(`[StateMachine] 非法转换: ${this.current} → ${next}`);
            return false;
        }
        this.previous = this.current;
        this.current = next;
        bus.emit('state:change', { from: this.previous, to: next });
        return true;
    }

    is(state) {
        return this.current === state;
    }

    can(next) {
        return (TRANSITIONS[this.current] || []).includes(next);
    }
}
