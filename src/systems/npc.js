import { NPC_KIND, NPC_KIND_DEFS, NPC_SURNAMES, NPC_GIVEN } from '../data/npc.js';
import { TILE, tileDef } from '../data/terrain.js';

/**
 * NPC 与门派系统 —— 效用 AI（Utility AI）
 *
 * 为什么不用行为树：效用 AI 几十行就能出效果，且天然支持"多个需求竞争"。
 * 每个 NPC 每隔若干刻给自己所有可行动作打分，执行分最高的那个：
 *
 *   修炼 = 基础分 × 当前地块灵气 × 时辰系数
 *   采集 = 附近资源数 × 权重
 *   探索 = 见到的未探索地块数
 *   战斗 = 附近敌对目标数 × 战力差
 *   复仇 = 有仇人且能打得过 → 极高优先级
 *   休息 = 血量低时飙升
 *
 * 于是涌现出复杂行为：邪修为抢灵脉杀人结仇 → 对方徒弟来复仇 →
 * 灵脉空出又被第三人占据。这就是"世界活起来"的来源。
 */

let _uid = 1;

export class NPC {
    constructor(opts) {
        this.id = _uid++;
        this.name = opts.name || '无名';
        this.kind = opts.kind || NPC_KIND.ROAMER;
        this.def = NPC_KIND_DEFS[this.kind];

        this.x = opts.x; this.y = opts.y;
        this.homeX = opts.x; this.homeY = opts.y;   // 洞府/据点

        this.realmIndex = opts.realmIndex ?? 0;
        this.level = opts.level ?? 1;
        this.exp = 0;
        this.hp = opts.hp ?? 60;
        this.maxHp = opts.maxHp ?? 60;
        this.attack = opts.attack ?? 10;
        this.defense = opts.defense ?? 5;
        this.karma = opts.karma ?? this.def.baseKarma;
        this.gold = opts.gold ?? 0;

        this.sectId = opts.sectId ?? null;
        this.alive = true;

        /** 记忆：谁对我做了什么 */
        this.grudges = new Map();     // targetId -> 仇恨值
        this.debt = new Map();        // targetId -> 恩情值
        this.known = new Set();       // 见过的 NPC id

        this.action = 'idle';
        this.actionTurns = 0;
        this.moveTo = null;
        this.lastThought = '';

        /** 对玩家的好感（-100 ~ 100），影响交互选项与态度 */
        this.favor = opts.favor ?? 0;
    }

    /** 好感对应的态度描述 */
    get attitude() {
        if (this.favor >= 60) return { key: 'devoted', name: '敬重', color: '#4ade80' };
        if (this.favor >= 25) return { key: 'friendly', name: '友善', color: '#86efac' };
        if (this.favor >= -10) return { key: 'neutral', name: '平淡', color: '#94a3b8' };
        if (this.favor >= -45) return { key: 'hostile', name: '戒备', color: '#fbbf24' };
        return { key: 'hateful', name: '仇视', color: '#f87171' };
    }

    get power() {
        return this.attack + this.defense * 0.5 + this.level * 2 + this.realmIndex * 10;
    }

    get isEvil() { return this.karma >= 50; }

    /** 记录仇恨 */
    addGrudge(targetId, amount) {
        const cur = this.grudges.get(targetId) || 0;
        this.grudges.set(targetId, cur + amount);
    }
    /** 记录恩情 */
    addDebt(targetId, amount) {
        const cur = this.debt.get(targetId) || 0;
        this.debt.set(targetId, cur + amount);
    }
    /** 最恨的人 */
    worstEnemy() {
        let best = null, max = 0;
        for (const [id, v] of this.grudges) {
            if (v > max) { max = v; best = id; }
        }
        return best ? { id: best, value: max } : null;
    }
}

export class Sect {
    constructor(id, name, opts = {}) {
        this.id = id;
        this.name = name;
        this.color = opts.color || '#60a5fa';
        this.members = new Set();       // npc id
        this.strength = opts.strength ?? 100;
        this.territory = opts.territory || [];   // 控制的地块 key
        this.enemies = new Set();       // 敌对门派 id
        this.doctrine = opts.doctrine || '正道';
    }
}

export class NPCSystem {
    constructor(world, rng, time) {
        this.world = world;
        this.rng = rng;
        this.time = time;
        this.npcs = new Map();      // id -> NPC
        this.sects = new Map();     // id -> Sect
        this.chronicle = [];        // 编年史：世界大事记
        this.tickCount = 0;
    }

