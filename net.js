// ============================================================
//  躺平发育：梦魇防线  —  命令层 + 联机接缝
// ============================================================
//  为什么要这一层：
//    单机时"点一下按钮"直接改 GameState（G）没问题；但要联机，就必须把
//    「玩家的意图」和「状态的改变」拆开 —— 客机只能发意图，主机负责执行与校验。
//    这一层现在就把这件事做完，且不改变单机行为（dispatch 会立即 exec）。
//
//  顺带的好处：
//    · 所有会改 G 的玩家操作只有一个入口，方便加日志 / 限制 / 反作弊
//    · 命令是纯数据（坐标 + 类型），可以直接序列化发给别人
//    · 命令日志可用于复现 bug（配合 main.js 的固定时间步长）
//
//  命令全部使用「可序列化引用」：建筑用格子坐标 (c,r)，门用 lane，绝不传对象引用。
// ============================================================

/** 联机接缝。现在不启用，接上 WebRTC/WebSocket 时只需要实现 send / onRemote */
const Net = {
  enabled: false,        // 单机 = false
  isHost: true,          // 房主负责跑模拟
  /** 客机 → 主机发送一条命令（阶段B 接入 DataChannel） */
  send(cmd) {
    // TODO(联机阶段B): this.channel.send(JSON.stringify(cmd))
    console.warn('[Net] 尚未接入传输层，命令被丢弃:', cmd.t);
  },
  /** 主机收到远端命令 → 走同一条 exec 路径 */
  onRemote(cmd) { Cmd.exec(cmd); },
};

