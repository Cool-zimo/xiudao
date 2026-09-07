/**
 * 地形定义
 *
 * 每种地形带三类属性：
 *   qi      灵气浓度（1-5），决定在此修炼的速度与突破概率
 *   walk    是否可通行
 *   danger  遇敌概率权重（0 表示安全区）
 *
 * 这是修仙世界的核心策略层：地形不只是背景板，
 * "在哪练功、在哪建洞府" 是玩家最重要的决策之一。
 */

export const TILE = {
    PLAIN: 'plain',   // 青芜坡
    VEIN: 'vein',     // 灵脉
    FOREST: 'forest', // 妖兽林
    SECT: 'sect',     // 山门
    CAVE: 'cave',     // 洞府
    ORE: 'ore',       // 灵石矿脉
    CLOUD: 'cloud'    // 云海（不可通行）
};

export const TILE_DEFS = {
    [TILE.PLAIN]: {
        name: '青芜坡', qi: 1, walk: true, danger: 0.05,
        desc: '寻常山野，灵气稀薄。', color: '#4a7c59'
    },
    [TILE.VEIN]: {
        name: '灵脉', qi: 5, walk: true, danger: 0.05,
        desc: '地脉灵气喷薄，修炼速度倍增，突破几率大增。', color: '#38bdf8'
    },
    [TILE.FOREST]: {
        name: '妖兽林', qi: 2, walk: true, danger: 0.45,
        desc: '古木蔽日，妖兽出没。灵气尚可，但危机四伏。', color: '#14532d'
    },
    [TILE.SECT]: {
        name: '山门', qi: 3, walk: true, danger: 0,
        desc: '宗门重地，灵气充盈且绝对安全。', color: '#94a3b8'
    },
    [TILE.CAVE]: {
        name: '洞府', qi: 4, walk: true, danger: 0,
        desc: '天然石台，可开辟为洞府，闭关修炼之所。', color: '#b45309'
    },
    [TILE.ORE]: {
        name: '灵石矿脉', qi: 2, walk: true, danger: 0.1,
        desc: '可开采灵石，修行界的硬通货。', color: '#a855f7'
    },
    [TILE.CLOUD]: {
        name: '云海', qi: 0, walk: false, danger: 0,
        desc: '深不见底的云渊，凡躯不可涉足。', color: '#e2e8f0'
    }
};

/** 可采集资源 */
export const RES = {
    HERB: 'herb',
    STONE: 'stone'
};

export const RES_DEFS = {
    [RES.HERB]: {
        name: '灵草', img: 'assets/art/r_herb.jpg',
        desc: '炼丹主材，服之可增修为。'
    },
    [RES.STONE]: {
        name: '灵石', img: 'assets/art/r_stone.jpg',
        desc: '修行界硬通货，布阵炼器皆需。'
    }
};

/** 瓦片贴图路径 */
export const TILE_IMGS = {
    [TILE.PLAIN]: 'assets/art/t_plain.jpg',
    [TILE.VEIN]: 'assets/art/t_vein.jpg',
    [TILE.FOREST]: 'assets/art/t_forest.jpg',
    [TILE.SECT]: 'assets/art/t_sect.jpg',
    [TILE.CAVE]: 'assets/art/t_cave.jpg',
    [TILE.ORE]: 'assets/art/t_ore.jpg',
    [TILE.CLOUD]: 'assets/art/t_cloud.jpg'
};

export function tileDef(t) {
    return TILE_DEFS[t] || TILE_DEFS[TILE.PLAIN];
}
