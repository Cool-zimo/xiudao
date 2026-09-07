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
    /**
     * 渡劫系统（通用版）
     * 任意境界达到 Lv10 圆满后均可渡劫，成功则晋升下一境界
     * 难度随境界递增，并受幸运、邪修业障影响
     * @param {Object} player - 玩家数据
     * @returns {Object} 渡劫结果
     */
    attemptTribulation(player) {
        if (!player || !player.cultivation) {
            return { success: false, reason: '无角色数据' };
        }

        const realms = Game.config.realms;
        const cur = player.cultivation;

        // 必须当前境界 Lv10 圆满
        if (cur.level < 10) {
            return {
                success: false,
                reason: `需达到【${cur.realm}】Lv10圆满方可渡劫`
            };
        }

        // 已至最高境界
        if (cur.realmIndex >= realms.length - 1) {
            return {
                success: false,
                reason: `已臻【${cur.realm}】极致，前路需自行证道`
            };
        }

        const nextRealm = realms[cur.realmIndex + 1];
        const info = this.getTribulationInfo(player);
        const success = Utils.chance(info.chance);

        if (success) {
            // 渡劫成功：晋升下一境界
            cur.realmIndex += 1;
            cur.realm = nextRealm.name;
            cur.level = 1;
            cur.experience = 0;

            // 关键修复：原版晋升后未重算升级所需经验，导致沿用旧境界数值
            Game.updateExpToNext();

            // 属性大幅提升
            Game.boostAttributesForRealm();

            return {
                success: true,
                message: `🎉 渡劫成功！晋升至【${cur.realm}】！`,
                type: 'success',
                newRealm: cur.realm,
                chance: info.chance
            };
        } else {
            // 渡劫失败：天劫反噬
            const expLoss = Math.floor(cur.expToNext * 0.3);
            cur.experience = Math.max(0, cur.experience - expLoss);

            // HP降至1
            player.attributes.hp = 1;

            return {
                success: false,
                message: `💥 渡劫失败！天劫反噬，损失${expLoss}点修为`,
                type: 'failure',
                expLoss: expLoss,
                chance: info.chance
            };
        }
    },

    /**
     * 判断当前是否可渡劫
     * @param {Object} player - 玩家数据
     * @returns {boolean}
     */
    canAttemptTribulation(player) {
        if (!player || !player.cultivation) return false;
        const cur = player.cultivation;
        return cur.level >= 10 && cur.realmIndex < Game.config.realms.length - 1;
    },

    /**
     * 获取渡劫预览信息（成功率、目标境界、影响因素）
     * @param {Object} player - 玩家数据
     * @returns {Object} 预览信息
     */
    getTribulationInfo(player) {
        const realms = Game.config.realms;
        const cur = player.cultivation;

        // 基础成功率随境界递减：60% 起，每高一境 -8%，下限 15%
        const baseChance = Math.max(0.15, 0.6 - cur.realmIndex * 0.08);
        const luckBonus = (player.attributes.luck - 10) * 0.01;

        // 邪修业障：吞噬魂魄越多，天劫越猛（上限 -20%）
        let karmaPenalty = 0;
        if (player.faction === '邪修' && player.evilCultivation) {
            karmaPenalty = Math.min(0.2, (player.evilCultivation.souls || 0) * 0.0005);
        }

        const chance = Math.max(0.05, Math.min(0.9, baseChance + luckBonus - karmaPenalty));

        return {
            chance: chance,
            chancePercent: (chance * 100).toFixed(1),
            fromRealm: cur.realm,
            toRealm: realms[cur.realmIndex + 1]?.name || null,
            luckBonus: luckBonus,
            karmaPenalty: karmaPenalty
        };
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
        // 修复：原版误用未定义变量 expPsi，导致修炼提示必定抛 ReferenceError
        return `📈 修炼进度：${expPercent}%，继续修炼以提升境界`;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cultivation;
}
