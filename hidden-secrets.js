/* Optional dorm discoveries: cosmetic collections, separate from story rewards. */
const HiddenSecrets = {
  key: 'tangping_hidden_secrets',
  _found: new Set(), _state: null, _owner: null, _generation: -1,
  _revision: 0, _message: '宿舍角落也有自己的声音。选一件东西，慢慢看看。',
  definitions: [
    {id:'rain_letter',name:'写在雨里的便条',hint:'窗上没有字。也许借一点暖光，再回头看看。',text:'你看向窗，又护住灯，再望回玻璃。两滴雨水绕过灯的倒影，像给一句没说出口的“晚安”加了引号。'},
    {id:'borrowed_second',name:'借来的滴答',hint:'钟安静了。和另一件还在动的东西对照看看。',text:'你对照了钟和窗外的雨。钟面没有改变，雨却一滴一滴往下走。原来今晚的时间，也可以这样数。'},
    {id:'paper_cat',name:'纸猫留的位置',hint:'纸猫不喜欢被一直盯着。忙完一轮守夜，再回来看看。',text:'你回来时，纸猫旁多了一小块折好的空纸。没有名字，也没有要求。像是谁认真给你留了一个位置。'},
    {id:'mended_light',name:'补好的一点暖光',hint:'有些灯影，只有在最暗的时候见过，才认得出回来时的样子。',text:'你记得床铺快撑不住时，灯影晃得很厉害。现在床沿补好了，灯下那道细细的裂纹还在——它像一条缝过的金线。'},
    {id:'door_chalk',name:'门边的一道粉笔线',hint:'等走廊里最大的一阵脚步过去，看看还守在原处的门。',text:'首领退去，三扇门仍在。你在门框下发现一道很短的粉笔线，旁边写着：“这一轮，大家都在。”'},
    {id:'window_chorus',name:'玻璃里的小合唱',hint:'窗里映着什么，取决于你让哪些颜色亮起来。',text:'暖光、冷光和跳动的电弧一起映进玻璃。窗上的雨点像捧着一排很小的灯。你没按任何节拍，它们却像在合唱。'},
  ],
  init(saved) {
    this._owner = typeof G !== 'undefined' ? G : null;
    const data = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    let stored = [];
    try { stored = JSON.parse(typeof Store !== 'undefined' ? Store.get(this.key,'[]') : '[]'); } catch (_) {}
    const legal = new Set(this.definitions.map(d=>d.id));
    // Keep in-memory discoveries if this browser cannot persist storage.
    this._found = new Set([...this._found, ...(Array.isArray(stored) ? stored.slice(0,64) : []),
      ...(Array.isArray(data.found) ? data.found.slice(0,64) : [])].filter(id=>legal.has(id)));
    if(typeof Store!=='undefined')Store.set(this.key,JSON.stringify([...this._found]));
    const wave = this._wave();
    const integer = value => Number.isInteger(value) && value >= 0 && value <= wave ? value : 0;
    this._state = {completedWave:integer(data.completedWave),catVisitWave:null,bedWasLow:data.bedWasLow===true,
      windowSeen:false,sequence:[]};
    if(Number.isInteger(data.catVisitWave) && data.catVisitWave>=0 && data.catVisitWave<=wave) this._state.catVisitWave=data.catVisitWave;
    // A half-finished observation sequence is deliberately not replayed by loading.
    this._message='宿舍角落也有自己的声音。选一件东西，慢慢看看。';
    this._revision++;
    if(typeof EventBus !== 'undefined' && this._generation!==EventBus.generation) {
      this._generation=EventBus.generation;
      EventBus.on('dream:waveEnd', waveNum=>{
        if(!this._ready() || !Number.isInteger(waveNum) || waveNum<1 || waveNum>this._wave())return;
        this._state.completedWave=Math.max(this._state.completedWave,waveNum);
        this._state.sequence=[];
        this._revision++;
      });
    }
  },
  _wave() { return typeof G!=='undefined' && Number.isFinite(G?.wave) ? Math.max(0,Math.floor(G.wave)) : 0; },
  _ready() { return !!this._state && typeof G!=='undefined' && G===this._owner && !G.over; },
  tick(dt) {
    if(!this._ready() || !Number.isFinite(dt) || dt<=0 || (typeof paused!=='undefined' && paused) ||
      (typeof document!=='undefined' && document.hidden))return;
    const bed=G.bed;
    if(bed && bed.hp>0 && bed.maxHp>0 && bed.hp/bed.maxHp<=.5 && !this._state.bedWasLow) {
      this._state.bedWasLow=true;this._revision++;
    }
  },
  _discover(id, discovered) {
    if(this._found.has(id))return;
    this._found.add(id);discovered.push(id);
    if(typeof Store!=='undefined')Store.set(this.key,JSON.stringify([...this._found]));
    if(typeof EventBus!=='undefined')EventBus.emit('secrets:discovered',{id,name:this.definitions.find(d=>d.id===id).name});
  },
  interact(key) {
    if(!this._ready())return {ok:false,message:'先开始一局守夜，再看看宿舍。',discovered:[]};
    const descriptions={
      window:'玻璃上有三道水痕，灯的倒影恰好落在中间。',
      lamp:'你护住灯罩。暖黄的光铺在床沿，没有催你做任何事。',
      clock:'钟面停在03:07。窗沿滴落一滴水，像是替它数了一秒。',
      cat:'桌上是一只折纸猫。它的耳朵朝着门，不知在等谁回来。',
      door:'你摸了摸门框。旧划痕旁有一小截没用完的粉笔。',
    };
    if(!Object.prototype.hasOwnProperty.call(descriptions,key))return {ok:false,message:'这里没有可以查看的东西。',discovered:[]};
    const discovered=[],s=this._state;
    s.sequence.push(key);s.sequence=s.sequence.slice(-3);
    const sequence=s.sequence.join('>');
    if(sequence==='window>lamp>window')this._discover('rain_letter',discovered);
    if(sequence==='clock>window>clock')this._discover('borrowed_second',discovered);
    if(key==='window') {
      s.windowSeen=true;
      const colors=new Set((G.buildings||[]).filter(b=>b.hp>0).map(b=>typeof BUILD_DEFS!=='undefined'?BUILD_DEFS[b.type]?.dmgType:null).filter(Boolean));
      if(colors.size>=3)this._discover('window_chorus',discovered);
    }
    if(key==='cat') {
      if(s.catVisitWave!==null && s.completedWave>s.catVisitWave)this._discover('paper_cat',discovered);
      else if(s.catVisitWave===null)s.catVisitWave=this._wave();
    }
    if(key==='lamp' && s.bedWasLow && G.bed?.maxHp>0 && G.bed.hp/G.bed.maxHp>=.8)this._discover('mended_light',discovered);
    if(key==='door' && G.state==='build' && (G.stats?.bossKills||0)>0 && G.doors?.length===3 && G.doors.every(d=>!d.broken && d.hp>0))this._discover('door_chalk',discovered);
    this._message=discovered.length ? discovered.map(id=>{const d=this.definitions.find(d=>d.id===id);return '发现「'+d.name+'」：'+d.text;}).join('\n') : descriptions[key];
    this._revision++;
    return {ok:true,message:this._message,discovered};
  },
  view() {
    const props=[
      {key:'window',name:'雨窗',description:'窗沿挂着细细的水痕，玻璃映着房里的灯。',hint:'隔着玻璃，外面还在下雨。'},
      {key:'lamp',name:'床头灯',description:this._state?.bedWasLow?'灯罩的裂纹里透着暖光。':'灯罩下有一圈暖黄色的光晕。',hint:'靠近一点，看看灯照到哪里。'},
      {key:'clock',name:'停下的钟',description:'03:07。钟面下面积着一小道灰。',hint:'安静不代表什么也没发生。'},
      {key:'cat',name:'折纸猫',description:'纸猫的耳朵朝着门，尾巴压着一角空纸。',hint:'它看起来很有耐心。'},
      {key:'door',name:'门边刻痕',description:'木纹里夹着一小截白色粉笔印。',hint:'等脚步远一点，再看看这里。'},
    ];
    const discoveries=this.definitions.map(d=>({id:d.id,name:this._found.has(d.id)?d.name:'尚未记录',discovered:this._found.has(d.id),hint:d.hint,text:this._found.has(d.id)?d.text:''}));
    return {props,discoveries,message:this._message,found:this._found.size,total:this.definitions.length,revision:this._revision};
  },
  serialize() {
    if(!this._state)return null;
    return {version:1,found:[...this._found],completedWave:this._state.completedWave,catVisitWave:this._state.catVisitWave,bedWasLow:this._state.bedWasLow};
  },
};
