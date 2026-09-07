import realmsData from '../data/realms.json' with { type: 'json' };

/**
 * 存档迁移
 *
 * 重构必然改动数据结构，如果没有迁移层，老玩家一升级就坏档 —— 这是
 * 最容易被忽略、但上线后最痛的一环。
 *
 * 策略：每个版本一个 migrate 函数，链式升级到当前版本
 */

export const CURRENT_SAVE_VERSION = 2;

/** 版本 1 → 2：1.x 六境界 + 固定阵营 → 2.0 九境界 + 心魔轴 */
const REALM_MAP_1_TO_2 = {
    '练气期': 'lianqi',
    '筑基期': 'zhuji',
    '结丹期': 'jiedan',
    '金丹期': 'jindan',
    '元婴期': 'yuanying',
    '筠仙期': 'dacheng' // 1.x 的"筠仙期"是错误命名，映射到最高境界大乘期
};

function migrate1to2(save) {
    const p = save.player;
    if (!p) return save;

    // 境界：名称 → id，并补齐 maxLevel
    const c = p.cultivation || {};
    const realmId = REALM_MAP_1_TO_2[c.realm] || 'lianqi';
    const realmDef = realmsData.realms.find(r => r.id === realmId) || realmsData.realms[0];
    p.cultivation = {
        ...c,
        realmId: realmDef.id,
        realm: realmDef.name,
        realmIndex: realmsData.realms.findIndex(r => r.id === realmDef.id),
        maxLevel: c.maxLevel || realmDef.maxLevel,
        expToNext: c.expToNext || realmDef.baseExp,
        baseExp: realmDef.baseExp
    };

    // 阵营 → 心魔轴：邪修初始心魔 40，正道 5
    p.karma = p.karma ?? (p.faction === '邪修' ? 40 : 5);

    // 功法：默认为青云诀（正道）/ 血海魔功（邪修）
    if (!p.methods) {
        p.methods = {
            main: p.faction === '邪修' ? 'xuehai' : 'qingyun',
            support: null
        };
    }

    // 遗物：1.x 无此概念
    p.relics = p.relics || [];

    // 成就统计：补齐缺失字段（1.x 因 recordStat 未调用而全为 0）
    p.stats = {
        totalCultivations: 0,
        battlesWon: 0,
        battlesLost: 0,
        itemsForged: 0,
        pillsMade: 0,
        soulsDevoured: 0,
        playTime: 0,
        ...(p.stats || {})
    };
    p.achievements = p.achievements || { unlocked: [], unlockedAt: {} };

    return save;
}

const MIGRATIONS = {
    1: migrate1to2
};

/**
 * 将存档升级到当前版本
 * @param {Object} save - 任意版本的存档
 * @returns {Object} { save, migrated, from, to }
 */
export function migrateSave(save) {
    if (!save) return { save: null, migrated: false };

    let version = save.saveVersion ?? 1;
    const from = version;
    let current = { ...save };

    while (version < CURRENT_SAVE_VERSION) {
        const fn = MIGRATIONS[version];
        if (!fn) {
            console.warn(`[Migrate] 缺少 v${version} → v${version + 1} 的迁移函数`);
            break;
        }
        current = fn(current);
        version++;
    }

    current.saveVersion = CURRENT_SAVE_VERSION;
    return {
        save: current,
        migrated: from < CURRENT_SAVE_VERSION,
        from,
        to: CURRENT_SAVE_VERSION
    };
}

/** 创建新存档（2.0 结构） */
export function createNewSave(characterData) {
    const { name, faction, profession, talent } = characterData;
    const realm0 = realmsData.realms[0];

    return {
        saveVersion: CURRENT_SAVE_VERSION,
        player: {
            name,
            faction,
            profession,
            talent,
            karma: faction === '邪修' ? 40 : 5,
            methods: {
                main: faction === '邪修' ? 'xuehai' : 'qingyun',
                support: null
            },
            cultivation: {
                realmId: realm0.id,
                realm: realm0.name,
                realmIndex: 0,
                level: 1,
                maxLevel: realm0.maxLevel,
                experience: 0,
                expToNext: realm0.baseExp
            },
            attributes: {
                hp: 100, maxHp: 100,
                mp: 50, maxMp: 50,
                attack: 10, defense: 5,
                speed: 10, luck: 10
            },
            gold: 0,
            inventory: [],
            relics: [],
            stats: {
                totalCultivations: 0, battlesWon: 0, battlesLost: 0,
                itemsForged: 0, pillsMade: 0, soulsDevoured: 0, playTime: 0
            },
            achievements: { unlocked: [], unlockedAt: {} },
            metadata: {
                createTime: new Date().toISOString(),
                lastSaveTime: new Date().toISOString(),
                playTime: 0
            }
        }
    };
}
