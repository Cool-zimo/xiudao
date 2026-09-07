/** 走火入魔必须阻塞修炼 —— 复现并守护 */
class ClassList{constructor(){this._s=new Set();}add(...c){c.forEach(x=>this._s.add(x));}remove(...c){c.forEach(x=>this._s.delete(x));}toggle(c,f){f?this._s.add(c):this._s.delete(c);}contains(c){return this._s.has(c);}}
class El{
    constructor(tag='div',id=''){this.tagName=tag;this.id=id;this.children=[];this.dataset={};this.attrs={};this.classList=new ClassList();this.style={setProperty(){}};this._html='';this._listeners={};this._parsed=[];this.disabled=false;this.title='';}
    set innerHTML(v){this._html=v;this._parsed=[];const re=/<(\w+)([^>]*)>/g;let m;while((m=re.exec(v))){const[,tag,attrs]=m;const c=new El(tag);const cls=/class="([^"]*)"/.exec(attrs);if(cls)cls[1].split(/\s+/).forEach(x=>x&&c.classList.add(x));const idm=/id="([^"]*)"/.exec(attrs);if(idm)c.id=idm[1];let d;const dm=/data-([\w-]+)="([^"]*)"/g;while((d=dm.exec(attrs)))c.dataset[d[1]]=d[2];const da=/data-action="([^"]*)"/.exec(attrs);if(da)c.dataset.action=da[1];const di=/disabled/.test(attrs);if(di)c.disabled=true;const ti=/title="([^"]*)"/.exec(attrs);if(ti)c.title=ti[1];this._parsed.push(c);}}
    get innerHTML(){return this._html;}
    set textContent(v){this._text=v;}get textContent(){return this._text||'';}
    appendChild(c){this.children.push(c);this._parsed.push(c);return c;}
    addEventListener(t,fn){(this._listeners[t]||=[]).push(fn);}
    dispatch(t,e={}){(this._listeners[t]||[]).forEach(fn=>fn(e));}
    click(){this.dispatch('click',{target:this});}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    querySelectorAll(s){const out=[];const parts=s.split(',').map(x=>x.trim());const match=(el,p)=>{if(p.startsWith('.'))return el.classList.contains(p.slice(1));if(p.startsWith('#'))return el.id===p.slice(1);if(p.includes('[data-action'))return el.dataset.action!==undefined;if(p.includes('[data-')){const k=p.match(/data-([\w-]+)/)?.[1];return k&&el.dataset[k]!==undefined;}return el.tagName===p;};const walk=n=>{for(const c of(n._parsed||[])){if(parts.some(p=>match(c,p)))out.push(c);}};walk(this);return out;}
    getBoundingClientRect(){return{width:480,height:640,left:0,top:0};}
    getContext(){return new Proxy({},{get:(t,k)=>String(k).includes('Gradient')?()=>({addColorStop(){}}):()=>{}});}
}
const nodes={};
for(const id of ['btn-home','btn-save','btn-new','screen-login','screen-home','screen-select','screen-main','login-container','home-container','select-container','hud-container','panel-container','modal','modal-close','modal-body'])
    nodes[id]=new El(id.startsWith('btn')?'button':'div',id);
for(const id of ['btn-home','btn-save','btn-new','screen-home','screen-select','screen-main']) nodes[id].classList.add('hidden');
global.document={getElementById:id=>nodes[id]||(nodes[id]=new El('div',id)),createElement:t=>new El(t),addEventListener(){},documentElement:new El('html'),hidden:false};
const store={};
global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
global.window={addEventListener(){},devicePixelRatio:1,matchMedia:()=>({matches:false})};
global.performance={now:()=>Date.now()};
global.requestAnimationFrame=()=>1;global.cancelAnimationFrame=()=>{};
global.confirm=()=>true;global.alert=m=>console.log('  [alert] '+m);
global.MutationObserver=class{observe(){}};
global.Image=class{set src(v){this._src=v;if(this.onload)this.onload();}};
global.fetch=async()=>({status:404,ok:false,headers:{get:()=>null},json:async()=>({})});

let pass=0,fail=0;
const check=(l,c,e='')=>{if(c){pass++;console.log(`  ✓ ${l}`);}else{fail++;console.log(`  ✗ ${l} ${e}`);}};

