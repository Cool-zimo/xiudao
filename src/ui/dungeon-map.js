/**
 * 秘境地图渲染 —— 节点图可视化
 *
 * 用 DOM + CSS 而非 Canvas：节点数量少（每层 6~15 个），
 * DOM 更利于做 hover 提示、点击交互和无障碍访问。
 */
export class DungeonMap {
    constructor(container, opts = {}) {
        this.container = container;
        this.onNodeClick = opts.onNodeClick || (() => {});
    }

    /**
     * 渲染地图
     * @param {Object} dungeon - { floor, nodes, position }
     */
    render(dungeon) {
        const { nodes, position, floor } = dungeon;
        const html = `
            <div class="dungeon-header">
                <span class="dungeon-floor">第 ${floor} 层</span>
                <span class="dungeon-progress">${position} / ${nodes.length}</span>
            </div>
            <div class="dungeon-path">
                ${nodes.map((n, i) => this._renderNode(n, i, position)).join('')}
            </div>
            <div class="dungeon-legend">
                <span>👹 妖兽</span><span>💀 妖王</span><span>📦 宝箱</span>
                <span>❓ 机缘</span><span>🧘 洞天</span><span>🏪 坊市</span><span>🐉 BOSS</span>
            </div>
        `;
        this.container.innerHTML = html;

        // 绑定点击
        this.container.querySelectorAll('.dungeon-node').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.index, 10);
                if (idx === position) this.onNodeClick(nodes[idx], idx);
            });
        });
    }

    _renderNode(node, index, position) {
        const state =
            index < position ? 'cleared' :
            index === position ? 'current' :
            node.revealed ? 'revealed' : 'hidden';

        const icon = node.revealed || index <= position ? node.icon : '❔';
        const name = node.revealed || index <= position ? node.name : '未知';

        return `
            <div class="dungeon-node ${state}" data-index="${index}"
                 title="${this._escape(name)}">
                <div class="node-icon">${icon}</div>
                <div class="node-name">${this._escape(name)}</div>
                ${state === 'current' ? '<div class="node-marker">▼</div>' : ''}
            </div>
        `;
    }

    _escape(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
}
