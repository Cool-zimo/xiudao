/**
 * 🌿 网页修仙模拟器 - 工具函数库
 * 提供加密、随机数、格式化等通用功能
 */

const Utils = {
    /**
     * 生成UUID
     * @returns {string} UUID字符串
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * 生成随机整数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 随机整数
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * 随机从数组中选择一项
     * @param {Array} array - 数组
     * @returns {*} 随机元素
     */
    randomChoice(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * 概率判定
     * @param {number} chance - 概率 (0-1)
     * @returns {boolean} 是否命中
     */
    chance(chance) {
        return Math.random() < chance;
    },

    /**
     * SHA256加密
     * @param {string} str - 待加密字符串
     * @returns {string} Hash值
     */
    sha256(str) {
        return CryptoJS.SHA256(str).toString();
    },

    /**
     * Base64编码
     * @param {string} str - 待编码字符串
     * @returns {string} Base64字符串
     */
    base64Encode(str) {
        return btoa(unescape(encodeURIComponent(str)));
    },

    /**
     * Base64解码
     * @param {string} base64 - Base64字符串
     * @returns {string} 原始字符串
     */
    base64Decode(base64) {
        return decodeURIComponent(escape(atob(base64)));
    },

    /**
     * 导出存档口令
     * @param {Object} gameData - 游戏数据
     * @param {string} password - 密码（可选）
     * @returns {string} 存档口令
     */
    exportSave(gameData, password = '') {
        const jsonStr = JSON.stringify(gameData);
        const hash = this.sha256(jsonStr + password);
        const base64 = this.base64Encode(jsonStr);
        return `XIUDAO|v1.0|${base64}|${hash}`;
    },

    /**
     * 导入存档口令
     * @param {string} token - 存档口令
     * @param {string} password - 密码（可选）
     * @returns {Object|null} 游戏数据，失败返回null
     */
    importSave(token, password = '') {
        try {
            const parts = token.split('|');
            if (parts.length !== 4 || parts[0] !== 'XIUDAO' || parts[1] !== 'v1.0') {
                throw new Error('无效的存档格式');
            }

            const base64 = parts[2];
            const hash = parts[3];
            const jsonStr = this.base64Decode(base64);
            const expectedHash = this.sha256(jsonStr + password);

            if (hash !== expectedHash) {
                throw new Error('存档损坏或密码错误');
            }

            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('导入存档失败:', error);
            return null;
        }
    },

    /**
     * 获取预览信息（无密码时）
     * @param {string} token - 存档口令
     * @returns {Object|null} 预览信息
     */
    getPreviewInfo(token) {
        try {
            const parts = token.split('|');
            if (parts.length !== 4) return null;

            const base64 = parts[2];
            const jsonStr = this.base64Decode(base64);
            const data = JSON.parse(jsonStr);

            return {
                name: data.player?.name || '未知',
                realm: data.player?.cultivation?.realm || '未知',
                profession: data.player?.profession || '未知',
                faction: data.player?.faction || '未知',
                petCount: data.pet ? 1 : 0,
                hasPassword: !!data._password
            };
        } catch (error) {
            return null;
        }
    },

    /**
     * 格式化时间
     * @param {number} seconds - 秒数
     * @returns {string} 格式化后的时间字符串
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}小时${minutes}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟${secs}秒`;
        } else {
            return `${secs}秒`;
        }
    },

    /**
     * 格式化数字（添加千位分隔符）
     * @param {number} num - 数字
     * @returns {string} 格式化后的字符串
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * 深拷贝对象
     * @param {Object} obj - 待拷贝对象
     * @returns {Object} 拷贝后的对象
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * 延迟执行
     * @param {number} ms - 毫秒数
     * @returns {Promise} Promise对象
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 本地存储保存
     * @param {string} key - 键名
     * @param {*} value - 值
     */
    saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('保存失败:', error);
            return false;
        }
    },

    /**
     * 本地存储读取
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @returns {*} 存储的值或默认值
     */
    loadFromStorage(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error('读取失败:', error);
            return defaultValue;
        }
    },

    /**
     * 从本地存储删除
     * @param {string} key - 键名
     */
    removeFromStorage(key) {
        localStorage.removeItem(key);
    },

    /**
     * 计算伤害值
     * @param {number} attack - 攻击力
     * @param {number} defense - 防御力
     * @param {number} luck - 幸运值（暴击率）
     * @returns {Object} { damage, isCritical }
     */
    calculateDamage(attack, defense, luck = 10) {
        let damage = Math.max(1, attack - defense);
        const isCritical = this.chance(luck / 100);
        
        if (isCritical) {
            damage = Math.floor(damage * 2);
        }
        
        return { damage, isCritical };
    },

    /**
     * 生成随机怪物属性
     * @param {string} realm - 境界
     * @param {number} level - 等级
     * @returns {Object} 怪物属性
     */
    generateMonsterStats(realm, level) {
        const realmMultiplier = {
            '练气期': 1,
            '筑基期': 3,
            '结丹期': 8,
            '金丹期': 20,
            '元婴期': 50,
            '筠仙期': 100
        };

        const multiplier = realmMultiplier[realm] || 1;
        const baseHp = 50 * multiplier;
        const baseAttack = 8 * multiplier;
        const baseDefense = 3 * multiplier;

        return {
            hp: Math.floor(baseHp * (1 + level * 0.1)),
            maxHp: Math.floor(baseHp * (1 + level * 0.1)),
            attack: Math.floor(baseAttack * (1 + level * 0.1)),
            defense: Math.floor(baseDefense * (1 + level * 0.1)),
            expReward: Math.floor(20 * multiplier * level)
        };
    },

    /**
     * 日志类型枚举
     */
    LogType: {
        NORMAL: 'normal',
        COMBAT: 'combat',
        REWARD: 'reward',
        LEVELUP: 'levelup',
        DANGER: 'danger'
    }
};

// 导出工具函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
