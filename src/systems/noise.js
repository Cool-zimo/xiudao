/**
 * 程序化噪声 —— 无限地图的地基
 *
 * 为什么需要它：
 *   固定数组地图（48×48）写死了布局，无法扩展。
 *   无限地图要求「任意坐标都能算出确定的地形，且与访问顺序无关」，
 *   这只能靠噪声函数实现：同一个 (x,y,seed) 永远得到同一个值。
 *
 * 实现选择：
 *   value noise + fbm，不用 Perlin / Simplex。
 *   理由：value noise 只需几十行、无依赖、速度足够；
 *   fbm 叠加多个倍频后视觉上与 Perlin 差异很小。
 */

/** 32 位整数哈希 → [0,1) */
export function hash2(x, y, seed = 0) {
    let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
}

/** 更散的哈希（用于资源点等需要低关联性的场合） */
export function hash3(x, y, seed) {
    let h = seed ^ Math.imul(x | 0, 0x9E3779B1) ^ Math.imul(y | 0, 0x85EBCA77);
    h = Math.imul(h ^ (h >>> 15), 0xC2B2AE35);
    h = Math.imul(h ^ (h >>> 12), 0x27D4EB2F);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** 平滑插值曲线（五次平滑，比三次更少方向性伪影） */
function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * 二维 value noise，输出 [0,1)
 * 格点随机值 + 双线性平滑插值
 */
export function valueNoise(x, y, seed = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;

    const v00 = hash2(xi, yi, seed);
    const v10 = hash2(xi + 1, yi, seed);
    const v01 = hash2(xi, yi + 1, seed);
    const v11 = hash2(xi + 1, yi + 1, seed);

    const u = fade(xf), v = fade(yf);
    return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
}

/**
 * 分形叠加（fbm）：多个倍频的 value noise 加权求和
 * 低频决定大地貌（山脉走向），高频添加细节（碎石、草丛起伏）
 *
 * @param {number} octaves 层数，越多细节越丰富但越慢
 * @param {number} lacunarity 频率倍数，通常 2
 * @param {number} gain 振幅衰减，通常 0.5
 * @returns {number} [0,1)
 */
export function fbm(x, y, seed = 0, octaves = 4, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 1013) * amp;
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return sum / norm;
}

/**
 * 脊线噪声（ridged）：1 - |2n - 1|
 * 普通噪声是「团块」，脊线噪声形成「细长脉络」——
 * 正好用来生成蜿蜒的灵脉与山脉，而非一片一片的色块。
 */
export function ridge(x, y, seed = 0, octaves = 4) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
        const n = valueNoise(x * freq, y * freq, seed + i * 7919);
        const r = 1 - Math.abs(n * 2 - 1);
        sum += r * r * amp;      // 平方让脊线更锐利
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
}
