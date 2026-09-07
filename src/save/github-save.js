import { GitHubAPI, describeError } from './github-api.js';

/**
 * GitHub 云存档
 *
 * 仓库结构（自动创建，默认私有）：
 *   xiudao-save/
 *   ├── save.json                  当前存档（含角色、境界、背包、成就）
 *   ├── meta.json                  轻量摘要（快速读取，用于主页展示）
 *   └── backups/save-<时间戳>.json  自动备份（保留最近 5 份）
 *
 * 本地仍保留一份 localStorage 副本：
 *   - 离线时可继续玩，联网后提示同步
 *   - 云存档读取失败时自动回落，不丢档
 */

const REPO_NAME = 'xiudao-save';
const SAVE_PATH = 'save.json';
const META_PATH = 'meta.json';
const BACKUP_DIR = 'backups';
const MAX_BACKUPS = 5;

const LS_TOKEN = 'xiudao_token';
const LS_USER = 'xiudao_user';
const LS_LOCAL_SAVE = 'xiudao2_save';
const LS_CHAR = 'xiudao2_char';

export class GitHubSave {
    constructor() {
        this.api = null;
        this.user = null;
        this.repoReady = false;
        this.online = false;
    }

    // ---------- 登录 ----------

    /** 用 token 登录；成功返回用户信息 */
    async login(token) {
        const api = new GitHubAPI(token);
        const user = await api.getMe();       // 失败会抛 TOKEN_INVALID
        this.api = api;
        this.user = user;
        this.token = token;

        localStorage.setItem(LS_TOKEN, token);
        localStorage.setItem(LS_USER, JSON.stringify(user));

        // 确保存档仓库存在（失败不阻断登录，降级为本地存档）
        try {
            await this.ensureRepo();
            this.online = true;
        } catch (e) {
            console.warn('[云存档] 仓库准备失败，降级为本地存档:', e.message);
            this.online = false;
        }
        return { user, cloudReady: this.online };
    }

    /** 尝试用已保存的 token 恢复登录 */
    async restore() {
        const token = localStorage.getItem(LS_TOKEN);
        if (!token) return null;
        try {
            const api = new GitHubAPI(token);
            const user = await api.getMe();
            this.api = api;
            this.user = user;
            this.token = token;
            try {
                await this.ensureRepo();
                this.online = true;
            } catch { this.online = false; }
            return { user, cloudReady: this.online };
        } catch {
            this.logout();   // token 失效，清掉
            return null;
        }
    }

    logout() {
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
        this.api = null;
        this.user = null;
        this.online = false;
        this.repoReady = false;
    }

    get isLoggedIn() { return !!this.user; }
    get username() { return this.user?.login || ''; }

    // ---------- 仓库 ----------

    async ensureRepo() {
        if (this.repoReady) return true;
        const owner = this.user.login;
        let repo = await this.api.getRepo(owner, REPO_NAME);
        if (!repo) {
            repo = await this.api.createRepo(REPO_NAME, {
                description: '🌿 修仙模拟器 2.0 · 云存档（自动生成）',
                private: true
            });
            // 初始提交后再写入，避免 409 冲突
            await new Promise(r => setTimeout(r, 800));
        }
        this.repoReady = true;
        return true;
    }

    get repoFullName() {
        return this.user ? `${this.user.login}/${REPO_NAME}` : '';
    }

    // ---------- 读档 ----------

    /** 读取云存档；无则返回 null */
    async load() {
        if (!this.online) return this.loadLocal();
        try {
            const f = await this.api.getFile(this.user.login, REPO_NAME, SAVE_PATH);
            if (!f) return this.loadLocal();
            const data = JSON.parse(f.content);
            this.lastSha = f.sha;
            // 同步一份到本地，便于离线继续
            localStorage.setItem(LS_LOCAL_SAVE, JSON.stringify(data));
            return { data, source: 'cloud', sha: f.sha };
        } catch (e) {
            console.warn('[云存档] 读取失败，回落本地:', e.message);
            return this.loadLocal();
        }
    }

    loadLocal() {
        const raw = localStorage.getItem(LS_LOCAL_SAVE);
        if (!raw) return null;
        try {
            return { data: JSON.parse(raw), source: 'local' };
        } catch { return null; }
    }

