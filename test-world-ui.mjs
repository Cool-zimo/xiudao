/** 世界地图 UI 集成测试 */
class ClassList{constructor(){this._s=new Set();}add(...c){c.forEach(x=>this._s.add(x));}remove(...c){c.forEach(x=>this._s.delete(x));}toggle(c,f){f?this._s.add(c):this._s.delete(c);}contains(c){return this._s.has(c);}}
class El{
    constructor(tag='div',id=''){this.tagName=tag;this.id=id;this.children=[];this.dataset={};this.attrs={};this.classList=new ClassList();this.style={setProperty(){}};this._html='';this._listeners={};this._parsed=[];this.disabled=false;this.title='';this.width=300;this.height=300;this.offsetWidth=100;}
    set innerHTML(v){this._html=v;this._parsed=[];const re=/<(\w+)([^>]*)>/g;let m;while((m=re.exec(v))){const[,tag,attrs]=m;const c=new El(tag);const cls=/class="([^"]*)"/.exec(attrs);if(cls)cls[1].split(/\s+/).forEach(x=>x&&c.classList.add(x));const idm=/id="([^"]*)"/.exec(attrs);if(idm)c.id=idm[1];let d;const dm=/data-([\w-]+)="([^"]*)"/g;while((d=dm.exec(attrs)))c.dataset[d[1]]=d[2];const da=/data-action="([^"]*)"/.exec(attrs);if(da)c.dataset.action=da[1];if(/disabled/.test(attrs))c.disabled=true;const ti=/title="([^"]*)"/.exec(attrs);if(ti)c.title=ti[1];this._parsed.push(c);}}
    get innerHTML(){return this._html;}
    set textContent(v){this._text=v;}get textContent(){return this._text||'';}
    appendChild(c){this.children.push(c);this._parsed.push(c);return c;}
    addEventListener(t,fn){(this._listeners[t]||=[]).push(fn);}
    dispatch(t,e={}){(this._listeners[t]||[]).forEach(fn=>fn(e));}
    click(){this.dispatch('click',{target:this});}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    querySelectorAll(s){const out=[];const parts=s.split(',').map(x=>x.trim());const match=(el,p)=>{if(p.startsWith('.'))return el.classList.contains(p.slice(1));if(p.startsWith('#'))return el.id===p.slice(1);if(p.includes('[data-action'))return el.dataset.action!==undefined;if(p.includes('[data-')){const k=p.match(/data-([\w-]+)/)?.[1];return k&&el.dataset[k]!==undefined;}return el.tagName===p;};const walk=n=>{for(const c of(n._parsed||[])){if(parts.some(p=>match(c,p)))out.push(c);}};walk(this);return out;}
    getBoundingClientRect(){return{width:720,height:720,left:0,top:0};}
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
global.Image=class{set src(v){this._src=v;this.width=128;this.height=128;if(this.onload)setTimeout(()=>this.onload(),0);}};
global.fetch=async()=>({status:404,ok:false,headers:{get:()=>null},json:async()=>({})});

let pass=0,fail=0;
const check=(l,c,e='')=>{if(c){pass++;console.log(`  ✓ ${l}`);}else{fail++;console.log(`  ✗ ${l} ${e}`);}};

await import('./src/main.js');
await new Promise(r=>setTimeout(r,60));
nodes['login-container'].querySelector('#btn-skip').click();
await new Promise(r=>setTimeout(r,60));
nodes['home-container'].querySelector('#hs-enter').click();
await new Promise(r=>setTimeout(r,60));
nodes['select-container'].querySelector('.cs-confirm').click();
await new Promise(r=>setTimeout(r,100));

console.log('═══════ 世界地图 UI 集成测试 ═══════\n');
check('已进入主界面', !nodes['screen-main'].classList.contains('hidden'));

console.log('【打开世界】');
const btns = nodes['hud-container'].querySelectorAll('[data-action]');
const worldBtn = btns.find(b=>b.dataset.action==='world');
check('HUD 出现「天下」按钮', !!worldBtn, btns.map(b=>b.dataset.action).join(','));

if (worldBtn) {
    worldBtn.click();
    await new Promise(r=>setTimeout(r,120));
    const html = nodes['panel-container'].innerHTML;
    check('世界地图已渲染', html.includes('wc-root'), html.slice(0,60));
    check('含地图 canvas', html.includes('wc-canvas'));
    check('含灵气图开关', html.includes('灵气图'));
    check('含图例', html.includes('wc-legend'));
    check('含操作提示', html.includes('WASD'));

    const legend = nodes['panel-container'].querySelectorAll('.wc-lg');
    check('图例列出全部 7 种地形', legend.length === 7, `${legend.length} 条`);

    console.log('\n【地图状态】');
    const posText = nodes['panel-container'].querySelector('#wc-pos')?.textContent || '';
    check('位置信息已显示', posText.includes('灵气') && posText.includes('('), posText);
    check('出生在山门', posText.includes('山门'), posText);
}

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail>0?1:0);
