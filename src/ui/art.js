/**
 * 美术资源映射 —— 唯一的图片引用入口
 *
 * 设计考虑：
 *   1. 立绘按「境界阶段」与「心魔状态」切换，而非一张图打天下
 *   2. 场景图按当前玩法界面切换
 *   3. 所有路径集中在此，换图只改这一处
 */

const BASE = 'assets/art/';
import { getCharacter } from '../data/characters.js';

/** 角色立绘：按境界阶段索引 */
export const CHAR_PORTRAITS = {
    early: BASE + 'core_lianqi.jpg',    // 练气 / 筑基
    mid: BASE + 'char_yuanying.jpg',    // 结丹 / 金丹 / 元婴
    high: BASE + 'char_yuanying.jpg',   // 化神 / 炼虚 / 合体 / 大乘
    demon: BASE + 'char_demon.jpg'      // 心魔 ≥ 60（走火入魔）
};

/** 场景背景图 */
export const SCENES = {
    cultivate: BASE + 'scene_cultivate.jpg',      // 打坐修炼
    tribulation: BASE + 'scene_tribulation.jpg',  // 渡天劫
    dungeon: BASE + 'scene_dungeon.jpg',          // 秘境探索
    sect: BASE + 'scene_sect.jpg'                 // 宗门
};

/**
 * 根据玩家状态选择立绘
 * @param {Object} player
 * @returns {string} 图片路径
 */
export function getPortrait(player) {
    if (!player) return CHAR_PORTRAITS.early;

    // 优先使用玩家所选角色的专属立绘
    if (player.characterId) {
        const c = getCharacter(player.characterId);
        // 心魔极深时，邪修以外的角色也显魔相（复用魔化立绘）
        if ((player.karma ?? 0) >= 85 && player.faction !== '邪修') {
            return CHAR_PORTRAITS.demon;
        }
        return c.stand;
    }

    // 无指定角色时，退化为按境界阶段选择
    const karma = player.karma ?? 0;
    if (karma >= 60) return CHAR_PORTRAITS.demon;

    const idx = player.cultivation?.realmIndex ?? 0;
    if (idx <= 1) return CHAR_PORTRAITS.early;
    if (idx <= 4) return CHAR_PORTRAITS.mid;
    return CHAR_PORTRAITS.high;
}

/** 境界阶段名称（用于立绘说明） */
export function getPortraitStage(player) {
    const karma = player.karma ?? 0;

    // 所选角色：显示其修行路线
    if (player.characterId) {
        const c = getCharacter(player.characterId);
        if (karma >= 85) return '走火入魔';
        if (karma >= 60) return '魔念滋生';
        return c.title;
    }

    if (karma >= 60) return '走火入魔';
    const idx = player.cultivation?.realmIndex ?? 0;
    if (idx <= 1) return '初入仙途';
    if (idx <= 4) return '道基稳固';
    return '登堂入室';
}

/** 预加载所有资源（避免首次切换时闪白） */
export function preloadArt() {
    const all = [...Object.values(CHAR_PORTRAITS), ...Object.values(SCENES)];
    return Promise.all(all.map(src => new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = resolve;
        img.src = src;
    })));
}
