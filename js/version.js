/**
 * 🌿 修仙模拟器 - 版本号系统
 *
 * 与 github_drive 保持一致的 APP_VERSION 结构（由 release.py 自动生成）：
 *   internalVersion  内部版本号（纯数字计数器，每次更新 +1）
 *   formalVersion    外部版本号 x.y.z（大版本.小版本.补丁）
 *   displayVersion   展示用版本号 vX.Y.Z
 *
 * 在此基础上保留修仙项目特有的 versionChain（YYYYMMDD-内部版本-v外部版本）
 */

// 版本信息 - 由 release.py 自动生成（结构与 github_drive/js/version.js 对齐）
const APP_VERSION = {
    internalVersion: '3',
    formalVersion: '1.1.0',
    displayVersion: 'v1.1.0'
};

const Version = {
    // ==================== 与 github_drive 对齐的字段 ====================
    get internalVersion() {
        return parseInt(APP_VERSION.internalVersion, 10);
    },

    get formalVersion() {
        return APP_VERSION.formalVersion;
    },

    get displayVersion() {
        return APP_VERSION.displayVersion;
    },

    // ==================== 分段版本号（便于程序化读取） ====================
    get major() {
        return parseInt(APP_VERSION.formalVersion.split('.')[0], 10) || 0;
    },

    get minor() {
        return parseInt(APP_VERSION.formalVersion.split('.')[1], 10) || 0;
    },

    get patch() {
        return parseInt(APP_VERSION.formalVersion.split('.')[2], 10) || 0;
    },

    // 完整版本信息
    get fullInfo() {
        return {
            internal: this.internalVersion,
            display: this.displayVersion,
            formal: this.formalVersion,
            major: this.major,
            minor: this.minor,
            patch: this.patch
        };
    },

    // 版本长链：YYYYMMDD-内部版本号-外部版本号
    get versionChain() {
        const now = new Date();
        const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        return `${date}-${APP_VERSION.internalVersion}-${this.displayVersion}`;
    },

    // 初始化：在页面上显示版本号
    init() {
        // 等待DOM加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._display());
        } else {
            this._display();
        }
    },

    _display() {
        // 在首页底部显示版本号
        const homeScreen = document.getElementById('home-screen');
        if (homeScreen && !homeScreen.querySelector('.version-display')) {
            const versionEl = document.createElement('div');
            versionEl.className = 'version-display';
            versionEl.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);font-size:12px;color:#999;opacity:0.7;';
            versionEl.textContent = `${this.displayVersion} (Build ${this.internalVersion})`;
            homeScreen.appendChild(versionEl);
        }

        // 在游戏界面顶部显示版本号（菜单中）
        console.log(`🌿 修仙模拟器 ${this.displayVersion} (内部版本 ${this.internalVersion})`);
    }
};
