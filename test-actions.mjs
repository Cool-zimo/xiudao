/** 主界面所有按钮交互测试 —— 防止同类静默异常 */
class ClassList{constructor(){this._s=new Set();}add(...c){c.forEach(x=>this._s.add(x));}remove(...c){c.forEach(x=>this._s.delete(x));}toggle(c,f){f?this._s.add(c):this._s.delete(c);}contains(c){return this._s.has(c);}}
class El{
    constructor(tag='div',id=''){this.tagName=tag;this.id=id;this.children=[];this.dataset={};this.classList=new ClassList();this.style={setProperty(){}};this._html='';this._listeners={};this._parsed=[];}
    set innerHTML(v){this._html=v;this._parsed=[];const re=/<(\w+)([^>]*)>/g;let m;while((m=re.exec(v))){const[,tag,attrs]=m;const c=new El(tag);const cls=/class="([^"]*)"/.exec(attrs);if(cls)cls[1].split(/\s+/).forEach(x=>x&&c.classList.add(x));const idm=/id="([^"]*)"/.exec(attrs);if(idm)c.id=idm[1];let d;const dm=/data-([\w-]+)="([^"]*)"/g;while((d=dm.exec(attrs)))c.dataset[d[1]]=d[2];const da=/data-action="([^"]*)"/.exec(attrs);if(da)c.dataset.action=da[1];const sr=/src="([^"]*)"/.exec(attrs);if(sr)c.src=sr[1];this._parsed.push(c);}}
    get innerHTML(){return this._html;}
    set textContent(v){this._text=v;}get textContent(){return this._text||'';}
    appendChild(c){this.children.push(c);return c;}
    addEventListener(t,fn){(this._listeners[t]||=[]).push(fn);}
    dispatch(t,e={}){(this._listeners[t]||[]).forEach(fn=>fn(e));}
    click(){this.dispatch('click',{target:this});}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    querySelectorAll(s){const out=[];const parts=s.split(',').map(x=>x.trim());const match=(el,p)=>{if(p.startsWith('.'))return el.classList.contains(p.slice(1));if(p.startsWith('#'))return el.id===p.slice(1);if(p.includes('[data-action'))return el.dataset.action!==undefined;if(p.includes('[data-')){const k=p.match(/data-([\w-]+)/)?.[1];return k&&el.dataset[k]!==undefined;}return el.tagName===p;};const walk=n=>{for(const c of(n._parsed||[])){if(parts.some(p=>match(c,p)))out.push(c);}};walk(this);return out;}
    getBoundingClientRect(){return{width:480,height:640,left:0,top:0};}
    getContext(){return new Proxy({},{get:(t,k)=>String(k).includes('Gradient')?()=>({addColorStop(){}}):()=>{}});}
}
const nodes={};
for(const id of ['btn-home','btn-save','btn-load','btn-new','screen-home','screen-select','screen-main','home-container','select-container','hud-container','panel-container','btn-select-char','btn-continue-home','modal','modal-close','modal-body'])
    nodes[id]=new El(id.startsWith('btn')?'button':'div',id);
for(const id of ['btn-continue-home','btn-home','btn-save','btn-new','screen-select','screen-main']) nodes[id].classList.add('hidden');
global.document={getElementById:id=>nodes[id]||(nodes[id]=new El('div',id)),createElement:t=>new El(t),addEventListener(){},documentElement:new El('html'),hidden:false};
const store={};
global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
global.window={addEventListener(){},devicePixelRatio:1,matchMedia:()=>({matches:false})};
global.performance={now:()=>Date.now()};
global.requestAnimationFrame=()=>1;global.cancelAnimationFrame=()=>{};
global.confirm=()=>true;global.alert=m=>console.log('  [alert] '+m);
global.MutationObserver=class{observe(){}};
global.Image=class{set src(v){this._src=v;if(this.onload)this.onload();}};

await import('./src/main.js');
await new Promise(r=>setTimeout(r,50));
nodes['btn-select-char'].click();
await new Promise(r=>setTimeout(r,50));
nodes['select-container'].querySelector('.cs-confirm').click();
await new Promise(r=>setTimeout(r,80));

let pass=0,fail=0;
const check=(l,c,e='')=>{if(c){pass++;console.log(`  ✓ ${l}`);}else{fail++;console.log(`  ✗ ${l} ${e}`);}};

console.log('═══════ 主界面交互测试 ═══════\n');
check('已进入主界面', !nodes['screen-main'].classList.contains('hidden'));

// 收集 HUD 上的所有 action 按钮
const btns = nodes['hud-container'].querySelectorAll('[data-action]');
console.log(`  HUD 按钮数: ${btns.length}`);
check('HUD 渲染出操作按钮', btns.length > 0);

const actions = btns.map(b=>b.dataset.action);
console.log(`  可用操作: ${actions.join(', ')}\n`);

// 逐个点击（每次点击后重新获取，因为 render 会重建 DOM）
for (const act of ['cultivate','methods','dungeon','event','purify']) {
    const fresh = nodes['hud-container'].querySelectorAll('[data-action]').find(b=>b.dataset.action===act);
    if (!fresh) { console.log(`  - ${act}: 当前状态不可用（跳过）`); continue; }
    try {
        fresh.click();
        await new Promise(r=>setTimeout(r,40));
        check(`点击「${act}」无异常`, true);
    } catch(e) {
        check(`点击「${act}」无异常`, false, e.message.slice(0,60));
    }
}

// 修炼多次触发走火入魔分支
console.log('\n【连续修炼 30 次（触发走火入魔 / 升级）】');
let err=null;
try {
    for(let i=0;i<30;i++){
        const b=nodes['hud-container'].querySelectorAll('[data-action]').find(x=>x.dataset.action==='cultivate');
        if(b) b.click();
    }
    await new Promise(r=>setTimeout(r,60));
} catch(e){ err=e.message; }
check('连续修炼无异常', !err, err||'');

// 渡劫（需达到圆满）
console.log('\n【渡劫按钮】');
const tb = nodes['hud-container'].querySelectorAll('[data-action]').find(b=>b.dataset.action==='tribulation');
if (tb) {
    try { tb.click(); await new Promise(r=>setTimeout(r,60)); check('点击「渡劫」无异常', true); }
    catch(e){ check('点击「渡劫」无异常', false, e.message.slice(0,60)); }
} else console.log('  - 未达圆满，渡劫按钮 disabled（正常）');

// 保存/读档
console.log('\n【存档】');
try {
    nodes['btn-save'].click();
    check('保存无异常', !!store['xiudao2_save']);
} catch(e){ check('保存无异常', false, e.message.slice(0,60)); }

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail>0?1:0);