// 加载并进入主界面
await import('./src/main.js');
await new Promise(r=>setTimeout(r,50));
nodes['login-container'].querySelector('#btn-skip').click();
await new Promise(r=>setTimeout(r,60));
nodes['home-container'].querySelector('#hs-enter').click();
await new Promise(r=>setTimeout(r,60));
nodes['select-container'].querySelector('.cs-confirm').click();
await new Promise(r=>setTimeout(r,80));

console.log('═══════ 走火入魔阻塞测试 ═══════\n');
check('已进入主界面', !nodes['screen-main'].classList.contains('hidden'));

// 拿到内部 UI 实例不方便，改为通过 DOM 观察
// 反复修炼直到出现走火入魔弹窗
let found = false;
for (let i=0; i<200 && !found; i++) {
    const b = nodes['hud-container'].querySelectorAll('[data-action]').find(x=>x.dataset.action==='cultivate');
    if (b && !b.disabled) b.click();
    if (nodes['panel-container'].innerHTML.includes('deviation-box')) found = true;
}
check('成功触发走火入魔', found, '修炼 200 次未触发（可能概率过低）');

if (found) {
    console.log('\n【走火入魔期间的按钮状态】');
    const btns = nodes['hud-container'].querySelectorAll('[data-action]');
    const byAct = {};
    for (const b of btns) byAct[b.dataset.action] = b;

    check('「修炼」按钮被禁用', byAct['cultivate']?.disabled === true,
          `disabled=${byAct['cultivate']?.disabled}`);
    check('「渡劫」按钮被禁用', byAct['tribulation']?.disabled === true);
    check('「秘境」按钮被禁用', byAct['dungeon']?.disabled === true);
    check('「机缘」按钮被禁用', byAct['event']?.disabled === true);
    check('「功法」按钮仍可用（不推进进程）', byAct['methods']?.disabled !== true);
    check('「诵经」按钮仍可用', byAct['purify']?.disabled !== true);
    check('禁用按钮带提示文案', (byAct['cultivate']?.title||'').includes('走火入魔'), byAct['cultivate']?.title);
    check('HUD 显示阻塞提示', nodes['hud-container'].innerHTML.includes('hud-block-tip'));
    check('弹窗含「未化解前无法修炼」说明', nodes['panel-container'].innerHTML.includes('未化解前无法修炼'));

    console.log('\n【尝试绕过：强制 dispatch click】');
    // 即使绕过 disabled 强制点击，handleAction 兜底拦截也应生效：
    // 日志中应出现「真气逆冲未平」的拒绝提示
    byAct['cultivate'].dispatch('click');
    await new Promise(r=>setTimeout(r,40));
    check('弹窗仍然存在（未被绕过清空）',
          nodes['panel-container'].innerHTML.includes('deviation-box'));
    // 面板被弹窗占用，拦截反馈以节点形式 append 到弹窗上
    // （stub 的 innerHTML 是字符串快照，故检查 children 而非 innerHTML）
    const box = nodes['panel-container'].querySelectorAll('.deviation-box')[0];
    const kids = [...(box?.children || []), ...(box?._parsed || [])];
    check('弹窗上出现拦截反馈（兜底拦截生效）',
          kids.some(k => (k.textContent || '').includes('真气逆冲未平')),
          `children=${kids.length} texts=${kids.map(k=>k.textContent).join('|').slice(0,60)}`);

    console.log('\n【做出决断后应解锁】');
    const opt = nodes['panel-container'].querySelectorAll('.deviation-opt')[1];
    check('找到「散功重修」选项', !!opt);
    if (opt) {
        opt.click();
        await new Promise(r=>setTimeout(r,60));
        const after = nodes['hud-container'].querySelectorAll('[data-action]');
        const cult = after.find(x=>x.dataset.action==='cultivate');
        check('「修炼」按钮已恢复可用', cult && cult.disabled !== true);
        check('阻塞提示已消失', !nodes['hud-container'].innerHTML.includes('hud-block-tip'));
        check('弹窗已关闭', !nodes['panel-container'].innerHTML.includes('deviation-box'));
    }
}

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail>0?1:0);
