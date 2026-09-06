/**
 * 🌿 网页修仙模拟器 - 存档系统
 * 处理localStorage、Base64导出导入、Hash校验等
 */

const SaveLoad = {
    // 存档键名
    SAVE_KEY: 'xiudao_save',
    AUTO_SAVE_KEY: 'xiudao_autosave',
    BACKUP_KEYS: ['xiudao_backup_1', 'xiudao_backup_2', 'xiudao_backup_3'],
    
    /**
     * 手动保存游戏
     * @param {Object} player - 玩家数据
     * @returns {boolean} 是否成功
     */
    manualSave(player) {
        if (!player) return false;
        
        try {
            // 创建备份（轮换）
            this.createBackup();
            
            // 保存当前存档
            player.metadata.lastSaveTime = new Date().toISOString();
            Utils.saveToStorage(this.SAVE_KEY, player);
            
            console.log('✅ 手动保存成功');
            return true;
        } catch (error) {
            console.error('❌ 保存失败:', error);
            return false;
        }
    },
    
    /**
     * 创建备份（保留最近3个）
     */
    createBackup() {
        const currentSave = Utils.loadFromStorage(this.SAVE_KEY);
        if (!currentSave) return;
        
        // 轮换备份
        const backup3 = Utils.loadFromStorage(this.BACKUP_KEYS[2]);
        const backup2 = Utils.loadFromStorage(this.BACKUP_KEYS[1]);
        const backup1 = Utils.loadFromStorage(this.BACKUP_KEYS[0]);
        
        if (backup1) Utils.saveToStorage(this.BACKUP_KEYS[1], backup1);
        if (backup2) Utils.saveToStorage(this.BACKUP_KEYS[2], backup2);
        Utils.saveToStorage(this.BACKUP_KEYS[0], currentSave);
    },
    
    /**
     * 从备份恢复
     * @param {number} backupIndex - 备份索引 (0-2)
     * @returns {Object|null} 恢复的数据
     */
    restoreFromBackup(backupIndex) {
        if (backupIndex < 0 || backupIndex > 2) {
            console.error('无效的备份索引');
            return null;
        }
        
        const backupData = Utils.loadFromStorage(this.BACKUP_KEYS[backupIndex]);
        if (backupData) {
            Utils.saveToStorage(this.SAVE_KEY, backupData);
            console.log(`✅ 已从备份${backupIndex + 1}恢复`);
            return backupData;
        }
        
        return null;
    },
    
    /**
     * 导出存档为口令
     * @param {Object} player - 玩家数据
     * @param {string} password - 密码（可选）
     * @returns {string} 存档口令
     */
    exportToToken(player, password = '') {
        if (!player) return '';
        
        // 添加导出元数据
        const exportData = Utils.deepClone(player);
        exportData.metadata.exportCount = (exportData.metadata.exportCount || 0) + 1;
        exportData.metadata.lastExportTime = new Date().toISOString();
        
        // 如果有密码，添加到数据中
        if (password) {
            exportData._passwordHash = Utils.sha256(password + 'XIUDAO_SALT');
        }
        
        return Utils.exportSave(exportData, password);
    },
    
    /**
     * 从口令导入存档
     * @param {string} token - 存档口令
     * @param {string} password - 密码（可选）
     * @returns {Object|null} 导入的数据
     */
    importFromToken(token, password = '') {
        const data = Utils.importSave(token, password);
        
        if (!data) {
            return null;
        }
        
        // 验证数据结构
        if (!this.validateSaveData(data)) {
            console.error('❌ 存档数据格式错误');
            return null;
        }
        
        console.log('✅ 导入成功');
        return data;
    },
    
    /**
     * 获取存档预览信息
     * @param {string} token - 存档口令
     * @returns {Object|null} 预览信息
     */
    getSavePreview(token) {
        return Utils.getPreviewInfo(token);
    },
    
    /**
     * 验证存档数据完整性
     * @param {Object} data - 存档数据
     * @returns {boolean} 是否有效
     */
    validateSaveData(data) {
        // 检查必需字段
        const requiredFields = ['player', 'version'];
        
        for (const field of requiredFields) {
            if (!(field in data)) {
                console.error(`缺少必需字段: ${field}`);
                return false;
            }
        }
        
        // 检查玩家数据
        const player = data.player;
        const playerFields = ['name', 'faction', 'profession', 'talent', 'cultivation', 'attributes'];
        
        for (const field of playerFields) {
            if (!(field in player)) {
                console.error(`玩家数据缺少字段: ${field}`);
                return false;
            }
        }
        
        // 检查境界数据
        const cultivation = player.cultivation;
        if (!cultivation.realm || !cultivation.level || !cultivation.experience) {
            console.error('境界数据不完整');
            return false;
        }
        
        return true;
    },
    
    /**
     * 清除所有存档
     */
    clearAllSaves() {
        Utils.removeFromStorage(this.SAVE_KEY);
        Utils.removeFromStorage(this.AUTO_SAVE_KEY);
        
        this.BACKUP_KEYS.forEach(key => {
            Utils.removeFromStorage(key);
        });
        
        console.log('🗑️ 已清除所有存档');
    },
    
    /**
     * 获取存档信息
     * @returns {Object} 存档信息
     */
    getSaveInfo() {
        const mainSave = Utils.loadFromStorage(this.SAVE_KEY);
        const autoSave = Utils.loadFromStorage(this.AUTO_SAVE_KEY);
        
        const info = {
            hasMainSave: !!mainSave,
            hasAutoSave: !!autoSave,
            backups: []
        };
        
        // 检查备份
        this.BACKUP_KEYS.forEach((key, index) => {
            const backup = Utils.loadFromStorage(key);
            if (backup) {
                info.backups.push({
                    index: index + 1,
                    time: backup.metadata?.lastSaveTime || '未知'
                });
            }
        });
        
        // 主存档信息
        if (mainSave) {
            info.mainSave = {
                name: mainSave.name,
                realm: mainSave.cultivation?.realm || '未知',
                level: mainSave.cultivation?.level || 0,
                lastSaveTime: mainSave.metadata?.lastSaveTime || '未知'
            };
        }
        
        return info;
    },
    
    /**
     * 压缩存档数据（简化版）
     * @param {Object} data - 原始数据
     * @returns {string} 压缩后的字符串
     */
    compressSave(data) {
        // 移除不必要的字段
        const compressed = Utils.deepClone(data);
        
        // 可以在此添加更多压缩逻辑
        // 例如：移除默认值、缩短键名等
        
        return JSON.stringify(compressed);
    },
    
    /**
     * 解压缩存档数据
     * @param {string} compressed - 压缩的字符串
     * @returns {Object} 解压后的数据
     */
    decompressSave(compressed) {
        try {
            return JSON.parse(compressed);
        } catch (error) {
            console.error('解压失败:', error);
            return null;
        }
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaveLoad;
}
