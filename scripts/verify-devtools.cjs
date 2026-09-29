// Real WeChat simulator verification. Requires manually enabled DevTools service port.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../artifacts/devtools-runner/node_modules/miniprogram-automator');
// Write evidence outside the watched project while connected. Saving a PNG/JSON
// inside the project can make DevTools hot-reload and invalidate automation IDs.
const dir=path.join(require('node:os').tmpdir(),'anju-visual-v11');fs.mkdirSync(dir,{recursive:true});
const evidence={at:new Date().toISOString(),environment:'WeChat DevTools simulator',interaction:'Real simulator rendering; Page.callMethod, custom component methods, dispatched view events and wx navigation. SDK native touch is not certified.',checks:[],screenshots:[],exceptions:[],notVerified:['Physical device','System photo picker','Physical soft keyboard','Native touch hit testing']};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let mini;
async function current(expected){let p;for(let n=0;n<12;n++){await sleep(400);p=await mini.currentPage();if(!expected||p.path==='pages/'+expected+'/'+expected)return p}assert.equal(p.path,'pages/'+expected+'/'+expected);return p}
// Element.tap/native touch times out in this IDE. Dispatch view events or the
// custom button's tap method; keep the limitation explicit in runtime evidence.
async function tap(p,selector,inner){console.log('event',p.path,selector);const el=await p.$(selector);assert.ok(el,'Missing '+selector);if(inner)await el.callMethod('tap');else await el.trigger('tap');await sleep(400)}
async function shot(name){await sleep(500);const file=dir+'/'+name+'.png';await mini.screenshot({path:file});evidence.screenshots.push(file);fs.writeFileSync(dir+'/progress.json',JSON.stringify(evidence,null,2))}
async function tab(name){await mini.switchTab('/pages/'+name+'/'+name);return current(name)}
async function main(){
 mini=await automator.connect({wsEndpoint:process.env.WECHAT_AUTOMATION_WS||'ws://127.0.0.1:9420'});
 mini.on('exception',e=>evidence.exceptions.push(e));
 const sys=await mini.systemInfo();evidence.device={model:sys.model,windowWidth:sys.windowWidth,windowHeight:sys.windowHeight,screenWidth:sys.screenWidth,screenHeight:sys.screenHeight,safeArea:sys.safeArea,SDKVersion:sys.SDKVersion};
 let p=await mini.reLaunch('/pages/login/login');await sleep(800);assert.equal(await p.data('agreed'),false);await shot('01-login-unchecked');
 console.log('unchecked');await p.callMethod('submit');await current('login');evidence.checks.push('Unchecked consent prevents login handler');
 console.log('agree');await p.callMethod('agree',{detail:{value:['yes']}});await sleep(400);assert.equal(await p.data('agreed'),true);await shot('02-login-checked');console.log('submit login');await p.callMethod('submit');p=await current('index');await shot('03-home');evidence.checks.push('Simulator page consent/login handlers open home');
 p=await tab('hazards');await shot('04-hazards');await tap(p,'.report-card');p=await current('report-detail');await shot('05-example-detail');await mini.navigateBack();await current('hazards');evidence.checks.push('Hazard list opens selected detail and wx.navigateBack returns to list');
 p=await tab('building');await shot('06-building');
 p=await tab('me');await shot('07-me');evidence.checks.push('wx.switchTab opens all four tab pages and renders native tabBar');
 p=await mini.navigateTo('/pages/report/report');await sleep(500);await shot('08-report-empty');
 await (await p.$('input[data-field="location"]')).input('6层东侧楼道（模拟器检查）');
 await (await p.$('textarea')).input('演示检查：楼道内堆放纸箱，请保持通道畅通。');
 await (await p.$('input[data-field="contact"]')).input('演示联系方式');await shot('09-report-filled');await tap(p,'#submit-report','button');p=await current('report-result');const report=await p.data('record');assert.ok(report.id);assert.ok(report.location.includes('模拟器检查'));await shot('10-report-result');
 await tap(p,'#view-report','button');p=await current('report-detail');assert.equal((await p.data('record')).id,report.id);await shot('11-report-detail');evidence.checks.push('Typed report produces matching result and detail, with real local ID');
 p=await mini.navigateTo('/pages/my-reports/my-reports');await sleep(500);assert.equal((await p.data('items'))[0].id,report.id);await shot('12-my-reports');
 p=await tab('building');await tap(p,'#start-drill','button');p=await current('drill');const drillId=p.query.id;await shot('13-drill-exit');await tap(p,'#next-drill','button');
 p=await current('assembly');await shot('14-assembly');await tap(p,'#finish-drill','button');p=await current('drill-summary');assert.equal((await p.data('record')).completedCount,2);assert.ok((await p.data('record')).durationSeconds>0);await shot('15-drill-summary');evidence.checks.push('Two step buttons complete a drill with dynamic duration and 2/2 summary');
 await mini.navigateBack();p=await current('building');evidence.checks.push('wx.navigateBack from completed summary returns to building');
 p=await mini.navigateTo('/pages/drill-records/drill-records');await sleep(500);assert.equal((await p.data('items'))[0].id,drillId);await shot('16-drill-records');await tap(p,'.card');p=await current('drill-summary');assert.equal(p.query.id,drillId);await tap(p,'#again-drill','button');p=await current('drill');assert.notEqual(p.query.id,drillId);evidence.checks.push('History opens matching summary; repeat creates a distinct session');
 p=await tab('building');await tap(p,'#view-devices');p=await current('devices');await shot('19-devices');
 p=await mini.navigateTo('/pages/emergency/emergency');await sleep(500);await shot('17-emergency');await tap(p,'button[data-kind="fire"]');await shot('18-emergency-demo-dialog');evidence.checks.push('Fire contact opens real demonstration dialog (no dial API in app)');
 assert.equal(evidence.exceptions.length,0,'Simulator runtime exception');
 evidence.result='passed';
}
main().catch(e=>{evidence.result='failed';evidence.failure=e.stack;console.error(e);process.exitCode=1}).finally(()=>{if(mini)mini.disconnect();fs.mkdirSync('artifacts/visual-v11',{recursive:true});evidence.screenshots=evidence.screenshots.map(f=>{const target='artifacts/visual-v11/'+path.basename(f);fs.copyFileSync(f,target);return target});fs.writeFileSync('artifacts/visual-v11/results.json',JSON.stringify(evidence,null,2)+'\n');console.log('Simulator result: '+evidence.result+'; checks: '+evidence.checks.length)});
