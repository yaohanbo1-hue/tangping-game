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

const REMOTE_CMD_TOKEN = Symbol('remote-command');
const AUTHORIZED_REMOTE_PEERS = new Set();
const REMOTE_PEER_SEQUENCES = new Map();

/** 联机接缝。远端命令在主机登记为已认证的 peer 之后才可进入执行层。 */
const Net = {
  enabled: false,        // 单机 = false
  isHost: true,          // 房主负责跑模拟
  /** 仅由完成握手的可信传输层调用，不能直接映射远端 payload。 */
  authorizePeer(peerId) {
    if (!this.enabled || !this.isHost || typeof peerId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(peerId)) return false;
    AUTHORIZED_REMOTE_PEERS.add(peerId);
    REMOTE_PEER_SEQUENCES.set(peerId, 0);
    return true;
  },
  revokePeer(peerId) {
    REMOTE_PEER_SEQUENCES.delete(peerId);
    return AUTHORIZED_REMOTE_PEERS.delete(peerId);
  },
  isAuthorizedPeer(peerId) {
    return this.enabled && this.isHost && typeof peerId === 'string' && AUTHORIZED_REMOTE_PEERS.has(peerId);
  },
  /** 客机 → 主机发送一条命令（阶段B 接入 DataChannel） */
  send(cmd) {
    // TODO(联机阶段B): this.channel.send(JSON.stringify(cmd))
    console.warn('[Net] 尚未接入传输层，命令被丢弃:', cmd && cmd.t);
    return false;
  },
  /** 主机只接受已认证 peer 的远端命令；当前没有传输层，默认拒绝。 */
  onRemote(cmd, peerId) {
    if (!this.isAuthorizedPeer(peerId)) return false;
    if (!cmd || !Number.isSafeInteger(cmd.seq) || cmd.seq <= (REMOTE_PEER_SEQUENCES.get(peerId) || 0)) return false;
    const clean = Cmd._normalize(cmd);
    if (!clean) return false;
    REMOTE_PEER_SEQUENCES.set(peerId, cmd.seq);
    return Cmd.exec(clean, REMOTE_CMD_TOKEN, peerId);
  },
};

