/** 复现：点击「开辟洞天」无反应 —— 捕获静默异常 */
class ClassList {
    constructor(){ this._s=new Set(); }
    add(...c){c.forEach(x=>this._s.add(x));}
    remove(...c){c.forEach(x=>this._s.delete(x));}
    toggle(c,f){f?this._s.add(c):this._s.delete(c);}
    contains(c){return this._s.has(c);}
}
class El {
    constructor(tag='div',id=''){
        this.tagName=tag; this.id=id; this.children=[]; this.dataset={};
        this.classList=new ClassList(); this.style={setProperty(){}};
        this._html=''; this._listeners={}; this._parsed=[];
    }
    set innerHTML(v){
        this._html=v; this._parsed=[];
        const re=/<(\w+)([^>]*)>/g; let m;
        while((m=re.exec(v))){
            const [,tag,attrs]=m; const c=new El(tag);
            const cls=/class="([^"]*)"/.exec(attrs);
            if(cls) cls[1].split(/\s+/).forEach(x=>x&&c.classList.add(x));
            const idm=/id="([^"]*)"/.exec(attrs); if(idm) c.id=idm[1];
            let d; const dm=/data-([\w-]+)="([^"]*)"/g;
            while((d=dm.exec(attrs))) c.dataset[d[1]]=d[2];
            this._parsed.push(c);
        }
    }
    get innerHTML(){return this._html;}
    set textContent(v){this._text=v;} get textContent(){return this._text||'';}
    appendChild(c){this.children.push(c);return c;}
    addEventListener(t,fn){(this._listeners[t]||=[]).push(fn);}
    dispatch(t,e={}){(this._listeners[t]||[]).forEach(fn=>fn(e));}
    click(){this.dispatch('click',{target:this});}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    querySelectorAll(s){
        const out=[]; const parts=s.split(',').map(x=>x.trim());
        const match=(el,p)=>{
            if(p.startsWith('.')) return el.classList.contains(p.slice(1));
            if(p.startsWith('#')) return el.id===p.slice(1);
            if(p.includes('[data-')){const k=p.match(/data-([\w-]+)/)?.[1];return k&&el.dataset[k]!==undefined;}
            return el.tagName===p;
        };
        const walk=n=>{ for(const c of (n._parsed||[])){ if(parts.some(p=>match(c,p))) out.push(c); } };
        walk(this); return out;
    }
    getBoundingClientRect(){return{width:480,height:520,left:0,top:0};}
    getContext(){return new Proxy({},{get:(t,k)=>String(k).includes('Gradient')?()=>({addColorStop(){}}):()=>{}});}
}
const nodes={};
for(const id of ['btn-home','btn-save','btn-load','btn-new','screen-home','screen-select','screen-main','home-container','select-container','hud-container','panel-container','btn-select-char','btn-continue-home','modal','modal-close','modal-body'])
    nodes[id]=new El(id.startsWith('btn')?'button':'div',id);
for(const id of ['btn-continue-home','btn-home','btn-save','btn-new','screen-select','screen-main'])
    nodes[id].classList.add('hidden');

global.document={getElementById:id=>nodes[id]||(nodes[id]=new El('div',id)),createElement:t=>new El(t),addEventListener(){},documentElement:new El('html'),hidden:false};
const store={};
global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
global.window={addEventListener(){},devicePixelRatio:1,matchMedia:()=>({matches:false})};
global.performance={now:()=>Date.now()};
global.requestAnimationFrame=()=>1; global.cancelAnimationFrame=()=>{};
global.confirm=()=>true; global.alert=m=>console.log('  [alert] '+m);
global.MutationObserver=class{observe(){}};
global.Image=class{set src(v){this._src=v;if(this.onload)this.onload();}};

// 捕获未处理的 module 异常
process.on('uncaughtException',e=>{console.log('  ✗ 未捕获异常: '+e.message);process.exit(1);});

await import('./src/main.js');
await new Promise(r=>setTimeout(r,50));

console.log('点击「选择角色」...');
nodes['btn-select-char'].click();
await new Promise(r=>setTimeout(r,50));
console.log('  选择页已渲染:', nodes['select-container'].innerHTML.includes('cs-root'));

const confirmBtn = nodes['select-container'].querySelector('.cs-confirm');
console.log('  找到确认按钮:', !!confirmBtn);
console.log('  绑定了 click 监听:', !!confirmBtn && (confirmBtn._listeners['click']||[]).length>0);

console.log('\n点击「开辟洞天」...');
try {
    confirmBtn.click();
    await new Promise(r=>setTimeout(r,80));
    const mainVisible = !nodes['screen-main'].classList.contains('hidden');
    console.log('  主界面可见:', mainVisible);
    console.log('  HUD 已渲染:', nodes['hud-container'].innerHTML.length>0);
    if(!mainVisible){ console.log('  ✗ 复现失败：主界面未显示'); process.exit(1); }
    console.log('  ✓ 流程正常');
} catch(e) {
    console.log('  ✗ 点击时抛异常: '+e.message);
    console.log(e.stack.split('\n').slice(0,6).join('\n'));
    process.exit(1);
}
