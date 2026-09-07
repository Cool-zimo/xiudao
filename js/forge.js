/**
 * 🌿 网页修仙模拟器 - 锻造系统
 * 炼器、炼丹、控云法术管理等
 */

const Forge = {
    /**
     * 锻造台数据
     */
    forgeData: {
        // 炼丹配方
        alchemyRecipes: {
            'pill_basic': {
                name: '基础炼丹',
                requiredLevel: 1,
                materials: {
                    'herb_common': 3
                },
                successRate: 0.8,
                products: {
                    'item_001': { min: 1, max: 3 } // 聚气丹
                },
                description: '使用普通草药炼制基础丹药'
            },
            'pill_advanced': {
                name: '进阶炼丹',
                requiredLevel: 3,
                materials: {
                    'herb_common': 2,
                    'herb_rare': 1
                },
                successRate: 0.7,
                products: {
                    'item_002': { min: 1, max: 2 }, // 凝元丹
                    'item_001': { min: 1, max: 2 }  // 聚气丹
                },
                description: '使用稀有草药炼制高级丹药'
            },
            'pill_master': {
                name: '大师炼丹',
                requiredLevel: 5,
                materials: {
                    'herb_rare': 3,
                    'herb_epic': 1
                },
                successRate: 0.6,
                products: {
                    'item_004': { min: 1, max: 1 }, // 筑基丹
                    'item_002': { min: 1, max: 2 }  // 凝元丹
                },
                description: '使用珍贵草药炼制筑基丹'
            }
        },
        
        // 炼器配方
        forgingRecipes: {
            'weapon_basic': {
                name: '基础炼器',
                requiredLevel: 2,
                materials: {
                    'iron_ore': 5,
                    'coal': 3
                },
                successRate: 0.75,
                products: {
                    'weapon_001': { min: 1, max: 1 } // 铁剑
                },
                description: '使用铁矿石炼制基础武器'
            },
            'weapon_advanced': {
                name: '进阶炼器',
                requiredLevel: 4,
                materials: {
                    'iron_ore': 3,
                    'steel_ore': 2,
                    'gem_flawed': 1
                },
                successRate: 0.6,
                products: {
                    'weapon_002': { min: 1, max: 1 } // 精钢剑
                },
                description: '使用精钢和宝石炼制高级武器'
            }
        },
        
        // 控云法术等级配置
        cloudControlLevels: {
            1: { name: '初窥门径', damageMultiplier: 1.1, description: '入门级控云法术' },
            2: { name: '小有所成', damageMultiplier: 1.2, description: '掌握基本元素操控' },
            3: { name: '登堂入室', damageMultiplier: 1.3, description: '能够熟练运用元素力量' },
            4: { name: '融会贯通', damageMultiplier: 1.4, description: '元素运用更加精准' },
            5: { name: '炉火纯青', damageMultiplier: 1.5, description: '对元素的掌控达到纯熟境界' },
            6: { name: '出神入化', damageMultiplier: 1.6, description: '能够运用高级元素技巧' },
            7: { name: '登峰造极', damageMultiplier: 1.7, description: '元素运用达到顶峰' },
            8: { name: '超凡入圣', damageMultiplier: 1.8, description: '超越凡人的元素掌控' },
            9: { name: '返璞归真', damageMultiplier: 1.9, description: '回归本源的元素运用' },
            10: { name: '大道至简', damageMultiplier: 2.0, description: '掌控天地元素，威力倍增' }
        },
        
        // 材料数据库
        materials: {
            'herb_common': {
                name: '普通草药',
                description: '常见的炼药材料',
                value: 10
            },
            'herb_rare': {
                name: '稀有草药',
                description: '稀有的炼药材料',
                value: 50
            },
            'herb_epic': {
                name: '史诗草药',
                description: '极其珍贵的炼药材料',
                value: 200
            },
            'iron_ore': {
                name: '铁矿石',
                description: '基础的炼器材料',
                value: 20
            },
            'steel_ore': {
                name: '精钢矿石',
                description: '高级炼器材料',
                value: 100
            },
            'coal': {
                name: '煤炭',
                description: '冶炼燃料',
                value: 5
            },
            'gem_flawed': {
                name: '瑕疵宝石',
                description: '有瑕疵的宝石，可用于炼器',
                value: 150
            }
        }
    },
    
    /**
     * 锻造师技能成功率加成
     */
    getForgeSuccessRate(player, recipeType) {
        let baseRate = 0; // 将在具体方法中设置
        
        // 职业加成（锻造师+20%）
        if (player.profession === '锻造师') {
            baseRate += 0.2;
        }
        
        // 境界加成
        const realmBonus = player.cultivation.realmIndex * 0.05; // 每个大境界+5%
        baseRate += realmBonus;
        
        // 等级加成
        const levelBonus = (player.cultivation.level - 1) * 0.01; // 每级+1%
        baseRate += levelBonus;
        
        return Math.min(0.95, baseRate); // 最高95%成功率
    },
    
    /**
     * 炼丹
     * @param {Object} player - 玩家数据
     * @param {string} recipeId - 配方ID
     * @returns {Object} 炼丹结果
     */
    alchemy(player, recipeId) {
        const recipe = this.forgeData.alchemyRecipes[recipeId];
        if (!recipe) {
            return { success: false, message: '未知配方' };
        }
        
        // 检查等级要求
        if (player.cultivation.level < recipe.requiredLevel) {
            return { 
                success: false, 
                message: `需要达到${recipe.requiredLevel}级才能使用此配方` 
            };
        }
        
        // 检查材料（简化版，实际应该检查背包）
        const hasMaterials = this.checkMaterials(player, recipe.materials);
        if (!hasMaterials) {
            return { success: false, message: '材料不足' };
        }
        // 消耗材料（简化版）
        this.consumeMaterials(player, recipe.materials);
        
        // 计算成功率
        const successRate = this.getForgeSuccessRate(player, 'alchemy');
        const success = Utils.chance(successRate);
        
        if (success) {
            // 生成产物
            const products = this.generateProducts(recipe.products);
            
            // 记录炼丹次数（成就统计）
            Achievements.recordStat(player, 'pillsMade');
            
            // 添加到背包
            products.forEach(product => {
                Game.addItem(product);
            });
            
            return {
                success: true,
                message: `✅ 炼丹成功！获得：${products.map(p => p.name).join(', ')}`,
                products: products
            };
        } else {
            return {
                success: false,
                message: '💥 炼丹失败！丹药炸炉了...'
            };
        }
    },
    
    /**
     * 炼器
     * @param {Object} player - 玩家数据
     * @param {string} recipeId - 配方ID
     * @returns {Object} 炼器结果
     */
    forging(player, recipeId) {
        const recipe = this.forgeData.forgingRecipes[recipeId];
        if (!recipe) {
            return { success: false, message: '未知配方' };
        }
        
        // 检查等级要求
        if (player.cultivation.level < recipe.requiredLevel) {
            return { 
                success: false, 
                message: `需要达到${recipe.requiredLevel}级才能使用此配方` 
            };
        }
        
        // 检查材料
        const hasMaterials = this.checkMaterials(player, recipe.materials);
        if (!hasMaterials) {
            return { success: false, message: '材料不足' };
        }
        // 消耗材料
        this.consumeMaterials(player, recipe.materials);
        
        // 计算成功率
        const successRate = this.getForgeSuccessRate(player, 'forging');
        const success = Utils.chance(successRate);
        
        if (success) {
            // 生成产物
            const products = this.generateProducts(recipe.products);
            
            // 记录炼器次数（成就统计）
            Achievements.recordStat(player, 'itemsForged');
            
            // 添加到背包
            products.forEach(product => {
                Game.addItem(product);
            });
            
            return {
                success: true,
                message: `✅ 炼器成功！获得：${products.map(p => p.name).join(', ')}`,
                products: products
            };
        } else {
            return {
                success: false,
                message: '💥 炼器失败！装备损坏了...'
            };
        }
    },
    
    /**
     * 管理控云法术
     * @param {Object} player - 玩家数据
     * @param {string} element - 元素类型
     * @param {number} targetLevel - 目标等级
     * @returns {Object} 升级结果
     */
    manageCloudControl(player, element, targetLevel) {
        if (player.talent !== '控云') {
            return { success: false, message: '你没有控云天赋！' };
        }
        
        if (player.profession !== '锻造师') {
            return { success: false, message: '只有锻造师可以管理控云法术！' };
        }
        
        // 检查目标等级
        if (targetLevel < 1 || targetLevel > 10) {
            return { success: false, message: '控云法术等级必须在1-10之间' };
        }
        
        // 检查是否需要升级材料
        const currentLevel = player.cloudControl ? player.cloudControl.level : 0;
        if (targetLevel > currentLevel) {
            // 计算升级所需材料
            const materialsNeeded = this.getCloudUpgradeMaterials(targetLevel - currentLevel);
            
            // 检查材料
            const hasMaterials = this.checkMaterials(player, materialsNeeded);
            if (!hasMaterials) {
                return { success: false, message: '升级材料不足' };
            }
            
            // 消耗材料
            this.consumeMaterials(player, materialsNeeded);
        }
        
        // 更新控云法术等级
        if (!player.cloudControl) {
            player.cloudControl = {
                level: 1,
                element: element,
                damageMultiplier: 1.1
            };
        } else {
            player.cloudControl.level = targetLevel;
            player.cloudControl.element = element;
            const levelInfo = this.forgeData.cloudControlLevels[targetLevel];
            player.cloudControl.damageMultiplier = levelInfo.damageMultiplier;
        }
        
        Game.autoSave();
        
        return {
            success: true,
            message: `⛅ 控云法术已升级至${targetLevel}级：【${this.forgeData.cloudControlLevels[targetLevel].name}】`,
            newLevel: targetLevel,
            element: element
        };
    },
    
    /**
     * 获取控云法术升级材料
     */
    getCloudUpgradeMaterials(levels) {
        const materials = {};
        
        // 每升一级需要1个稀有草药和2个普通草药
        materials['herb_rare'] = levels;
        materials['herb_common'] = levels * 2;
        
        return materials;
    },
    
    /**
     * 检查材料是否足够
     */
    checkMaterials(player, requiredMaterials) {
        // 简化版：假设材料总是足够
        // 实际应该检查背包中的材料
        return true;
    },
    
    /**
     * 消耗材料
     */
    consumeMaterials(player, materials) {
        // 简化版：只记录消耗，不实际从背包移除
        // 实际应该从背包中移除相应材料
        if (!player.materialsUsed) {
            player.materialsUsed = {};
        }
        
        for (const [materialId, amount] of Object.entries(materials)) {
            player.materialsUsed[materialId] = (player.materialsUsed[materialId] || 0) + amount;
        }
        
        Game.autoSave();
    },
    
    /**
     * 生成产物
     */
    generateProducts(productSpecs) {
        const products = [];
        
        for (const [itemId, spec] of Object.entries(productSpecs)) {
            const count = Utils.randomInt(spec.min, spec.max);
            const item = Inventory.getItemInfo(itemId);
            
            if (item) {
                products.push({
                    ...item,
                    count: count
                });
            }
        }
        
        return products;
    },
    
    /**
     * 获取可用配方列表
     */
    getAvailableRecipes(player, type = 'alchemy') {
        const recipes = type === 'alchemy' ? this.forgeData.alchemyRecipes : this.forgeData.forgingRecipes;
        const available = [];
        
        for (const [recipeId, recipe] of Object.entries(recipes)) {
            if (player.cultivation.level >= recipe.requiredLevel) {
                available.push({
                    id: recipeId,
                    ...recipe
                });
            }
        }
        
        return available;
    },
    
    /**
     * 获取控云法术信息
     */
    getCloudControlInfo(player) {
        if (!player.cloudControl) {
            return {
                hasCloudControl: false,
                message: '尚未学习控云法术'
            };
        }
        
        const levelInfo = this.forgeData.cloudControlLevels[player.cloudControl.level];
        
        return {
            hasCloudControl: true,
            level: player.cloudControl.level,
            levelName: levelInfo.name,
            element: player.cloudControl.element,
            damageMultiplier: player.cloudControl.damageMultiplier,
            description: levelInfo.description
        };
    },
    
    /**
     * 切换控云法术元素
     */
    switchCloudElement(player, newElement) {
        if (!player.cloudControl) {
            return { success: false, message: '尚未学习控云法术' };
        }
        
        const validElements = ['风', '雨', '雷', '电', '火', '冰'];
        if (!validElements.includes(newElement)) {
            return { success: false, message: '无效的元素类型' };
        }
        
        player.cloudControl.element = newElement;
        Game.autoSave();
        
        return {
            success: true,
            message: `⛅ 控云法术元素已切换为【${newElement}】`
        };
    }
};

// 导出锻造系统
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Forge;
}