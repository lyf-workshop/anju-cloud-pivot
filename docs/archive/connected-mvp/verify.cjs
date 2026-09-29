const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Run with npm run verify');
fs.mkdirSync('artifacts/verification',{recursive:true});
const results=[];
for(const [name,args] of [['build',['run','build']],['tests',['test']],['wechat-compiler',['run','check:wechat']],['dependency-audit',['audit','--json']]]){
  const r=spawnSync(process.execPath,[npm,...args],{encoding:'utf8',maxBuffer:8*1024*1024});
  const log=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join('artifacts/verification',name+'.txt'),log);
  results.push({name,exitCode:r.status,log:name+'.txt'});console.log(name+': '+(r.status===0?'PASS':'FAIL'));
  if(r.status!==0)process.exitCode=1;
}
fs.writeFileSync('artifacts/verification/results.json',JSON.stringify({at:new Date().toISOString(),node:process.version,results,notExecuted:['Figma comparison','WeChat simulator UI','physical devices','live WeChat identity exchange','real hardware']},null,2)+'\n');
