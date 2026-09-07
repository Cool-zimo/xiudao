import { getPortrait, getPortraitStage, CHAR_PORTRAITS, SCENES, preloadArt } from './src/ui/art.js';
import fs from 'fs';
import path from 'path';

let pass=0, fail=0;
const check=(l,c,e='')=>{ if(c){pass++;console.log(`  ✓ ${l}`);} else {fail++;console.log(`  ✗ ${l} ${e}`);} };

console.log('═══════ 美术资源集成验证 ═══════\n');

console.log('【资源文件存在性】');
for (const [k,v] of Object.entries({...CHAR_PORTRAITS, ...SCENES})) {
    check(`${k} 文件存在`, fs.existsSync(v), v);
}

console.log('\n【立绘切换逻辑】');
const mk = (realmIndex, karma) => ({ karma, cultivation: { realmIndex } });

check('练气期 → 初期立绘', getPortrait(mk(0,5)) === CHAR_PORTRAITS.early);
check('筑基期 → 初期立绘', getPortrait(mk(1,5)) === CHAR_PORTRAITS.early);
check('结丹期 → 中期立绘', getPortrait(mk(2,5)) === CHAR_PORTRAITS.mid);
check('元婴期 → 中期立绘', getPortrait(mk(4,5)) === CHAR_PORTRAITS.mid);
check('化神期 → 高阶立绘', getPortrait(mk(5,5)) === CHAR_PORTRAITS.high);
check('大乘期 → 高阶立绘', getPortrait(mk(8,5)) === CHAR_PORTRAITS.high);

console.log('\n【心魔覆盖境界】');
check('心魔 60 → 魔化立绘（覆盖低境界）', getPortrait(mk(0,60)) === CHAR_PORTRAITS.demon);
check('心魔 85 → 魔化立绘（覆盖高境界）', getPortrait(mk(8,85)) === CHAR_PORTRAITS.demon);
check('心魔 59 → 仍用境界立绘', getPortrait(mk(4,59)) === CHAR_PORTRAITS.mid);

console.log('\n【阶段名称】');
check('练气 → 初入仙途', getPortraitStage(mk(0,5)) === '初入仙途');
check('元婴 → 道基稳固', getPortraitStage(mk(4,5)) === '道基稳固');
check('化神 → 登堂入室', getPortraitStage(mk(5,5)) === '登堂入室');
check('心魔满 → 走火入魔', getPortraitStage(mk(8,90)) === '走火入魔');

console.log('\n【体积检查】');
let total = 0;
for (const v of [...Object.values(CHAR_PORTRAITS), ...Object.values(SCENES)]) {
    total += fs.statSync(v).size;
}
check(`总资源 < 1.5MB（实为 ${(total/1024/1024).toFixed(2)}MB）`, total < 1.5*1024*1024);

console.log(`\n═══════ 结果：${pass} 通过 / ${fail} 失败 ═══════`);
process.exit(fail>0?1:0);
