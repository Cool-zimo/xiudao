 /**
 * 🌿 网页修仙模拟器 - 主入口文件
 * 初始化游戏，启动所有模块
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌿 网页修仙模拟器启动中...');
    
    // 初始化游戏核心
    Game.init();
    
    // 初始化UI
    UI.init();
    
    // 检查是否有存档
    if (Game.state.isPlaying) {
        console.log('✅ 检测到存档，自动加载');
        UI.applyTheme(Game.player.faction);
    } else {
        console.log('🆕 新游戏，请创建角色');
    }
    
    console.log('🎮 游戏启动完成！');
    
    // 调试：检查按钮是否存在
    const btnNewGame = document.getElementById('btn-new-game');
    if (btnNewGame) {
        console.log('✅ "开始修行"按钮已找到');
    } else {
        console.error('❌ "开始修行"按钮未找到！');
    }
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('❌ 游戏错误:', event.error);
});

// 防止意外关闭页面时丢失进度
window.addEventListener('beforeunload', (event) => {
    if (Game.state.isPlaying) {
        Game.autoSave();
    }
});
