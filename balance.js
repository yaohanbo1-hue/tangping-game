// All initial enemy health and shield values are finalized here, exactly once.
// Damage, status changes and Boss phase mechanics operate on the resulting values.
const EnemyBalance = {
  anchors: [[10,1],[20,1.18],[30,1.45],[40,1.85],[50,2.45],[60,3.15]],
  wave(value) { return Math.max(1, Math.min(9999, Number.isFinite(+value) ? +value : 1)); },
  legacyScale(value) {
    const w=this.wave(value);
    return 1 + w*0.18 + Math.pow(Math.max(0,w-10),1.4)*0.075 + Math.pow(Math.max(0,w-30),1.5)*0.04;
  },
  curve(value) {
    const w=this.wave(value), points=this.anchors;
    if (w<=10) return 1;
    if (w>=60) return 3.15 * (1 + (w-60)*0.024);
    const i=Math.min(4, Math.floor((w-10)/10)), a=points[i], b=points[i+1], t=(w-a[0])/10;
    const slope=k => k===0 ? 0 : k===5 ? 0.0756 : (points[k+1][1]-points[k-1][1])/20;
    const t2=t*t, t3=t2*t;
    return (2*t3-3*t2+1)*a[1] + (t3-2*t2+t)*10*slope(i) +
      (-2*t3+3*t2)*b[1] + (t3-t2)*10*slope(i+1);
  },
  health(def, wave, context={}) {
    const valid=n=>Number.isFinite(+n) && +n>0 ? +n : 1;
    const factors = { base: valid(def.hp), wave: this.legacyScale(wave), curve: this.curve(wave),
      difficulty: valid(context.difficulty), event: valid(context.event), trial: valid(context.trial),
      dream: valid(context.dream), elite: 1 };
    let shieldFraction=def.shieldself || 0;
    (context.affixes || []).forEach(key => {
      const a=AFFIX[key];
      if (!a) return;
      factors.elite *= valid(a.hp);
      shieldFraction=Math.max(shieldFraction,a.shield || 0);
    });
    const hp=Math.min(1e150,Object.values(factors).reduce((a,b)=>a*b,1));
    return { hp, shield: Math.min(1e150,hp*shieldFraction), factors };
  },
};
