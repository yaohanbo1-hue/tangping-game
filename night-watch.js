// Optional preparation decisions. Only an explicit choice changes the battle.
// Everything is run-local and serializable; no combat RNG or wall-clock timer.
const NightWatch = {
  _number(value, max=1e12) { return Number.isFinite(value) ? Math.max(0,Math.min(max,value)) : 0; },
  init(saved) {
    if (typeof G==='undefined'||!G)return;
    const s={version:1,decided:{},active:null,history:[],result:null,messages:[],said:[],observed:{leaks:G.stats?.leaks||0,interrupts:G.stats?.bossInterrupts||0,lowBed:G.bed?.hp<=G.bed?.maxHp*.3}};
    if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
      for(const [key,value]of Object.entries(saved.decided||{}))if(/^\d+$/.test(key)&&Number(key)>=3&&Number(key)<=55&&(Number(key)-3)%4===0&&['prepare','venture','pass'].includes(value))s.decided[Number(key)]=value;
      if(Array.isArray(saved.history))s.history=saved.history.slice(-8).filter(x=>x&&typeof x.title==='string').map(x=>({title:x.title.slice(0,80),description:String(x.description||'').slice(0,240),success:x.success===true,wave:this._number(x.wave,9999)}));
      if(saved.result&&typeof saved.result.title==='string')s.result={title:saved.result.title.slice(0,80),description:String(saved.result.description||'').slice(0,240),success:saved.result.success===true};
      if(Array.isArray(saved.messages))s.messages=saved.messages.slice(-8).filter(m=>m&&typeof m.text==='string').map(m=>({speaker:'室友',text:m.text.slice(0,240),wave:this._number(m.wave,9999)}));
      if(Array.isArray(saved.said))s.said=saved.said.filter(k=>typeof k==='string').slice(-24).map(k=>k.slice(0,70));
      const a=saved.active,activeKinds=[{}, {prepare:'overload',venture:'freeze'}, {prepare:'lure',venture:'seal'}, {prepare:'deposit'}, {prepare:'route',venture:'spread'}, {}];
      const slot=a&&a.wave-1,index=slot>=2?(Math.floor((slot-2)/4)%6):-1;
      if(a&&typeof a==='object'&&Number.isInteger(a.wave)&&a.wave>=3&&a.wave<=55&&(slot-2)%4===0&&activeKinds[index]?.[s.decided[a.wave]]===a.kind){
        const base=Math.round(35*Math.pow(1.22,slot));
        s.active={kind:a.kind,wave:a.wave,title:String(a.title||'守夜安排').slice(0,80),description:String(a.description||'').slice(0,240),reward:a.kind==='lure'?Math.round(base*.8):a.kind==='deposit'?Math.round(base*.45):0,deposit:a.kind==='deposit'?Math.round(base*.5):0,lane:Math.floor(this._number(a.lane,2)),freezeApplied:a.freezeApplied===true,violated:a.violated===true,startedWave:0,startStamp:null,elapsed:0,baseline:null};
      }
    }
    G.nightWatch=s;
  },
  _state() { if(typeof G==='undefined'||!G)return null;if(!G.nightWatch)this.init();return G.nightWatch; },
  _slot() { return G.resumeWave ? G.wave-1 : G.wave; },
  _offer() {
    const s=this._state();if(!s||G.over||G.state!=='build'||s.active)return null;
    const slot=this._slot();if(slot<2||slot>54||(slot-2)%4)return null;
    const wave=slot+1;if(s.decided[wave])return null;
    const base=Math.round(35*Math.pow(1.22,Math.min(slot,60))),power=8+slot*2;
    const living=(G.doors||[]).filter(d=>!d.broken),weak=living.slice().sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    const strongest=living.slice().sort((a,b)=>b.hp/b.maxHp-a.hp/a.maxHp||a.lane-b.lane)[0];
    const lane=strongest?strongest.lane:1;
    const choice=(id,title,description,cost,reward,action,reason='')=>({id,title,description,cost,reward,action,disabled:!!reason,reason});
    const fee=(gold=0,p=0,souls=0)=>({gold:Math.round(gold),power:p,souls});
    const payText=c=>[c.gold?c.gold+'金币':'',c.power?c.power+'电力':'',c.souls?c.souls+'灵魂':''].filter(Boolean).join(' · ')||'无需预付';
    let title,description,choices;
    switch(Math.floor((slot-2)/4)%6){
      case 0:
        title='门缝里的螺丝';description='值夜的同伴找到了两套工具。只能趁下一波到来前修一处。';
        choices=[choice('prepare','先补最危险的门','修补当前生命比例最低、尚未破坏的铁门。',fee(base*.65),'该门恢复25%最大生命',{kind:'repairDoor',lane:weak?weak.lane:1},!weak?'没有完整铁门可修':weak.hp>=weak.maxHp?'铁门目前完好':''),choice('venture','把工具分给房内','用电动工具给全部现存建筑做一次小修。',fee(0,power),'现存建筑各恢复15%最大生命',{kind:'repairBuildings'},!(G.buildings||[]).some(b=>b.hp<b.maxHp)?'现存建筑目前无需修理':'')];break;
      case 1:
        title='插座正在发烫';description='走廊里的电压忽高忽低。是把余电留给火力，还是先让应急开关复位？';
        choices=[choice('prepare','存成一轮爆发','下一波开场获得12秒超频，电力现在支付。',fee(0,power*2),'下一波开场12秒超频',{kind:'overload'}),choice('venture','先校准冻结开关','下一波开场缩短冻结技能冷却8秒；不会越过试炼的禁技能规则。',fee(base*.55),'冻结冷却缩短8秒',{kind:'freeze'},(G.skills.freeze||0)<=0?'冻结开关已就绪，无需校准':'')];break;
      case 2:
        title='拐角又响了三声';description='有人想用空罐头把追赶者引出来。多守一小群，便能取回他们丢下的物资。';
        choices=[choice('prepare','引它们到门前','下一波增加3只同波次普通梦魇，不增加Boss；完成该波才领额外补给。',fee(),'额外3只梦魇；守住后+'+Math.round(base*.8)+'金币',{kind:'lure',reward:Math.round(base*.8)}),choice('venture','封住召唤的回声','花费物资布置封条，下一波禁止敌人召唤增援；现存敌人仍正常进攻。',fee(base*.8),'下一波召唤封锁',{kind:'seal'})];break;
      case 3:
        title='借来的工具箱';description='维修员愿意押下一箱补给：下一波先守住已有布阵，清波后再扩建。';
        choices=[choice('prepare','答应先守后建','预付押金；下一波不新建建筑则返还押金与额外补给。升级和转职仍可进行。',fee(base*.5),'不新建通关：返还押金并额外+'+Math.round(base*.45)+'金币',{kind:'deposit',deposit:Math.round(base*.5),reward:Math.round(base*.45)}),choice('venture','现在买走备用电池','不接押金约定，把金币换成电力，继续自由扩建。',fee(base*.7),'立即获得'+power*3+'电力',{kind:'power',amount:power*3})];break;
      case 4:
        title='走廊路口的信号灯';description='同伴能挪动第一批追赶者的来路。调整只影响普通队列，Boss仍按原路线抵达。';
        choices=[choice('prepare','把前排引向第'+(lane+1)+'路','下一波前8名普通队列集中到当前最完好的铁门一路；总敌人数不变。',fee(base*.55),'前8名集中到第'+(lane+1)+'路',{kind:'route',lane}),choice('venture','把前排分散三路','下一波前12名普通队列按一、二、三路轮流抵达；总敌人数不变。',fee(base*.35),'前12名轮流三路',{kind:'spread'})];break;
      default:
        title='值夜人的补给单';description='储物柜里只剩两种互换方案。考虑下一轮升级需要，签下一项即可。';
        choices=[choice('prepare','先留建筑预算','交出一批电力换金币；只在本次补给中可兑换一次。',fee(0,power*3),'立即获得'+Math.round(base*.9)+'金币',{kind:'gold',amount:Math.round(base*.9)}),choice('venture','先留高阶升级电力','支付金币换电力，保留下一轮高阶升级空间。',fee(base*.65),'立即获得'+power*4+'电力',{kind:'power',amount:power*4})];
    }
    for(const c of choices){c.payment=c.cost;c.cost=payText(c.payment);if(!c.disabled&&['gold','power','souls'].some(k=>(G[k]||0)<(c.payment[k]||0))){c.disabled=true;c.reason='当前资源不足';}}
    choices.push(choice('pass','按原计划守夜','不接受这次安排，保留资源与原本的战局。','无','战斗不变',{kind:'pass'}));
    return{title,description,choices,wave,nextWave:wave};
  },
  _record(title,description,success,wave) {
    const s=this._state();if(!s)return;s.result={title,description,success};s.history.push({title,description,success,wave});s.history=s.history.slice(-8);
    this._say(description,'result:'+wave);
    if(typeof EventBus!=='undefined')EventBus.emit('watch:result',s.result);
  },
  _say(text,key) {
    const s=this._state();if(!s||s.said.includes(key))return;s.said.push(key);s.said=s.said.slice(-24);
    const message={speaker:'室友',text,wave:G.wave};s.messages.push(message);s.messages=s.messages.slice(-8);
    if(typeof EventBus!=='undefined')EventBus.emit('watch:room',message);
  },
  choose(id) {
    const offer=this._offer();if(!offer)return false;const c=offer.choices.find(x=>x.id===id);if(!c||c.disabled)return false;
    const s=this._state(),a=c.action;s.decided[offer.wave]=id;
    for(const k of ['gold','power','souls'])G[k]=Math.max(0,(G[k]||0)-(c.payment?.[k]||0));
    s.result=null;
    if(a.kind==='pass')this._record(offer.title,'你决定按原来的计划守夜。',true,offer.wave);
    else if(a.kind==='repairDoor'){
      const door=G.doors.find(d=>d.lane===a.lane&&!d.broken);if(door)door.hp=Math.min(door.maxHp,door.hp+door.maxHp*.25);
      this._record(offer.title,c.title+'：'+c.reward,true,offer.wave);
    }else if(a.kind==='repairBuildings'){
      G.buildings.forEach(b=>{b.hp=Math.min(b.maxHp,b.hp+b.maxHp*.15);});this._record(offer.title,c.title+'：'+c.reward,true,offer.wave);
    }else if(a.kind==='gold'||a.kind==='power'){
      G[a.kind]+=a.amount;this._record(offer.title,c.title+'：'+c.reward,true,offer.wave);
    }else s.active={...a,wave:offer.wave,title:offer.title,description:c.description+' '+c.reward,startedWave:0,startStamp:null,elapsed:0,baseline:null};
    G.resDirty=true;if(typeof EventBus!=='undefined')EventBus.emit('watch:choice',{wave:offer.wave,id,title:offer.title});return true;
  },
  onWaveStart() {
    const s=this._state();if(!s||G.state!=='wave')return;
    if(G.wave%5===0)this._say('脚步比刚才沉。你盯住前摇，我替你看着门。','boss:'+G.wave);
    const a=s.active;if(!a)return;
    if(a.wave!==G.wave){if(a.wave<G.wave){this._record(a.title,'这次安排已经错过了对应波次。',false,a.wave);s.active=null;}return;}
    if(a.startStamp===G.runStamp&&a.startedWave===G.wave)return;
    a.startStamp=G.runStamp;a.startedWave=G.wave;a.elapsed=0;a.baseline={build:G.stats?.build||0};
    if(a.kind==='overload')G.buff.overclock=Math.max(G.buff.overclock||0,12);
    if(a.kind==='freeze'&&!a.freezeApplied){G.skills.freeze=Math.max(0,(G.skills.freeze||0)-8);a.freezeApplied=true;}
    if(a.kind==='seal')G.buff.noSummon=true;
    if(a.kind==='lure')for(let i=0;i<3;i++)G.spawnQueue.push({type:'grunt',lane:i});
    if(a.kind==='route'||a.kind==='spread'){
      const count=a.kind==='route'?8:12;
      for(let i=0;i<Math.min(count,G.spawnQueue.length);i++){const entry=G.spawnQueue[i];G.spawnQueue[i]={...(typeof entry==='string'?{type:entry}:entry),lane:a.kind==='route'?a.lane:i%3};}
    }
  },
  tick(dt) {
    const s=this._state();if(!s||G.state!=='wave'||G.over||typeof paused!=='undefined'&&paused)return;
    const seen=s.observed,leaks=G.stats?.leaks||0,interrupts=G.stats?.bossInterrupts||0,lowBed=G.bed?.hp<=G.bed?.maxHp*.3;
    if(leaks>seen.leaks)this._say('门被撞开了。先顾床边，这条路我会一直提醒你。','leak:'+G.wave);
    if(interrupts>seen.interrupts)this._say('就是这个空当！它的动作断了，趁现在。','interrupt:'+G.wave);
    if(lowBed&&!seen.lowBed)this._say('床边快守不住了，留一手抢修。灯还亮着。','bed:'+G.wave);
    s.observed={leaks,interrupts,lowBed};const a=s.active;if(!a)return;
    if(a.kind==='deposit'&&this._depositBroken(a))a.violated=true;
    if(Number.isFinite(dt)&&dt>0)a.elapsed+=Math.min(dt,.25);
  },
  onWaveEnd() {
    const s=this._state(),a=s?.active;if(!a||a.wave!==G.wave||a.startedWave!==G.wave)return;
    const pass=a.kind!=='deposit'||!this._depositBroken(a);
    const payment=pass?(a.reward||0)+(a.deposit||0):0;
    s.active=null; // Consume before dispatch/reward; nested calls cannot pay twice.
    if(payment>0)G.gold+=payment;
    const detail=pass?(a.kind==='deposit'?'你守住了原有布阵，押金与补给已交还。':a.kind==='lure'?'额外的脚步声停下了，物资已取回。':'这轮守夜安排已经完成。'):( '你选择了临场扩建，押金用于工具损耗；防线仍由你作主。');
    this._record(a.title,detail+(payment?' +'+payment+'金币':''),pass,a.wave);G.resDirty=true;
  },
  _depositBroken(active) { return active.violated===true||!!active.baseline&&(G.stats?.build||0)!==active.baseline.build; },
  serialize() {
    const s=this._state();if(!s)return null;const copy=JSON.parse(JSON.stringify(s));
    // A paused UI can build and immediately save without another simulation tick.
    if(copy.active?.kind==='deposit')copy.active.violated=this._depositBroken(s.active);
    return copy;
  },
  view() {
    const s=this._state();if(!s)return{available:false,title:'守夜安排',description:'进入梦境后再查看。',choices:[],active:null,result:null,history:[]};
    const offer=this._offer(),a=s.active;
    const active=a?{title:a.title,description:a.description,progress:a.kind==='deposit'?(this._depositBroken(a)?0:1):a.elapsed,target:a.kind==='deposit'?1:0,wave:a.wave}:null;
    return{available:!!offer,title:offer?.title||'守夜安排',description:offer?.description||'每隔几轮备战，同伴会送来一项可选安排。不接受也可照常守夜。',wave:G.wave,nextWave:offer?.wave||(G.resumeWave?G.wave:G.wave+1),choices:offer?offer.choices.map(({action,payment,...c})=>c):[],active,result:s.result,history:s.history.slice(),messages:s.messages.slice(),roomMessage:s.messages.at(-1)||null,hint:G.state==='wave'?'这一波正在守夜，先看好防线。':'先安排布阵，再决定是否接受同伴的提议。'};
  },
};
