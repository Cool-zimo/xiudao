/**
 * 🌿 网页修仙模拟器 - 游戏核心状态管理
 * 管理玩家数据、游戏状态、配置等
 */

const Game = {
    // 游戏版本
    version: '1.0.0',
    
    // 游戏状态
    state: {
        isPlaying: false,
        currentScreen: 'home-screen',
        startTime: null,
        playTime: 0,
        lastSaveTime: null
    },
    
    // 玩家数据
    player: null,
    
    // 游戏配置
    config: {
        // 境界配置
        realms: [
            { name: '练气期', maxLevel: 10, baseExp: 100 },
            { name: '筑基期', maxLevel: 10, baseExp: 2000 },
            { name: '结丹期', maxLevel: 10, baseExp: 20000 },
            { name: '金丹期', maxLevel: 10, baseExp: 200000 },
            { name: '元婴期', maxLevel: 10, baseExp: 1000000 },
            { name: '筠仙期', maxLevel: 10, baseExp: 5000000 }
        ],
        
        // 职业配置
        professions: ['锻造师', '召唤师', '暗器师'],
        
        // 天赋配置
        talents: ['运气', '肉盾', '远攻', '控云'],
        
        // 阵营配置
        factions: ['正道', '邪修']
    },
    
    /**
     * 初始化游戏
     */
    init() {
        console.log('🌿 网页修仙模拟器 v' + this.version);
        this.loadAutoSave();
        this.startPlayTimeCounter();
    },
    
    /**
     * 创建新角色
     * @param {Object} characterData - 角色数据
     */
    createCharacter(characterData) {
        const { name, faction, profession, talent } = characterData;
        
        // 基础属性计算
        let baseHp = 100;
        let baseMp = 50;
        let baseAttack = 10;
        let baseDefense = 5;
        let baseLuck = 10;
        
        // 天赋加成
        if (talent === '肉盾') {
            baseHp = 150;
            baseDefense = 8;
        } else if (talent === '远攻') {
            baseAttack = 15;
        } else if (talent === '运气') {
            baseLuck = 20;
        }
        
        // 构建玩家数据
        this.player = {
            name: name,
            faction: faction,
            profession: profession,
            talent: talent,
            
            cultivation: {
                realmIndex: 0,
                realm: '练气期',
                level: 1,
                experience: 0,
                expToNext: 100
            },
            
            attributes: {
                hp: baseHp,
                maxHp: baseHp,
                mp: baseMp,
                maxMp: baseMp,
                attack: baseAttack,
                defense: baseDefense,
                speed: 10,
                luck: baseLuck
            },
            
            pet: null,
            inventory: [],
            
            evilCultivation: faction === '邪修' ? {
                souls: 0,
                secondPersonality: null,
                possessionTarget: null,
                possessionCooldown: 0, // 夺舍冷却回合数
                soulQuality: {         // 魂魄品质系统
                    common: 0,    // 普通魂魄
                    rare: 0,      // 稀有魂魄
                    epic: 0       // 史诗魂魄
                }
            } : null,
            
            metadata: {
                createTime: new Date().toISOString(),
                lastSaveTime: new Date().toISOString(),
                playTime: 0
            }
        };
        
        this.state.isPlaying = true;
        this.state.startTime = Date.now();
        
        // 自动保存
        this.autoSave();
        
        console.log(`✨ 角色创建成功: ${name} (${faction} ${profession})`);
    },
    
    /**
     * 获得经验值
     * @param {number} exp - 经验值
     * @returns {Object} { leveledUp: boolean, newRealm: string }
     */
    gainExperience(exp) {
        if (!this.player) return { leveledUp: false };
        
        this.player.cultivation.experience += exp;
        
        let leveledUp = false;
        let newRealm = null;
        
        // 检查是否升级
        while (this.player.cultivation.experience >= this.player.cultivation.expToNext) {
            this.player.cultivation.experience -= this.player.cultivation.expToNext;
            this.player.cultivation.level++;
            leveledUp = true;
            
            // 检查是否突破境界
            if (this.player.cultivation.level > 10) {
                const nextRealmIndex = this.player.cultivation.realmIndex + 1;
                if (nextRealmIndex < this.config.realms.length) {
                    this.player.cultivation.realmIndex = nextRealmIndex;
                    this.player.cultivation.realm = this.config.realms[nextRealmIndex].name;
                    this.player.cultivation.level = 1;
                    newRealm = this.player.cultivation.realm;
                    
                    // 新境界属性提升
                    this.boostAttributesForRealm();
                } else {
                    this.player.cultivation.level = 10;
                }
            }
            
            // 更新下一级所需经验
            this.updateExpToNext();
        }
        
        // 自动保存
        if (leveledUp) {
            this.autoSave();
        }
        
        return { leveledUp, newRealm };
    },
    
    /**
     * 更新升级所需经验
     */
    updateExpToNext() {
        const realmConfig = this.config.realms[this.player.cultivation.realmIndex];
        const baseExp = realmConfig.baseExp;
        const level = this.player.cultivation.level;
        
        // 经验曲线：每级递增10%
        this.player.cultivation.expToNext = Math.floor(baseExp * Math.pow(1.1, level - 1));
    },
    
    /**
     * 境界突破时属性提升
     */
    boostAttributesForRealm() {
        const boostRate = 1.5; // 属性提升倍率
        
        this.player.attributes.maxHp = Math.floor(this.player.attributes.maxHp * boostRate);
        this.player.attributes.hp = this.player.attributes.maxHp;
        this.player.attributes.maxMp = Math.floor(this.player.attributes.maxMp * boostRate);
        this.player.attributes.mp = this.player.attributes.maxMp;
        this.player.attributes.attack = Math.floor(this.player.attributes.attack * boostRate);
        this.player.attributes.defense = Math.floor(this.player.attributes.defense * boostRate);
    },
    
    /**
     * 受到伤害
     * @param {number} damage - 伤害值
     * @returns {boolean} 是否死亡
     */
    takeDamage(damage) {
        if (!this.player) return false;
        
        this.player.attributes.hp -= damage;
        
        if (this.player.attributes.hp <= 0) {
            this.player.attributes.hp = 0;
            return true; // 死亡
        }
        
        return false;
    },
    
    /**
     * 恢复生命
     * @param {number} amount - 恢复量
     */
    heal(amount) {
        if (!this.player) return;
        
        this.player.attributes.hp = Math.min(
            this.player.attributes.hp + amount,
            this.player.attributes.maxHp
        );
    },
    
    /**
     * 恢复法力
     * @param {number} amount - 恢复量
     */
    restoreMp(amount) {
        if (!this.player) return;
        
        this.player.attributes.mp = Math.min(
            this.player.attributes.mp + amount,
            this.player.attributes.maxMp
        );
    },
    
    /**
     * 添加物品到背包
     * @param {Object} item - 物品对象
     */
    addItem(item) {
        if (!this.player) return;
        
        // 检查是否已有相同物品
        const existingItem = this.player.inventory.find(i => i.id === item.id);
        
        if (existingItem) {
            existingItem.count = (existingItem.count || 1) + (item.count || 1);
        } else {
            this.player.inventory.push({ ...item, count: item.count || 1 });
        }
        
        this.autoSave();
    },
    
    /**
     * 使用物品
     * @param {string} itemId - 物品ID
     * @returns {boolean} 是否成功
     */
    useItem(itemId) {
        if (!this.player) return false;
        
        const itemIndex = this.player.inventory.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return false;
        
        const item = this.player.inventory[itemIndex];
        
        // 根据物品类型执行效果
        if (item.type === '丹药') {
            if (item.effect.type === 'exp') {
                this.gainExperience(item.effect.value);
            } else if (item.effect.type === 'heal') {
                this.heal(item.effect.value);
            }
        }
        
        // 减少数量
        item.count--;
        if (item.count <= 0) {
            this.player.inventory.splice(itemIndex, 1);
        }
        
        this.autoSave();
        return true;
    },
    
    /**
     * 自动保存
     */
    autoSave() {
        if (!this.player) return;
        
        this.player.metadata.lastSaveTime = new Date().toISOString();
        Utils.saveToStorage('xiudao_autosave', this.player);
        this.state.lastSaveTime = Date.now();
    },
    
    /**
     * 加载自动存档
     */
    loadAutoSave() {
        const savedData = Utils.loadFromStorage('xiudao_autosave');
        if (savedData) {
            this.player = savedData;
            this.state.isPlaying = true;
            console.log('✅ 已加载自动存档');
            return true;
        }
        return false;
    },
    
    /**
     * 开始游戏时间计数
     */
    startPlayTimeCounter() {
        setInterval(() => {
            if (this.state.isPlaying) {
                this.state.playTime++;
                
                if (this.player) {
                    this.player.metadata.playTime = this.state.playTime;
                }
                
                // 每5分钟自动保存
                if (this.state.playTime % 300 === 0) {
                    this.autoSave();
                }
            }
        }, 1000);
    },
    
    /**
     * 获取当前境界配置
     * @returns {Object} 境界配置
     */
    getCurrentRealmConfig() {
        if (!this.player) return null;
        return this.config.realms[this.player.cultivation.realmIndex];
    },
    
    /**
     * 重置游戏
     */
    reset() {
        this.player = null;
        this.state.isPlaying = false;
        this.state.playTime = 0;
        this.state.startTime = null;
        Utils.removeFromStorage('xiudao_autosave');
        console.log('🔄 游戏已重置');
    }
};

// 导出游戏对象
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
}
