import { SKILLS, COMBOS, ELEMENT_COUNTER } from '../systems/combat.js';
import methodsData from '../data/methods.js';

/**
 * 功法装配面板 + 技能/连招面板
 *
 * 主修 1 门 + 辅修 1 门，组合产生化学反应
 */
export class MethodPanel {
    constructor(container, game, opts = {}) {
        this.container = container;
        this.game = game;
        this.onChange = opts.onChange || (() => {});
    }

    render() {
        const p = this.game.state.player;
        if (!p) return;

        const { main, support } = this.game.methods.getEquipped(p);
        const combo = this.game.methods.getCombo(p);
        const profile = this.game.methods.getCultivationProfile(p);
        const available = this.game.methods.getAvailableMethods(p);

        const html = `
            <div class="method-panel">
                <h3>功法搭配</h3>
                <div class="method-slots">
                    ${this._renderSlot('主修', main, available.filter(m => m.type === 'main'), 'main')}
                    ${this._renderSlot('辅修', support, available.filter(m => m.type === 'support'), 'support')}
                </div>

                <div class="combo-display ${combo ? 'active' : ''}">
                    ${combo
                        ? `<div class="combo-name">✨ 组合触发：${this._esc(combo.name)}</div>
                           <div class="combo-desc">${this._esc(combo.desc)}</div>`
                        : `<div class="combo-hint">装配主修 + 辅修可触发组合效果</div>`}
                </div>

                <div class="profile-stats">
                    <div class="stat"><span>修炼速度</span><b>${profile.speed.toFixed(2)}x</b></div>
                    <div class="stat"><span>走火入魔</span><b class="${profile.risk > 0.3 ? 'danger' : ''}">${(profile.risk * 100).toFixed(1)}%</b></div>
                    ${Object.entries(profile.bonus).filter(([, v]) => v !== 0).map(([k, v]) =>
                        `<div class="stat"><span>${this._bonusName(k)}</span><b class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : ''}${v}</b></div>`
                    ).join('')}
                </div>

                <h3>技能与连招</h3>
                <div class="skill-list">
                    ${SKILLS.map(s => `
                        <div class="skill-item" data-element="${s.element}">
                            <span class="skill-name">${this._esc(s.name)}</span>
                            <span class="skill-element el-${s.element}">${s.element}</span>
                            <span class="skill-cost">${s.mpCost} MP / CD ${s.cooldown}</span>
                            <span class="skill-desc">${this._esc(s.desc)}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="combo-list">
                    <h4>连招（窗口期内按序释放）</h4>
                    ${COMBOS.map(c => `
                        <div class="combo-item">
                            <b>${this._esc(c.name)}</b>
                            <span>${c.sequence.map(id => {
                                const s = SKILLS.find(x => x.id === id);
                                return s ? s.name : id;
                            }).join(' → ')}</span>
                            <em>${this._esc(c.desc)}</em>
                        </div>
                    `).join('')}
                </div>

                <div class="element-counter">
                    <h4>元素克制</h4>
                    ${Object.entries(ELEMENT_COUNTER).map(([a, b]) =>
                        `<span class="counter-pair">${a} → ${b}</span>`
                    ).join('')}
                </div>
            </div>
        `;
        this.container.innerHTML = html;

        // 绑定装配
        this.container.querySelectorAll('.method-option').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                const slot = el.dataset.slot;
                const res = this.game.methods.equip(p, id, slot);
                if (res.ok) {
                    this.render();
                    this.onChange(res);
                } else {
                    alert(res.reason);
                }
            });
        });
    }

    _renderSlot(label, current, options, slot) {
        return `
            <div class="method-slot">
                <div class="slot-label">${label}</div>
                <div class="slot-current ${current ? 'filled' : 'empty'}">
                    ${current
                        ? `<b>${this._esc(current.name)}</b><span>${this._esc(current.desc)}</span>`
                        : '<span>未装配</span>'}
                </div>
                <div class="slot-options">
                    ${options.map(m => `
                        <div class="method-option ${current?.id === m.id ? 'selected' : ''}"
                             data-id="${m.id}" data-slot="${slot}"
                             title="${this._esc(m.desc)}">
                            <span class="mo-name">${this._esc(m.name)}</span>
                            <span class="mo-speed">${m.speed >= 0 ? '+' : ''}${m.speed} 速</span>
                            <span class="mo-risk ${m.risk > 0 ? 'neg' : m.risk < 0 ? 'pos' : ''}">${m.risk > 0 ? '+' : ''}${(m.risk * 100).toFixed(0)}% 险</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _bonusName(k) {
        const map = { maxHp: '生命', maxMp: '法力', attack: '攻击', defense: '防御', luck: '气运' };
        return map[k] || k;
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
