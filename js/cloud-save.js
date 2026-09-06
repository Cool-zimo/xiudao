/**
 * ☁️ 云存档系统 - 与 GitHub / GitHub Drive 联动
 * 支持将存档保存到 GitHub 仓库，实现多设备同步
 * 可复用 GitHub Drive 的 Token
 */

const CloudSave = {
    // GitHub API 基础地址
    API_BASE: 'https://api.github.com',
    // 云存档仓库名（可配置）
    REPO_NAME: 'xiudao-saves',
    // 存档目录
    SAVE_DIR: 'saves',
    // Token 存储键
    TOKEN_KEY: 'xiudao_github_token',
    // 用户名缓存
    _username: null,

    /**
     * 检测是否在 GitHub Drive 环境中运行（iframe 嵌入）
     * @returns {boolean}
     */
    isInGitHubDrive() {
        try {
            return window.parent !== window && 
                   window.parent.location.href.includes('github_drive');
        } catch (e) {
            return false;
        }
    },

    /**
     * 尝试从 GitHub Drive 获取 Token
     * @returns {string|null}
     */
    async getTokenFromDrive() {
        if (!this.isInGitHubDrive()) return null;
        try {
            // 尝试从 parent window 的 localStorage 获取
            const token = window.parent.localStorage.getItem('gd_token');
            return token || null;
        } catch (e) {
            return null;
        }
    },

    /**
     * 获取当前使用的 Token
     * @returns {string|null}
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY) || null;
    },

    /**
     * 设置 GitHub Token
     * @param {string} token
     */
    setToken(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
        this._username = null; // 清除缓存
    },

    /**
     * 清除 Token
     */
    clearToken() {
        localStorage.removeItem(this.TOKEN_KEY);
        this._username = null;
    },

    /**
     * 验证 Token 并获取用户名
     * @returns {Promise<string|null>}
     */
    async verifyToken() {
        const token = this.getToken();
        if (!token) return null;

        try {
            const res = await fetch(`${this.API_BASE}/user`, {
                headers: { 'Authorization': `token ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                this._username = data.login;
                return data.login;
            }
            return null;
        } catch (e) {
            console.error('Token 验证失败:', e);
            return null;
        }
    },

    /**
     * 获取用户名（带缓存）
     * @returns {Promise<string|null>}
     */
    async getUsername() {
        if (this._username) return this._username;
        return await this.verifyToken();
    },

    /**
     * 确保云存档仓库存在，不存在则创建
     * @returns {Promise<boolean>}
     */
    async ensureRepo() {
        const token = this.getToken();
        const username = await this.getUsername();
        if (!token || !username) return false;

        try {
            // 检查仓库是否存在
            const res = await fetch(`${this.API_BASE}/repos/${username}/${this.REPO_NAME}`, {
                headers: { 'Authorization': `token ${token}` }
            });

            if (res.ok) return true;
            if (res.status === 404) {
                // 创建仓库
                const createRes = await fetch(`${this.API_BASE}/user/repos`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: this.REPO_NAME,
                        description: '🌿 修仙模拟器云存档 - 由 xiudao 自动管理',
                        private: true,
                        auto_init: true
                    })
                });
                if (createRes.ok) {
                    // 等待仓库初始化
                    await new Promise(r => setTimeout(r, 2000));
                    return true;
                }
                return false;
            }
            return false;
        } catch (e) {
            console.error('创建仓库失败:', e);
            return false;
        }
    },

    /**
     * 上传存档到 GitHub
     * @param {Object} playerData - 玩家数据
     * @param {string} slotName - 存档槽名称
     * @returns {Promise<boolean>}
     */
    async uploadSave(playerData, slotName = 'autosave') {
        const token = this.getToken();
        const username = await this.getUsername();
        if (!token || !username) {
            console.error('未配置 GitHub Token');
            return false;
        }

        if (!(await this.ensureRepo())) {
            console.error('云存档仓库不可用');
            return false;
        }

        try {
            const fileName = `${slotName}.json`;
            const filePath = `${this.SAVE_DIR}/${fileName}`;
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(playerData, null, 2))));

            // 检查文件是否已存在（获取 SHA）
            let sha = null;
            const getRes = await fetch(
                `${this.API_BASE}/repos/${username}/${this.REPO_NAME}/contents/${filePath}`,
                { headers: { 'Authorization': `token ${token}` } }
            );
            if (getRes.ok) {
                const existing = await getRes.json();
                sha = existing.sha;
            }

            // 上传/更新文件
            const body = {
                message: `💾 云存档: ${slotName} - ${new Date().toLocaleString('zh-CN')}`,
                content: content,
                branch: 'main'
            };
            if (sha) body.sha = sha;

            const res = await fetch(
                `${this.API_BASE}/repos/${username}/${this.REPO_NAME}/contents/${filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            return res.ok;
        } catch (e) {
            console.error('上传存档失败:', e);
            return false;
        }
    },

    /**
     * 从 GitHub 下载存档
     * @param {string} slotName - 存档槽名称
     * @returns {Promise<Object|null>}
     */
    async downloadSave(slotName = 'autosave') {
        const token = this.getToken();
        const username = await this.getUsername();
        if (!token || !username) return null;

        try {
            const fileName = `${slotName}.json`;
            const filePath = `${this.SAVE_DIR}/${fileName}`;

            const res = await fetch(
                `${this.API_BASE}/repos/${username}/${this.REPO_NAME}/contents/${filePath}`,
                { headers: { 'Authorization': `token ${token}` } }
            );

            if (!res.ok) return null;

            const data = await res.json();
            const content = decodeURIComponent(escape(atob(data.content)));
            return JSON.parse(content);
        } catch (e) {
            console.error('下载存档失败:', e);
            return null;
        }
    },

    /**
     * 获取云端存档列表
     * @returns {Promise<Array>}
     */
    async listSaves() {
        const token = this.getToken();
        const username = await this.getUsername();
        if (!token || !username) return [];

        try {
            const res = await fetch(
                `${this.API_BASE}/repos/${username}/${this.REPO_NAME}/contents/${this.SAVE_DIR}`,
                { headers: { 'Authorization': `token ${token}` } }
            );

            if (!res.ok) return [];

            const files = await res.json();
            return files
                .filter(f => f.name.endsWith('.json'))
                .map(f => ({
                    name: f.name.replace('.json', ''),
                    size: f.size,
                    lastModified: f.last_modified,
                    downloadUrl: f.download_url
                }))
                .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        } catch (e) {
            console.error('获取存档列表失败:', e);
            return [];
        }
    },

    /**
     * 删除云端存档
     * @param {string} slotName
     * @returns {Promise<boolean>}
     */
    async deleteSave(slotName) {
        const token = this.getToken();
        const username = await this.getUsername();
        if (!token || !username) return false;

        try {
            const fileName = `${slotName}.json`;
            const filePath = `${this.SAVE_DIR}/${fileName}`;

            // 获取 SHA
            const getRes = await fetch(
                `${this.API_BASE}/repos/${username}/${this.REPO_NAME}/contents/${filePath}`,
                { headers: { 'Authorization': `token ${token}` } }
            );
            if (!getRes.ok) return false;
            const existing = await getRes.json();

            // 删除
            const res = await fetch(
                `${this.API_BASE}/repos/${username}/${this.REPO_NAME}/contents/${filePath}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `🗑️ 删除存档: ${slotName}`,
                        sha: existing.sha,
                        branch: 'main'
                    })
                }
            );

            return res.ok;
        } catch (e) {
            console.error('删除存档失败:', e);
            return false;
        }
    }
};
