/**
 * 🌿 网页修仙模拟器 - 邪修系统
 * 魂魄收集、第二人格、夺舍重生
 */

const EvilCultivation = {
    /**
     * 击杀怪物获得魂魄（带品质系统）
     * @param {Object} player - 玩家数据
     * @param {Object} monster - 怪物数据
     * @returns {Object} 获得的魂魄信息
     */
    gainSouls(player, monster) {
        if (!player || player.faction !== '邪修' || !player.evilCultivation) {
            return { total: 0, details: {} };
        }
        
        // 基础魂魄数量：1-3个
        let soulCount = Utils.randomInt(1, 3);
        
        // 境界加成
        const realmBonus = player.cultivation.realmIndex * 0.5;
        soulCount = Math.floor(soulCount + realmBonus);
        
        // 魂魄品质判定（基于怪物等级和随机）
        const qualityRoll = Math.random();
        let quality = 'common';
        let multiplier = 1;
        
        if (qualityRoll < 0.05) {
            // 5%概率史诗魂魄
            quality = 'epic';
            multiplier = 3;
        } else if (qualityRoll < 0.2) {
            // 15%概率稀有魂魄
            quality = 'rare';
            multiplier = 2;
        }
        
        // 计算各品质魂魄数量
        const epicSouls = quality === 'epic' ? soulCount : 0;
        const rareSouls = quality === 'rare' ? soulCount : 0;
        const commonSouls = quality === 'common' ? soulCount : 0;
        
        // 添加到魂魄池
        player.evilCultivation.souls += soulCount * multiplier;
        player.evilCultivation.soulQuality.common += commonSouls;
        player.evilCultivation.soulQuality.rare += rareSouls;
        player.evilCultivation.soulQuality.epic += epicSouls;
        
        Game.autoSave();
        
        return {
            total: soulCount * multiplier,
            details: {
                common: commonSouls,
                rare: rareSouls,
                epic: epicSouls,
                quality: quality
            }
        };
    },
    
    /**
     * 吞噬魂魄获得修为（支持品质系统）
     * @param {Object} player - 玩家数据
     * @param {number} soulCount - 吞噬魂魄数量
     * @param {string} quality - 魂魄品质 'common'/'rare'/'epic'
     * @returns {Object} 吞噬结果
     */
    devourSouls(player, soulCount = 1, quality = 'common') {
        if (!player || player.faction !== '邪修' || !player.evilCultivation) {
            return { success: false, message: '非邪修无法吞噬魂魄' };
        }
        
        // 检查对应品质的魂魄数量
        const availableSouls = player.evilCultivation.soulQuality[quality] || 0;
        if (availableSouls < soulCount) {
            return { 
                success: false, 
                message: `${quality === 'common' ? '普通' : quality === 'rare' ? '稀有' : '史诗'}魂魄不足！需要${soulCount}个，当前${availableSouls}个` 
            };
        }
        
        // 消耗魂魄
        player.evilCultivation.soulQuality[quality] -= soulCount;
        player.evilCultivation.souls -= soulCount * this.getQualityMultiplier(quality);
        
        // 计算获得的修为（基于品质）
        const baseExp = Utils.randomInt(50, 100);
        const multiplier = this.getQualityMultiplier(quality);
        const expGain = soulCount * baseExp * multiplier;
        
        const result = Game.gainExperience(expGain);
        
        // 记录吞噬历史
        if (!player.evilCultivation.devourHistory) {
            player.evilCultivation.devourHistory = [];
        }
        player.evilCultivation.devourHistory.push({
            souls: soulCount,
            quality: quality,
            exp: expGain,
            time: new Date().toISOString()
        });
        
        return {
            success: true,
            message: `吞噬${soulCount}个${quality === 'common' ? '普通' : quality === 'rare' ? '稀有' : '史诗'}魂魄，获得${expGain}点修为`,
            expGain: expGain,
            leveledUp: result.leveledUp,
            newRealm: result.newRealm
        };
    },
    
    /**
     * 获取魂魄品质倍数
     */
    getQualityMultiplier(quality) {
        const multipliers = {
            common: 1,
            rare: 2,
            epic: 3
        };
        return multipliers[quality] || 1;
    },
    
    /**
     * 检查是否可以开启第二人格
     * @param {Object} player - 玩家数据
     * @returns {Object} 检查结果
     */
    checkSecondPersonality(player) {
        if (!player || player.faction !== '邪修') {
            return { canOpen: false, reason: '非邪修无法开启第二人格' };
        }
        
        if (player.cultivation.realm !== '结丹期' || player.cultivation.level !== 10) {
            return { 
                canOpen: false, 
                reason: '需要结丹期Lv10才能开启第二人格' 
            };
        }
        
        if (player.evilCultivation.secondPersonality) {
            return { canOpen: false, reason: '第二人格已开启' };
        }
        
        return { canOpen: true, reason: '可以开启第二人格' };
    },
    
    /**
     * 开启第二人格
     * @param {Object} player - 玩家数据
     * @returns {Object} 开启结果
     */
    openSecondPersonality(player) {
        const checkResult = this.checkSecondPersonality(player);
        
        if (!checkResult.canOpen) {
            return { success: false, message: checkResult.reason };
        }
        
        // 消耗大量魂魄开启第二人格
        const soulCost = 100;
        if (player.evilCultivation.souls < soulCost) {
            return {
                success: false,
                message: `魂魄不足！需要${soulCost}个，当前${player.evilCultivation.souls}个`
            };
        }
        
        player.evilCultivation.souls -= soulCost;
        
        // 创建第二人格
        player.evilCultivation.secondPersonality = {
            name: '魔心',
            level: 1,
            fusionProgress: 0, // 融合进度 0-100
            risk: 20, // 融合风险 0-100
            attributes: {
                attack: player.attributes.attack * 0.5,
                defense: player.attributes.defense * 0.5
            }
        };
        
        Game.autoSave();
        
        return {
            success: true,
            message: '🌑 第二人格【魔心】已开启！融合之路开始...',
            secondPersonality: player.evilCultivation.secondPersonality
        };
    },
    
    /**
     * 融合第二人格
     * @param {Object} player - 玩家数据
     * @returns {Object} 融合结果
     */
    fuseSecondPersonality(player) {
        if (!player || !player.evilCultivation || !player.evilCultivation.secondPersonality) {
            return { success: false, message: '未开启第二人格' };
        }
        
        const sp = player.evilCultivation.secondPersonality;
        
        // 检查融合进度是否已满
        if (sp.fusionProgress >= 100) {
            return { success: false, message: '融合已完成！' };
        }
        
        // 消耗魂魄提升融合进度
        const soulCost = 50;
        if (player.evilCultivation.souls < soulCost) {
            return {
                success: false,
                message: `魂魄不足！需要${soulCost}个`
            };
        }
        
        player.evilCultivation.souls -= soulCost;
        
        // 提升融合进度（10-20%）
        const progressGain = Utils.randomInt(10, 20);
        sp.fusionProgress = Math.min(100, sp.fusionProgress + progressGain);
        
        // 增加融合风险
        sp.risk = Math.min(100, sp.risk + 5);
        
        Game.autoSave();
        
        // 检查是否融合完成
        if (sp.fusionProgress >= 100) {
            return this.completeFusion(player);
        }
        
        return {
            success: true,
            message: `融合进度提升至${sp.fusionProgress}%，风险${sp.risk}%`,
            fusionProgress: sp.fusionProgress,
            risk: sp.risk
        };
    },
    
    /**
     * 完成第二人格融合
     */
    completeFusion(player) {
        const sp = player.evilCultivation.secondPersonality;
        
        // 融合成功判定（基于风险）
        const successChance = 1 - (sp.risk / 100);
        const success = Utils.chance(successChance);
        
        if (success) {
            // 融合成功：属性大幅提升
            player.attributes.attack = Math.floor(player.attributes.attack * 1.8);
            player.attributes.defense = Math.floor(player.attributes.defense * 1.8);
            player.attributes.maxHp = Math.floor(player.attributes.maxHp * 1.5);
            player.attributes.hp = player.attributes.maxHp;
            
            // 清除第二人格
            player.evilCultivation.secondPersonality = null;
            
            Game.autoSave();
            
            return {
                success: true,
                fused: true,
                message: '🎉 第二人格融合成功！实力大幅提升！'
            };
        } else {
            // 融合失败：第一人格受损
            player.attributes.attack = Math.floor(player.attributes.attack * 0.7);
            player.attributes.defense = Math.floor(player.attributes.defense * 0.7);
            
            // 重置融合进度
            sp.fusionProgress = 0;
            sp.risk = 20;
            
            Game.autoSave();
            
            return {
                success: true,
                fused: false,
                message: '💥 融合失败！第一人格受损，属性降低30%',
                penalty: '属性降低30%'
            };
        }
    },
    
    /**
     * 检查是否可以夺舍
     * @param {Object} player - 玩家数据
     * @param {Object} targetMonster - 目标怪物
     * @returns {Object} 检查结果
     */
    checkPossession(player, targetMonster) {
        if (!player || player.faction !== '邪修') {
            return { canPossess: false, reason: '非邪修无法夺舍' };
        }
        
        if (!player.evilCultivation || !player.evilCultivation.secondPersonality) {
            return { 
                canPossess: false, 
                reason: '需要开启第二人格才能夺舍' 
            };
        }
        
        // 检查夺舍冷却
        if (player.evilCultivation.possessionCooldown > 0) {
            return {
                canPossess: false,
                reason: `夺舍冷却中，还需${player.evilCultivation.possessionCooldown}回合`
            };
        }
        
        // 检查怪物等级限制（不能高于自身2个大境界）
        const playerRealmIndex = player.cultivation.realmIndex;
        // 安全获取怪物境界索引，默认为0（练气期）
        const monsterRealmIndex = targetMonster.realm ? 
            this.getMonsterRealmIndex(targetMonster.realm) : 0;
        
        if (monsterRealmIndex > playerRealmIndex + 2) {
            return {
                canPossess: false,
                reason: '目标等级过高，无法夺舍'
            };
        }
        
        return { canPossess: true, reason: '可以夺舍' };
    },
    
    /**
     * 开始夺舍流程（简化版）
     * @param {Object} player - 玩家数据
     * @param {Object} targetMonster - 目标怪物
     * @returns {Object} 夺舍结果
     */
    startPossession(player, targetMonster) {
        const checkResult = this.checkPossession(player, targetMonster);
        
        if (!checkResult.canPossess) {
            return { success: false, message: checkResult.reason };
        }
        
        // 夺舍成功率计算
        const baseChance = 0.5; // 基础50%
        const levelDiff = targetMonster.level - player.cultivation.level;
        const levelPenalty = levelDiff * 0.05; // 每级差-5%
        const finalChance = Math.max(0.1, baseChance - levelPenalty);
        
        const success = Utils.chance(finalChance);
        
        if (success) {
            // 夺舍成功
            return this.completePossession(player, targetMonster);
        } else {
            // 夺舍失败
            return this.failPossession(player);
        }
    },
    
    /**
     * 夺舍成功
     */
    completePossession(player, targetMonster) {
        // 保留原属性的50% + 新肉体属性
        const oldAttack = player.attributes.attack;
        const oldDefense = player.attributes.defense;
        
        // 新肉体属性（基于怪物）
        const newAttack = targetMonster.attack || 50;
        const newDefense = targetMonster.defense || 20;
        
        // 合并属性
        player.attributes.attack = Math.floor(oldAttack * 0.5 + newAttack);
        player.attributes.defense = Math.floor(oldDefense * 0.5 + newDefense);
        player.attributes.maxHp = Math.floor((player.attributes.maxHp + targetMonster.hp) * 0.6);
        player.attributes.hp = player.attributes.maxHp;
        
        // 设置夺舍冷却时间（10回合）
        player.evilCultivation.possessionCooldown = 10;
        
        // 记录夺舍历史
        if (!player.evilCultivation.possessionHistory) {
            player.evilCultivation.possessionHistory = [];
        }
        player.evilCultivation.possessionHistory.push({
            target: targetMonster.name,
            time: new Date().toISOString(),
            success: true
        });
        
        Game.autoSave();
        
        return {
            success: true,
            possessed: true,
            message: `☠️ 夺舍成功！获得【${targetMonster.name}】的肉体！（冷却10回合）`,
            newAttributes: {
                attack: player.attributes.attack,
                defense: player.attributes.defense,
                hp: player.attributes.maxHp
            },
            cooldown: 10
        };
    },
    
    /**
     * 夺舍失败
     */
    failPossession(player) {
        // 损失50%修为
        const expLoss = Math.floor(player.cultivation.experience * 0.5);
        player.cultivation.experience = Math.max(0, player.cultivation.experience - expLoss);
        
        // HP降至1
        player.attributes.hp = 1;
        
        // 设置较短的冷却时间（5回合）
        player.evilCultivation.possessionCooldown = 5;
        
        // 记录失败
        if (!player.evilCultivation.possessionHistory) {
            player.evilCultivation.possessionHistory = [];
        }
        player.evilCultivation.possessionHistory.push({
            target: '未知',
            time: new Date().toISOString(),
            success: false
        });
        
        Game.autoSave();
        
        return {
            success: true,
            possessed: false,
            message: `💀 夺舍失败！修为大跌，损失${expLoss}点修为（冷却5回合）`,
            expLoss: expLoss,
            cooldown: 5
        };
    },
    
    /**
     * 获取夺舍预览信息
     * @param {Object} player - 玩家数据
     * @param {Object} targetMonster - 目标怪物
     * @returns {Object} 夺舍预览数据
     */
    getPossessionPreview(player, targetMonster) {
        if (!player || !targetMonster) {
            return null;
        }
        
        const oldAttack = player.attributes.attack;
        const oldDefense = player.attributes.defense;
        const oldMaxHp = player.attributes.maxHp;
        
        const newAttack = targetMonster.attack || 50;
        const newDefense = targetMonster.defense || 20;
        
        // 计算预期属性
        const previewAttack = Math.floor(oldAttack * 0.5 + newAttack);
        const previewDefense = Math.floor(oldDefense * 0.5 + newDefense);
        const previewMaxHp = Math.floor((oldMaxHp + targetMonster.hp) * 0.6);
        
        // 计算成功率
        const baseChance = 0.5;
        const levelDiff = targetMonster.level - player.cultivation.level;
        const levelPenalty = levelDiff * 0.05;
        const finalChance = Math.max(0.1, baseChance - levelPenalty);
        
        return {
            success: true,
            currentAttributes: {
                attack: oldAttack,
                defense: oldDefense,
                hp: oldMaxHp
            },
            predictedAttributes: {
                attack: previewAttack,
                defense: previewDefense,
                hp: previewMaxHp
            },
            successRate: (finalChance * 100).toFixed(0),
            cooldown: 10
        };
    },
    
    /**
     * 获取怪物境界索引
     */
    getMonsterRealmIndex(realmName) {
        const realms = ['练气期', '筑基期', '结丹期', '金丹期', '元婴期', '筠仙期'];
        return realms.indexOf(realmName);
    },
    
    /**
     * 获取邪修状态摘要
     */
    getStatusSummary(player) {
        if (!player || player.faction !== '邪修') {
            return null;
        }
        
        const evil = player.evilCultivation;
        const summary = {
            souls: evil.souls || 0,
            hasSecondPersonality: !!evil.secondPersonality
        };
        
        if (evil.secondPersonality) {
            summary.secondPersonality = {
                name: evil.secondPersonality.name,
                fusionProgress: evil.secondPersonality.fusionProgress,
                risk: evil.secondPersonality.risk
            };
        }
        
        return summary;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EvilCultivation;
}
