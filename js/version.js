/**
 * 🌿 修仙模拟器 - 版本号系统
 * 内部版本号：纯数字计数器，每次更新+1
 * 外部版本号：x.y.z（大版本.小版本.补丁）
 */

const Version = {
    // 内部版本号（计数器）
    internalVersion: 3,
    
    // 外部版本号
    major: 1,      // 大版本：重大更新
    minor: 1,      // 小版本：新功能
    patch: 0,      // 补丁：bug修复
    
    // 显示用版本号
    get displayVersion() {
        return `v${this.major}.${this.minor}.${this.patch}`;
    },
    
    // 完整版本信息
    get fullInfo() {
        return {
            internal: this.internalVersion,
            display: this.displayVersion,
            major: this.major,
            minor: this.minor,
            patch: this.patch
        };
    },
    
    // 版本长链：YYYYMMDD-内部版本号-外部版本号
    get versionChain() {
        const now = new Date();
        const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        return `${date}-${this.internalVersion}-${this.displayVersion}`;
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
