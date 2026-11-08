#!/usr/bin/env node
// Opt-in local device check. Exposes only the game, its assets and this lab.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),reportDir=path.join(root,'artifacts','device-reports');
const checks=['portrait','landscape','rotation','safeArea','largeText','build','runes','story','saveLoad','fullscreen','background','audio','denseBattle'];
const previews=[['turret','机枪炮塔'],['frost','冰霜塔'],['laser','激光塔'],['tesla','电磁塔'],['flame','火焰塔'],['poison','毒液塔'],['sonic','声波塔'],['missile','导弹塔'],['gravity','引力塔'],['prism','棱镜塔'],['generator','发电机·特斯拉线圈'],['boss_lord','领主·号令'],['boss_abyss','巨口·汲取'],['boss_machine','机械·扫射'],['boss_void','虚空·跃迁'],['boss_final','终焉·终钟']];
const listenStates=['untested','clear','confusing','inaudible','harsh'];
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.json':'application/json; charset=utf-8','.vtt':'text/vtt; charset=utf-8'};
function sendMedia(req,res,type,size,read){
 res.setHeader('Content-Type',type);res.setHeader('Accept-Ranges','bytes');
 let start=0,end=size-1;
 if(req.headers.range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(match&&(match[1]||match[2])){
   if(!match[1])start=Math.max(0,size-Number(match[2]));
   else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
  }else start=NaN;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=size){res.setHeader('Content-Range','bytes */'+size);return res.writeHead(416).end();}
  res.statusCode=206;res.setHeader('Content-Range','bytes '+start+'-'+end+'/'+size);
 }
 res.setHeader('Content-Length',end-start+1);if(req.method==='HEAD'||size===0)return res.end();read(start,end);
}
function recordedClip(id){
 const index=previews.findIndex(([key])=>key===id),file=path.join(root,'artifacts','audio','chromium-weapon-sampler.wav');
 if(index<0||!fs.existsSync(file))return null;
 const source=fs.readFileSync(file);if(source.length<44||source.toString('ascii',0,4)!=='RIFF'||source.toString('ascii',36,40)!=='data')return null;
 const stride=source.readUInt32LE(28),start=44+index*stride,end=start+stride;
 if(!stride||end>source.length)return null;
 const header=Buffer.from(source.subarray(0,44));header.writeUInt32LE(stride+36,4);header.writeUInt32LE(stride,40);
 return Buffer.concat([header,source.subarray(start,end)]);
}
function cleanReport(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid report');
 const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
 const device=text(value.device,160),physicalConfirmed=value.physicalConfirmed===true && !!device;
 const status={};for(const key of checks)status[key]=['pass','fail','untested'].includes(value.checks?.[key])?value.checks[key]:'untested';
 const listening={};for(const [id]of previews)listening[id]=listenStates.includes(value.listening?.[id])?value.listening[id]:'untested';
 const environment=value.sample?.environment||{},measurement=value.sample?.measurement||{};
 const number=(v,max=60000)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.min(v,max):null;
 const timing=metric=>({count:number(metric?.count,100000),mean:number(metric?.mean),p95:number(metric?.p95),max:number(metric?.max)});
 return {schema:2,recordedAt:new Date().toISOString(),device,physicalConfirmed,checks:status,listening,
  listeningSetup:text(value.listeningSetup,160),audioPreview:{method:['web-audio','recorded-pcm'].includes(value.audioPreview?.method)?value.audioPreview.method:'untested',contextState:text(value.audioPreview?.contextState,40),volume:number(value.audioPreview?.volume,1)},notes:text(value.notes,6000),
  sample:{environment:{userAgent:text(environment.userAgent,500),platform:text(environment.platform,100),viewport:text(environment.viewport,100),safeArea:text(environment.safeArea,200),audio:text(environment.audio,200),fullscreen:text(environment.fullscreen,100)},
   measurement:{seconds:number(measurement.seconds,60),paused:measurement.paused===true,quality:text(measurement.quality,20),wave:number(measurement.wave,9999),buildings:number(measurement.buildings,10000),enemies:number(measurement.enemies,10000),frames:timing(measurement.frames),render:timing(measurement.render),simulation:timing(measurement.simulation)}},
  interpretation:physicalConfirmed?'用户手动确认物理设备；检查项为用户记录，帧时间为该次页面采样。':'未确认物理设备；不得作为Android／iOS实机验收。'};
}
function createServer(){
 const token=crypto.randomBytes(24).toString('hex');
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end('Bad URL');}
  if(pathname==='/report'){
   if(req.method!=='POST')return res.writeHead(405).end();
   if(req.headers['x-device-lab-token']!==token)return res.writeHead(403).end('Open the device lab first');
   let body='',tooLarge=false;
   try{
    for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536){tooLarge=true;break;}}
    if(tooLarge)return res.writeHead(413).end('Report exceeds 64 KiB');
    const report=cleanReport(JSON.parse(body));fs.mkdirSync(reportDir,{recursive:true});
    const name='device-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.json';
    fs.writeFileSync(path.join(reportDir,name),JSON.stringify(report,null,2),{flag:'wx'});
    res.setHeader('Content-Type',mime['.json']);return res.end(JSON.stringify({saved:name,report}));
   }catch(error){return res.writeHead(400).end('Invalid report');}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return res.writeHead(405).end();
  if(pathname==='/audio-runtime.js'){
   res.setHeader('Content-Type','application/javascript; charset=utf-8');
   return res.end(fs.readFileSync(path.join(root,'presentation.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'audio.js'),'utf8'));
  }
  if(pathname.startsWith('/sound-samples/')){
   const id=pathname.slice('/sound-samples/'.length).replace(/\.wav$/,''),clip=pathname.endsWith('.wav')&&recordedClip(id);
   if(!clip)return res.writeHead(404).end('Recorded sample unavailable; run npm run test:audio on the computer');
   return sendMedia(req,res,'audio/wav',clip.length,(start,end)=>res.end(clip.subarray(start,end+1)));
  }
  if(pathname==='/'||pathname==='/device-lab.html'){
   res.setHeader('Content-Type',mime['.html']);const html=fs.readFileSync(path.join(__dirname,'device-lab.html'),'utf8').replace('<!--LAB_TOKEN-->',()=>token).replace('<!--PREVIEW_DATA-->',()=>JSON.stringify(previews));
   return req.method==='HEAD'?res.end():res.end(html);
  }
  const isGame=['/game','/index.html','/shoudengren.html'].includes(pathname),extension=path.extname(pathname).toLowerCase();
  const audioFile=pathname.startsWith('/audio/')&&['.mp3','.ogg','.wav'].includes(extension);
  if(!isGame && !audioFile && !(pathname.startsWith('/assets/')&&mime[extension]))return res.writeHead(404).end();
  const file=path.resolve(root,isGame?pathname==='/shoudengren.html'?'shoudengren.html':'index.html':'.'+pathname);
  if(!file.startsWith(root+path.sep)||pathname.split('/').some(s=>s.startsWith('.'))||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  return sendMedia(req,res,isGame?mime['.html']:mime[extension],fs.statSync(file).size,(start,end)=>fs.createReadStream(file,{start,end}).pipe(res));
 });
}
if(require.main===module){
 const lan=process.argv.includes('--lan'),portArg=process.argv.find(a=>a.startsWith('--port=')),port=portArg?Number(portArg.slice(7)):4173;
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid --port');
 const server=createServer();server.on('error',error=>{console.error(error.message);process.exitCode=1;});
 server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
  const actual=server.address().port;console.log('本地手机验收入口：http://127.0.0.1:'+actual+'/');
  if(lan)for(const items of Object.values(os.networkInterfaces()))for(const item of items||[])if(item.family==='IPv4'&&!item.internal)console.log('同一Wi-Fi手机可打开：http://'+item.address+':'+actual+'/');
  console.log('报告仅保存至 artifacts/device-reports；Ctrl+C 停止。'+(lan?'':' 局域网需显式添加 --lan。'));
 });
}
module.exports={createServer,cleanReport,checks,previews};
