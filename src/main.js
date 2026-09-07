import { Game } from './game.js';
import { UI } from './ui/index.js';
import { CharacterSelect } from './ui/character-select.js';
import { HomeScene } from './ui/home-scene.js';
import { preloadCharacters, getCharacter, DEFAULT_CHARACTER_ID } from './data/characters.js';
import { RNG } from './core/rng.js';

/**
 * 入口：主页修炼动画 → 角色选择 → 主界面
 */
const game = new Game();
const dom = {
    hud: document.getElementById('hud-container'),
    panel: document.getElementById('panel-container'),
    canvas: null
};

let ui = null;
let homeScene = null;
let pendingCharacterId = localStorage.getItem('xiudao2_char') || DEFAULT_CHARACTER_ID;

const $ = id => document.getElementById(id);
const SAVE_KEY = 'xiudao2_save';
const CHAR_KEY = 'xiudao2_char';
// 1.x 的存档 key，用于老玩家升级后无缝继承
const LEGACY_KEYS = ['xiudao_save', 'xiudao_autosave'];

/**
 * 读取存档：优先 2.0 存档，其次回落到 1.x 存档（会自动迁移）
 * @returns {{raw: string|null, from: string}}
 */
function findSave() {
    const cur = localStorage.getItem(SAVE_KEY);
    if (cur) return { raw: cur, from: '2.0' };
    for (const k of LEGACY_KEYS) {
        const old = localStorage.getItem(k);
        if (old) return { raw: old, from: '1.x' };
    }
    return { raw: null, from: null };
}

function hasAnySave() {
    return !!(localStorage.getItem(SAVE_KEY) || LEGACY_KEYS.some(k => localStorage.getItem(k)));
}

/** 切换屏幕 */
function show(name) {
    $('screen-home').classList.toggle('hidden', name !== 'home');
    $('screen-select').classList.toggle('hidden', name !== 'select');
    $('screen-main').classList.toggle('hidden', name !== 'main');
    // 顶栏按钮按界面显隐
    $('btn-home').classList.toggle('hidden', name === 'home');
    $('btn-save').classList.toggle('hidden', name !== 'main');
    $('btn-new').classList.toggle('hidden', name !== 'main');
    $('btn-load').classList.toggle('hidden', name !== 'home');
}

// ============ 1. 主页修炼动画 ============
function initHome() {
    homeScene = new HomeScene($('home-container'), {
        characterId: pendingCharacterId,
        onEnter: () => showSelect()
    });
    homeScene.start();

    // 有存档（含 1.x 老档）时显示「继续上次修行」
    if (hasAnySave()) {
        $('btn-continue-home').classList.remove('hidden');
    }
}

$('btn-select-char').addEventListener('click', () => showSelect());

$('btn-continue-home').addEventListener('click', () => {
    const { raw, from } = findSave();
    if (!raw) return alert('没有找到存档');
    let data;
    try { data = JSON.parse(raw); }
    catch { return alert('存档已损坏，无法读取'); }

    const res = game.loadSave(data);
    if (!res.ok) return alert(res.reason);

    let msg;
    if (from === '1.x') {
        msg = `🔄 检测到 1.x 老存档，已自动迁移到 2.0（v${res.from} → v${res.to}）`;
        // 迁移后立即以 2.0 格式写回，避免下次重复迁移
        localStorage.setItem(SAVE_KEY, JSON.stringify(game.toSave()));
    } else if (res.migrated) {
        msg = `🔄 存档已从 v${res.from} 迁移到 v${res.to}`;
    } else {
        msg = '📂 存档已载入';
    }
    enterMain(msg);
});

// ============ 2. 角色选择 ============
const selector = new CharacterSelect($('select-container'), {
    initialId: pendingCharacterId,
    onConfirm: (char) => {
        pendingCharacterId = char.id;
        localStorage.setItem(CHAR_KEY, char.id);
        // 主页动画切换为该角色
        if (homeScene) homeScene.setCharacter(char.id);
        doCreateCharacter(char);
    }
});

// 进入选择界面时渲染（直接调用，不依赖 MutationObserver，避免部分环境下不触发）
function showSelect() {
    selector.selectedId = pendingCharacterId;
    selector.render();
    show('select');
}

function doCreateCharacter(char) {
    const p = game.createCharacter({
        name: char.name,
        faction: char.faction,
        profession: '剑修',
        talent: '运气'
    });

    // 应用角色路线加成
    const b = char.bonus;
    p.attributes.attack = Math.max(1, (p.attributes.attack || 10) + (b.attack || 0));
    p.attributes.defense = Math.max(0, (p.attributes.defense || 5) + (b.defense || 0));
    p.attributes.maxHp = Math.max(10, (p.attributes.maxHp || 100) + (b.maxHp || 0));
    p.attributes.hp = p.attributes.maxHp;
    p.attributes.maxMp = Math.max(10, (p.attributes.maxMp || 50) + (b.maxMp || 0));
    p.attributes.mp = p.attributes.maxMp;
    p.attributes.luck = Math.max(1, (p.attributes.luck || 10) + (b.luck || 0));
    if (b.karma) p.karma = b.karma;
    if (char.gender) p.gender = char.gender;
    p.characterId = char.id;

    enterMain(`✨ ${char.name}（${char.title}）已诞生`);
}

// ============ 3. 主界面 ============
function enterMain(welcomeMsg) {
    ui = new UI(game, dom);
    show('main');
    if (welcomeMsg) ui.log(welcomeMsg, 'levelup');
    // 角色立绘按所选角色展示
    if (game.state.player?.characterId) {
        const c = getCharacter(game.state.player.characterId);
        ui.applyCharacter?.(c);
    }
}

$('btn-home').addEventListener('click', () => {
    if (confirm('返回主页？当前进度若未保存将丢失。')) {
        if (homeScene) {
            homeScene.setCharacter(pendingCharacterId);
            homeScene.start();
        }
        show('home');
    }
});

$('btn-save').addEventListener('click', () => {
    const save = game.toSave();
    if (!save) return alert('尚无角色');
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    ui?.log('💾 已保存到本地', 'normal');
    $('btn-continue-home').classList.remove('hidden');
});

$('btn-new').addEventListener('click', () => {
    if (confirm('确定要开始新的一局吗？当前进度将丢失。')) {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
    }
});

// ============ 弹窗 ============
$('modal-close').addEventListener('click', () => $('modal').classList.add('hidden'));
$('modal').addEventListener('click', e => {
    if (e.target === $('modal')) $('modal').classList.add('hidden');
});

// ============ 启动 ============
preloadCharacters();
initHome();
show('home');
