/**
 * 角色定义 —— 玩家可选的 4 位修士（2 男 2 女，4 条不同修行路线）
 *
 * 每位角色包含：
 *   stand  站立全身立绘（角色选择界面用）
 *   sit    盘腿打坐立绘（主界面修炼动画用）
 *   aura   灵气主色（驱动粒子、光晕、边框等 UI 元素）
 *   bonus  初始属性加成（体现路线差异）
 */

const BASE = 'assets/art/';

export const CHARACTERS = [
    {
        id: 'swordsman',
        name: '凌霄',
        title: '剑修',
        gender: 'male',
        faction: '正道',
        aura: '#7dd3fc',                 // 霜青
        auraRgb: '125,211,252',
        desc: '一剑霜寒十四州。攻高防薄，出手必定见血。',
        traits: ['高攻击', '低防御', '暴击率 +5%'],
        bonus: { attack: 8, defense: -3, maxHp: -20, luck: 5 },
        stand: BASE + 'char_swordsman.jpg',
        sit: BASE + 'sit_swordsman.jpg'
    },
    {
        id: 'bodycult',
        name: '铁岩',
        title: '体修',
        gender: 'male',
        faction: '正道',
        aura: '#fbbf24',                 // 暗金
        auraRgb: '251,191,36',
        desc: '以身为炉，以骨为炭。皮糙肉厚，最擅持久。',
        traits: ['高生命', '高防御', '修炼速度略慢'],
        bonus: { attack: -2, defense: 10, maxHp: 120, luck: -5 },
        stand: BASE + 'char_bodycult.jpg',
        sit: BASE + 'sit_bodycult.jpg'
    },
    {
        id: 'ice',
        name: '霜华',
        title: '冰修',
        gender: 'female',
        faction: '正道',
        aura: '#a5b4fc',                 // 冰蓝
        auraRgb: '165,180,252',
        desc: '冰心玉壶，不染尘埃。法力绵长，控场见长。',
        traits: ['高法力', '高气运', '攻击偏弱'],
        bonus: { attack: -3, defense: 2, maxMp: 60, maxHp: -10, luck: 8 },
        stand: BASE + 'char_ice.jpg',
        sit: BASE + 'sit_ice.jpg'
    },
    {
        id: 'fox',
        name: '赤魅',
        title: '妖修',
        gender: 'female',
        faction: '邪修',
        aura: '#fb7185',                 // 赤金
        auraRgb: '251,113,133',
        desc: '天生媚骨，道心难持。初始心魔极高，但战力惊人。',
        traits: ['初始心魔 40', '高暴击', '邪道功法'],
        bonus: { attack: 6, defense: -2, maxHp: 30, luck: 3, karma: 40 },
        stand: BASE + 'char_fox.jpg',
        sit: BASE + 'sit_fox.jpg'
    }
];

export const DEFAULT_CHARACTER_ID = 'swordsman';

/** 按 id 获取角色 */
export function getCharacter(id) {
    return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

/** 按性别筛选 */
export function getByGender(gender) {
    return CHARACTERS.filter(c => c.gender === gender);
}

/** 预加载所有角色立绘 */
export function preloadCharacters() {
    const urls = CHARACTERS.flatMap(c => [c.stand, c.sit]);
    return Promise.all(urls.map(src => new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = resolve;
        img.src = src;
    })));
}
