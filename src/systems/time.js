/**
 * 节气与昼夜
 *
 * 修仙世界的时间不只是装饰：
 *   · 子时（23-01）阴气最盛 → 邪修修炼 +30%，正道 -20%
 *   · 午时（11-13）阳气最盛 → 正道 +25%，邪修 -15%
 *   · 春分/秋分 灵气平稳，夏至灵气最旺，冬至灵气蛰伏
 *
 * 一个时辰 = 2 小时；一天 12 时辰。
 */

export const HOURS_PER_DAY = 24;
export const DAYS_PER_SEASON = 30;      // 一季 30 天（简化）
export const DAYS_PER_YEAR = 120;       // 一年 4 季

/** 十二时辰 */
export const SHICHEN = [
    { name: '子时', range: [23, 1], yin: 1.0 },   // 阴气最盛
    { name: '丑时', range: [1, 3], yin: 0.8 },
    { name: '寅时', range: [3, 5], yin: 0.6 },
    { name: '卯时', range: [5, 7], yin: 0.35 },
    { name: '辰时', range: [7, 9], yin: 0.15 },
    { name: '巳时', range: [9, 11], yin: 0.05 },
    { name: '午时', range: [11, 13], yin: -1.0 },  // 阳气最盛
    { name: '未时', range: [13, 15], yin: -0.7 },
    { name: '申时', range: [15, 17], yin: -0.4 },
    { name: '酉时', range: [17, 19], yin: -0.1 },
    { name: '戌时', range: [19, 21], yin: 0.25 },
    { name: '亥时', range: [21, 23], yin: 0.6 }
];

export const SEASONS = [
    { key: 'spring', name: '春', qiMul: 1.15, desc: '万物生发，灵气渐苏' },
    { key: 'summer', name: '夏', qiMul: 1.35, desc: '阳气鼎盛，灵气最旺' },
    { key: 'autumn', name: '秋', qiMul: 1.0, desc: '天高气清，灵气平稳' },
    { key: 'winter', name: '冬', qiMul: 0.75, desc: '万物蛰伏，灵气内敛' }
];

export class TimeSystem {
    constructor(initialDay = 1, initialHour = 6) {
        this.day = initialDay;
        this.hour = initialHour;      // 0-23
        this.minute = 0;
    }

    /** 推进指定分钟数 */
    advance(minutes) {
        this.minute += minutes;
        while (this.minute >= 60) {
            this.minute -= 60;
            this.hour += 1;
            if (this.hour >= 24) {
                this.hour -= 24;
                this.day += 1;
            }
        }
    }

    /** 当前时辰 */
    shichen() {
        const h = this.hour;
        for (const s of SHICHEN) {
            const [a, b] = s.range;
            if (a > b) {                 // 跨零点，如子时 23-1
                if (h >= a || h < b) return s;
            } else {
                if (h >= a && h < b) return s;
            }
        }
        return SHICHEN[0];
    }

    /** 当前季节 */
    season() {
        const idx = Math.floor(((this.day - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
        return SEASONS[Math.min(idx, 3)];
    }

    /** 阴气值：-1（纯阳）~ 1（纯阴） */
    yinQi() { return this.shichen().yin; }

    /**
     * 修炼效率系数
     * @param {number} karma 心魔（0-100）
     */
    cultivationMul(karma = 0) {
        const yin = this.yinQi();
        // 高心魔（邪道）喜阴，低心魔（正道）喜阳
        const evil = karma >= 50;
        let mul = 1;
        if (evil) mul += yin * 0.30;
        else mul -= yin * 0.20;
        mul *= this.season().qiMul;
        return Math.max(0.4, Math.round(mul * 100) / 100);
    }

    /** 天色（0=夜，1=昼），用于地图滤镜 */
    daylight() {
        const h = this.hour + this.minute / 60;
        // 6 点日出，18 点日落，正弦曲线
        return Math.max(0, Math.min(1, Math.sin((h - 6) / 12 * Math.PI)));
    }

    /** 显示文本 */
    display() {
        const s = this.shichen();
        const sea = this.season();
        return `第 ${this.day} 日 · ${s.name} · ${sea.name}季`;
    }

    toJSON() { return { day: this.day, hour: this.hour, minute: this.minute }; }
    static from(d) {
        const t = new TimeSystem();
        if (d) { t.day = d.day ?? 1; t.hour = d.hour ?? 6; t.minute = d.minute ?? 0; }
        return t;
    }
}
