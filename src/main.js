import { Game } from './game.js';
import { UI } from './ui/index.js';
import { CharacterSelect } from './ui/character-select.js';
import { HomeScene } from './ui/home-scene.js';
import { LoginScreen } from './ui/login.js';
import { githubSave } from './save/github-save.js';
import { preloadCharacters, getCharacter, DEFAULT_CHARACTER_ID } from './data/characters.js';

/**
 * 入口：登录 → 主页修炼 → （选角色）→ 主界面
 *
 * 存档默认写入登录账号的 GitHub 私有仓库 xiudao-save；
 * 未登录或云端不可用时自动回落本地 localStorage。
 */
const game = new Game();
const dom = {
    hud: document.getElementById('hud-container'),
    panel: document.getElementById('panel-container')
};

let ui = null;
let homeScene = null;
let selector = null;
let preferredCharId = githubSave.constructor.getPreferredCharacter() || DEFAULT_CHARACTER_ID;
let currentSave = null;      // 当前存档对象
let autoSaveTimer = null;

const $ = id => document.getElementById(id);

function show(name) {
    $('screen-login').classList.toggle('hidden', name !== 'login');
    $('screen-home').classList.toggle('hidden', name !== 'home');
    $('screen-select').classList.toggle('hidden', name !== 'select');
    $('screen-main').classList.toggle('hidden', name !== 'main');
}

// ============ 1. 登录 ============
const login = new LoginScreen($('login-container'), {
    onSuccess: async (res) => {
        show('home');
        await enterHome(res);
    }
});

// 自动恢复登录
(async () => {
    try {
        const res = await githubSave.restore();
        if (res) {
            show('home');
            await enterHome(res);
        }
    } catch { /* 未登录，停留在登录页 */ }
})();

// ============ 2. 主页 ============
function buildSaveInfo(data) {
    const p = data?.player;
    if (!p) return null;
    return {
        realm: p.cultivation?.realm || '练气期',
        level: p.cultivation?.level ?? 1,
        savedAt: p.metadata?.lastSaveTime || data.savedAt,
        source: data.__source
    };
}

async function enterHome(res) {
    // 读取存档（云优先，失败回落本地）
    const loaded = await githubSave.load();
    currentSave = loaded?.data || null;

    // 存档里若记了角色，用它；否则用偏好
    if (currentSave?.player?.characterId) {
        preferredCharId = currentSave.player.characterId;
    }

    homeScene = new HomeScene($('home-container'), {
        characterId: preferredCharId,
        user: res?.user || null,
        cloudReady: !!res?.cloudReady,
        saveInfo: buildSaveInfo(currentSave),
        onEnter: () => startOrContinue(),
        onSwitchChar: () => showSelect(),
        onLogout: () => { githubSave.logout(); location.reload(); },
        onSave: res?.cloudReady ? () => syncNow() : null,
        onRestore: res?.cloudReady ? () => showBackups() : null
    });
    homeScene.start();
}

/** 点击「进入洞府」 */
function startOrContinue() {
    if (currentSave?.player) {
        // 已有存档 → 直接载入
        const r = game.loadSave(currentSave);
        if (!r.ok) {
            alert('存档读取失败：' + r.reason);
            return;
        }
        enterMain(r.migrated ? `🔄 存档已从 v${r.from} 迁移到 v${r.to}` : '📂 存档已载入');
    } else {
        // 无存档 → 先选角色
        showSelect();
    }
}

// ============ 3. 角色选择 ============
function showSelect() {
    selector = selector || new CharacterSelect($('select-container'), {
        onConfirm: (char) => doCreate(char)
    });
    selector.selectedId = preferredCharId;
    selector.render();
    show('select');
}

function doCreate(char) {
    preferredCharId = char.id;
    githubSave.constructor.setPreferredCharacter(char.id);

    const p = game.createCharacter({
        name: char.name,
        faction: char.faction,
        profession: char.title,
        talent: '运气'
    });

    const b = char.bonus;
    p.attributes.attack = Math.max(1, (p.attributes.attack || 10) + (b.attack || 0));
    p.attributes.defense = Math.max(0, (p.attributes.defense || 5) + (b.defense || 0));
    p.attributes.maxHp = Math.max(10, (p.attributes.maxHp || 100) + (b.maxHp || 0));
    p.attributes.hp = p.attributes.maxHp;
    p.attributes.maxMp = Math.max(10, (p.attributes.maxMp || 50) + (b.maxMp || 0));
    p.attributes.mp = p.attributes.maxMp;
    p.attributes.luck = Math.max(1, (p.attributes.luck || 10) + (b.luck || 0));
    p.karma = b.karma ?? (char.faction === '邪修' ? 40 : 5);
    p.gender = char.gender;
    p.characterId = char.id;

    enterMain(`✨ ${char.name}（${char.title}）已诞生`);
    syncNow(true);
}

