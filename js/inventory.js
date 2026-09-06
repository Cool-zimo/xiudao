/**
 * 🌿 网页修仙模拟器 - 背包系统
 * 管理物品、装备、丹药等
 */

const Inventory = {
    /**
     * 物品数据库（MVP简化版）
     */
    itemDatabase: {
        // 丹药类
        'item_001': {
            id: 'item_001',
            name: '聚气丹',
            type: '丹药',
            quality: '凡品',
            effect: { type: 'exp', value: 50 },
            description: '服用后获得50点修为',
            icon: '💊'
        },
        'item_002': {
            id: 'item_002',
            name: '凝元丹',
            type: '丹药',
            quality: '下品',
            effect: { type: 'exp', value: 100 },
            description: '服用后获得100点修为',
            icon: '💊'
        },
        'item_003': {
            id: 'item_003',
            name: '回春丹',
            type: '丹药',
            quality: '凡品',
            effect: { type: 'heal', value: 50 },
            description: '恢复50点生命值',
            icon: '💚'
        },
        'item_004': {
            id: 'item_004',
            name: '筑基丹',
            type: '丹药',
            quality: '中品',
            effect: { type: 'exp', value: 200 },
            description: '服用后获得200点修为',
            icon: '💊'
        },
        
        // 装备类（预留）
        'weapon_001': {
            id: 'weapon_001',
            name: '铁剑',
            type: '武器',
            quality: '凡品',
            attributes: { attack: 10 },
            description: '普通的铁剑，攻击+10',
            icon: '⚔️'
        }
    },
    
    /**
     * 获取物品详细信息
     * @param {string} itemId - 物品ID
     * @returns {Object|null} 物品信息
     */
    getItemInfo(itemId) {
        return this.itemDatabase[itemId] || null;
    },
    
    /**
     * 使用物品的详细逻辑
     * @param {Object} player - 玩家数据
     * @param {string} itemId - 物品ID
     * @returns {Object} 使用结果
     */
    useItemDetailed(player, itemId) {
        const itemIndex = player.inventory.findIndex(i => i.id === itemId);
        if (itemIndex === -1) {
            return { success: false, message: '物品不存在' };
        }
        
        const item = player.inventory[itemIndex];
        const itemInfo = this.getItemInfo(itemId);
        
        if (!itemInfo) {
            return { success: false, message: '未知物品' };
        }
        
        let result = { success: true, item: itemInfo };
        
        // 根据物品类型执行效果
        switch (item.type) {
            case '丹药':
                result = this.usePill(player, item, itemInfo);
                break;
            
            case '武器':
            case '防具':
                result = this.equipItem(player, item, itemInfo);
                break;
            
            default:
                result = { success: false, message: '该物品无法使用' };
        }
        
        // 减少物品数量
        if (result.success) {
            item.count--;
            if (item.count <= 0) {
                player.inventory.splice(itemIndex, 1);
            }
            Game.autoSave();
        }
        
        return result;
    },
    
    /**
     * 使用丹药
     */
    usePill(player, item, itemInfo) {
        const effect = itemInfo.effect;
        
        switch (effect.type) {
            case 'exp':
                const result = Game.gainExperience(effect.value);
                return {
                    success: true,
                    message: `服用${itemInfo.name}，获得${effect.value}点修为`,
                    expGain: effect.value,
                    leveledUp: result.leveledUp,
                    newRealm: result.newRealm
                };
            
            case 'heal':
                const oldHp = player.attributes.hp;
                Game.heal(effect.value);
                const healed = player.attributes.hp - oldHp;
                return {
                    success: true,
                    message: `服用${itemInfo.name}，恢复${healed}点生命`,
                    healAmount: healed
                };
            
            default:
                return { success: false, message: '未知的丹药效果' };
        }
    },
    
    /**
     * 装备物品（预留功能）
     */
    equipItem(player, item, itemInfo) {
        // TODO: 实现装备系统
        return {
            success: false,
            message: '装备系统开发中...'
        };
    },
    
    /**
     * 获取背包物品总价值
     * @param {Array} inventory - 背包数组
     * @returns {number} 总价值
     */
    calculateInventoryValue(inventory) {
        const qualityValues = {
            '凡品': 10,
            '下品': 20,
            '中品': 50,
            '上品': 100,
            '极品': 200,
            '法器': 500,
            '宝器': 1000,
            '灵器': 2000,
            '仙器': 5000,
            '神器': 10000,
            '道器': 50000
        };
        
        let totalValue = 0;
        
        inventory.forEach(item => {
            const itemInfo = this.getItemInfo(item.id);
            if (itemInfo && itemInfo.quality) {
                const baseValue = qualityValues[itemInfo.quality] || 10;
                totalValue += baseValue * (item.count || 1);
            }
        });
        
        return totalValue;
    },
    
    /**
     * 清理背包（移除数量为0的物品）
     * @param {Array} inventory - 背包数组
     */
    cleanInventory(inventory) {
        for (let i = inventory.length - 1; i >= 0; i--) {
            if (inventory[i].count <= 0) {
                inventory.splice(i, 1);
            }
        }
    },
    
    /**
     * 检查背包是否有空位
     * @param {Array} inventory - 背包数组
     * @param {number} maxSize - 最大容量
     * @returns {boolean} 是否有空位
     */
    hasEmptySlot(inventory, maxSize = 50) {
        return inventory.length < maxSize;
    },
    
    /**
     * 批量使用物品
     * @param {Object} player - 玩家数据
     * @param {string} itemId - 物品ID
     * @param {number} count - 使用数量
     * @returns {Object} 使用结果
     */
    useItemBatch(player, itemId, count = 1) {
        const item = player.inventory.find(i => i.id === itemId);
        
        if (!item) {
            return { success: false, message: '物品不存在' };
        }
        
        const actualCount = Math.min(count, item.count);
        let totalEffect = 0;
        
        for (let i = 0; i < actualCount; i++) {
            const result = this.useItemDetailed(player, itemId);
            if (!result.success) {
                return result;
            }
            
            if (result.expGain) {
                totalEffect += result.expGain;
            } else if (result.healAmount) {
                totalEffect += result.healAmount;
            }
        }
        
        return {
            success: true,
            message: `批量使用了${actualCount}个物品`,
            count: actualCount,
            totalEffect: totalEffect
        };
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Inventory;
}