    // ---------- 初始化 ----------

    /** 生成初始人口与门派 */
    populate({ npcCount = 24, sectCount = 3 } = {}) {
        // 门派
        const sectNames = ['青云宗', '灵霄阁', '血煞门'];
        const doctrines = ['正道', '正道', '邪道'];
        for (let i = 0; i < sectCount; i++) {
            const s = new Sect(i + 1, sectNames[i] || `宗门${i + 1}`, {
                color: ['#60a5fa', '#a78bfa', '#f87171'][i] || '#94a3b8',
                strength: 80 + Math.floor(this.rng.next() * 60),
                doctrine: doctrines[i] || '正道'
            });
            this.sects.set(s.id, s);
        }

        // NPC：优先落在洞府石台、山门、灵脉附近
        const spots = this._pickSpawnSpots(npcCount);
        for (let i = 0; i < npcCount; i++) {
            const spot = spots[i];
            // 前 60% 分给门派，其余为散修/邪修
            let kind, sectId = null;
            if (i < npcCount * 0.6) {
                const s = [...this.sects.values()][i % this.sects.size];
                sectId = s.id;
                kind = s.doctrine === '邪道' ? NPC_KIND.DEMON : NPC_KIND.SECT;
            } else {
                kind = this.rng.next() < 0.35 ? NPC_KIND.DEMON : NPC_KIND.ROAMER;
            }
            const npc = this._makeNPC(kind, spot.x, spot.y, sectId);
            this.npcs.set(npc.id, npc);
            if (sectId) this.sects.get(sectId).members.add(npc.id);
            this.world.occupied = this.world.occupied || new Set();
            this.world.occupied.add(`${spot.x},${spot.y}`);
        }
        this._log(`🌍 天下初开，${npcCount} 名修士散落四方，${sectCount} 个宗门并立`);
    }

    _makeNPC(kind, x, y, sectId) {
        const def = NPC_KIND_DEFS[kind];
        const name = this.rng.pick(NPC_SURNAMES) + this.rng.pick(NPC_GIVEN);
        const realmIndex = Math.floor(this.rng.next() * 4);
        const level = 1 + Math.floor(this.rng.next() * 10);
        const hp = 50 + realmIndex * 25 + level * 3;

        return new NPC({
            name, kind, x, y, sectId,
            realmIndex, level,
            hp, maxHp: hp,
            attack: 8 + realmIndex * 6 + level,
            defense: 4 + realmIndex * 3,
            karma: Math.max(0, Math.min(100,
                def.baseKarma + Math.floor((this.rng.next() - 0.5) * 30))),
            gold: Math.floor(this.rng.next() * 200)
        });
    }

