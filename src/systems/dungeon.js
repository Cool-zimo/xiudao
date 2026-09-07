import { bus, EV } from '../core/event-bus.js';
import { RNG } from '../core/rng.js';
import dungeonData from '../data/dungeon.js';

let nodeSeq = 0;

/**
 * 秘境探索（Roguelike）
 *
 * 设计要点：
 * - 每层随机生成一张节点图（类似杀戮尖塔）
 * - 遗物（relic）跨局永久保留，形成长线成长
 * - 使用种子随机，同种子生成相同地图，便于分享与复现
 */
export class DungeonSystem {
    constructor(state) {
        this.state = state;
        this.data = dungeonData;
        this.current = null; // 当前探索会话
    }

    /**
     * 进入秘境
     * @param {Object} player
     * @param {number} floor - 层数，默认从 1 开始
     * @param {number} seed - 随机种子
     */
    enter(player, floor = 1, seed = Date.now()) {
        const cfg = this.data.floorConfig;
        const hpCost = cfg.hpCostPerFloor * floor;
        if ((player.attributes?.hp || 0) < hpCost) {
            return { ok: false, reason: `灵力不足，需要 ${hpCost} 点生命值作为引` };
        }

        player.attributes.hp -= hpCost;
        const rng = new RNG(seed);

        // 生成节点图：每层节点数递增
        const nodeCount = cfg.baseNodeCount + (floor - 1) * cfg.nodesPerFloor;
        const isBossFloor = floor % cfg.bossEveryFloors === 0;

        const nodes = [];
        for (let i = 0; i < nodeCount; i++) {
            const type = rng.weighted(this.data.nodeTypes);
            nodes.push({
                id: `n${++nodeSeq}`,
                index: i,
                type: type.id,
                name: type.name,
                icon: type.icon,
                cleared: false,
                revealed: false
            });
        }

        // BOSS 层：末尾固定加 BOSS
        if (isBossFloor) {
            nodes.push({
                id: `n${++nodeSeq}`,
                index: nodeCount,
                type: 'boss',
                name: '秘境之主',
                icon: '🐉',
                cleared: false,
                revealed: true
            });
        }

        // 起始节点始终可见
        if (nodes[0]) nodes[0].revealed = true;

        this.current = {
            floor,
            seed,
            rng,
            nodes,
            position: 0,
            relicsGained: [],
            expMultiplier: Math.pow(cfg.expMultiplierPerFloor, floor - 1),
            finished: false
        };

        bus.emit(EV.EXPLORE_ENTER, { player, floor, seed, nodeCount: nodes.length });
        return { ok: true, dungeon: this.current };
    }

    /** 推进到下一个节点 */
    advance(player) {
        if (!this.current || this.current.finished) {
            return { ok: false, reason: '当前没有进行中的探索' };
        }
        const d = this.current;
        if (d.position >= d.nodes.length) {
            return { ok: false, reason: '已抵达秘境终点' };
        }

        const node = d.nodes[d.position];
        // 揭示后续节点（受遗物 revealNodes 加成）
        const revealCount = 1 + this.getRelicEffect(player, 'revealNodes');
        for (let i = 1; i <= revealCount; i++) {
            if (d.nodes[d.position + i]) d.nodes[d.position + i].revealed = true;
        }

        const result = this._resolveNode(player, node);
        bus.emit(EV.EXPLORE_NODE, { player, node, result, floor: d.floor });
        return { ok: true, node, result };
    }

    _resolveNode(player, node) {
        const d = this.current;
        const rng = d.rng;
        const result = { type: node.type, rewards: {}, text: '' };

        switch (node.type) {
            case 'monster':
            case 'elite':
            case 'boss': {
                const isBoss = node.type === 'boss';
                const isElite = node.type === 'elite';
                const exp = Math.floor(
                    (isBoss ? 800 : isElite ? 300 : 100) * d.expMultiplier
                );
                result.rewards.exp = exp;
                result.text = `${node.icon} ${node.name}出现！`;
                bus.emit(EV.BATTLE_START, { player, nodeType: node.type, isBoss });
                break;
            }
            case 'treasure': {
                const relic = rng.weighted(
                    this.data.relics.map(r => ({
                        ...r,
                        weight: r.rarity === 'common' ? 50 : r.rarity === 'rare' ? 25 : r.rarity === 'epic' ? 10 : 3
                    }))
                );
                this._grantRelic(player, relic);
                result.rewards.relic = relic;
                result.rewards.gold = rng.int(50, 200);
                result.text = `📦 开启宝箱，获得遗物【${relic.name}】`;
                break;
            }
            case 'cultivate': {
                const exp = Math.floor(150 * d.expMultiplier);
                result.rewards.exp = exp;
                result.text = `🧘 洞天福地，灵气充盈，修为 +${exp}`;
                break;
            }
            case 'merchant':
                result.text = '🏪 遇见游商，可交易物品';
                break;
            case 'event':
                result.text = '❓ 前方有异象';
                break;
        }

        node.cleared = true;
        d.position++;
        return result;
    }

    /** 结算本层并退出 */
    exit(player) {
        if (!this.current) return { ok: false, reason: '当前没有进行中的探索' };
        const d = this.current;
        const cleared = d.nodes.filter(n => n.cleared).length;
        const bonus = Math.floor(cleared * 50 * d.expMultiplier);

        const summary = {
            floor: d.floor,
            cleared,
            total: d.nodes.length,
            bonusExp: bonus,
            relics: d.relicsGained
        };

        this.current = null;
        bus.emit(EV.EXPLORE_EXIT, { player, summary });
        return { ok: true, summary };
    }

    /** 发放遗物（永久保留） */
    _grantRelic(player, relic) {
        player.relics = player.relics || [];
        if (!player.relics.find(r => r.id === relic.id)) {
            player.relics.push({ id: relic.id, name: relic.name, desc: relic.desc, effect: relic.effect });
            this.current?.relicsGained.push(relic.id);
            bus.emit(EV.ITEM_GAIN, { player, item: relic, kind: 'relic' });
        }
    }

    /** 汇总所有遗物效果 */
    getRelicEffects(player) {
        const eff = {};
        for (const r of player.relics || []) {
            for (const [k, v] of Object.entries(r.effect || {})) {
                eff[k] = (eff[k] || 0) + v;
            }
        }
        return eff;
    }

    getRelicEffect(player, key) {
        return this.getRelicEffects(player)[key] || 0;
    }

    /** 当前探索进度（供 UI 渲染） */
    getProgress() {
        if (!this.current) return null;
        return {
            floor: this.current.floor,
            position: this.current.position,
            total: this.current.nodes.length,
            nodes: this.current.nodes
        };
    }
}
