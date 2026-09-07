/**
 * 精简版 GitHub API 客户端
 *
 * 只保留存档需要的能力：验证身份、仓库CRUD、文件读写、列举文件。
 * 浏览器可直连（GitHub API 支持 CORS），无需后端。
 *
 * 注意：token 仅保存在浏览器 localStorage，不上传任何第三方服务器。
 */
export class GitHubAPI {
    constructor(token) {
        this.token = (token || '').trim();
        this.base = 'https://api.github.com';
    }

    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : this.base + endpoint;
        const res = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28',
                ...(options.headers || {})
            }
        });

        if (res.status === 401) {
            throw new Error('TOKEN_INVALID');
        }
        if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
            throw new Error('RATE_LIMIT');
        }
        if (res.status === 404) return null;
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || `HTTP ${res.status}`);
        }
        if (res.status === 204) return null;
        return res.json();
    }

    /** 验证 token 并获取用户信息 */
    async getMe() {
        const u = await this.request('/user');
        if (!u) throw new Error('TOKEN_INVALID');
        return {
            login: u.login,
            name: u.name || u.login,
            avatar: u.avatar_url,
            id: u.id,
            publicRepos: u.public_repos,
            createdAt: u.created_at
        };
    }

    /** 列出 token 具备的权限范围（经典 token 才有 scopes 头） */
    async getScopes() {
        try {
            const url = this.base + '/user';
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}`, 'Accept': 'application/vnd.github+json' }
            });
            const s = res.headers.get('X-OAuth-Scopes');
            return s ? s.split(',').map(x => x.trim()).filter(Boolean) : [];
        } catch { return []; }
    }

    async getRepo(owner, repo) {
        return this.request(`/repos/${owner}/${repo}`);
    }

    async createRepo(name, { description = '', private: isPrivate = true } = {}) {
        return this.request('/user/repos', {
            method: 'POST',
            body: JSON.stringify({
                name,
                description,
                private: isPrivate,
                auto_init: true,     // 初始化 README，保证 main 分支存在
                has_issues: false,
                has_wiki: false,
                has_projects: false
            })
        });
    }

    /** 读取文件内容（文本），不存在返回 null */
    async getFile(owner, repo, path, ref = 'main') {
        const r = await this.request(
            `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
        );
        if (!r || !r.content) return null;
        try {
            const bin = atob(r.content.replace(/\n/g, ''));
            return {
                content: decodeURIComponent(escape(bin)),
                sha: r.sha,
                size: r.size
            };
        } catch {
            return { content: atob(r.content.replace(/\n/g, '')), sha: r.sha, size: r.size };
        }
    }

    /** 创建或更新文件；sha 为空=新建 */
    async putFile(owner, repo, path, content, message, sha = null, branch = 'main') {
        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(content))),
            branch
        };
        if (sha) body.sha = sha;
        return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    async deleteFile(owner, repo, path, message, sha, branch = 'main') {
        return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
            method: 'DELETE',
            body: JSON.stringify({ message, sha, branch })
        });
    }

    /** 列举目录，返回 [{name, path, size, type}] */
    async listDir(owner, repo, path = '', ref = 'main') {
        const r = await this.request(
            `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
        );
        if (!Array.isArray(r)) return [];
        return r.map(x => ({
            name: x.name, path: x.path, size: x.size, type: x.type, sha: x.sha
        }));
    }

    /** 删除整个仓库（危险操作，用于「重置存档」） */
    async deleteRepo(owner, repo) {
        return this.request(`/repos/${owner}/${repo}`, { method: 'DELETE' });
    }
}

export const TOKEN_ERRORS = {
    TOKEN_INVALID: '令牌无效或已过期，请检查后重试',
    RATE_LIMIT: 'GitHub API 请求过于频繁，请稍后再试'
};

export function describeError(e) {
    return TOKEN_ERRORS[e.message] || e.message || '未知错误';
}
