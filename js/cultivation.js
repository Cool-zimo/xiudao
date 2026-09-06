/**
 * 🌿 网页修仙模拟器 - 修炼系统扩展
 * 处理渡劫、突破等高级修炼功能
 */

const Cultivation = {
    /**
     * 渡劫系统
     * @param {Object} player - 玩家数据
     * @returns {Object} 渡劫结果
     */
    attemptTribulation(player) {
        if (!player || player.cultivation.realm !== '筑基期' || player.cultivation.level !== 10) {
            return { 
                success: false, 
                reason: '只有筑基期Lv10才能渡劫' 
            };
        }
        
        // 渡劫成功率计算
        const baseChance = 0.6; // 基础60%成功率
        const luckBonus = (player.attributes.luck - 10) * 0.01; // 幸运加成
        const finalChance = Math.min(0.9, baseChance + luckBonus);
        
        const success = Utils.chance(finalChance);
        
        if (success) {
            // 渡劫成功
            player.cultivation.realmIndex = 2;
            player.cultivation.realm = '结丹期';
            player.cultivation.level = 1;
            player.cultivation.experience = 0;
            
            // 属性大幅提升
            Game.boostAttributesForRealm();
            
            return {
                success: true,
                message: '🎉 渡劫成功！晋升至【结丹期】！',
                type: 'success'
            };
        } else {
            // 渡劫失败
            const expLoss = Math.floor(player.cultivation.expToNext * 0.3);
            player.cultivation.experience = Math.max(0, player.cultivation.experience - expLoss);
            
            // HP降至1
            player.attributes.hp = 1;
            
            return {
                success: false,
                message: `💥 渡劫失败！修为受损，损失${expLoss}点修为`,
                type: 'failure',
                expLoss: expLoss
            };
        }
    },
    
    /**
     * 计算修炼速度倍率
     * @param {Object} player - 玩家数据
     * @returns {number} 修炼倍率
     */
    calculateCultivationSpeed(player) {
        let multiplier = 1.0;
        
        // 天赋加成
        if (player.talent === '运气') {
            multiplier += 0.2; // 运气天赋+20%修炼速度
        }
        
        // 境界加成（高境界修炼更快）
        const realmBonus = player.cultivation.realmIndex * 0.1;
        multiplier += realmBonus;
        
        return multiplier;
    },
    
    /**
     * 获取境界名称列表
     * @returns {Array} 境界名称数组
     */
    getRealmList() {
        return [
            '练气期',
            '筑基期',
            '结丹期',
            '金丹期',
            '元婴期',
            '筠仙期'
        ];
    },
    
    /**
     * 获取当前境界的下一个境界
     * @param {string} currentRealm - 当前境界
     * @returns {string|null} 下一境界名称
     */
    getNextRealm(currentRealm) {
        const realms = this.getRealmList();
        const index = realms.indexOf(currentRealm);
        
        if (index === -1 || index >= realms.length - 1) {
            return null;
        }
        
        return realms[index + 1];
    },
    
    /**
     * 计算突破所需总经验
     * @param {number} realmIndex - 境界索引
     * @param {number} level - 等级
     * @returns {number} 所需经验
     */
    calculateTotalExpNeeded(realmIndex, level) {
        const realmConfig = Game.config.realms[realmIndex];
        if (!realmConfig) return 0;
        
        let totalExp = 0;
        for (let i = 0; i < level; i++) {
            totalExp += Math.floor(realmConfig.baseExp * Math.pow(1.1, i));
        }
        
        return totalExp;
    },
    
    /**
     * 获取修炼提示
     * @param {Object} player - 玩家数据
     * @returns {string} 提示信息
     */
    getCultivationHint(player) {
        if (!player) return '';
        
        const currentRealm = player.cultivation.realm;
        const currentLevel = player.cultivation.level;
        
        if (currentLevel >= 10) {
            if (currentRealm === '筑基期') {
                return '⚠️ 已达到筑基期圆满，需要渡劫才能突破至结丹期';
            } else if (currentRealm === '结丹期' && player.faction === '邪修') {
                return '☠️ 邪修无法直接结婴，需开启第二人格或夺舍他人';
            } else {
                const nextRealm = this.getNextRealm(currentRealm);
                return `✨ 已达成突破条件，可晋升至【${nextRealm}】`;
            }
        }
        
        const expPercent = (player.cultivation.experience / player.cultivation.expToNext * 100).toFixed(1);
        return `📈 修炼进度：${expPsi}%，继续修炼以提升境界`;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cultivation;
}