const Cmd = {
  _seq: 0,
  /** 是否记录命令日志（复现 bug / 将来的回放用） */
  recording: true,
  log: [],

  /* ---------------- 派发 ---------------- */

  /** 玩家意图入口。单机立即执行；将来客机只发送。 */
  dispatch(cmd) {
    const clean = this._normalize(cmd);
    if (!clean) return false;
    const logged = Object.assign({ seq: ++this._seq }, clean);
    if (this.recording) {
      this.log.push(logged);
      if (this.log.length > 4000) this.log.shift();
    }
    if (Net.enabled && !Net.isHost) return Net.send(logged);
    return this.exec(clean);
  },

  /** 只接受当前命令协议中的字段和值，避免远端 JSON 被宽松强转。 */
  _normalize(cmd) {
    if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd) || !Object.prototype.hasOwnProperty.call(cmd, 't')) return null;
    if (cmd.seq !== undefined && (!Number.isSafeInteger(cmd.seq) || cmd.seq < 1)) return null;
    const shape = (...fields) => {
      const allowed = new Set(['t', 'seq', ...fields]);
      const keys = Object.keys(cmd);
      return keys.every(k => allowed.has(k)) && keys.filter(k => k !== 'seq').length === fields.length + 1 && fields.every(k => Object.prototype.hasOwnProperty.call(cmd, k));
    };
    const coords = () => Number.isInteger(cmd.c) && cmd.c >= 0 && cmd.c < COLS && Number.isInteger(cmd.r) && cmd.r >= 0 && cmd.r < ROWS;
    const runeId = v => typeof v === 'string' && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9_-]+$/.test(v);

    switch (cmd.t) {
      case 'build':
        return shape('k', 'c', 'r') && typeof cmd.k === 'string' && Object.prototype.hasOwnProperty.call(BUILD_DEFS, cmd.k) && coords()
          ? { t: 'build', k: cmd.k, c: cmd.c, r: cmd.r } : null;
      case 'upgrade':
        if (cmd.what === 'bed' && shape('what')) return { t: 'upgrade', what: 'bed' };
        if (cmd.what === 'door' && shape('what', 'lane') && Number.isInteger(cmd.lane) && cmd.lane >= 0 && cmd.lane < LANES.length) return { t: 'upgrade', what: 'door', lane: cmd.lane };
        if (cmd.what === undefined && shape('c', 'r') && coords()) return { t: 'upgrade', c: cmd.c, r: cmd.r };
        return null;
      case 'branch':
        return shape('c', 'r', 'which') && coords() && (cmd.which === 'a' || cmd.which === 'b')
          ? { t: 'branch', c: cmd.c, r: cmd.r, which: cmd.which } : null;
      case 'sell':
        return shape('c', 'r') && coords() ? { t: 'sell', c: cmd.c, r: cmd.r } : null;
      case 'skill':
        return shape('k') && typeof cmd.k === 'string' && Object.prototype.hasOwnProperty.call(SKILL_DEFS, cmd.k)
          ? { t: 'skill', k: cmd.k } : null;
      case 'skip':
        return shape() ? { t: 'skip' } : null;
      case 'upAll':
        return shape('towersOnly') && typeof cmd.towersOnly === 'boolean' ? { t: 'upAll', towersOnly: cmd.towersOnly } : null;
      case 'maxAll':
        return shape() ? { t: 'maxAll' } : null;
      case 'maxSel':
        if (cmd.what === 'bed' && shape('what')) return { t: 'maxSel', what: 'bed' };
        if (cmd.what === 'door' && shape('what', 'lane') && Number.isInteger(cmd.lane) && cmd.lane >= 0 && cmd.lane < LANES.length) return { t: 'maxSel', what: 'door', lane: cmd.lane };
        if (cmd.what === undefined && shape('c', 'r') && coords()) return { t: 'maxSel', c: cmd.c, r: cmd.r };
        return null;
      case 'rune': {
        if (!Number.isInteger(cmd.c) || !Number.isInteger(cmd.r) || !coords()) return null;
        if (cmd.op === 'socket') {
          const fields = Object.prototype.hasOwnProperty.call(cmd, 'slot') ? ['op', 'c', 'r', 'runeId', 'slot'] : ['op', 'c', 'r', 'runeId'];
          const slot = cmd.slot == null ? null : cmd.slot;
          return shape(...fields) && runeId(cmd.runeId) && (slot === null || (Number.isInteger(slot) && slot >= 0 && slot < 16))
            ? { t: 'rune', op: 'socket', c: cmd.c, r: cmd.r, runeId: cmd.runeId, slot } : null;
        }
        if ((cmd.op === 'unsocket' || cmd.op === 'upgrade') && shape('op', 'c', 'r', 'slot') && Number.isInteger(cmd.slot) && cmd.slot >= 0 && cmd.slot < 16)
          return { t: 'rune', op: cmd.op, c: cmd.c, r: cmd.r, slot: cmd.slot };
        return null;
      }
      case 'runeSalvage':
        return shape('runeId') && runeId(cmd.runeId) ? { t: 'runeSalvage', runeId: cmd.runeId } : null;
      case 'draw':
        return shape('n', 'cur') && (cmd.n === 1 || cmd.n === 10) && (cmd.cur === 'gold' || cmd.cur === 'soul')
          ? { t: 'draw', n: cmd.n, cur: cmd.cur } : null;
      case 'jump':
        return shape('wave') && Number.isInteger(cmd.wave) && cmd.wave >= 1 && cmd.wave <= 999 ? { t: 'jump', wave: cmd.wave } : null;
      default: return null;
    }
  },

  /** 真正改状态的地方（主机执行 / 单机执行） */
  exec(cmd, remoteToken, peerId) {
    const fromRemote = remoteToken === REMOTE_CMD_TOKEN;
    if (fromRemote ? !Net.isAuthorizedPeer(peerId) : (remoteToken !== undefined || (Net.enabled && !Net.isHost))) return false;
    cmd = this._normalize(cmd);
    if (!cmd || typeof G === 'undefined' || !G || G.over || (fromRemote && cmd.t === 'jump')) return false;
    switch (cmd.t) {
      case 'build': {
        return !!tryBuild(cmd.k, cmd.c, cmd.r);
      }
      case 'upgrade': {
        if (cmd.what === 'bed') { upgradeBed(); return true; }
        if (cmd.what === 'door') { const d = G.doors[cmd.lane]; if (d) upgradeDoor(d); return !!d; }
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
        if (!Object.prototype.hasOwnProperty.call(SKILL_DEFS, cmd.k)) return false;
        useSkill(cmd.k); return true;
      }
      case 'skip': { skipPrep(); return true; }
      case 'upAll': { upgradeAllBuildings(!!cmd.towersOnly); return true; }
      case 'maxAll': { upgradeAllMax(); return true; }
      case 'maxSel': {
        if (cmd.what === 'bed') { upgradeMaxSelected({ isBed: true }); return true; }
        if (cmd.what === 'door') { const d = G.doors[cmd.lane]; if (d) upgradeMaxSelected({ isDoor: true, door: d }); return !!d; }
        const b = this._at(cmd.c, cmd.r); if (!b) return false;
        upgradeMaxSelected(b); return true;
      }
      case 'rune': {
        const b = this._at(cmd.c, cmd.r); if (!b) return false;
        if (cmd.op === 'socket') return !!socketRune(b, cmd.runeId, cmd.slot);
        if (cmd.op === 'unsocket') return !!unsocketRune(b, cmd.slot);
        if (cmd.op === 'upgrade') return !!upgradeRuneIn(b, cmd.slot);
        return false;
      }
      case 'runeSalvage': { return !!salvageRune(cmd.runeId); }
      case 'draw': { this.lastDraw = drawLottery(cmd.n, cmd.cur); return !!this.lastDraw; }
      case 'jump': { return !fromRemote && !!jumpToWave(cmd.wave); }
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
