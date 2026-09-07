import { CHARACTERS, getCharacter } from '../data/characters.js';

/**
 * 角色选择界面
 *
 * 支持按性别筛选，展示 4 位修士的立绘、路线、属性倾向
 */
export class CharacterSelect {
    constructor(container, opts = {}) {
        this.container = container;
        this.onConfirm = opts.onConfirm || (() => {});
        this.selectedId = opts.initialId || CHARACTERS[0].id;
        this.genderFilter = 'all';   // all | male | female
    }

    render() {
        const list = this.genderFilter === 'all'
            ? CHARACTERS
            : CHARACTERS.filter(c => c.gender === this.genderFilter);

        const cur = getCharacter(this.selectedId);

        this.container.innerHTML = `
            <div class="cs-root">
                <div class="cs-header">
                    <h2>择一肉身，踏入仙途</h2>
                    <p>不同修行路线，初始属性与心魔各不相同</p>
                </div>

                <div class="cs-filter">
                    <button class="cs-tab ${this.genderFilter === 'all' ? 'on' : ''}" data-g="all">全部</button>
                    <button class="cs-tab ${this.genderFilter === 'male' ? 'on' : ''}" data-g="male">男修</button>
                    <button class="cs-tab ${this.genderFilter === 'female' ? 'on' : ''}" data-g="female">女修</button>
                </div>

                <div class="cs-grid">
                    ${list.map(c => `
                        <div class="cs-card ${c.id === this.selectedId ? 'selected' : ''}"
                             data-id="${c.id}" style="--aura:${c.aura};--aura-rgb:${c.auraRgb}">
                            <div class="cs-portrait">
                                <img src="${c.stand}" alt="${this._esc(c.name)}"
                                     onerror="this.style.display='none'">
                                <div class="cs-fallback">${this._esc(c.name[0])}</div>
                            </div>
                            <div class="cs-name">${this._esc(c.name)}</div>
                            <div class="cs-title">${this._esc(c.title)} · ${c.gender === 'male' ? '男' : '女'}</div>
                            <div class="cs-traits">
                                ${c.traits.map(t => `<span>${this._esc(t)}</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="cs-detail">
                    <div class="cs-detail-art">
                        <img src="${cur.stand}" alt="${this._esc(cur.name)}"
                             onerror="this.style.display='none'">
                    </div>
                    <div class="cs-detail-info">
                        <h3>${this._esc(cur.name)} <span class="cs-dt">${this._esc(cur.title)}</span></h3>
                        <p class="cs-desc">${this._esc(cur.desc)}</p>
                        <div class="cs-bonus">
                            ${this._bonusList(cur)}
                        </div>
                        <div class="cs-karma-note">
                            初始心魔：<b>${cur.bonus.karma ?? (cur.faction === '邪修' ? 40 : 5)}</b>
                            <span>（心魔越高，战力越强，但天劫越险）</span>
                        </div>
                    </div>
                </div>

                <button class="cs-confirm">选定此身 · 开辟洞天</button>
            </div>
        `;

        this._bind();
    }

    _bonusList(c) {
        const map = {
            attack: '攻击', defense: '防御', maxHp: '生命',
            maxMp: '法力', luck: '气运', karma: '心魔'
        };
        return Object.entries(c.bonus)
            .map(([k, v]) => {
                if (k === 'karma') return '';
                const cls = v > 0 ? 'up' : 'down';
                const sign = v > 0 ? '+' : '';
                return `<span class="cs-b ${cls}">${map[k] || k} ${sign}${v}</span>`;
            })
            .filter(Boolean)
            .join('');
    }

    _bind() {
        this.container.querySelectorAll('.cs-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.genderFilter = btn.dataset.g;
                this.render();
            });
        });

        this.container.querySelectorAll('.cs-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedId = card.dataset.id;
                this.render();
            });
        });

        this.container.querySelector('.cs-confirm')
            ?.addEventListener('click', () => {
                this.onConfirm(getCharacter(this.selectedId));
            });
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
