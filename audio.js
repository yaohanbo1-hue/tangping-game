// Procedural Web Audio mixer. No downloaded samples and no combat RNG use.
const SFX = {
  ctx: null, on: true, unsupported: false, volume: .72, masterVolume: 1, uiVolume: .65, ambienceVolume: .45,
  voices: new Set(), buffers: new Map(), gates: new Map(), graph: null, background: false,
  limits: { total: 24, combat: 16, ui: 6, ambience: 1 },
  counts: { played: 0, dropped: 0, peak: 0 },
  // Squared amplitude gives an even perceived progression; zero is exact silence.
  gain(value) { const n = Math.max(0, Math.min(1, Number(value) || 0)); return n*n; },
  init() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.unsupported=false; } catch (e) { this.unsupported=true;return; } }
    this._graph();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },
  _graph() {
    if (!this.ctx || this.graph && this.graph.ctx === this.ctx) return this.graph;
    if (this.graph) {
      this.stopAll();
      for(const node of [this.graph.master,this.graph.limiter,...Object.values(this.graph.buses)]){try{node.disconnect();}catch(e){}}
    }
    const ctx = this.ctx, master = ctx.createGain(), limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 8;
    limiter.attack.value = .003; limiter.release.value = .12;
    master.connect(limiter); limiter.connect(ctx.destination);
    const buses = {};
    for (const bus of ['combat','ui','ambience']) { buses[bus]=ctx.createGain();buses[bus].connect(master); }
    this.graph = { ctx, master, limiter, buses };this.buffers.clear();this.gates.clear();this.sync();
    return this.graph;
  },
  sync() {
    const graph=this.graph;if(!graph || graph.ctx!==this.ctx)return;
    const now=this.ctx.currentTime;
    graph.master.gain.setValueAtTime(this.background ? 0 : .72*this.gain(this.masterVolume),now);
    for(const [bus,value]of [['combat',this.volume],['ui',this.uiVolume],['ambience',this.ambienceVolume]])
      graph.buses[bus].gain.setValueAtTime(this.on ? this.gain(value) : 0,now);
  },
  setEnabled(on) { this.on=!!on;this.sync();if(!this.on)this.stopAll(); },
  setVolume(bus,value) {
    const key={master:'masterVolume',combat:'volume',ui:'uiVolume',ambience:'ambienceVolume'}[bus];
    if(!key)return;this[key]=Math.max(0,Math.min(1,Number(value)||0));this.sync();
    if(this[key]===0 && bus!=='master')this.stopBus(bus);
  },
  _dispose(voice,stop=false) {
    if(!this.voices.delete(voice))return;
    if(stop){try{voice.source.stop();}catch(e){}}
    for(const node of voice.nodes){try{node.disconnect();}catch(e){}}
  },
  _reserve(bus,duration,delay=0) {
    if(!this.on || !this.ctx || this.background || this.masterVolume<=0)return null;
    const value=bus==='ui'?this.uiVolume:bus==='ambience'?this.ambienceVolume:this.volume;
    if(value<=0)return null;
    const graph=this._graph(),now=this.ctx.currentTime;
    for(const voice of this.voices)if(voice.end<=now)this._dispose(voice,true);
    if([...this.voices].filter(v=>v.bus===bus).length>=this.limits[bus]){this.counts.dropped++;return null;}
    if(this.voices.size>=this.limits.total){
      const expendable=bus==='ui' && [...this.voices].find(v=>v.bus==='combat');
      if(expendable)this._dispose(expendable,true);else{this.counts.dropped++;return null;}
    }
    return {bus,start:now+delay,end:now+delay+duration+.025,output:graph.buses[bus]};
  },
  _track(reservation,source,nodes) {
    const voice={...reservation,source,nodes};this.voices.add(voice);
    this.counts.played++;this.counts.peak=Math.max(this.counts.peak,this.voices.size);
    source.onended=()=>this._dispose(voice);
    source.start(voice.start);if(Number.isFinite(voice.end))source.stop(voice.end);
    return voice;
  },
  gate(key,seconds) {
    if(!this.ctx || !this.on || this.background)return false;
    this._graph();
    const now=this.ctx.currentTime,last=this.gates.get(key);
    if(last!=null && now-last<seconds)return false;
    if(this.gates.size>=64 && !this.gates.has(key))this.gates.delete(this.gates.keys().next().value);
    this.gates.set(key,now);return true;
  },
  tone(freq,dur,type='sine',vol=.14,slide=0,bus='combat',delay=0) {
    const slot=this._reserve(bus,dur,delay);if(!slot)return false;
    const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain(),t=slot.start;
    o.type=type;o.frequency.setValueAtTime(Math.max(30,freq),t);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+dur);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.003);
    g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(.004,dur));
    o.connect(g);g.connect(slot.output);this._track(slot,o,[o,g]);return true;
  },
  noise(dur,vol=.2,filt=900,bus='combat',delay=0) {
    const slot=this._reserve(bus,dur,delay);if(!slot)return false;
    const ctx=this.ctx,key=String(ctx.sampleRate);
    let buffer=this.buffers.get(key);
    if(!buffer){
      buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.6),ctx.sampleRate);
      const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=PresentationRandom.next('audio')*2-1;
      this.buffers.set(key,buffer);
    }
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain(),t=slot.start;
    source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=filt;
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.004);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    source.connect(filter);filter.connect(g);g.connect(slot.output);this._track(slot,source,[source,filter,g]);return true;
  },
  weapons: {
    turret: [680,.055,'square',.055,-430], frost: [1550,.14,'sine',.1,-500],
    laser: [1050,.11,'sawtooth',.055,-760], tesla: [240,.1,'sawtooth',.07,740],
    flame: [130,.21,'triangle',.06,70], poison: [410,.16,'sine',.09,280],
    sonic: [190,.2,'sine',.13,170], missile: [100,.19,'triangle',.13,-60],
    gravity: [65,.28,'sine',.13,70], prism: [1760,.1,'triangle',.08,-240],
    generator: [360,.13,'square',.045,500],
  },
  weapon(type) {
    const spec=this.weapons[type];if(!spec || !this.gate('weapon:'+type,['flame','gravity'].includes(type)?.24:.045))return;
    const [freq,dur,wave,volume,slide]=spec,variation=PresentationRandom.range(.97,1.03,'audio');
    this.tone(freq*variation,dur,wave,volume,slide);
    if(type==='missile' || type==='flame')this.noise(dur,type==='missile'?.13:.065,type==='missile'?620:1400);
    if(type==='prism')this.tone(freq*1.5,dur*.65,'sine',volume*.55,-180,'combat',.025);
  },
  impact(type) { if(this.gate('impact',.09))this.tone(type==='frost'?1100:180,.04,'triangle',.025,-80); },
  alert(kind) {
    const notes={lord:[220,165],abyss:[110,65],machine:[880,660],void:[587,1174],final:[262,196]}[kind];
    if(!notes || !this.gate('alert:'+kind,.3))return;
    notes.forEach((frequency,i)=>this.tone(frequency,.16,'triangle',.15,0,'ui',i*.13));
  },
  shoot(){this.weapon('turret');},laser(){this.weapon('laser');},zap(){this.weapon('tesla');},hit(){this.impact('kinetic');},
  boom(){if(this.gate('boom',.12)){this.noise(.32,.22,650);this.tone(90,.28,'sine',.18,-55);}},
  _chime(key,notes,spacing=.08,duration=.13) {
    if(!this.gate('ui:'+key,.06))return;
    notes.forEach((frequency,i)=>this.tone(frequency,duration,'triangle',.13,0,'ui',i*spacing));
  },
  build(){this._chime('build',[430,650]);},up(){this._chime('up',[520,780]);},coin(){this._chime('coin',[900],0,.06);},
  err(){if(this.gate('ui:err',.12))this.tone(160,.14,'triangle',.13,-60,'ui');},
  wave(){this._chime('wave',[300,420],.14,.22);},lose(){this._chime('lose',[260,180],.26,.6);},
  win(){this._chime('win',[523,659,784,1046],.11,.22);},achieve(){this._chime('achieve',[660,880,1180],.09,.18);},
  skill(){if(this.gate('ui:skill',.1)){this.tone(700,.2,'sine',.14,700,'ui');this.noise(.25,.13,1600,'ui');}},
  ambient(depth) {
    if(this._ambientDepth===depth && [...this.voices].some(v=>v.bus==='ambience'))return;
    this.stopBus('ambience');this._ambientDepth=depth;if(!depth)return;
    const slot=this._reserve('ambience',Infinity);if(!slot)return;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';
    o.frequency.value=Math.max(25,60-depth*10);g.gain.value=.03+depth*.015;o.connect(g);g.connect(slot.output);
    this._track(slot,o,[o,g]);
  },
  stopBus(bus){for(const voice of this.voices)if(voice.bus===bus)this._dispose(voice,true);},
  stopAll(){for(const voice of this.voices)this._dispose(voice,true);},
  setBackground(hidden){this.background=!!hidden;this.sync();if(hidden)this.stopAll();},
  stats(){return {...this.counts,active:this.voices.size,buffers:this.buffers.size,buses:Object.fromEntries(['combat','ui','ambience'].map(bus=>[bus,[...this.voices].filter(v=>v.bus===bus).length]))};},
};
