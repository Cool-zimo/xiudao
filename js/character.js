/**
 * 🌿 网页修仙模拟器 - 角色系统扩展
 * 处理角色属性计算、天赋效果等
 */

const Character = {
    /**
     * 计算角色最终属性（考虑天赋、装备等加成）
     * @param {Object} player - 玩家数据
     * @returns {Object} 最终属性
     */
    calculateFinalAttributes(player) {
        const base = { ...player.attributes };
        
        // 天赋加成
        const talentBonus = this.getTalentBonus(player.talent, player.cultivation.level);
        
        return {
            hp: base.hp + (talentBonus.hp || 0),
            maxHp: base.maxHp + (talentBonus.hp || 0),
            mp: base.mp + (talentBonus.mp || 0),
            maxMp: base.maxMp + (talentBonus.mp || 0),
            attack: base.attack + (talentBonus.attack || 0),
            defense: base.defense + (talentBonus.defense || 0),
            speed: base.speed + (talentBonus.speed || 0),
            luck: base.luck + (talentBonus.luck || 0)
        };
    },
    
    /**
     * 获取天赋加成
     * @param {string} talent - 天赋名称
     * @param {number} level - 当前等级
     * @returns {Object} 属性加成
     */
    getTalentBonus(talent, level) {
        const bonuses = {
            '运气': {
                luck: 10 + Math.floor(level * 0.5),
                description: '掉落率提升，奇遇概率增加'
            },
            '肉盾': {
                hp: 50 + Math.floor(level * 5),
                defense: 3 + Math.floor(level * 0.3),
                description: '血量上限提升，防御增强'
            },
            '远攻': {
                attack: 5 + Math.floor(level * 0.5),
                speed: 2 + Math.floor(level * 0.2),
                description: '远程攻击伤害提升'
            },
            '控云': {
                mp: 20 + Math.floor(level * 2),
                description: '掌控风雨雷电，元素伤害'
            }
        };
        
        return bonuses[talent] || {};
    },
    
    /**
     * 获取职业特性描述
     * @param {string} profession - 职业名称
     * @returns {Object} 职业特性
     */
    getProfessionInfo(profession) {
        const infos = {
            '锻造师': {
                icon: '🔧',
                description: '炼器炼丹，提高成功率',
                specialAbility: '可在锻造台中管理控云法术',
                passiveSkill: '炼制成功率+20%'
            },
            '召唤师': {
                icon: '📦',
                description: '契约灵兽，后台挂机刷怪',
                specialAbility: '可契约多只灵兽协助战斗',
                passiveSkill: '灵兽忠诚度下降速度-50%',
                warning: '⚠️ 灵兽等级过高有反噬风险'
            },
            '暗器师': {
                icon: '🗡️',
                description: '打造暗器，高爆发伤害',
                specialAbility: '可使用特殊暗器技能',
                passiveSkill: '暴击伤害+30%'
            }
        };
        
        return infos[profession] || {};
    },
    
    /**
     * 检查是否可以突破境界
     * @param {Object} player - 玩家数据
     * @returns {Object} { canBreakthrough: boolean, reason: string }
     */
    checkBreakthrough(player) {
        if (!player || !player.cultivation) {
            return { canBreakthrough: false, reason: '数据错误' };
        }
        
        const currentRealm = player.cultivation.realm;
        const currentLevel = player.cultivation.level;
        
        // 检查是否达到当前境界满级
        if (currentLevel < 10) {
            return { 
                canBreakthrough: false, 
                reason: `需要达到${currentRealm} Lv10` 
            };
        }
        
        // 特殊境界要求
        if (currentRealm === '筑基期') {
            // 结丹需要渡劫
            return {
                canBreakthrough: true,
                reason: '可以开始渡劫，准备突破至结丹期',
                needTribulation: true
            };
        }
        
        if (currentRealm === '结丹期' && player.faction === '邪修') {
            // 邪修无法直接结婴
            return {
                canBreakthrough: false,
                reason: '邪修无法直接结婴，需开启第二人格或夺舍',
                evilCultivatorBlock: true
            };
        }
        
        return {
            canBreakthrough: true,
            reason: `可以突破至下一境界`
        };
    },
    
    /**
     * 生成角色简介文本
     * @param {Object} player - 玩家数据
     * @returns {string} 简介文本
     */
    generateCharacterSummary(player) {
        if (!player) return '';
        
        const profInfo = this.getProfessionInfo(player.profession);
        
        return `
道号：${player.name}
阵营：${player.faction}
职业：${profInfo.icon} ${player.profession}
天赋：${player.talent}
境界：${player.cultivation.realm} Lv${player.cultivation.level}
修为：${player.cultivation.experience}/${player.cultivation.expToNext}
        `.trim();
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Character;
}
