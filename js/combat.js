/**
 * 🌿 网页修仙模拟器 - 战斗系统扩展
 * 处理技能、职业特殊战斗等
 */

const Combat = {
    /**
     * 使用职业技能
     * @param {Object} player - 玩家数据
     * @param {Object} enemy - 敌人数据
     * @returns {Object} 技能结果
     */
    useProfessionSkill(player, enemy) {
        switch (player.profession) {
            case '锻造师':
                return this.forgeSkill(player, enemy);
            case '召唤师':
                return this.summonerSkill(player, enemy);
            case '暗器师':
                return this.assassinSkill(player, enemy);
            default:
                return { damage: 0, message: '未知职业' };
        }
    },
    
    /**
     * 锻造师技能：炼丹爆发
     */
    forgeSkill(player, enemy) {
        // 消耗法力，造成基于攻击力的伤害
        const mpCost = 20;
        
        if (player.attributes.mp < mpCost) {
            return { 
                success: false, 
                message: '法力不足！需要20点法力' 
            };
        }
        
        player.attributes.mp -= mpCost;
        
        // 炼丹爆炸伤害 = 攻击力 * 2.5
        const damage = Math.floor(player.attributes.attack * 2.5);
        enemy.hp -= damage;
        
        return {
            success: true,
            damage: damage,
            message: `🔥 炼丹爆炸！造成${damage}点伤害`,
            mpCost: mpCost
        };
    },
    
    /**
     * 召唤师技能：灵兽协战
     */
    summonerSkill(player, enemy) {
        if (!player.pet) {
            return {
                success: false,
                message: '未契约灵兽！'
            };
        }
        
        // 检查灵兽忠诚度
        if (player.pet.loyalty < 30) {
            return {
                success: false,
                message: '灵兽忠诚度太低，拒绝出战！'
            };
        }
        
        // 灵兽攻击 = 灵兽攻击力 * 1.8
        const petDamage = Math.floor(player.pet.attributes.attack * 1.8);
        enemy.hp -= petDamage;
        
        // 降低少量忠诚度
        player.pet.loyalty = Math.max(0, player.pet.loyalty - 5);
        
        return {
            success: true,
            damage: petDamage,
            message: `📦 ${player.pet.name}发动攻击！造成${petDamage}点伤害`,
            loyaltyChange: -5
        };
    },
    
    /**
     * 暗器师技能：暗器突袭
     */
    assassinSkill(player, enemy) {
        // 暗器必定暴击
        const baseDamage = player.attributes.attack * 2;
        const criticalBonus = 1.3; // 额外30%暴击伤害
        const damage = Math.floor(baseDamage * criticalBonus);
        
        enemy.hp -= damage;
        
        return {
            success: true,
            damage: damage,
            isCritical: true,
            message: `🗡️ 暗器突袭！暴击造成${damage}点伤害！`
        };
    },
    
    /**
     * 使用控云法术（如果天赋是控云）
     * @param {Object} player - 玩家数据
     * @param {Object} enemy - 敌人数据
     * @param {string} element - 元素类型
     * @returns {Object} 法术结果
     */
    useCloudControl(player, enemy, element = '雷') {
        if (player.talent !== '控云') {
            return {
                success: false,
                message: '你没有控云天赋！'
            };
        }
        
        const mpCost = 15;
        if (player.attributes.mp < mpCost) {
            return {
                success: false,
                message: '法力不足！需要15点法力'
            };
        }
        
        player.attributes.mp -= mpCost;
        
        // 元素伤害计算
        const elementMultipliers = {
            '风': 1.2,
            '雨': 1.0,
            '雷': 1.8,
            '电': 1.6,
            '火': 1.5,
            '冰': 1.3
        };
        
        const multiplier = elementMultipliers[element] || 1.0;
        const damage = Math.floor(player.attributes.attack * multiplier * 1.5);
        
        enemy.hp -= damage;
        
        // 元素特效描述
        const elementEffects = {
            '风': '狂风呼啸',
            '雨': '暴雨倾盆',
            '雷': '紫霄神雷',
            '电': '雷霆万钧',
            '火': '红莲业火',
            '冰': '冰封万里'
        };
        
        return {
            success: true,
            damage: damage,
            element: element,
            message: `⛅ ${elementEffects[element]}！造成${damage}点${element}属性伤害`
        };
    },
    
    /**
     * 逃跑判定
     * @param {Object} player - 玩家数据
     * @param {Object} enemy - 敌人数据
     * @returns {boolean} 是否成功逃跑
     */
    attemptFlee(player, enemy) {
        // 逃跑成功率 = 玩家速度 / (玩家速度 + 敌人速度) * 100%
        const playerSpeed = player.attributes.speed || 10;
        const enemySpeed = enemy.speed || 10;
        
        const fleeChance = playerSpeed / (playerSpeed + enemySpeed);
        
        return Utils.chance(fleeChance);
    },
    
    /**
     * 生成怪物掉落物
     * @param {Object} monster - 怪物数据
     * @param {Object} player - 玩家数据
     * @returns {Array} 掉落物品列表
     */
    generateDrops(monster, player) {
        const drops = [];
        
        // 基础掉落率30%，运气天赋提升
        let dropChance = 0.3;
        if (player.talent === '运气') {
            dropChance += 0.1; // 运气天赋+10%掉落率
        }
        
        if (Utils.chance(dropChance)) {
            // 随机选择一个丹药
            const pills = [
                { id: 'item_001', name: '聚气丹', type: '丹药', effect: { type: 'exp', value: 50 } },
                { id: 'item_002', name: '凝元丹', type: '丹药', effect: { type: 'exp', value: 100 } },
                { id: 'item_003', name: '回春丹', type: '丹药', effect: { type: 'heal', value: 50 } },
                { id: 'item_004', name: '筑基丹', type: '丹药', effect: { type: 'exp', value: 200 } }
            ];
            
            const dropItem = Utils.deepClone(Utils.randomChoice(pills));
            drops.push(dropItem);
        }
        
        return drops;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Combat;
}
