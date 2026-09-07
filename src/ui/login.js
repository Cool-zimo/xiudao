import { githubSave } from '../save/github-save.js';

/**
 * 登录页 —— 输入 GitHub 令牌，把存档托管到自己的私有仓库
 *
 * 安全说明全部写在界面上，不藏着：
 *   - 令牌只存本机浏览器，不经过任何第三方服务器
 *   - 建议用 fine-grained token，只给 xiudao-save 一个仓库权限
 */
export class LoginScreen {
    constructor(root, opts = {}) {
        this.root = root;
        this.onSuccess = opts.onSuccess || (() => { });
        this.state = 'idle';   // idle | loading | error
        this.error = '';
        this.render();
    }

    render() {
        const saved = localStorage.getItem('xiudao_user');
        let lastUser = null;
        try { lastUser = saved ? JSON.parse(saved) : null; } catch { /* ignore */ }

        this.root.innerHTML = `
            <div class="login-root">
                <div class="login-card">
                    <div class="login-brand">
                        <div class="login-logo">🌿</div>
                        <h1>修仙模拟器 <span class="v">2.0</span></h1>
                        <p class="login-sub">登仙籍 · 存档托管于你的 GitHub 私有仓库</p>
                    </div>

                    ${lastUser ? `
                        <div class="login-last">
                            <img src="${this._esc(lastUser.avatar)}" alt="">
                            <div>
                                <div class="ll-name">${this._esc(lastUser.name)}</div>
                                <div class="ll-sub">上次登录 · @${this._esc(lastUser.login)}</div>
                            </div>
                            <button class="ll-again" id="btn-restore">快速登录</button>
                        </div>
                    ` : ''}

                    <form class="login-form" id="login-form" autocomplete="off">
                        <label for="token-input">GitHub 个人访问令牌</label>
                        <input type="password" id="token-input"
                               placeholder="ghp_ 或 github_pat_ 开头"
                               spellcheck="false" autocomplete="new-password">
                        <div class="login-err ${this.error ? 'show' : ''}">${this._esc(this.error)}</div>

                        <button type="submit" class="login-submit" id="btn-login"
                                ${this.state === 'loading' ? 'disabled' : ''}>
                            ${this.state === 'loading' ? '正在登仙籍…' : '登 录'}
                        </button>
                    </form>

                    <details class="login-help">
                        <summary>🔑 如何获取令牌？（点开看三步）</summary>
                        <ol>
                            <li>打开
                                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">
                                    GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
                                </a>
                            </li>
                            <li>Repository access 选 <b>Only select repositories</b>，
                                若还没有 <code>xiudao-save</code> 就先选「All repositories」，
                                或手动新建这个私有仓库</li>
                            <li>Permissions 里展开 <b>Contents</b> 设为
                                <b>Read and write</b>，其余全部保持默认，然后生成</li>
                        </ol>
                        <div class="login-note">
                            <b>关于安全</b>：令牌只保存在你这台浏览器的 localStorage，
                            代码里不含任何外发请求，存档直接写入你自己的仓库。
                            建议在用完后到 GitHub 设置页吊销该令牌。
                        </div>
                    </details>

                    <button class="login-skip" id="btn-skip">先不登录 · 本地试玩</button>
                </div>
            </div>
        `;

        this._bind();
    }

    _bind() {
        const form = this.root.querySelector('#login-form');
        const input = this.root.querySelector('#token-input');

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = input.value.trim();
            if (!token) return this._fail('请输入令牌');
            if (!/^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)/.test(token)) {
                return this._fail('令牌格式不对，应以 ghp_ 或 github_pat_ 开头');
            }
            this._loading();
            try {
                const res = await githubSave.login(token);
                this.onSuccess(res);
            } catch (err) {
                this._fail(
                    err.message === 'TOKEN_INVALID'
                        ? '令牌无效或已过期，请重新生成'
                        : err.message === 'RATE_LIMIT'
                            ? 'GitHub 接口限流，请稍后再试'
                            : (err.message || '登录失败')
                );
            }
        });

        this.root.querySelector('#btn-restore')?.addEventListener('click', async () => {
            this._loading();
            try {
                const res = await githubSave.restore();
                if (!res) return this._fail('本地令牌已失效，请重新输入');
                this.onSuccess(res);
            } catch (e) {
                this._fail(e.message || '恢复登录失败');
            }
        });

        this.root.querySelector('#btn-skip')?.addEventListener('click', () => {
            this.onSuccess({ user: null, cloudReady: false, guest: true });
        });

        // 输入时清掉错误提示
        input?.addEventListener('input', () => {
            const box = this.root.querySelector('.login-err');
            if (box) box.classList.remove('show');
        });
    }

    _loading() {
        this.state = 'loading';
        const btn = this.root.querySelector('#btn-login');
        if (btn) { btn.disabled = true; btn.textContent = '正在登仙籍…'; }
        const box = this.root.querySelector('.login-err');
        if (box) box.classList.remove('show');
    }

    _fail(msg) {
        this.state = 'error';
        this.error = msg;
        const box = this.root.querySelector('.login-err');
        if (box) { box.textContent = msg; box.classList.add('show'); }
        const btn = this.root.querySelector('#btn-login');
        if (btn) { btn.disabled = false; btn.textContent = '登 录'; }
        const input = this.root.querySelector('#token-input');
        if (input) input.focus();
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
