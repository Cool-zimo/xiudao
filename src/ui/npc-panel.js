import { NPC_KIND_DEFS } from '../data/npc.js';

/**
 * NPC 交互面板
 *
 * 五种交互 + 拜师，全部实时牵动 world 变量（好感 / 心魔 / 灵石 / 仇恨），
 * 结果即时反映到编年史与其他 NPC 的态度上。
 */
export class NPCPanel {
    constructor(container, opts = {}) {
        this.container = container;
        this.game = opts.game;
        this.interaction = opts.interaction;
        this.npcSystem = opts.npcSystem;
        this.onLog = opts.onLog || (() => { });
        this.onChange = opts.onChange || (() => { });   // 世界状态变化 → 触发存档

        this.npc = null;
        this.player = null;
        this.mode = 'main';        // main | trade | gift
        this.lastText = '';
    }

    /** 打开与某 NPC 的交互 */
    open(npc, player) {
        this.npc = npc;
        this.player = player;
        this.mode = 'main';
        this.lastText = '';
        this.render();
    }

    close() {
        this.npc = null;
        this.container.innerHTML = '';
    }

    render() {
        const n = this.npc;
        if (!n) return;
        const p = this.player;
        const att = n.attitude;
        const realmName = ['练气', '筑基', '结丹', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'][n.realmIndex] || '?';
        const sect = n.sectId ? this.npcSystem.sects.get(n.sectId) : null;

        const canJoin = n.sectId && n.favor >= 40 && p.sectId !== n.sectId;

        let body = '';
        if (this.mode === 'trade') body = this._renderTrade();
        else if (this.mode === 'gift') body = this._renderGift();
        else body = this._renderMain(canJoin);

        this.container.innerHTML = `
            <div class="npc-panel">
                <div class="npc-head">
                    <div class="npc-avatar" style="--c:${n.def.color}">${this._esc(n.name[0] || '修')}</div>
                    <div class="npc-meta">
                        <div class="npc-name">
                            ${this._esc(n.name)}
                            <span class="npc-att" style="color:${att.color}">${att.name}</span>
                        </div>
                        <div class="npc-sub">
                            ${this._esc(n.def.name)} · ${realmName}期 Lv${n.level}
                            ${sect ? ` · <b style="color:${sect.color}">${this._esc(sect.name)}</b>` : ''}
                        </div>
                        <div class="npc-bars">
                            <div class="npc-bar">
                                <span>好感</span>
                                <i class="fav"><b style="width:${Math.max(0, (n.favor + 100) / 2)}%;background:${att.color}"></b></i>
                                <em>${Math.round(n.favor)}</em>
                            </div>
                            <div class="npc-bar">
                                <span>心魔</span>
                                <i><b style="width:${n.karma}%"></b></i>
                                <em>${Math.round(n.karma)}</em>
                            </div>
                        </div>
                    </div>
                    <button class="npc-close" data-act="close">×</button>
                </div>

                ${this.lastText ? `<div class="npc-say">${this._esc(this.lastText)}</div>` : ''}

                ${body}
            </div>
        `;

        this._bind();
    }

    _renderMain(canJoin) {
        const n = this.npc;
        return `
            <div class="npc-acts">
                <button class="npc-act" data-act="talk">💬 交谈</button>
                <button class="npc-act" data-act="trade">🛒 交易</button>
                <button class="npc-act" data-act="spar">⚔️ 切磋</button>
                <button class="npc-act" data-act="gift">🎁 赠礼</button>
                ${canJoin ? '<button class="npc-act join" data-act="join">🏛️ 拜师入门</button>' : ''}
                <button class="npc-act danger" data-act="attack">🗡️ 袭击</button>
            </div>
            <div class="npc-tip">
                ${this._hint()}
            </div>
        `;
    }

    _hint() {
        const n = this.npc;
        if (n.isEvil) return '⚠️ 此人周身魔气缭绕，恐非善类。';
        if (n.favor >= 60) return '✨ 此人对你极为敬重，愿倾囊相授。';
        if (n.favor <= -45) return '⚠️ 此人眼中含恨，小心动手。';
        if (n.sectId && n.favor >= 40) return '💡 好感已足，可求入门。';
        if (n.sectId) return '💡 多赠灵石可提升好感，好感 40 可拜师。';
        return '💡 赠礼与切磋可积累好感。';
    }

    _renderTrade() {
        const r = this.interaction.trade(this.npc, this.player);
        if (!r.ok) return `<div class="npc-empty">${r.reason}</div>`;
        return `
            <div class="npc-trade">
                <div class="npc-trade-head">
                    在售货物 ${r.discount > 0 ? `<span class="npc-off">好感折扣 -${r.discount}%</span>` : ''}
                    <span class="npc-gold">你的灵石：${this.player.gold || 0}</span>
                </div>
                ${r.items.map((it, i) => `
                    <div class="npc-item">
                        <div class="ni-name">${this._esc(it.name)} <span>×${it.count}</span></div>
                        <div class="ni-desc">${this._esc(it.desc)}</div>
                        <button class="ni-buy" data-act="buy" data-i="${i}"
                            ${(this.player.gold || 0) < it.price ? 'disabled' : ''}>
                            ${it.price} 灵石
                        </button>
                    </div>
                `).join('')}
                <button class="npc-back" data-act="back">返回</button>
            </div>
        `;
    }

    _renderGift() {
        const amounts = [50, 100, 300];
        return `
            <div class="npc-gift">
                <div class="npc-trade-head">赠予灵石 <span class="npc-gold">持有：${this.player.gold || 0}</span></div>
                ${amounts.map(a => `
                    <button class="npc-act" data-act="giftamt" data-amt="${a}"
                        ${(this.player.gold || 0) < a ? 'disabled' : ''}>
                        🎁 ${a} 灵石
                    </button>
                `).join('')}
                <button class="npc-back" data-act="back">返回</button>
            </div>
        `;
    }

    _bind() {
        const n = this.npc;
        if (!n) return;
        const p = this.player;

        this.container.querySelector('[data-act="close"]')?.addEventListener('click', () => this.close());
        this.container.querySelector('[data-act="back"]')?.addEventListener('click', () => {
            this.mode = 'main'; this.render();
        });

        this.container.querySelector('[data-act="talk"]')?.addEventListener('click', () => {
            const r = this.interaction.talk(n, p);
            n.favor = Math.min(100, n.favor + r.favor);
            this.lastText = r.text;
            this.onLog(`💬 ${n.name}：「${r.text.replace(/[「」]/g, '')}」`, 'info');
            this._after();
        });

        this.container.querySelector('[data-act="trade"]')?.addEventListener('click', () => {
            this.mode = 'trade'; this.render();
        });

        this.container.querySelector('[data-act="gift"]')?.addEventListener('click', () => {
            this.mode = 'gift'; this.render();
        });

        this.container.querySelectorAll('[data-act="giftamt"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = parseInt(btn.dataset.amt, 10);
                const r = this.interaction.gift(n, p, amt);
                if (!r.ok) { this.lastText = r.reason; this.render(); return; }
                this.lastText = r.text;
                this.onLog(`🎁 ${r.text}`, 'reward');
                this.mode = 'main';
                this._after();
            });
        });

        this.container.querySelectorAll('[data-act="buy"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.i, 10);
                const stock = this.interaction.trade(n, p).items[i];
                const r = this.interaction.buy(n, p, stock);
                if (!r.ok) { this.lastText = r.reason; this.render(); return; }
                this.lastText = r.text;
                this.onLog(`🛒 ${r.text}`, 'reward');
                this._after();
            });
        });

        this.container.querySelector('[data-act="spar"]')?.addEventListener('click', () => {
            const r = this.interaction.spar(n, p);
            if (r.win && r.exp) this.game?._gainExp?.(r.exp);
            this.lastText = r.text;
            this.onLog(r.win ? `⚔️ ${r.text}` : `🩸 ${r.text}`, r.win ? 'reward' : 'danger');
            this._after();
        });

        this.container.querySelector('[data-act="attack"]')?.addEventListener('click', () => {
            if (!confirm(`袭击 ${n.name}？心魔将大涨，${n.sectId ? '整个门派与你为敌' : '对方誓要复仇'}。`)) return;
            const r = this.interaction.attack(n, p);
            this.lastText = r.text;
            this.onLog(`🗡️ ${r.text}`, 'danger');
            if (!n.alive) { this.close(); this.onChange(); return; }
            this._after();
        });

        this.container.querySelector('[data-act="join"]')?.addEventListener('click', () => {
            const r = this.interaction.join(n, p);
            if (!r.ok) { this.lastText = r.reason; this.render(); return; }
            this.lastText = r.text;
            this.onLog(`🏛️ ${r.text}`, 'levelup');
            this._after();
        });
    }

    /** 每次交互后：刷新面板 + 通知上层世界已变化（触发存档） */
    _after() {
        this.onChange();
        this.render();
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
