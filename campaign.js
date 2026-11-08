// Gameplay identity belongs to a run; playback belongs to this device.
// Presentation never owns combat events, wave progression or quest rewards.
const StoryKnowledge = {
  canReveal(wave) {
    if(!wave)return true;
    if((META.storySeen || []).includes(wave))return true;
    if(wave>=55 && (META.endingIds || []).some(id=>STORY_ENDINGS.some(ending=>ending.id===id)))return true;
    const event=G && G.storyState && G.storyState.events && G.storyState.events['wave:'+wave];
    return !!(G && G.experience!=='combat' && event && event.method==='legacy' && G.wave>=wave);
  },
  record(data) {
    if(!data || !G || !StoryFlow.allowed() || StoryFlow.key(data)!=='wave:'+data.wave || !WAVE_STORY.some(s=>s.wave===data.wave))return;
    if(!Array.isArray(META.storySeen))META.storySeen=[];
    if(!META.storySeen.includes(data.wave)){META.storySeen.push(data.wave);saveMeta();}
  },
};
const StoryFlow = {
  playback: true,
  init() { this.playback = Store.get('tangping_story_playback', 'on') !== 'off'; },
  allowed() { return !!G && G.experience !== 'combat' && this.playback; },
  blank() { return { events: {} }; },
  state() {
    if (!G.storyState || !G.storyState.events) G.storyState = this.blank();
    return G.storyState;
  },
  key(data) {
    if (data.storyId) return data.storyId;
    const main = WAVE_STORY.find(s => s === data || (s.wave === data.wave && s.text === data.text && s.speaker === data.speaker));
    if (main) return 'wave:' + main.wave;
    let hash = 2166136261;
    const text = [data.wave || G.wave, data.speaker || '', data.text || ''].join('|');
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return 'dialog:' + (hash >>> 0);
  },
  // One authored branch per node. Includes the NPC/deep-dream routes, never stacks choices.
  defaults: { 1: 1, 2: 1, 3: 1, 5: 1, 6: 1, 8: 1, 10: 0, 11: 0,
    14: 1, 15: 0, 16: 0, 19: 1, 20: 1, 21: 1, 23: 0, 25: 0,
    27: 1, 28: 0, 30: 0, 32: 0, 35: 0, 38: 0, 40: 0, 42: 0,
    48: 0, 50: 0, 52: 1, 55: 0, 60: 0 },
  begin(data) {
    if (!G || !data) return false;
    if (!this.allowed()) { this.skip(data); return false; }
    const key = this.key(data), events = this.state().events;
    if (events[key]) return false;
    events[key] = { wave: G.wave, status: data.choices && data.choices.length ? 'pending' : 'shown' };
    return true;
  },
  settle(data, choice, method) {
    if (!G || !data || !choice) return { got: [] };
    const key = this.key(data), events = this.state().events, old = events[key];
    if (old && (old.status === 'settled' || old.status === 'legacy')) return { got: [] };
    // Reserve before effects: rewards may synchronously emit more story events.
    events[key] = { wave: G.wave, status: 'settled', method };
    if(method==='manual')StoryKnowledge.record(data);
    const result = choice.effect ? applyStoryEffect(choice.effect, { speaker: data.speaker }) : { got: [] };
    if (method === 'manual' && G.experience !== 'combat') {
      const marks = [['__story_route__:', choice.storyRoute], ['__story_ending_reply__:', choice.endingReply]];
      marks.forEach(([prefix, value]) => {
        if (!value) return;
        G.fate.notes = G.fate.notes.filter(n => typeof n !== 'string' || !n.startsWith(prefix));
        G.fate.notes.push(prefix + value);
      });
    }
    statFrame++; // buffs invalidate the cached tower panel immediately
    return result;
  },
  skip(data) {
    if (!G || !data) return;
    const key = this.key(data), choices = data.choices || [];
    if (choices.some(c => (c.effect || '').startsWith('__mercy_'))) {
      this.cancelMercy(); // keep the enemy and continue combat, without a dialogue penalty
      return;
    }
    if (!choices.length) {
      if (!this.state().events[key]) this.state().events[key] = { wave: G.wave, status: 'skipped' };
      return;
    }
    this.settle(data, choices[this.defaults[data.wave] || 0] || choices[0], 'default');
  },
  cancelMercy() {
    if (typeof MercyPath === 'undefined') return;
    const active = MercyPath._activeDialogue;
    if (active && active.enemy) active.enemy.mercyOffered = true;
    MercyPath._activeDialogue = null;
    MercyPath._dialogueStep = 0;
  },
  onWave(wave) {
    if (this.allowed()) return;
    const data = WAVE_STORY.find(s => s.wave === wave);
    if (data) this.skip(data); // resolve before the first spawn, not in a presentation timer
  },
  endingEligible() {
    if (!G || G.experience === 'combat') return false;
    const e = this.state().events;
    return [55, 60].every(w => e['wave:' + w] && ['manual', 'legacy'].includes(e['wave:' + w].method));
  },
  restore(raw, wave) {
    const state = this.blank();
    if (raw && raw.events && typeof raw.events === 'object') {
      Object.keys(raw.events).slice(0, 1000).forEach(key => {
        const item = raw.events[key];
        if (!/^(wave:\d+|dialog:\d+)$/.test(key) || !item) return;
        if (!['pending', 'shown', 'skipped', 'settled', 'legacy'].includes(item.status)) return;
        state.events[key] = { wave: Math.max(0, Math.min(9999, +item.wave || 0)), status: item.status,
          method: ['default', 'manual', 'legacy'].includes(item.method) ? item.method : undefined };
      });
    } else {
      WAVE_STORY.filter(s => s.wave <= wave).forEach(s => {
        state.events['wave:' + s.wave] = { wave: s.wave, status: 'legacy', method: 'legacy' };
      });
    }
    G.storyState = state;
  },
  recoverPending() {
    // Timers/DOM are never serialized. Resolve an interrupted choice once at restore.
    const events = this.state().events;
    WAVE_STORY.forEach(data => { if (events['wave:' + data.wave] && events['wave:' + data.wave].status === 'pending') this.skip(data); });
  },
  setPlayback(on) {
    this.playback = !!on;
    Store.set('tangping_story_playback', on ? 'on' : 'off');
    if (!this.playback && typeof resetStoryPresentation === 'function') resetStoryPresentation(true);
    if (typeof syncStoryPlaybackUI === 'function') syncStoryPlaybackUI();
  },
};
StoryFlow.init();
