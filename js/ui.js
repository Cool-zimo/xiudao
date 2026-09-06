/**
 * 🌿 网页修仙模拟器 - UI渲染和交互
 * 管理界面切换、事件绑定、UI更新等
 */

const UI = {
    // 当前屏幕
    currentScreen: 'home-screen',
    
    /**
     * 初始化UI
     */
    init() {
        this.bindEvents();
        this.updateUI();
        console.log('✅ UI初始化完成');
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        console.log('🔧 开始绑定事件...');
        
        // 首页按钮
        const btnNewGame = document.getElementById('btn-new-game');
        if (btnNewGame) {
            btnNewGame.addEventListener('click', () => {
                console.log('👆 点击了"开始修行"按钮');
                this.showScreen('character-creation');
            });
            console.log('✅ "开始修行"按钮事件已绑定');
        } else {
            console.error('❌ "开始修行"按钮不存在！');
        }
        
        document.getElementById('btn-continue')?.addEventListener('click', () => {
            if (Game.state.isPlaying) {
                this.showScreen('main-game');
                this.updateMainGameUI();
            } else {
                alert('没有找到存档，请先开始修行！');
            }
        });
        
        document.getElementById('btn-import')?.addEventListener('click', () => {
            this.showModal('import-dialog');
        });
        
        document.getElementById('btn-help')?.addEventListener('click', () => {
            this.showScreen('help-screen');
        });
        
        // 角色创建界面
        document.getElementById('btn-create-character')?.addEventListener('click', () => {
            this.createCharacter();
        });
        
        document.getElementById('btn-back-home')?.addEventListener('click', () => {
            this.showScreen('home-screen');
        });
        
        // 职业和天赋选择
        document.querySelectorAll('.profession-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.profession-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });
        
        document.querySelectorAll('.talent-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.talent-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });
        
        // 主游戏界面按钮
        document.getElementById('btn-cultivate')?.addEventListener('click', () => {
            this.cultivate();
        });
        
        document.getElementById('btn-combat')?.addEventListener('click', () => {
            this.startCombat();
        });
        
        document.getElementById('btn-tribulation')?.addEventListener('click', () => {
            this.showTribulationScreen();
        });
        
        document.getElementById('btn-forge')?.addEventListener('click', () => {
            alert('锻造功能开发中...');
        });
        
        document.getElementById('btn-inventory')?.addEventListener('click', () => {
            this.showScreen('inventory-screen');
            this.updateInventoryUI();
        });
        
        document.getElementById('btn-save')?.addEventListener('click', () => {
            Game.autoSave();
            this.addLog('💾 游戏已保存', Utils.LogType.NORMAL);
        });
        
        document.getElementById('btn-export')?.addEventListener('click', () => {
            this.exportSave();
        });
        
        document.getElementById('btn-close-inventory')?.addEventListener('click', () => {
            this.showScreen('main-game');
        });
        
        // 渡劫界面按钮
        document.getElementById('btn-start-tribulation')?.addEventListener('click', () => {
            this.startTribulation();
        });
        
        document.getElementById('btn-cancel-tribulation')?.addEventListener('click', () => {
            this.showScreen('main-game');
        });
        
        // 邪修系统按钮
        document.getElementById('btn-devour')?.addEventListener('click', () => {
            this.devourSouls();
        });
        
        document.getElementById('btn-second-personality')?.addEventListener('click', () => {
            this.openSecondPersonality();
        });
        
        document.getElementById('btn-fuse')?.addEventListener('click', () => {
            this.fuseSecondPersonality();
        });
        
        // 夺舍界面按钮
        document.getElementById('btn-start-possession')?.addEventListener('click', () => {
            this.startPossession();
        });
        
        document.getElementById('btn-cancel-possession')?.addEventListener('click', () => {
            this.showScreen('main-game');
        });
        
        // 战斗中的夺舍按钮
        document.getElementById('btn-possession')?.addEventListener('click', () => {
            if (this.currentBattle && this.currentBattle.monster) {
                this.showPossessionScreen(this.currentBattle.monster);
            }
        });
        
        // 导入导出对话框
        document.getElementById('btn-confirm-import')?.addEventListener('click', () => {
            this.confirmImport();
        });
        
        document.getElementById('btn-cancel-import')?.addEventListener('click', () => {
            this.hideModal('import-dialog');
        });
        
        document.getElementById('btn-copy-token')?.addEventListener('click', () => {
            this.copyToken();
        });
        
        document.getElementById('btn-close-export')?.addEventListener('click', () => {
            this.hideModal('export-dialog');
        });
        
        document.getElementById('btn-close-help')?.addEventListener('click', () => {
            if (Game.state.isPlaying) {
                this.showScreen('main-game');
            } else {
                this.showScreen('home-screen');
            }
        });
    },
    
    /**
     * 显示指定屏幕
     * @param {string} screenId - 屏幕ID
     */
    showScreen(screenId) {
        console.log(`📺 切换屏幕: ${screenId}`);
        
        // 隐藏所有屏幕
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // 显示目标屏幕
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            console.log(`✅ 屏幕切换成功: ${screenId}`);
        } else {
            console.error(`❌ 找不到屏幕: ${screenId}`);
        }
        
        // 特殊处理
        if (screenId === 'main-game') {
            this.updateMainGameUI();
        }
    },
    
    /**
     * 显示模态对话框
     * @param {string} modalId - 对话框ID
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    /**
     * 隐藏模态对话框
     * @param {string} modalId - 对话框ID
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    /**
     * 创建角色
     */
    createCharacter() {
        const name = document.getElementById('player-name').value.trim();
        const faction = document.querySelector('input[name="faction"]:checked')?.value;
        const professionCard = document.querySelector('.profession-card.selected');
        const talentCard = document.querySelector('.talent-card.selected');
        
        // 验证输入
        if (!name) {
            alert('请输入道号！');
            return;
        }
        
        if (!professionCard) {
            alert('请选择职业！');
            return;
        }
        
        if (!talentCard) {
            alert('请选择天赋！');
            return;
        }
        
        const profession = professionCard.dataset.profession;
        const talent = talentCard.dataset.talent;
        
        // 创建角色
        Game.createCharacter({ name, faction, profession, talent });
        
        // 应用主题
        this.applyTheme(faction);
        
        // 切换到主游戏界面
        this.showScreen('main-game');
        this.updateMainGameUI();
        
        this.addLog(`✨ 欢迎踏入修仙世界，${name}道友！`, Utils.LogType.LEVELUP);
        this.addLog(`🎯 你选择了${faction}阵营，职业为${profession}，天赋为${talent}`, Utils.LogType.NORMAL);
    },
    
    /**
     * 应用主题
     * @param {string} faction - 阵营
     */
    applyTheme(faction) {
        document.body.classList.remove('theme-righteous', 'theme-evil');
        
        if (faction === '邪修') {
            document.body.classList.add('theme-evil');
        } else {
            document.body.classList.add('theme-righteous');
        }
    },
    
    /**
     * 修炼
     */
    cultivate() {
        if (!Game.player) return;
        
        // 基础修炼获得经验
        const baseExp = 10;
        const luckBonus = Game.player.attributes.luck > 10 ? 5 : 0;
        const totalExp = baseExp + luckBonus;
        
        const result = Game.gainExperience(totalExp);
        
        this.addLog(`🧘 你打坐修炼，获得了${totalExp}点修为`, Utils.LogType.NORMAL);
        
        if (result.leveledUp) {
            if (result.newRealm) {
                this.addLog(`🎉 恭喜突破！晋升至【${result.newRealm}】！`, Utils.LogType.LEVELUP);
            } else {
                this.addLog(`⬆️ 境界提升！当前：${Game.player.cultivation.realm} Lv${Game.player.cultivation.level}`, Utils.LogType.LEVELUP);
            }
        }
        
        this.updateMainGameUI();
    },
    
    /**
     * 开始战斗
     */
    startCombat() {
        if (!Game.player) return;
        
        // 生成怪物
        const monsterStats = Utils.generateMonsterStats(
            Game.player.cultivation.realm,
            Game.player.cultivation.level
        );
        
        const monsterNames = [
            '铁背熊', '赤焰蛇', '寒冰狼', '狂风鹰', '雷霆豹',
            '烈焰虎', '玄冰龟', '紫电貂', '金翅鹏', '幽冥猫'
        ];
        
        const monsterName = Utils.randomChoice(monsterNames);
        
        // 显示战斗界面
        this.showScreen('combat-screen');
        
        // 初始化战斗UI
        document.getElementById('combat-player-name').textContent = Game.player.name;
        document.getElementById('combat-enemy-name').textContent = monsterName;
        this.updateCombatHP('player', Game.player.attributes.hp, Game.player.attributes.maxHp);
        this.updateCombatHP('enemy', monsterStats.hp, monsterStats.maxHp);
        
        // 清空战斗日志
        const combatLog = document.getElementById('combat-log-content');
        combatLog.innerHTML = '<p class="log-entry">战斗开始！</p>';
        
        // 存储当前战斗数据
        this.currentBattle = {
            monster: {
                name: monsterName,
                ...monsterStats
            },
            turn: 0
        };
        
        this.addCombatLog(`遭遇了【${monsterName}】！`, Utils.LogType.COMBAT);
        
        // 显示/隐藏夺舍按钮（仅邪修且已开启第二人格）
        const possessionBtn = document.getElementById('btn-possession');
        if (possessionBtn) {
            if (Game.player.faction === '邪修' && 
                Game.player.evilCultivation && 
                Game.player.evilCultivation.secondPersonality) {
                possessionBtn.style.display = 'inline-block';
            } else {
                possessionBtn.style.display = 'none';
            }
        }
    },
    
    /**
     * 攻击
     */
    attack() {
        if (!this.currentBattle || !Game.player) return;
        
        // 每回合减少夺舍冷却时间
        if (Game.player.evilCultivation && Game.player.evilCultivation.possessionCooldown > 0) {
            Game.player.evilCultivation.possessionCooldown--;
            Game.autoSave();
        }
        
        const monster = this.currentBattle.monster;
        
        // 玩家攻击
        const playerDamage = Utils.calculateDamage(
            Game.player.attributes.attack,
            monster.defense,
            Game.player.attributes.luck
        );
        
        monster.hp -= playerDamage.damage;
        
        let logMsg = `你攻击了${monster.name}，造成${playerDamage.damage}点伤害`;
        if (playerDamage.isCritical) {
            logMsg += '（暴击！）';
        }
        this.addCombatLog(logMsg, Utils.LogType.COMBAT);
        
        // 检查怪物是否死亡
        if (monster.hp <= 0) {
            this.victory();
            return;
        }
        
        this.updateCombatHP('enemy', monster.hp, monster.maxHp);
        
        // 怪物反击（延迟执行）
        setTimeout(() => {
            this.monsterAttack();
        }, 500);
    },
    
    /**
     * 怪物攻击
     */
    monsterAttack() {
        if (!this.currentBattle || !Game.player) return;
        
        const monster = this.currentBattle.monster;
        
        const monsterDamage = Utils.calculateDamage(
            monster.attack,
            Game.player.attributes.defense,
            10
        );
        
        const isDead = Game.takeDamage(monsterDamage.damage);
        
        this.addCombatLog(
            `${monster.name}攻击了你，造成${monsterDamage.damage}点伤害`,
            Utils.LogType.COMBAT
        );
        
        this.updateCombatHP('player', Game.player.attributes.hp, Game.player.attributes.maxHp);
        
        // 检查玩家是否死亡
        if (isDead) {
            this.defeat();
        }
    },
    
    /**
     * 战斗胜利
     */
    victory() {
        const monster = this.currentBattle.monster;
        
        this.addCombatLog(`🎉 击败了${monster.name}！`, Utils.LogType.REWARD);
        
        // 获得经验
        const expGain = monster.expReward;
        const result = Game.gainExperience(expGain);
        
        this.addCombatLog(`获得${expGain}点修为`, Utils.LogType.REWARD);
        
        // 邪修获得魂魄
        if (Game.player.faction === '邪修' && Game.player.evilCultivation) {
            const soulResult = EvilCultivation.gainSouls(Game.player, monster);
            if (soulResult.total > 0) {
                const qualityText = soulResult.details.quality === 'epic' ? '✨史诗' : 
                                   soulResult.details.quality === 'rare' ? '💎稀有' : '普通';
                this.addCombatLog(`☠️ 获得${soulResult.total}个${qualityText}魂魄`, Utils.LogType.REWARD);
            }
        }
        
        // 随机掉落物品
        if (Utils.chance(0.3)) {
            const dropItem = this.generateRandomDrop();
            Game.addItem(dropItem);
            this.addCombatLog(`获得物品：${dropItem.name}`, Utils.LogType.REWARD);
        }
        
        if (result.leveledUp) {
            this.addCombatLog(`⬆️ 境界提升！`, Utils.LogType.LEVELUP);
        }
        
        // 返回主界面
        setTimeout(() => {
            this.showScreen('main-game');
            this.updateMainGameUI();
        }, 1500);
        
        this.currentBattle = null;
    },
    
    /**
     * 战斗失败
     */
    defeat() {
        this.addCombatLog('💀 你被击败了...', Utils.LogType.DANGER);
        
        // 惩罚：损失部分修为
        const expLoss = Math.floor(Game.player.cultivation.experience * 0.1);
        Game.player.cultivation.experience = Math.max(0, Game.player.cultivation.experience - expLoss);
        
        this.addCombatLog(`修为受损，损失${expLoss}点修为`, Utils.LogType.DANGER);
        
        // 恢复部分生命
        Game.heal(Math.floor(Game.player.attributes.maxHp * 0.3));
        
        setTimeout(() => {
            this.showScreen('main-game');
            this.updateMainGameUI();
        }, 1500);
        
        this.currentBattle = null;
    },
    
    /**
     * 生成随机掉落物品
     * @returns {Object} 物品对象
     */
    generateRandomDrop() {
        const items = [
            { id: 'item_001', name: '聚气丹', type: '丹药', effect: { type: 'exp', value: 50 } },
            { id: 'item_002', name: '凝元丹', type: '丹药', effect: { type: 'exp', value: 100 } },
            { id: 'item_003', name: '回春丹', type: '丹药', effect: { type: 'heal', value: 50 } }
        ];
        
        return Utils.deepClone(Utils.randomChoice(items));
    },
    
    /**
     * 显示技能面板
     */
    showSkillPanel() {
        if (!this.currentBattle || !Game.player) return;
        
        const skillList = document.getElementById('skill-list');
        skillList.innerHTML = '';
        
        // 根据职业生成技能
        const skills = this.getAvailableSkills();
        
        skills.forEach(skill => {
            const btn = document.createElement('div');
            btn.className = 'skill-btn';
            btn.innerHTML = `
                <div class="skill-name">${skill.name}</div>
                <div class="skill-cost">${skill.cost > 0 ? `消耗${skill.cost}法力` : '无消耗'}</div>
            `;
            btn.addEventListener('click', () => {
                this.useSkill(skill);
            });
            skillList.appendChild(btn);
        });
        
        document.getElementById('skill-panel').style.display = 'block';
    },
    
    /**
     * 隐藏技能面板
     */
    hideSkillPanel() {
        document.getElementById('skill-panel').style.display = 'none';
    },
    
    /**
     * 获取可用技能列表
     */
    getAvailableSkills() {
        const player = Game.player;
        const skills = [];
        
        // 职业技能
        if (player.profession === '锻造师') {
            skills.push({
                name: '🔥 炼丹爆炸',
                type: 'profession',
                cost: 20,
                action: () => Combat.forgeSkill(player, this.currentBattle.monster)
            });
        } else if (player.profession === '召唤师') {
            skills.push({
                name: '📦 灵兽协战',
                type: 'profession',
                cost: 0,
                action: () => Combat.summonerSkill(player, this.currentBattle.monster)
            });
        } else if (player.profession === '暗器师') {
            skills.push({
                name: '🗡️ 暗器突袭',
                type: 'profession',
                cost: 0,
                action: () => Combat.assassinSkill(player, this.currentBattle.monster)
            });
        }
        
        // 控云法术（如果天赋是控云）
        if (player.talent === '控云') {
            const elements = [
                { name: '⛅ 狂风斩', element: '风', cost: 15 },
                { name: '⛅ 暴雨梨花', element: '雨', cost: 15 },
                { name: '⚡ 紫霄神雷', element: '雷', cost: 15 },
                { name: '⚡ 雷霆万钧', element: '电', cost: 15 },
                { name: '🔥 红莲业火', element: '火', cost: 15 },
                { name: '❄️ 冰封万里', element: '冰', cost: 15 }
            ];
            
            elements.forEach(elem => {
                skills.push({
                    name: elem.name,
                    type: 'cloud',
                    element: elem.element,
                    cost: elem.cost,
                    action: () => Combat.useCloudControl(player, this.currentBattle.monster, elem.element)
                });
            });
        }
        
        return skills;
    },
    
    /**
     * 使用技能
     */
    useSkill(skill) {
        if (!this.currentBattle || !Game.player) return;
        
        // 每回合减少夺舍冷却时间
        if (Game.player.evilCultivation && Game.player.evilCultivation.possessionCooldown > 0) {
            Game.player.evilCultivation.possessionCooldown--;
            Game.autoSave();
        }
        
        const result = skill.action();
        
        if (!result.success) {
            this.addCombatLog(result.message, Utils.LogType.DANGER);
            return;
        }
        
        // 显示技能效果
        this.addCombatLog(result.message, Utils.LogType.COMBAT);
        
        if (result.damage) {
            this.updateCombatHP('enemy', this.currentBattle.monster.hp, this.currentBattle.monster.maxHp);
            
            // 检查怪物是否死亡
            if (this.currentBattle.monster.hp <= 0) {
                this.hideSkillPanel();
                setTimeout(() => this.victory(), 500);
                return;
            }
        }
        
        // 隐藏技能面板
        this.hideSkillPanel();
        
        // 怪物反击
        setTimeout(() => {
            this.monsterAttack();
        }, 500);
    },
    
    /**
     * 显示渡劫界面
     */
    showTribulationScreen() {
        if (!Game.player) return;
        
        // 检查是否可以渡劫
        const checkResult = Character.checkBreakthrough(Game.player);
        
        if (!checkResult.canBreakthrough || !checkResult.needTribulation) {
            alert('当前无法渡劫！需要筑基期Lv10');
            return;
        }
        
        // 计算成功率
        const baseChance = 0.6;
        const luckBonus = (Game.player.attributes.luck - 10) * 0.01;
        const finalChance = Math.min(0.9, baseChance + luckBonus);
        
        // 更新界面
        document.getElementById('tribulation-realm').textContent = 
            `${Game.player.cultivation.realm} Lv${Game.player.cultivation.level}`;
        document.getElementById('next-realm').textContent = '结丹期';
        document.getElementById('tribulation-chance').textContent = 
            `${(finalChance * 100).toFixed(0)}%`;
        
        this.showScreen('tribulation-screen');
    },
    
    /**
     * 开始渡劫
     */
    startTribulation() {
        if (!Game.player) return;
        
        const result = Cultivation.attemptTribulation(Game.player);
        
        if (result.success) {
            this.addLog(result.message, Utils.LogType.LEVELUP);
            
            // 显示渡劫成功特效
            setTimeout(() => {
                alert('🎉 恭喜渡劫成功！晋升至结丹期！');
                this.showScreen('main-game');
                this.updateMainGameUI();
            }, 500);
        } else {
            this.addLog(result.message, Utils.LogType.DANGER);
            
            setTimeout(() => {
                alert(`💥 渡劫失败！\n${result.message}`);
                this.showScreen('main-game');
                this.updateMainGameUI();
            }, 500);
        }
    },
    
    /**
     * 更新邪修面板显示
     */
    updateEvilPanel() {
        const evilPanel = document.getElementById('evil-panel');
        
        if (!Game.player || Game.player.faction !== '邪修') {
            evilPanel.style.display = 'none';
            return;
        }
        
        // 显示邪修面板
        evilPanel.style.display = 'block';
        
        const evil = Game.player.evilCultivation;
        
        // 更新魂魄数量（显示总数量和品质分布）
        const totalSouls = evil.souls || 0;
        const soulQuality = evil.soulQuality || { common: 0, rare: 0, epic: 0 };
        document.getElementById('souls-display').innerHTML = 
            `${totalSouls} <small style="font-size:0.8em;">(普通:${soulQuality.common} 稀有:${soulQuality.rare} 史诗:${soulQuality.epic})</small>`;
        
        // 第二人格信息
        const spInfo = document.getElementById('second-personality-info');
        const btnSecondPersonality = document.getElementById('btn-second-personality');
        const btnFuse = document.getElementById('btn-fuse');
        
        if (evil.secondPersonality) {
            // 已开启第二人格
            spInfo.style.display = 'block';
            btnSecondPersonality.style.display = 'none';
            btnFuse.style.display = 'inline-block';
            
            document.getElementById('sp-name').textContent = evil.secondPersonality.name;
            document.getElementById('sp-fusion').textContent = `${evil.secondPersonality.fusionProgress}%`;
            document.getElementById('sp-risk').textContent = `${evil.secondPersonality.risk}%`;
        } else {
            // 未开启第二人格，检查是否可以开启
            spInfo.style.display = 'none';
            btnFuse.style.display = 'none';
            
            const checkResult = EvilCultivation.checkSecondPersonality(Game.player);
            if (checkResult.canOpen) {
                btnSecondPersonality.style.display = 'inline-block';
            } else {
                btnSecondPersonality.style.display = 'none';
            }
        }
    },
    
    /**
     * 吞噬魂魄
     */
    devourSouls() {
        if (!Game.player) return;
        
        const result = EvilCultivation.devourSouls(Game.player, 1);
        
        if (result.success) {
            this.addLog(result.message, Utils.LogType.REWARD);
            this.updateEvilPanel();
            this.updateMainGameUI();
        } else {
            alert(result.message);
        }
    },
    
    /**
     * 开启第二人格
     */
    openSecondPersonality() {
        if (!Game.player) return;
        
        const result = EvilCultivation.openSecondPersonality(Game.player);
        
        if (result.success) {
            this.addLog(result.message, Utils.LogType.LEVELUP);
            setTimeout(() => {
                alert('🌑 第二人格【魔心】已开启！\n融合之路开始...');
                this.updateEvilPanel();
            }, 300);
        } else {
            alert(result.message);
        }
    },
    
    /**
     * 融合第二人格
     */
    fuseSecondPersonality() {
        if (!Game.player) return;
        
        const result = EvilCultivation.fuseSecondPersonality(Game.player);
        
        if (!result.success) {
            alert(result.message);
            return;
        }
        
        if (result.fused) {
            // 融合成功
            this.addLog(result.message, Utils.LogType.LEVELUP);
            setTimeout(() => {
                alert('🎉 第二人格融合成功！\n实力大幅提升！');
                this.updateEvilPanel();
                this.updateMainGameUI();
            }, 300);
        } else {
            // 融合失败
            this.addLog(result.message, Utils.LogType.DANGER);
            setTimeout(() => {
                alert(`💥 ${result.message}`);
                this.updateEvilPanel();
                this.updateMainGameUI();
            }, 300);
        }
    },
    
    /**
     * 显示夺舍界面（战斗中调用）
     */
    showPossessionScreen(targetMonster) {
        if (!Game.player || !targetMonster) return;
        
        const checkResult = EvilCultivation.checkPossession(Game.player, targetMonster);
        
        if (!checkResult.canPossess) {
            alert(checkResult.reason);
            return;
        }
        
        // 获取夺舍预览数据
        const preview = EvilCultivation.getPossessionPreview(Game.player, targetMonster);
        
        // 更新界面
        document.getElementById('possession-target').textContent = targetMonster.name;
        document.getElementById('possession-chance').textContent = 
            `${preview.successRate}%`;
        
        // 更新冷却时间显示
        const cooldown = Game.player.evilCultivation.possessionCooldown || 0;
        document.getElementById('possession-cooldown').textContent = 
            cooldown > 0 ? `${cooldown}回合` : '无';
        
        // 更新属性预览
        if (preview) {
            document.getElementById('preview-current-attack').textContent = preview.currentAttributes.attack;
            document.getElementById('preview-current-defense').textContent = preview.currentAttributes.defense;
            document.getElementById('preview-current-hp').textContent = preview.currentAttributes.hp;
            
            document.getElementById('preview-predicted-attack').textContent = preview.predictedAttributes.attack;
            document.getElementById('preview-predicted-defense').textContent = preview.predictedAttributes.defense;
            document.getElementById('preview-predicted-hp').textContent = preview.predictedAttributes.hp;
        }
        
        // 保存当前目标怪物
        this.currentPossessionTarget = targetMonster;
        
        this.showScreen('possession-screen');
    },
    
    /**
     * 开始夺舍
     */
    startPossession() {
        if (!Game.player || !this.currentPossessionTarget) return;
        
        const result = EvilCultivation.startPossession(Game.player, this.currentPossessionTarget);
        
        if (!result.success) {
            alert(result.message);
            return;
        }
        
        if (result.possessed) {
            // 夺舍成功
            this.addLog(result.message, Utils.LogType.LEVELUP);
            setTimeout(() => {
                alert(`☠️ 夺舍成功！\n获得新肉体属性：\n攻击: ${result.newAttributes.attack}\n防御: ${result.newAttributes.defense}\n生命: ${result.newAttributes.hp}`);
                this.showScreen('main-game');
                this.updateMainGameUI();
                this.updateEvilPanel();
            }, 500);
        } else {
            // 夺舍失败
            this.addLog(result.message, Utils.LogType.DANGER);
            setTimeout(() => {
                alert(`💀 ${result.message}`);
                this.showScreen('main-game');
                this.updateMainGameUI();
            }, 500);
        }
        
        this.currentPossessionTarget = null;
    },
    
    /**
     * 更新境界提示和渡劫按钮显示
     */
    updateRealmHint() {
        const realmHint = document.getElementById('realm-hint');
        const btnTribulation = document.getElementById('btn-tribulation');
        
        if (!realmHint || !btnTribulation) return;
        
        const player = Game.player;
        const realm = player.cultivation.realm;
        const level = player.cultivation.level;
        const maxLevel = 10; // 每个境界最大等级
        
        // 检查是否可以渡劫（达到当前境界满级）
        if (level >= maxLevel && realm !== '筠仙期') {
            // 可以渡劫
            realmHint.style.display = 'block';
            realmHint.innerHTML = `⚡ <strong>恭喜！</strong>已达到${realm}Lv${level}，可以渡劫突破至下一境界！`;
            btnTribulation.style.display = 'inline-block';
        } else if (realm === '筠仙期' && level >= maxLevel) {
            // 已达最高境界
            realmHint.style.display = 'block';
            realmHint.innerHTML = `🎉 <strong>大道至简！</strong>你已达到最高境界筠仙期Lv${level}！`;
            btnTribulation.style.display = 'none';
        } else {
            // 未达到渡劫条件
            realmHint.style.display = 'none';
            btnTribulation.style.display = 'none';
        }
    },
    
    /**
     * 更新主游戏界面UI
     */
    updateMainGameUI() {
        if (!Game.player) return;
        
        // 更新玩家信息
        document.getElementById('player-name-display').textContent = Game.player.name;
        document.getElementById('player-realm-display').textContent = 
            `${Game.player.cultivation.realm} Lv${Game.player.cultivation.level}`;
        document.getElementById('player-faction-display').textContent = Game.player.faction;
        document.getElementById('profession-display').textContent = Game.player.profession;
        document.getElementById('talent-display').textContent = Game.player.talent;
        
        // 更新属性
        document.getElementById('hp-text').textContent = 
            `${Game.player.attributes.hp}/${Game.player.attributes.maxHp}`;
        document.getElementById('mp-text').textContent = 
            `${Game.player.attributes.mp}/${Game.player.attributes.maxMp}`;
        document.getElementById('attack-text').textContent = Game.player.attributes.attack;
        document.getElementById('defense-text').textContent = Game.player.attributes.defense;
        
        // 更新经验条
        const expPercent = (Game.player.cultivation.experience / Game.player.cultivation.expToNext) * 100;
        document.getElementById('exp-bar').style.width = `${Math.min(100, expPercent)}%`;
        document.getElementById('exp-text').textContent = 
            `${Game.player.cultivation.experience} / ${Game.player.cultivation.expToNext}`;
        
        // 更新游戏时间
        document.getElementById('playtime-display').textContent = 
            Utils.formatTime(Game.state.playTime);
        
        // 更新境界提示和渡劫按钮
        this.updateRealmHint();
        
        // 更新邪修面板
        this.updateEvilPanel();
    },
    
    /**
     * 更新战斗血条
     * @param {string} side - 'player' 或 'enemy'
     * @param {number} current - 当前血量
     * @param {number} max - 最大血量
     */
    updateCombatHP(side, current, max) {
        const percentage = (current / max) * 100;
        document.getElementById(`combat-${side}-hp-bar`).style.width = `${Math.max(0, percentage)}%`;
        document.getElementById(`combat-${side}-hp`).textContent = `${current}/${max}`;
    },
    
    /**
     * 添加战斗日志
     * @param {string} message - 消息
     * @param {string} type - 类型
     */
    addCombatLog(message, type = Utils.LogType.NORMAL) {
        const combatLog = document.getElementById('combat-log-content');
        const entry = document.createElement('p');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        combatLog.appendChild(entry);
        combatLog.scrollTop = combatLog.scrollHeight;
    },
    
    /**
     * 添加日志
     * @param {string} message - 消息
     * @param {string} type - 类型
     */
    addLog(message, type = Utils.LogType.NORMAL) {
        const gameLog = document.getElementById('game-log');
        const entry = document.createElement('p');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        gameLog.appendChild(entry);
        gameLog.scrollTop = gameLog.scrollHeight;
        
        // 限制日志数量
        while (gameLog.children.length > 50) {
            gameLog.removeChild(gameLog.firstChild);
        }
    },
    
    /**
     * 更新背包UI
     */
    updateInventoryUI() {
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';
        
        if (!Game.player || Game.player.inventory.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">背包空空如也...</p>';
            return;
        }
        
        Game.player.inventory.forEach(item => {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 2em;">📦</div>
                    <div style="font-size: 0.8em;">${item.name}</div>
                    <div style="font-size: 0.7em; color: #666;">x${item.count}</div>
                </div>
            `;
            slot.addEventListener('click', () => {
                if (confirm(`使用 ${item.name}？`)) {
                    Game.useItem(item.id);
                    this.updateInventoryUI();
                    this.updateMainGameUI();
                    this.addLog(`使用了${item.name}`, Utils.LogType.NORMAL);
                }
            });
            grid.appendChild(slot);
        });
    },
    
    /**
     * 导出存档
     */
    exportSave() {
        if (!Game.player) return;
        
        const password = document.getElementById('export-password')?.value || '';
        const token = Utils.exportSave(Game.player, password);
        
        document.getElementById('export-token').value = token;
        this.showModal('export-dialog');
    },
    
    /**
     * 确认导入
     */
    confirmImport() {
        const token = document.getElementById('import-token').value.trim();
        const password = document.getElementById('import-password').value || '';
        
        if (!token) {
            alert('请粘贴存档口令！');
            return;
        }
        
        const data = Utils.importSave(token, password);
        
        if (!data) {
            alert('导入失败！存档损坏或密码错误。');
            return;
        }
        
        if (confirm('导入存档将覆盖当前进度，确定继续吗？')) {
            Game.player = data;
            Game.state.isPlaying = true;
            this.applyTheme(data.faction);
            this.hideModal('import-dialog');
            this.showScreen('main-game');
            this.updateMainGameUI();
            this.addLog('📥 存档导入成功！', Utils.LogType.LEVELUP);
        }
    },
    
    /**
     * 复制口令
     */
    copyToken() {
        const tokenField = document.getElementById('export-token');
        tokenField.select();
        document.execCommand('copy');
        alert('口令已复制到剪贴板！');
    },
    
    /**
     * 更新UI（通用）
     */
    updateUI() {
        if (Game.state.isPlaying) {
            this.applyTheme(Game.player.faction);
        }
    }
};

// 绑定攻击按钮事件（需要在战斗界面显示后绑定）
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-attack')?.addEventListener('click', () => {
        UI.attack();
    });
    
    document.getElementById('btn-skill')?.addEventListener('click', () => {
        UI.showSkillPanel();
    });
    
    document.getElementById('btn-close-skill')?.addEventListener('click', () => {
        UI.hideSkillPanel();
    });
    
    document.getElementById('btn-flee')?.addEventListener('click', () => {
        if (confirm('确定要逃跑吗？')) {
            UI.showScreen('main-game');
            UI.currentBattle = null;
        }
    });
});

// 导出UI对象
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
