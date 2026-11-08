// Presentation streams never read Math.random: sound, particles and UI must not
// change critical hits, drops, wave composition or neutral-creature outcomes.
const PresentationRandom = (() => {
  const streams = Object.create(null);
  const seeds = { particles: 0x9e3779b9, audio: 0x243f6a88, ui: 0xb7e15162 };
  function next(stream = 'particles') {
    let n = (streams[stream] == null ? seeds[stream] || 0xa341316c : streams[stream]) >>> 0;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    streams[stream] = n >>> 0;
    return (n >>> 0) / 4294967296;
  }
  return { next, range: (a,b,stream) => a + (b-a)*next(stream) };
})();

const Graphics = {
  level: 'medium',
  profiles: {
    low: { particles: 64, density: .22, texts: 24, impacts: 16, beams: 20, glow: 0, motion: false, weather: false },
    medium: { particles: 200, density: .55, texts: 40, impacts: 48, beams: 64, glow: .35, motion: true, weather: true },
    high: { particles: 600, density: 1, texts: 60, impacts: 96, beams: 160, glow: 1, motion: true, weather: true },
  },
  get profile() { return this.profiles[this.level]; },
  init() { this.set(Store.get('tangping_graphics', 'medium'), false); },
  set(level, persist = true) {
    this.level = Object.hasOwn(this.profiles, level) ? level : 'medium';
    if (persist) Store.set('tangping_graphics', this.level);
    if (typeof G !== 'undefined' && G) {
      if (G.parts.length > this.profile.particles) G.parts.splice(0, G.parts.length-this.profile.particles);
      if (G.texts.length > this.profile.texts) G.texts.splice(0, G.texts.length-this.profile.texts);
    }
    if (typeof syncAccessibilityUI === 'function') syncAccessibilityUI();
  },
  glow(value) { return value * this.profile.glow; },
};
