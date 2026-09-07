/**
 * 可复现随机数（mulberry32）
 *
 * 秘境 Roguelike 需要「同一个种子生成同一张地图」，
 * 便于玩家分享种子、也便于复现 bug。
 */
export class RNG {
    constructor(seed = Date.now()) {
        this.seed = seed >>> 0;
        this.state = this.seed;
    }

    /** 重置到初始种子 */
    reset(seed = this.seed) {
        this.seed = seed >>> 0;
        this.state = this.seed;
    }

    /** [0,1) 浮点数 */
    next() {
        this.state |= 0;
        this.state = (this.state + 0x6D2B79F5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** [min,max] 整数（含两端） */
    int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /** [min,max) 浮点 */
    float(min, max) {
        return this.next() * (max - min) + min;
    }

    /** 概率判定 */
    chance(p) {
        return this.next() < p;
    }

    /** 从数组随机取一个 */
    pick(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }

    /** 按权重随机：items=[{weight:10,...}] */
    weighted(items, weightKey = 'weight') {
        const total = items.reduce((s, i) => s + (i[weightKey] || 0), 0);
        if (total <= 0) return items[0];
        let r = this.next() * total;
        for (const item of items) {
            r -= (item[weightKey] || 0);
            if (r <= 0) return item;
        }
        return items[items.length - 1];
    }

    /** 洗牌（Fisher-Yates） */
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /** 不重复抽取 n 个 */
    sample(arr, n) {
        return this.shuffle(arr).slice(0, n);
    }
}

/** 全局默认 RNG（非秘境场景使用） */
export const rng = new RNG();
