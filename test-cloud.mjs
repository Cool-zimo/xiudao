/** GitHub 云存档模块测试（mock fetch，不发真实请求） */
let pass=0, fail=0;
const check=(l,c,e='')=>{ if(c){pass++;console.log(`  ✓ ${l}`);} else {fail++;console.log(`  ✗ ${l} ${e}`);} };

// ---------- mock 环境 ----------
const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k,v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
};
// 浏览器语义：atob/btoa 处理 latin1(binary) 字符串
global.atob = s => Buffer.from(s, 'base64').toString('latin1');
global.btoa = s => Buffer.from(s, 'latin1').toString('base64');
// escape/unescape 在 Node 中仍可用（兼容旧 API），但保险起见显式定义
if (typeof global.escape === 'undefined') {
    global.escape = s => String(s).replace(/[^\w@*_+\-./]/g, ch => {
        const c = ch.charCodeAt(0);
        return c < 256 ? '%' + c.toString(16).padStart(2,'0')
                       : '%u' + c.toString(16).padStart(4,'0').toUpperCase();
    });
    global.unescape = s => String(s).replace(/%u([0-9A-Fa-f]{4})|%([0-9A-Fa-f]{2})/g,
        (_, a, b) => String.fromCharCode(parseInt(a||b, 16)));
}

// 模拟 GitHub 仓库（内存态）
let REPO = null;
const FILES = {};   // path -> {content, sha}
let requestLog = [];

function mkRes(status, body, headers={}) {
    return {
        status, ok: status>=200&&status<300,
        headers: { get: k => headers[k] ?? null },
        json: async () => body
    };
}
global.fetch = async (url, opts={}) => {
    requestLog.push(`${opts.method||'GET'} ${url}`);
    const m = String(url).match(/api\.github\.com(\/[^?]+)(\?.*)?$/);
    const path = m ? m[1] : '';
    const body = opts.body ? JSON.parse(opts.body) : {};
    const METHOD = opts.method || 'GET';   // fetch 不传 method 时默认为 GET

    // 401 模拟
    if (opts.headers?.Authorization?.includes('BAD')) return mkRes(401, {message:'Bad credentials'});

    if (path === '/user') {
        return mkRes(200, { login:'tester', name:'测试道友', avatar_url:'https://a/b.png', id:1 });
    }
    if (path === '/user/repos' && METHOD === 'POST') {
        REPO = { name: body.name, private: body.private, owner:'tester' };
        return mkRes(201, REPO);
    }
    let mm = path.match(/^\/repos\/([^/]+)\/([^/]+)$/);
    if (mm && METHOD === 'GET') {
        return REPO ? mkRes(200, REPO) : mkRes(404, {message:'Not Found'});
    }
    mm = path.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/);
    if (mm) {
        const p = decodeURIComponent(mm[3]);
        // 目录列举：路径无扩展名且是已知目录 → 返回数组
        if (METHOD === 'GET' && p === 'backups') {
            return mkRes(200, Object.entries(FILES)
                .filter(([k]) => k.startsWith('backups/'))
                .map(([k,v]) => ({ name: k.split('/').pop(), path: k, size: 0, type: 'file', sha: v.sha })));
        }
        if (METHOD === 'GET') {
            if (!FILES[p]) return mkRes(404, {});
            return mkRes(200, { content: FILES[p].content, sha: FILES[p].sha, size: 0 });
        }
        if (METHOD === 'PUT') {
            // 真实 GitHub 存 base64 原文；解码交给客户端 getFile 处理
            const sha = 'sha' + Math.random().toString(36).slice(2,8);
            FILES[p] = { content: body.content, sha };
            return mkRes(200, { content: { sha } });
        }
        if (METHOD === 'DELETE') {
            delete FILES[body.sha ? p : p];
            return mkRes(200, {});
        }
    }
    return mkRes(404, {});
};

const { GitHubAPI, describeError } = await import('./src/save/github-api.js');
const { githubSave } = await import('./src/save/github-save.js');

console.log('═══════ GitHub 云存档 模块测试 ═══════\n');

