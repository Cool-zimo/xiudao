import { NPC_KIND_DEFS } from '../data/npc.js';

/**
 * NPC 交互系统
 *
 * 五种交互，各自牵动不同的世界变量：
 *   交谈  获取情报（灵脉位置 / 门派动向 / 他人虚实），小幅加好感
 *   交易  用灵石换资源，价格随好感浮动
 *   切磋  比拼战力，胜得修为与好感，败则受伤
 *   赠礼  送灵石换好感，是结交高人的捷径
 *   袭击  抢灵石，心魔大涨，对方与同门记仇
 *
 * 好感（favor）是长线变量：同一批 NPC 会记住你的每一次善意与背叛，
 * 最终决定这个世界待你是友是敌。
 */

export class InteractionSystem {
    constructor(npcSys, rng, time) {
        this.npcs = npcSys;
        this.rng = rng;
        this.time = time;
    }

    /**
     * 交谈：随机情报
     * @returns {{text:string, favor:number}}
     */
    talk(npc, player) {
        const R = this.rng;
        const w = this.npcs.world;
        const kinds = [];

        // 情报 1：附近灵脉方位
        const vein = this._nearestVein(npc.x, npc.y);
        if (vein) {
            const dir = this._dirName(vein.x - npc.x, vein.y - npc.y);
            kinds.push({
                text: `「${dir}三十里外有一道地脉，灵气逼人，去那儿打坐胜过此处十倍。」`,
                favor: 2
            });
        }

        // 情报 2：门派动向
        const sects = [...this.npcs.sects.values()];
        if (sects.length) {
            const s = R.pick(sects);
            const strong = s.strength > 100;
            kinds.push({
                text: strong
                    ? `「${s.name}近来气势正盛，门下弟子骄横，你若撞上，能避则避。」`
                    : `「${s.name}元气大伤，正是可乘之机。」`,
                favor: 1
            });
        }

        // 情报 3：某位高手的虚实
        const alive = this.npcs.aliveNpcs().filter(n => n.id !== npc.id);
        if (alive.length) {
            const t = R.pick(alive);
            const realm = ['练气', '筑基', '结丹', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'][t.realmIndex] || '?';
            kinds.push({
                text: `「${t.name}么……${realm}期修为，${t.power > (npc.power * 1.5) ? '深不可测，莫要招惹' : '不过如此'}。」`,
                favor: 1
            });
        }

        // 情报 4：时辰修行之道
        kinds.push({
            text: npc.isEvil
                ? `「子时阴气最盛，我等修行之人，自当顺天应时。」`
                : `「午时阳气最旺，正宜打坐。你若逆时而行，事倍功半。」`,
            favor: 1
        });

        // 情报 5：自身近况
        kinds.push({
            text: `「${npc.lastThought || '不过混迹度日罢了'}。」`,
            favor: 0
        });

        const pick = R.pick(kinds);
        return { text: pick.text, favor: pick.favor };
    }

    /**
     * 交易：好感越高价格越低
     * @returns {{ok:boolean, reason?:string, items?:Array}}
     */
    trade(npc, player) {
        // 按 NPC 身份生成在售商品
        const stock = this._stock(npc);
        const discount = 1 - Math.min(0.4, Math.max(0, npc.favor) / 200);  // 好感满最多打 6 折
        const items = stock.map(s => ({
            name: s.name,
            count: s.count,
            price: Math.max(1, Math.round(s.price * discount)),
            desc: s.desc
        }));
        return { ok: true, items, discount: Math.round((1 - discount) * 100) };
    }

    /** 执行购买 */
    buy(npc, player, item) {
        if ((player.gold || 0) < item.price) {
            return { ok: false, reason: `灵石不足，需 ${item.price}` };
        }
        player.gold -= item.price;
        npc.gold += item.price;
        player.inventory = player.inventory || [];
        const slot = player.inventory.find(i => i.name === item.name);
        if (slot) slot.count = (slot.count || 0) + item.count;
        else player.inventory.push({ name: item.name, count: item.count });

        npc.favor = Math.min(100, npc.favor + 3);
        return {
            ok: true,
            text: `以 ${item.price} 灵石购得 ${item.name} ×${item.count}`,
            favor: 3
        };
    }

    /**
     * 切磋：比拼战力
     */
    spar(npc, player) {
        const a = player.attributes || {};
        const c = player.cultivation || {};
        const power = (a.attack || 10) + (a.defense || 5) * 0.5
            + (c.level || 1) * 2 + (c.realmIndex || 0) * 10;
        const R = this.rng;

        // 好感高时对方会手下留情
        const mercy = npc.favor > 40 ? 0.85 : 1;
        const npcPower = npc.power * mercy;

        if (power >= npcPower) {
            const exp = 20 + Math.floor(R.next() * 30) + npc.realmIndex * 10;
            npc.hp = Math.max(1, npc.hp - Math.floor(npc.maxHp * 0.2));
            npc.favor = Math.min(100, npc.favor + 6);
            npc.addDebt('player', 10);
            return {
                ok: true, win: true, exp,
                text: `胜！${npc.name}拱手认输：「道友修为了得。」你获得 ${exp} 点修为`,
                favor: 6
            };
        }

        const dmg = Math.max(5, Math.floor((npcPower - power) * 1.2 + R.next() * 10));
        a.hp = Math.max(1, (a.hp || 100) - dmg);
        npc.favor = Math.max(-100, npc.favor - 2);
        return {
            ok: true, win: false, damage: dmg,
            text: `败！${npc.name}收势而立：「道友还需苦练。」你受伤 ${dmg} 点`,
            favor: -2
        };
    }

    /**
     * 赠礼：灵石换好感，递减收益
     */
    gift(npc, player, amount = 50) {
        if ((player.gold || 0) < amount) {
            return { ok: false, reason: '灵石不足' };
        }
        player.gold -= amount;
        npc.gold += amount;

        // 好感越高，同样的礼换来的好感越少（边际递减）
        const base = Math.sqrt(amount) * 1.6;
        const decay = 1 - Math.min(0.75, Math.max(0, npc.favor) / 133);
        const gain = Math.round(base * decay);

        npc.favor = Math.min(100, npc.favor + gain);
        npc.addDebt('player', amount);

        let flavor;
        if (npc.favor >= 60) flavor = `${npc.name}动容：「道友厚赠，某记下了。」`;
        else if (npc.favor >= 25) flavor = `${npc.name}收下灵石，神色缓和。`;
        else flavor = `${npc.name}接过灵石，只淡淡拱手。`;

        return { ok: true, text: `赠予 ${amount} 灵石。${flavor}`, favor: gain };
    }

    /**
     * 袭击：抢灵石，心魔大涨，结仇
     */
    attack(npc, player) {
        const a = player.attributes || {};
        const c = player.cultivation || {};
        const power = (a.attack || 10) + (a.defense || 5) * 0.5
            + (c.level || 1) * 2 + (c.realmIndex || 0) * 10;
        const R = this.rng;

        // 袭击方额外加成（偷袭）
        const effective = power * 1.25;

        if (effective >= npc.power) {
            const loot = Math.min(npc.gold, 30 + Math.floor(R.next() * 60));
            npc.gold -= loot;
            player.gold = (player.gold || 0) + loot;
            npc.hp = Math.max(0, npc.hp - Math.floor(npc.maxHp * 0.5));

            player.karma = Math.min(100, (player.karma ?? 0) + 12);
            npc.favor = -100;
            npc.addGrudge('player', 60);

            // 同门记仇
            if (npc.sectId) {
                const sect = this.npcs.sects.get(npc.sectId);
                if (sect) {
                    for (const id of sect.members) {
                        const m = this.npcs.npcs.get(id);
                        if (m && m.id !== npc.id) { m.addGrudge('player', 35); m.favor = Math.max(-100, m.favor - 30); }
                    }
                }
            }

            if (npc.hp <= 0) {
                npc.alive = false;
                if (npc.sectId) {
                    const sect = this.npcs.sects.get(npc.sectId);
                    if (sect) sect.members.delete(npc.id);
                }
                this.npcs._log(`💀 ${npc.name} 被 ${player.name || '你'} 袭杀`);
                return {
                    ok: true, killed: true, loot,
                    text: `你袭杀 ${npc.name}，夺得 ${loot} 灵石。心魔 +12，${npc.sectId ? '其同门皆与你结仇' : '此事已传遍江湖'}`,
                    karma: 12
                };
            }

            this.npcs._log(`🩸 ${player.name || '你'} 袭击 ${npc.name}`);
            return {
                ok: true, killed: false, loot,
                text: `重创 ${npc.name}，夺得 ${loot} 灵石。心魔 +12，对方恨你入骨`,
                karma: 12
            };
        }

        // 袭击失败
        const dmg = Math.max(8, Math.floor((npc.power - effective) * 1.5 + R.next() * 12));
        a.hp = Math.max(1, (a.hp || 100) - dmg);
        player.karma = Math.min(100, (player.karma ?? 0) + 8);
        npc.favor = -100;
        npc.addGrudge('player', 70);

        if (npc.sectId) {
            const sect = this.npcs.sects.get(npc.sectId);
            if (sect) {
                for (const id of sect.members) {
                    const m = this.npcs.npcs.get(id);
                    if (m && m.id !== npc.id) { m.addGrudge('player', 40); m.favor = Math.max(-100, m.favor - 35); }
                }
            }
        }

        return {
            ok: true, killed: false, loot: 0, damage: dmg,
            text: `袭击失手！${npc.name}反击，你受伤 ${dmg} 点。心魔 +8，${npc.sectId ? '整个门派与你为敌' : '对方誓要复仇'}`,
            karma: 8
        };
    }

    /**
     * 拜师入宗：需好感足够 + 对方是宗门弟子
     */
    join(npc, player) {
        if (!npc.sectId) return { ok: false, reason: '对方并无师门' };
        if (npc.favor < 40) return { ok: false, reason: `好感不足（需 40，当前 ${Math.round(npc.favor)}）` };
        if (player.sectId === npc.sectId) return { ok: false, reason: '你已是本门弟子' };

        const sect = this.npcs.sects.get(npc.sectId);
        if (!sect) return { ok: false, reason: '门派已不存在' };

        // 邪道门派会拉高心魔
        const before = player.sectId;
        player.sectId = sect.id;
        player.sectName = sect.name;

        if (sect.doctrine === '邪道') {
            player.karma = Math.min(100, (player.karma ?? 0) + 15);
        }

        // 加入新门派，得罪旧门派
        if (before && before !== sect.id) {
            const old = this.npcs.sects.get(before);
            if (old) {
                for (const id of old.members) {
                    const m = this.npcs.npcs.get(id);
                    if (m) { m.favor = Math.max(-100, m.favor - 25); m.addGrudge('player', 20); }
                }
            }
        }

        return {
            ok: true,
            text: `你拜入 ${sect.name}。${sect.doctrine === '邪道' ? '入魔门者，心魔 +15。' : '自此同门一体，休戚与共。'}`,
            sectName: sect.name
        };
    }

    // ---------- 工具 ----------

    _nearestVein(x, y, maxR = 20) {
        const w = this.npcs.world;
        let best = null, bq = 0;
        for (let dy = -maxR; dy <= maxR; dy += 2) {
            for (let dx = -maxR; dx <= maxR; dx += 2) {
                const nx = x + dx, ny = y + dy;
                if (!w.inBounds(nx, ny)) continue;
                const q = w.qiAt(nx, ny);
                if (q >= 4 && q > bq) { bq = q; best = { x: nx, y: ny }; }
            }
        }
        return best;
    }

    _dirName(dx, dy) {
        if (Math.abs(dx) > Math.abs(dy) * 2) return dx > 0 ? '东' : '西';
        if (Math.abs(dy) > Math.abs(dx) * 2) return dy > 0 ? '南' : '北';
        const ns = dy > 0 ? '南' : '北';
        const ew = dx > 0 ? '东' : '西';
        return ns + ew;
    }

    _stock(npc) {
        const R = this.rng;
        const base = [
            { name: '灵草', count: 2 + Math.floor(R.next() * 3), price: 25, desc: '炼丹主材' },
            { name: '灵石', count: 3 + Math.floor(R.next() * 5), price: 15, desc: '修行硬通货' }
        ];
        if (npc.isEvil) {
            base.push({ name: '噬魂幡', count: 1, price: 180, desc: '邪道法器，攻击 +12' });
        }
        if (npc.sectId) {
            base.push({ name: '疗伤丹', count: 1 + Math.floor(R.next() * 2), price: 60, desc: '恢复三成气血' });
        }
        if (npc.realmIndex >= 3) {
            base.push({ name: '功法残卷', count: 1, price: 220, desc: '可参悟新功法' });
        }
        // 储备随境界提升
        return base.map(s => ({
            ...s,
            count: s.count + Math.floor(npc.realmIndex / 2)
        }));
    }
}
