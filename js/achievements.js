/**
 * 🏆 修仙模拟器 - 成就系统
 * 定义成就列表、检查逻辑、解锁通知
 */

const Achievements = {
    // 成就定义
    LIST: {
        first_cultivation: {
            id: 'first_cultivation',
            name: '初入仙途',
            desc: '完成第一次修炼',
            icon: '🧘',
            rarity: 'common',
            check: (player, stats) => stats.totalCultivations >= 1
        },
        cultivation_10: {
            id: 'cultivation_10',
            name: '勤奋修士',
            desc: '累计修炼10次',
            icon: '💪',
            rarity: 'common',
            check: (player, stats) => stats.totalCultivations >= 10
        },
        cultivation_100: {
            id: 'cultivation_100',
            name: '修炼狂人',
            desc: '累计修炼100次',
            icon: '🔥',
            rarity: 'rare',
            check: (player, stats) => stats.totalCultivations >= 100
        },
        first_battle: {
            id: 'first_battle',
            name: '初战告捷',
            desc: '赢得第一场战斗',
            icon: '⚔️',
            rarity: 'common',
            check: (player, stats) => stats.battlesWon >= 1
        },
        battles_10: {
            id: 'battles_10',
            name: '战斗老手',
            desc: '赢得10场战斗',
            icon: '🗡️',
            rarity: 'common',
            check: (player, stats) => stats.battlesWon >= 10
        },
        battles_50: {
            id: 'battles_50',
            name: '百战不殆',
            desc: '赢得50场战斗',
            icon: '🏅',
            rarity: 'rare',
            check: (player, stats) => stats.battlesWon >= 50
        },
        realm_zhuji: {
            id: 'realm_zhuji',
            name: '筑基成功',
            desc: '突破到筑基期',
            icon: '🏔️',
            rarity: 'rare',
            check: (player) => {
                const realms = ['练气期', '筑基期', '结丹期', '金丹期', '元婴期', '筠仙期'];
                return realms.indexOf(player.cultivation?.realm) >= 1;
            }
        },
        realm_jiedan: {
            id: 'realm_jiedan',
            name: '结丹大成',
            desc: '突破到结丹期',
            icon: '🔮',
            rarity: 'epic',
            check: (player) => {
                const realms = ['练气期', '筑基期', '结丹期', '金丹期', '元婴期', '筠仙期'];
                return realms.indexOf(player.cultivation?.realm) >= 2;
            }
        },
        realm_jindan: {
            id: 'realm_jindan',
            name: '金丹大道',
            desc: '突破到金丹期',
            icon: '✨',
            rarity: 'epic',
            check: (player) => {
                const realms = ['练气期', '筑基期', '结丹期', '金丹期', '元婴期', '筠仙期'];
                return realms.indexOf(player.cultivation?.realm) >= 3;
            }
        },
        realm_yuanying: {
            id: 'realm_yuanying',
            name: '元婴出窍',
            desc: '突破到元婴期',
            icon: '👶',
            rarity: 'legendary',
            check: (player) => {
                const realms = ['练气期', '筑基期', '结丹期', '金丹期', '元婴期', '筠仙期'];
                return realms.indexOf(player.cultivation?.realm) >= 4;
            }
        },
        first_forge: {
            id: 'first_forge',
            name: '炼器新手',
            desc: '完成第一次炼器',
            icon: '🔨',
            rarity: 'common',
            check: (player, stats) => stats.itemsForged >= 1
        },
        first_alchemy: {
            id: 'first_alchemy',
            name: '丹道入门',
            desc: '炼制第一炉丹药',
            icon: '⚗️',
            rarity: 'common',
            check: (player, stats) => stats.pillsMade >= 1
        },
        first_death: {
            id: 'first_death',
            name: '死而复生',
            desc: '第一次战斗失败',
            icon: '💀',
            rarity: 'common',
            check: (player, stats) => stats.battlesLost >= 1
        },
        rich: {
            id: 'rich',
            name: '小富即安',
            desc: '拥有100灵石',
            icon: '💰',
            rarity: 'common',
            check: (player) => (player.gold || 0) >= 100
        },
        collector: {
            id: 'collector',
            name: '收藏家',
            desc: '背包中有20件物品',
            icon: '🎒',
            rarity: 'rare',
            check: (player) => {
                const inv = player.inventory || [];
                return inv.length >= 20;
            }
        },
        evil_path: {
            id: 'evil_path',
            name: '踏入邪途',
            desc: '选择邪修阵营',
            icon: '😈',
            rarity: 'rare',
            // 注意：阵营实际取值为 '正道' / '邪修'，此前误判 'evil' 导致该成就永不可解锁
            check: (player) => player.faction === '邪修'
        },
        first_soul: {
            id: 'first_soul',
            name: '噬魂者',
            desc: '吞噬第一个魂魄',
            icon: '👻',
            rarity: 'rare',
            check: (player, stats) => stats.soulsDevoured >= 1
        },
        cloud_master: {
            id: 'cloud_master',
            name: '控云大师',
            desc: '学习第一个控云法术',
            icon: '☁️',
            rarity: 'rare',
            check: (player) => {
                const spells = player.cloudSpells || [];
                return spells.length >= 1;
            }
        },
        play_10min: {
            id: 'play_10min',
            name: '潜心修炼',
            desc: '游戏时长达到10分钟',
            icon: '⏰',
            rarity: 'common',
            check: (player, stats) => stats.playTime >= 600
        },
        play_1hour: {
            id: 'play_1hour',
            name: '修仙不倦',
            desc: '游戏时长达到1小时',
            icon: '⌛',
            rarity: 'epic',
            check: (player, stats) => stats.playTime >= 3600
        }
    },

    // 稀有度颜色
    RARITY_COLORS: {
        common: '#9ca3af',
        rare: '#3b82f6',
        epic: '#8b5cf6',
        legendary: '#f59e0b'
    },

    RARITY_NAMES: {
        common: '普通',
        rare: '稀有',
        epic: '史诗',
        legendary: '传说'
    },

    /**
     * 初始化玩家的成就数据
     */
    initPlayer(player) {
        if (!player.achievements) {
            player.achievements = {
                unlocked: [],
                unlockedAt: {}
            };
        }
        if (!player.stats) {
            player.stats = {
                totalCultivations: 0,
                battlesWon: 0,
                battlesLost: 0,
                itemsForged: 0,
                pillsMade: 0,
                soulsDevoured: 0,
                playTime: 0
            };
        }
    },

    /**
     * 检查并解锁成就
     * @param {Object} player - 玩家数据
     * @returns {Array} 新解锁的成就列表
     */
    checkAchievements(player) {
        this.initPlayer(player);
        const newlyUnlocked = [];
        const stats = player.stats;

        for (const [id, achievement] of Object.entries(this.LIST)) {
            if (player.achievements.unlocked.includes(id)) continue;
            try {
                if (achievement.check(player, stats)) {
                    player.achievements.unlocked.push(id);
                    player.achievements.unlockedAt[id] = new Date().toISOString();
                    newlyUnlocked.push(achievement);
                }
            } catch (e) {
                console.debug('成就检查失败:', id, e.message);
            }
        }

        return newlyUnlocked;
    },

    /**
     * 记录统计数据
     */
    recordStat(player, stat, amount = 1) {
        this.initPlayer(player);
        if (player.stats[stat] !== undefined) {
            player.stats[stat] += amount;
        }
    },

    /**
     * 获取已解锁成就数量
     */
    getUnlockedCount(player) {
        return player.achievements?.unlocked?.length || 0;
    },

    /**
     * 获取总成就数量
     */
    getTotalCount() {
        return Object.keys(this.LIST).length;
    },

    /**
     * 获取成就进度百分比
     */
    getProgress(player) {
        return Math.round((this.getUnlockedCount(player) / this.getTotalCount()) * 100);
    }
};