    _pickSpawnSpots(n) {
        const spots = [];
        const w = this.world;
        // 候选：洞府石台 > 灵脉 > 山门 > 任意可通行
        const caves = [], veins = [], plains = [];
        for (let y = 2; y < w.size - 2; y++) {
            for (let x = 2; x < w.size - 2; x++) {
                if (!w.walkable(x, y)) continue;
                const t = w.get(x, y);
                if (t === TILE.CAVE) caves.push({ x, y });
                else if (t === TILE.VEIN) veins.push({ x, y });
                else if (t === TILE.PLAIN || t === TILE.ORE) plains.push({ x, y });
            }
        }
        const pool = [...this.rng.shuffle(caves), ...this.rng.shuffle(veins), ...this.rng.shuffle(plains)];
        for (const p of pool) {
            if (spots.length >= n) break;
            if (spots.some(s => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) < 2)) continue;
            spots.push(p);
        }
        while (spots.length < n) {
            const p = w.findWalkableNear(
                Math.floor(this.rng.next() * w.size),
                Math.floor(this.rng.next() * w.size)
            );
            spots.push(p);
        }
        return spots;
    }

    // ---------- 效用 AI ----------

    /**
     * 推进一个刻（tick）
     * @param {Object} player 玩家对象（可为 null）
     */
    tick(player = null) {
        this.tickCount++;
        // 玩家每走一步 = 前进 10 分钟
        this.time.advance(10);

        for (const npc of this.npcs.values()) {
            if (!npc.alive) continue;
            this._think(npc, player);
        }

        // 每 12 刻（约 2 小时）结算一次门派大事
        if (this.tickCount % 12 === 0) this._sectTick();
    }

    /** 单个 NPC 决策：打分 → 执行最高分 */
    _think(npc, player) {
        const w = this.world;
        const R = this.rng;
        const scores = [];
        const def = npc.def.weights;

        // --- 1. 休息（血低优先级飙升）---
        const hpRatio = npc.hp / npc.maxHp;
        scores.push({ act: 'rest', score: hpRatio < 0.35 ? 95 : (hpRatio < 0.6 ? 45 : 8) });

        // --- 2. 复仇（有仇人且打得过 → 极高）---
        const foe = npc.worstEnemy();
        if (foe) {
            const target = this.npcs.get(foe.id);
            const isPlayer = foe.id === 'player';
            const tp = isPlayer && player ? this._playerPower(player) : (target?.power || 0);
            if (tp > 0) {
                const canWin = npc.power >= tp * 0.85;
                const dist = isPlayer && player
                    ? Math.abs(player.worldX - npc.x) + Math.abs(player.worldY - npc.y)
                    : (target ? Math.abs(target.x - npc.x) + Math.abs(target.y - npc.y) : 99);
                const proximity = Math.max(0, 1 - dist / 30);
                scores.push({
                    act: 'revenge',
                    score: (canWin ? 70 : 25) * proximity * def.revenge * (foe.value / 50),
                    data: { foeId: foe.id }
                });
            }
        }

        // --- 3. 修炼（当前地块灵气 × 时辰 × 性格）---
        const qi = w.qiAt(npc.x, npc.y);
        const timeMul = this.time.cultivationMul(npc.karma);
        scores.push({
            act: 'cultivate',
            score: (20 + qi * 12) * timeMul * def.cultivate
        });

        // --- 4. 采集（附近资源）---
        const nearRes = this._countNearbyResources(npc.x, npc.y, 2);
        scores.push({ act: 'gather', score: nearRes * 22 * def.gather });

        // --- 5. 探索（向高灵气移动）---
        const better = this._findBetterSpot(npc.x, npc.y, 6);
        scores.push({
            act: 'explore',
            score: better ? (better.qi - qi) * 18 * def.explore : 3,
            data: { target: better }
        });

        // --- 6. 战斗（附近敌对目标）---
        const enemies = this._findEnemiesNear(npc, 3, player);
        if (enemies.length) {
            const weakest = enemies.reduce((a, b) => (a.power < b.power ? a : b));
            const canWin = npc.power > weakest.power * 0.9;
            scores.push({
                act: 'fight',
                score: (canWin ? 65 : 20) * def.fight,
                data: { target: weakest }
            });
        }

        // 选最高分（打平时随机，避免所有 NPC 步调一致）
        scores.sort((a, b) => b.score - a.score);
        const top = scores[0].score > 0
            ? (scores.length > 1 && Math.abs(scores[0].score - scores[1].score) < 3
                ? (R.next() < 0.5 ? scores[0] : scores[1])
                : scores[0])
            : { act: 'idle' };

        this._act(npc, top, player);
    }

    _act(npc, choice, player) {
        const w = this.world;
        npc.action = choice.act;

        switch (choice.act) {
            case 'rest': {
                npc.hp = Math.min(npc.maxHp, npc.hp + Math.floor(npc.maxHp * 0.22));
                npc.lastThought = '闭目调息';
                break;
            }

            case 'cultivate': {
                const qi = w.qiAt(npc.x, npc.y);
                const mul = this.time.cultivationMul(npc.karma);
                const gain = Math.floor((6 + qi * 4) * mul);
                npc.exp += gain;
                const need = 60 + npc.level * 25 + npc.realmIndex * 120;
                if (npc.exp >= need) {
                    npc.exp -= need;
                    if (npc.level < 10) {
                        npc.level++;
                        npc.lastThought = `修为精进至 Lv${npc.level}`;
                    } else if (npc.realmIndex < 8) {
                        npc.realmIndex++;
                        npc.level = 1;
                        npc.maxHp += 30; npc.hp = npc.maxHp;
                        npc.attack += 8; npc.defense += 4;
                        const realmName = ['练气', '筑基', '结丹', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'][npc.realmIndex] || '未知';
                        npc.lastThought = `突破至${realmName}期！`;
                        if (npc.realmIndex >= 3) {
                            this._log(`🎉 ${this._npcLabel(npc)} 突破至${realmName}期`);
                        }
                    }
                } else {
                    npc.lastThought = '打坐吐纳';
                }
                // 邪修修炼会涨心魔
                if (npc.isEvil) npc.karma = Math.min(100, npc.karma + 0.3);
                break;
            }

            case 'gather': {
                const r = this._harvestNear(npc);
                if (r) {
                    npc.gold += r.type === 'stone' ? r.amount * 5 : r.amount * 2;
                    npc.lastThought = r.type === 'stone' ? '开采灵石' : '采撷灵草';
                } else {
                    npc.lastThought = '寻觅资源';
                }
                break;
            }

            case 'explore': {
                const t = choice.data?.target;
                if (t) this._stepToward(npc, t.x, t.y);
                else this._wander(npc);
                npc.lastThought = '赶路';
                break;
            }

            case 'fight': {
                const target = choice.data?.target;
                if (target) this._resolveCombat(npc, target, player);
                break;
            }

            case 'revenge': {
                const foeId = choice.data?.foeId;
                if (foeId === 'player' && player) {
                    this._stepToward(npc, player.worldX, player.worldY);
                    npc.lastThought = '寻仇而去';
                    // 走到玩家身边就开打
                    const dist = Math.abs(player.worldX - npc.x) + Math.abs(player.worldY - npc.y);
                    if (dist <= 1) this._resolveCombat(npc, { id: 'player', isPlayer: true }, player);
                } else {
                    const target = this.npcs.get(foeId);
                    if (target && target.alive) {
                        this._stepToward(npc, target.x, target.y);
                        const dist = Math.abs(target.x - npc.x) + Math.abs(target.y - npc.y);
                        if (dist <= 1) this._resolveCombat(npc, target, player);
                        else npc.lastThought = `追杀 ${target.name}`;
                    }
                }
                break;
            }

            default:
                this._wander(npc);
                npc.lastThought = '游荡';
        }
    }

    // ---------- 战斗 ----------

    _resolveCombat(npc, target, player) {
        const R = this.rng;
        const isPlayer = target.isPlayer || target.id === 'player';
        const tName = isPlayer ? (player?.name || '你') : target.name;
        const tp = isPlayer ? this._playerPower(player) : (target.power || 0);

        if (npc.power >= tp) {
            // NPC 胜
            if (isPlayer && player) {
                const dmg = Math.max(4, Math.floor((npc.power - tp) * 1.2 + R.next() * 10));
                player.attributes.hp = Math.max(1, player.attributes.hp - dmg);
                const taken = Math.min(player.gold || 0, 20 + Math.floor(R.next() * 40));
                player.gold = (player.gold || 0) - taken;
                npc.gold += taken;
                this._log(`⚔️ ${this._npcLabel(npc)} 袭击了你，夺走 ${taken} 灵石，你受伤 ${dmg}`);
            } else {
                target.hp = Math.max(0, target.hp - Math.floor(npc.power * 0.6));
                if (target.hp <= 0) {
                    target.alive = false;
                    const sect = target.sectId ? this.sects.get(target.sectId) : null;
                    if (sect) {
                        sect.members.delete(target.id);
                        sect.strength = Math.max(0, sect.strength - 12);
                        // 同门记仇
                        for (const id of sect.members) {
                            const m = this.npcs.get(id);
                            if (m) m.addGrudge(npc.id, 40);
                        }
                    }
                    this._log(`💀 ${this._npcLabel(npc)} 斩杀 ${tName}`);
                } else {
                    target.addGrudge(npc.id, 30);
                    this._log(`⚔️ ${this._npcLabel(npc)} 重创 ${tName}`);
                }
            }
            npc.lastThought = `与 ${tName} 交手占优`;
        } else {
            // NPC 败
            const dmg = Math.max(5, Math.floor((tp - npc.power) * 1.3 + R.next() * 8));
            npc.hp = Math.max(0, npc.hp - dmg);
            npc.addGrudge(target.id || 'player', 25);
            if (npc.hp <= 0) {
                npc.alive = false;
                const sect = npc.sectId ? this.sects.get(npc.sectId) : null;
                if (sect) {
                    sect.members.delete(npc.id);
                    sect.strength = Math.max(0, sect.strength - 12);
                    for (const id of sect.members) {
                        const m = this.npcs.get(id);
                        if (m) m.addGrudge(target.id || 'player', 35);
                    }
                }
                this._log(`💀 ${this._npcLabel(npc)} 被 ${tName} 击杀`);
            } else {
                this._log(`🩸 ${this._npcLabel(npc)} 不敌 ${tName}，负伤遁走`);
            }
            npc.lastThought = '负伤';
        }
    }

    _playerPower(player) {
        if (!player) return 0;
        const a = player.attributes || {};
        const c = player.cultivation || {};
        return (a.attack || 10) + (a.defense || 5) * 0.5
            + (c.level || 1) * 2 + (c.realmIndex || 0) * 10;
    }

    // ---------- 门派大事 ----------

    _sectTick() {
        // 门派实力随成员数缓变
        for (const s of this.sects.values()) {
            s.strength = Math.max(0, s.strength - 1 + s.members.size * 0.6);
        }
        // 敌对门派之间随机爆发冲突
        const list = [...this.sects.values()];
        if (list.length >= 2 && this.rng.next() < 0.25) {
            const a = this.rng.pick(list);
            let b = this.rng.pick(list);
            if (a.id !== b.id) {
                if (!a.enemies.has(b.id)) {
                    a.enemies.add(b.id); b.enemies.add(a.id);
                    this._log(`🔥 ${a.name} 与 ${b.name} 正式交恶`);
                } else if (this.rng.next() < 0.4) {
                    const pa = a.strength, pb = b.strength;
                    const win = pa > pb ? a : b;
                    const lose = pa > pb ? b : a;
                    win.strength = Math.max(0, win.strength - 10);
                    lose.strength = Math.max(0, lose.strength - 25);
                    this._log(`⚔️ ${win.name} 与 ${lose.name} 爆发冲突，${win.name} 占上风`);
                }
            }
        }
    }

    // ---------- 工具 ----------

    _countNearbyResources(x, y, r) {
        let n = 0;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (this.world.resources.has(`${x + dx},${y + dy}`)) n++;
            }
        }
        return n;
    }

    _findBetterSpot(x, y, radius) {
        const w = this.world;
        const cur = w.qiAt(x, y);
        let best = null, bestQi = cur + 0.5;
        for (let dy = -radius; dy <= radius; dy += 2) {
            for (let dx = -radius; dx <= radius; dx += 2) {
                const nx = x + dx, ny = y + dy;
                if (!w.walkable(nx, ny)) continue;
                if (w.occupied?.has(`${nx},${ny}`)) continue;
                const q = w.qiAt(nx, ny);
                if (q > bestQi) { bestQi = q; best = { x: nx, y: ny, qi: q }; }
            }
        }
        return best;
    }

    _findEnemiesNear(npc, r, player) {
        const out = [];
        // 其他 NPC：不同门派 or 有仇 or 邪修见谁都打
        for (const other of this.npcs.values()) {
            if (other.id === npc.id || !other.alive) continue;
            const dist = Math.abs(other.x - npc.x) + Math.abs(other.y - npc.y);
            if (dist > r) continue;
            const sameTeam = npc.sectId && npc.sectId === other.sectId;
            if (sameTeam) continue;
            const grudge = npc.grudges.get(other.id) || 0;
            if (npc.isEvil || grudge > 15 || other.isEvil) out.push(other);
        }
        // 玩家
        if (player && player.worldX !== undefined) {
            const dist = Math.abs(player.worldX - npc.x) + Math.abs(player.worldY - npc.y);
            if (dist <= r) {
                const grudge = npc.grudges.get('player') || 0;
                if (npc.isEvil || grudge > 20) {
                    out.push({ id: 'player', isPlayer: true, power: this._playerPower(player), name: player.name });
                }
            }
        }
        return out;
    }

    _harvestNear(npc) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const r = this.world.harvest(npc.x + dx, npc.y + dy);
                if (r) return r;
            }
        }
        return null;
    }

    _stepToward(npc, tx, ty) {
        const w = this.world;
        const dx = Math.sign(tx - npc.x);
        const dy = Math.sign(ty - npc.y);
        const opts = [];
        if (dx) opts.push([dx, 0]);
        if (dy) opts.push([0, dy]);
        if (!dx && !dy) return;
        for (const [mx, my] of opts) {
            const nx = npc.x + mx, ny = npc.y + my;
            if (w.walkable(nx, ny) && !this._occupiedByOther(npc, nx, ny)) {
                npc.x = nx; npc.y = ny; return;
            }
        }
        this._wander(npc);
    }

    _occupiedByOther(self, x, y) {
        for (const n of this.npcs.values()) {
            if (n.id !== self.id && n.alive && n.x === x && n.y === y) return true;
        }
        return false;
    }

    _wander(npc) {
        const R = this.rng;
        const dirs = R.shuffle([[0, -1], [0, 1], [-1, 0], [1, 0]]);
        for (const [dx, dy] of dirs) {
            const nx = npc.x + dx, ny = npc.y + dy;
            if (this.world.walkable(nx, ny) && !this._occupiedByOther(npc, nx, ny)) {
                npc.x = nx; npc.y = ny; return;
            }
        }
    }

    _npcLabel(npc) {
        const s = npc.sectId ? this.sects.get(npc.sectId) : null;
        return `${npc.name}${s ? `（${s.name}）` : ''}`;
    }

    _log(text) {
        this.chronicle.unshift({ text, at: this.time.display(), tick: this.tickCount });
        if (this.chronicle.length > 60) this.chronicle.pop();
    }

    // ---------- 存档 ----------

    serialize() {
        return {
            tick: this.tickCount,
            npcs: [...this.npcs.values()].map(n => ({
                i: n.id, n: n.name, k: n.kind, x: n.x, y: n.y,
                hx: n.homeX, hy: n.homeY,
                ri: n.realmIndex, lv: n.level, exp: n.exp,
                hp: n.hp, mhp: n.maxHp, at: n.attack, df: n.defense,
                km: Math.round(n.karma * 10) / 10, gd: n.gold,
                sid: n.sectId, a: n.alive ? 1 : 0,
                gr: [...n.grudges], db: [...n.debt],
                fav: n.favor ?? 0
            })),
            sects: [...this.sects.values()].map(s => ({
                i: s.id, n: s.name, c: s.color,
                st: Math.round(s.strength),
                m: [...s.members], e: [...s.enemies],
                d: s.doctrine
            })),
            chronicle: this.chronicle.slice(0, 30)
        };
    }

    deserialize(data, world, rng, time) {
        if (!data) return;
        this.world = world;
        this.rng = rng;
        this.time = time;
        this.tickCount = data.tick || 0;

        this.npcs = new Map();
        for (const d of (data.npcs || [])) {
            const n = new NPC({
                name: d.n, kind: d.k, x: d.x, y: d.y, sectId: d.sid,
                realmIndex: d.ri, level: d.lv,
                hp: d.hp, maxHp: d.mhp,
                attack: d.at, defense: d.df,
                karma: d.km, gold: d.gd
            });
            n.id = d.i;
            n.homeX = d.hx; n.homeY = d.hy;
            n.exp = d.exp || 0;
            n.alive = d.a === 1;
            n.grudges = new Map(d.gr || []);
            n.debt = new Map(d.db || []);
            n.favor = d.fav || 0;
            this.npcs.set(n.id, n);
        }
        // 保证新生成的 NPC id 不与存档冲突
        _uid = Math.max(1, ...this.npcs.keys()) + 1;

        this.sects = new Map();
        for (const s of (data.sects || [])) {
            const sect = new Sect(s.i, s.n, { color: s.c, strength: s.st, doctrine: s.d });
            sect.members = new Set(s.m || []);
            sect.enemies = new Set(s.e || []);
            this.sects.set(sect.id, sect);
        }

        this.chronicle = data.chronicle || [];

        // 重建占位信息，避免 NPC 重叠
        world.occupied = world.occupied || new Set();
    }

    // ---------- 查询 ----------

    npcAt(x, y) {
        for (const n of this.npcs.values()) {
            if (n.alive && n.x === x && n.y === y) return n;
        }
        return null;
    }

    aliveNpcs() { return [...this.npcs.values()].filter(n => n.alive); }

    /** 世界概览（UI 展示） */
    summary() {
        const alive = this.aliveNpcs();
        const bySect = {};
        for (const s of this.sects.values()) {
            bySect[s.name] = { members: s.members.size, strength: Math.round(s.strength) };
        }
        const top = [...alive].sort((a, b) => b.power - a.power).slice(0, 5);
        return {
            alive: alive.length,
            dead: this.npcs.size - alive.length,
            sects: bySect,
            top: top.map(n => ({
                name: n.name,
                sect: n.sectId ? this.sects.get(n.sectId)?.name : '散修',
                realm: ['练气', '筑基', '结丹', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'][n.realmIndex] || '?',
                level: n.level,
                karma: Math.round(n.karma),
                power: Math.round(n.power)
            })),
            chronicle: this.chronicle.slice(0, 12)
        };
    }
}
