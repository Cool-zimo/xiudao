/**
 * NPC 定义模板
 *
 * 三类身份，行为倾向不同：
 *   散修  独来独往，专心修炼，偶尔夺宝
 *   宗门  维护门派利益，会驱赶外人，有组织性
 *   邪修  不择手段，噬魂夺宝，心魔普遍偏高
 */
export const NPC_KIND = {
    ROAMER: 'roamer',   // 散修
    SECT: 'sect',       // 宗门弟子
    DEMON: 'demon'      // 邪修
};

export const NPC_KIND_DEFS = {
    [NPC_KIND.ROAMER]: {
        name: '散修', color: '#94a3b8',
        desc: '独来独往，专心修炼',
        baseKarma: 15,
        // 效用权重：数值越高越倾向该行为
        weights: { cultivate: 1.0, gather: 0.7, explore: 0.5, fight: 0.25, revenge: 0.5, rest: 0.4 }
    },
    [NPC_KIND.SECT]: {
        name: '宗门弟子', color: '#60a5fa',
        desc: '维护山门，驱赶外敌',
        baseKarma: 8,
        weights: { cultivate: 0.8, gather: 0.5, explore: 0.35, fight: 0.5, revenge: 0.8, rest: 0.5 }
    },
    [NPC_KIND.DEMON]: {
        name: '邪修', color: '#f87171',
        desc: '不择手段，噬魂夺宝',
        baseKarma: 62,
        weights: { cultivate: 0.7, gather: 0.6, explore: 0.6, fight: 0.9, revenge: 1.0, rest: 0.25 }
    }
};

/** 姓氏与道号，用于生成名字 */
export const NPC_SURNAMES = ['李', '王', '张', '刘', '陈', '杨', '赵', '周', '吴', '徐',
    '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗', '郑'];

export const NPC_GIVEN = ['青玄', '玄机', '云鹤', '寒山', '拾得', '无咎', '长风', '明尘',
    '素问', '灵枢', '守拙', '抱朴', '知微', '若谷', '归墟', '沧溟',
    '疏影', '听雪', '观澜', '问渠'];
