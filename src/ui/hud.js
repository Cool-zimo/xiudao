import { KARMA_TIERS } from '../systems/karma.js';
import { getPortrait, getPortraitStage } from './art.js';

/**
 * 主界面 HUD —— 角色状态总览
 * 只读渲染，所有交互通过回调抛给上层，保持 UI 与逻辑解耦
 */
export class HUD {
    constructor(container, game, opts = {}) {
        this.container = container;
        this.game = game;
        this.onAction = opts.onAction || (() => {});
    }

    render() {
        const p = this.game.state.player;
        if (!p) {
            this.container.innerHTML = '<div class="hud-empty">未创建角色</div>';
            return;
        }

        const c = p.cultivation;
        const a = p.attributes;
        const tier = this.game.karma.getTier(p.karma);
        const canTribulate = this.game.tribulation.canAttempt(p);
        const relics = p.relics || [];

        const expPercent = Math.min(100, (c.experience / c.expToNext * 100));
        const levelPercent = ((c.level - 1) / Math.max(1, c.maxLevel - 1)) * 100;

        const html = `
            <div class="hud">
                <div class="hud-top">
                    <div class="portrait-wrap" data-stage="${this._esc(getPortraitStage(p))}">
                        <img class="portrait" src="${getPortrait(p)}" alt="角色立绘"
                             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                        <div class="avatar" data-faction="${this._esc(p.faction)}" style="display:none">${this._esc(p.name[0] || '道')}</div>
                        <div class="portrait-stage">${this._esc(getPortraitStage(p))}</div>
                    </div>
                    <div class="hud-basic">
                        <div class="name">${this._esc(p.name)}</div>
                        <div class="realm">${this._esc(c.realm)} <span class="lv">Lv ${c.level}/${c.maxLevel}</span></div>
                        <div class="sub">${this._esc(p.profession)} · ${this._esc(p.talent)} · ${this._esc(p.faction)}</div>
                    </div>
                    <div class="karma-badge" style="border-color:${tier.color}">
                        <div class="karma-tier" style="color:${tier.color}">${tier.name}</div>
                        <div class="karma-value">心魔 ${p.karma}/100</div>
                    </div>
                </div>

                <div class="bars">
                    <div class="bar-row">
                        <label>HP</label>
                        <div class="bar"><div class="fill hp" style="width:${(a.hp / a.maxHp * 100).toFixed(1)}%"></div></div>
                        <span>${a.hp}/${a.maxHp}</span>
                    </div>
                    <div class="bar-row">
                        <label>MP</label>
                        <div class="bar"><div class="fill mp" style="width:${(a.mp / a.maxMp * 100).toFixed(1)}%"></div></div>
                        <span>${a.mp}/${a.maxMp}</span>
                    </div>
                    <div class="bar-row">
                        <label>修为</label>
                        <div class="bar"><div class="fill exp" style="width:${expPercent.toFixed(1)}%"></div></div>
                        <span>${c.experience}/${c.expToNext}</span>
                    </div>
                    <div class="bar-row">
                        <label>境界</label>
                        <div class="bar"><div class="fill realm" style="width:${levelPercent.toFixed(1)}%"></div></div>
                        <span>${canTribulate ? '圆满·可渡劫' : `Lv ${c.level}`}</span>
                    </div>
                </div>

                <div class="attrs">
                    <div><label>攻击</label><b>${a.attack}</b></div>
                    <div><label>防御</label><b>${a.defense}</b></div>
                    <div><label>身法</label><b>${a.speed}</b></div>
                    <div><label>气运</label><b>${a.luck}</b></div>
                    <div><label>灵石</label><b>${p.gold || 0}</b></div>
                </div>

                ${relics.length ? `
                    <div class="relics">
                        <h4>遗物 (${relics.length})</h4>
                        <div class="relic-list">
                            ${relics.map(r => `<span class="relic" title="${this._esc(r.desc)}">${this._esc(r.name)}</span>`).join('')}
                        </div>
                    </div>` : ''}

                <div class="hud-actions">
                    <button data-action="cultivate">🧘 修炼</button>
                    <button data-action="tribulation" ${canTribulate ? '' : 'disabled'}>⚡ 渡劫</button>
                    <button data-action="dungeon">🗺️ 秘境</button>
                    <button data-action="event">❓ 机缘</button>
                    <button data-action="methods">📖 功法</button>
                    <button data-action="purify">📿 诵经</button>
                    ${p.karma >= 20 ? '<button data-action="forbidden">🔮 禁忌</button>' : ''}
                </div>
            </div>
        `;
        this.container.innerHTML = html;

        this.container.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => this.onAction(btn.dataset.action));
        });
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