const Cmd = {
  _seq: 0,
  /** 是否记录命令日志（复现 bug / 将来的回放用） */
  recording: true,
  log: [],

  /* ---------------- 派发 ---------------- */

  /** 玩家意图入口。单机立即执行；将来客机只发送。 */
  dispatch(cmd) {
    if (!cmd) return false;
    cmd.seq = ++this._seq;
    if (this.recording) {
      this.log.push(cmd);
      if (this.log.length > 4000) this.log.shift();
    }
    if (Net.enabled && !Net.isHost) { Net.send(cmd); return true; }
    return this.exec(cmd);
  },

  /** 真正改状态的地方（主机执行 / 单机执行） */
  exec(cmd) {
    if (typeof G === 'undefined' || !G || G.over) return false;
    switch (cmd.t) {
      case 'build': {
        if (typeof cmd.k !== 'string') return false;
        return !!tryBuild(cmd.k, cmd.c | 0, cmd.r | 0);
      }
      case 'upgrade': {
        if (cmd.what === 'bed') { upgradeBed(); return true; }
        if (cmd.what === 'door') { const d = G.doors[cmd.lane | 0]; if (d) upgradeDoor(d); return true; }
        const b = this._at(cmd.c, cmd.r); if (!b) return false;
        tryUpgrade(b); return true;
      }
      case 'branch': {
        const b = this._at(cmd.c, cmd.r); if (!b) return false;
        return !!tryBranch(b, cmd.which === 'b' ? 'b' : 'a');
      }
      case 'sell': {
        const b = this._at(cmd.c, cmd.r); if (!b) return false;
        sellBuilding(b); return true;
      }
      case 'skill': {
        if (typeof cmd.k !== 'string') return false;
        useSkill(cmd.k); return true;
      }
      case 'skip': { skipPrep(); return true; }
      case 'upAll': { upgradeAllBuildings(!!cmd.towersOnly); return true; }
      case 'maxAll': { upgradeAllMax(); return true; }
      case 'maxSel': {
        if (cmd.what === 'bed') { upgradeMaxSelected({ isBed: true }); return true; }
        if (cmd.what === 'door') { const d = G.doors[cmd.lane | 0]; if (d) upgradeMaxSelected({ isDoor: true, door: d }); return true; }
        const b = this._at(cmd.c, cmd.r); if (!b) return false;
        upgradeMaxSelected(b); return true;
      }
      case 'rune': {
        const b = this._at(cmd.c, cmd.r); if (!b) return false;
        if (cmd.op === 'socket') return !!socketRune(b, cmd.runeId, cmd.slot == null ? null : (cmd.slot | 0));
        if (cmd.op === 'unsocket') return !!unsocketRune(b, cmd.slot | 0);
        if (cmd.op === 'upgrade') return !!upgradeRuneIn(b, cmd.slot | 0);
        return false;
      }
      case 'runeSalvage': { return !!salvageRune(cmd.runeId); }
      case 'draw': { this.lastDraw = drawLottery(cmd.n | 0 || 1, cmd.cur === 'soul' ? 'soul' : 'gold'); return true; }
      case 'jump': { return !!jumpToWave(cmd.wave | 0); }
      default: console.warn('[Cmd] 未知命令:', cmd.t); return false;
    }
  },

  _at(c, r) {
    c = c | 0; r = r | 0;
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    const b = G.grid[r * COLS + c];
    return (b && b !== 'bed') ? b : null;
  },

  /* ---------------- 给 UI 用的语义化包装（避免 UI 里到处拼命令对象） ---------------- */

  build(k, c, r) { return this.dispatch({ t: 'build', k, c, r }); },

  /** 升级「当前选中的东西」——把 UI 的 selected 对象翻译成可序列化命令 */
  upgradeSelection(sel) {
    if (!sel) return false;
    if (sel.isBed) return this.dispatch({ t: 'upgrade', what: 'bed' });
    if (sel.isDoor) return this.dispatch({ t: 'upgrade', what: 'door', lane: sel.door.lane });
    if (sel.def) return this.dispatch({ t: 'upgrade', c: sel.col, r: sel.row });
    return false;
  },
  maxSelection(sel) {
    if (!sel) return false;
    if (sel.isBed) return this.dispatch({ t: 'maxSel', what: 'bed' });
    if (sel.isDoor) return this.dispatch({ t: 'maxSel', what: 'door', lane: sel.door.lane });
    if (sel.def) return this.dispatch({ t: 'maxSel', c: sel.col, r: sel.row });
    return false;
  },
  sellSelection(sel) {
    if (!sel || !sel.def) return false;
    return this.dispatch({ t: 'sell', c: sel.col, r: sel.row });
  },
  branchSelection(sel, which) {
    if (!sel || !sel.def) return false;
    return this.dispatch({ t: 'branch', c: sel.col, r: sel.row, which });
  },
  skill(k) { return this.dispatch({ t: 'skill', k }); },
  skipPrep() { return this.dispatch({ t: 'skip' }); },
  upgradeAll(towersOnly) { return this.dispatch({ t: 'upAll', towersOnly: !!towersOnly }); },
  upgradeAllMax() { return this.dispatch({ t: 'maxAll' }); },
  socket(b, runeId, slot) { return b ? this.dispatch({ t: 'rune', op: 'socket', c: b.col, r: b.row, runeId, slot }) : false; },
  unsocket(b, slot) { return b ? this.dispatch({ t: 'rune', op: 'unsocket', c: b.col, r: b.row, slot }) : false; },
  upgradeRuneIn(b, slot) { return b ? this.dispatch({ t: 'rune', op: 'upgrade', c: b.col, r: b.row, slot }) : false; },
  salvage(runeId) { return this.dispatch({ t: 'runeSalvage', runeId }); },
  draw(n, cur) { this.dispatch({ t: 'draw', n, cur }); return this.lastDraw; },   // 单机立即拿到结果；联机时结果随状态同步回来
  jump(wave) { return this.dispatch({ t: 'jump', wave }); },

  /** 命令日志导出（复现 bug 时贴给人看） */
  dumpLog() { return JSON.stringify(this.log); },
  clearLog() { this.log.length = 0; },
};