// ============ 4. 主界面 ============
function enterMain(welcomeMsg) {
    ui = new UI(game, dom);
    show('main');
    if (welcomeMsg) ui.log(welcomeMsg, 'levelup');
    if (githubSave.isLoggedIn) {
        const tag = githubSave.cloudReady ? '云' : '本地';
        ui.log(`💾 存档模式：${tag}（@${githubSave.username}）`, 'info');
    }
    if (game.state.player?.characterId) {
        ui.applyCharacter?.(getCharacter(game.state.player.characterId));
    }
    startAutoSave();
}

// ============ 存档同步 ============
async function syncNow(silent = false) {
    if (!game.state.player) return;
    const data = game.toSave();
    if (!data) return;
    currentSave = data;

    const r = await githubSave.save(data, { backup: true });
    if (!silent) {
        if (r.source === 'cloud') ui?.log('☁️ 已同步到 GitHub 云存档', 'reward');
        else ui?.log(`💾 已保存到本地${r.reason ? '（' + r.reason + '）' : ''}`, 'normal');
    }
    homeScene?.update({ saveInfo: buildSaveInfo(data) });
}

/** 每 3 分钟自动存一次 */
function startAutoSave() {
    stopAutoSave();
    autoSaveTimer = setInterval(() => syncNow(true), 3 * 60 * 1000);
}
function stopAutoSave() {
    if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; }
}

/** 备份列表弹窗 */
async function showBackups() {
    const list = await githubSave.listBackups();
    const body = $('modal-body');
    if (!list.length) {
        body.innerHTML = `<div class="bk-empty">暂无备份</div>`;
    } else {
        body.innerHTML = `
            <h3 class="bk-title">云存档备份</h3>
            <div class="bk-list">
                ${list.map(f => {
            const ts = f.name.replace('save-', '').replace('.json', '');
            return `<div class="bk-item" data-path="${f.path}">
                            <span>${ts.replace('T', ' ')}</span>
                            <button>恢复</button>
                        </div>`;
        }).join('')}
            </div>
        `;
        body.querySelectorAll('.bk-item button').forEach(btn => {
            btn.addEventListener('click', async () => {
                const path = btn.parentElement.dataset.path;
                if (!confirm('确定用该备份覆盖当前存档？')) return;
                try {
                    const data = await githubSave.restoreBackup(path);
                    const r = game.loadSave(data);
                    if (!r.ok) return alert(r.reason);
                    currentSave = data;
                    $('modal').classList.add('hidden');
                    enterMain('♻️ 已从备份恢复');
                    syncNow(true);
                } catch (e) { alert('恢复失败：' + e.message); }
            });
        });
    }
    $('modal').classList.remove('hidden');
}

// ============ 顶栏按钮 ============
$('btn-home').addEventListener('click', async () => {
    if (game.state.player && confirm('返回主页？会自动保存当前进度。')) {
        await syncNow(true);
    } else if (game.state.player) return;
    stopAutoSave();
    if (homeScene) {
        homeScene.update({ saveInfo: buildSaveInfo(currentSave) });
        homeScene.start();
    }
    show('home');
});

$('btn-save').addEventListener('click', () => syncNow());

$('btn-new').addEventListener('click', async () => {
    if (!confirm('重开一局？当前存档会被新角色覆盖（旧档仍可从云端备份恢复）。')) return;
    githubSave.constructor.clearLocalSave();
    currentSave = null;
    stopAutoSave();
    showSelect();
});

// ============ 弹窗 ============
$('modal-close').addEventListener('click', () => $('modal').classList.add('hidden'));
$('modal').addEventListener('click', e => {
    if (e.target === $('modal')) $('modal').classList.add('hidden');
});

// 页面关闭前保存
window.addEventListener('beforeunload', () => {
    if (game.state.player) {
        const data = game.toSave();
        if (data) localStorage.setItem('xiudao2_save', JSON.stringify(data));
    }
});

// ============ 启动 ============
preloadCharacters();
show('login');