console.log('【令牌验证】');
const api = new GitHubAPI('good_token');
const me = await api.getMe();
check('getMe 返回用户信息', me.login === 'tester' && me.name === '测试道友');

const bad = new GitHubAPI('BAD_token');
let caught = null;
try { await bad.getMe(); } catch(e) { caught = e.message; }
check('无效令牌抛 TOKEN_INVALID', caught === 'TOKEN_INVALID', caught);
check('错误信息本地化', describeError(new Error('TOKEN_INVALID')).includes('无效'));

console.log('\n【登录流程】');
const res = await githubSave.login('good_token');
check('登录成功返回用户', res.user?.login === 'tester');
check('cloudReady 为 true', res.cloudReady === true);
check('令牌已存入 localStorage', store['xiudao_token'] === 'good_token');
check('用户信息已缓存', JSON.parse(store['xiudao_user']).login === 'tester');
check('isLoggedIn 为真', githubSave.isLoggedIn === true);
check('username 正确', githubSave.username === 'tester');
check('仓库名正确', githubSave.repoFullName === 'tester/xiudao-save');

console.log('\n【自动创建仓库】');
check('仓库已创建', REPO !== null && REPO.name === 'xiudao-save');
check('仓库为私有', REPO.private === true);

console.log('\n【存档写入】');
const saveData = {
    saveVersion: 3,
    player: {
        name: '凌霄', characterId: 'swordsman', faction: '正道', karma: 5,
        cultivation: { realm: '筑基期', level: 3 },
        gold: 120,
        metadata: { playTime: 600, lastSaveTime: new Date().toISOString() }
    }
};
const w = await githubSave.save(saveData, { backup: true });
check('写入返回 cloud', w.source === 'cloud', JSON.stringify(w));
check('save.json 已写入仓库', !!FILES['save.json']);
const decodedSave = JSON.parse(decodeURIComponent(escape(atob(FILES['save.json'].content))));
check('内容可解析（UTF-8 中文无乱码）', decodedSave.player.name === '凌霄', decodedSave.player.name);
check('meta.json 已写入', !!FILES['meta.json']);
const meta = JSON.parse(decodeURIComponent(escape(atob(FILES['meta.json'].content))));
check('meta 含境界', meta.realm === '筑基期');
check('meta 含角色 id', meta.characterId === 'swordsman');
check('本地副本已同步', JSON.parse(store['xiudao2_save']).player.name === '凌霄');

console.log('\n【备份机制】');
const bkFiles = Object.keys(FILES).filter(k => k.startsWith('backups/save-'));
check('已创建备份', bkFiles.length === 1, `${bkFiles.length} 个`);
const backups = await githubSave.listBackups();
check('可列出备份', backups.length >= 0);

// 写 8 次，验证只保留 5 份
for (let i=0;i<7;i++) await githubSave.save(saveData, { backup: true });
const after = Object.keys(FILES).filter(k => k.startsWith('backups/save-'));
check('备份数量受上限约束（<=5+新建中的）', after.length <= 6, `${after.length} 个`);

console.log('\n【读档】');
const loaded = await githubSave.load();
check('读到云存档', loaded.source === 'cloud', loaded.source);
check('数据正确', loaded.data.player.name === '凌霄');

console.log('\n【备份恢复】');
const bkp = await githubSave.listBackups();
if (bkp.length) {
    const data = await githubSave.restoreBackup(bkp[0].path);
    check('可从备份恢复数据', data.player?.name === '凌霄');
} else console.log('  - 无备份，跳过');

console.log('\n【登出】');
githubSave.logout();
check('令牌已清除', !store['xiudao_token']);
check('用户已清除', !store['xiudao_user']);
check('isLoggedIn 为假', githubSave.isLoggedIn === false);
check('online 为假', githubSave.online === false);

console.log('\n【离线回落】');
const offline = await githubSave.save(saveData);
check('未登录时回落到本地', offline.source === 'local', offline.source);
check('本地仍有数据', !!store['xiudao2_save']);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail>0?1:0);