    /**
     * 写入存档
     * @param {Object} data  完整存档对象
     * @param {Object} opts  { backup: boolean } 是否同时创建备份
     */
    async save(data, opts = {}) {
        // 无论云端是否可用，先写本地
        localStorage.setItem(LS_LOCAL_SAVE, JSON.stringify(data));

        if (!this.online) {
            return { ok: true, source: 'local', reason: '未连接云端，已保存到本地' };
        }

        try {
            const owner = this.user.login;

            // 并发保护：写前重新取 sha
            let sha = this.lastSha;
            if (!sha) {
                const cur = await this.api.getFile(owner, REPO_NAME, SAVE_PATH);
                sha = cur?.sha || null;
            }

            const now = new Date();
            const msg = `🧘 修仙存档 ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;
            const r = await this.api.putFile(owner, REPO_NAME, SAVE_PATH,
                JSON.stringify(data, null, 2), msg, sha);
            this.lastSha = r?.content?.sha || sha;

            // 写入摘要（主页快速展示用）
            await this._writeMeta(data);

            // 备份
            if (opts.backup !== false) {
                await this._backup(data).catch(e => console.warn('备份失败:', e.message));
            }

            return { ok: true, source: 'cloud' };
        } catch (e) {
            console.warn('[云存档] 写入失败:', e.message);
            return { ok: true, source: 'local', reason: describeError(e) };
        }
    }

    async _writeMeta(data) {
        const p = data?.player;
        if (!p) return;
        const meta = {
            name: p.name,
            characterId: p.characterId || null,
            realm: p.cultivation?.realm || '练气期',
            level: p.cultivation?.level ?? 1,
            karma: p.karma ?? 0,
            faction: p.faction,
            gold: p.gold ?? 0,
            playTime: p.metadata?.playTime ?? 0,
            savedAt: new Date().toISOString()
        };
        let sha = null;
        try {
            const cur = await this.api.getFile(this.user.login, REPO_NAME, META_PATH);
            sha = cur?.sha || null;
        } catch { /* 忽略 */ }
        try {
            await this.api.putFile(this.user.login, REPO_NAME, META_PATH,
                JSON.stringify(meta, null, 2), '更新存档摘要', sha);
        } catch { /* meta 失败不影响主流程 */ }
    }

    async _backup(data) {
        const owner = this.user.login;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const path = `${BACKUP_DIR}/save-${stamp}.json`;
        await this.api.putFile(owner, REPO_NAME, path,
            JSON.stringify(data), `备份存档 ${stamp}`);

        // 清理超出上限的旧备份
        const list = await this.api.listDir(owner, REPO_NAME, BACKUP_DIR);
        const files = list.filter(f => f.type === 'file' && f.name.startsWith('save-'));
        if (files.length > MAX_BACKUPS) {
            files.sort((a, b) => a.name < b.name ? -1 : 1);   // 名字含时间戳，字典序=时间序
            for (const f of files.slice(0, files.length - MAX_BACKUPS)) {
                await this.api.deleteFile(owner, REPO_NAME, f.path, `清理旧备份 ${f.name}`, f.sha)
                    .catch(() => { });
            }
        }
    }

    /** 列出备份（新→旧） */
    async listBackups() {
        if (!this.online) return [];
        try {
            const list = await this.api.listDir(this.user.login, REPO_NAME, BACKUP_DIR);
            return list
                .filter(f => f.type === 'file' && f.name.startsWith('save-'))
                .sort((a, b) => a.name < b.name ? 1 : -1);
        } catch { return []; }
    }

    /** 从指定备份恢复 */
    async restoreBackup(path) {
        const f = await this.api.getFile(this.user.login, REPO_NAME, path);
        if (!f) throw new Error('备份不存在');
        return JSON.parse(f.content);
    }

    // ---------- 本地偏好 ----------

    static getPreferredCharacter() {
        return localStorage.getItem(LS_CHAR) || null;
    }
    static setPreferredCharacter(id) {
        localStorage.setItem(LS_CHAR, id);
    }
    static clearLocalSave() {
        localStorage.removeItem(LS_LOCAL_SAVE);
    }
}

export const githubSave = new GitHubSave();
