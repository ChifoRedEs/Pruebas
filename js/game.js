// Reglas del juego. No toca el DOM: se comunica con la interfaz mediante `hooks`.
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const r6 = () => 1 + Math.floor(Math.random() * 6);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const RULES = { pot: true, auction: true, cash: 1500 };

class Player {
  constructor(c, cash) { Object.assign(this, { money: cash, pos: 0, jail: 0, inJail: false, cards: 0, out: false, bot: false }, c); }
}

// Inteligencia sencilla para los bots
class AI {
  constructor(g) { this.g = g; }
  done(s, p) { const g = this.g; return s.type === "property" && g.grp(s).every(x => x === s || x.owner === g.idx(p)); }
  buy(s, p) { return p.money - s.price >= (this.done(s, p) ? 0 : 150); }
  bid(s, p, cur) { const max = Math.min(s.price * (this.done(s, p) ? 1.5 : .9), p.money - 100); return cur + 10 <= max ? cur + 10 : 0; }
  choose(p, o) {
    if (o.includes("Usar carta")) return "Usar carta";
    if (o.includes("Pagar 50M")) return p.money > 400 ? "Pagar 50M" : "Intentar dobles";
    return o[0];
  }
  manage(p) {
    const g = this.g, i = g.idx(p);
    for (let n = 0; n < 40; n++) {
      const o = g.own(i), u = o.find(s => s.mort && p.money > s.price + 200 && g.canUnmort(s));
      if (u) { g.unmort(u); continue; }
      const b = o.filter(s => g.canBuild(s) && p.money - G[s.g][1] >= 250).sort((a, b) => a.houses - b.houses)[0];
      if (!b) break; g.build(b);
    }
    g.h.render();
  }
  raise(p, amt) { // vende casas e hipoteca hasta reunir `amt`
    const g = this.g, i = g.idx(p);
    while (p.money < amt) {
      const o = g.own(i), s = o.find(x => g.canSell(x));
      if (s) { g.sell(s); continue; }
      const m = o.filter(x => g.canMort(x)).sort((a, b) => a.price - b.price)[0];
      if (!m) break; g.mort(m);
    }
    g.h.render(); return p.money >= amt;
  }
  trade(b, o) {
    const g = this.g, bi = g.idx(b), v = s => s.price * (s.mort ? .5 : 1);
    const got = o.gi.reduce((t, i) => { const s = g.sp[i]; return t + v(s) * (s.type === "property" && g.grp(s).every(x => x.owner === bi || o.gi.includes(x.id)) ? 1.6 : 1); }, o.gm);
    const gave = o.ri.reduce((t, i) => { const s = g.sp[i]; return t + v(s) * (s.type === "property" && g.hasSet(bi, s.g) ? 2.5 : 1.3); }, o.rm);
    return got >= gave * 1.1 && b.money + o.gm - o.rm >= 50;
  }
}

class Game {
  constructor(cfg, hooks, rules) {
    this.h = hooks; this.rules = { ...RULES, ...rules };
    this.players = cfg.map(c => new Player(c, this.rules.cash));
    this.sp = SPACES.map((s, i) => ({ ...s, id: i, owner: null, houses: 0, mort: false })); // estado propio, sin mutar SPACES
    this.decks = { chance: shuffle(CHANCE.slice()), chest: shuffle(CHEST.slice()) };
    this.cur = 0; this.over = false; this.pot = 0; this.houses = 32; this.hotels = 12; this.ai = new AI(this);
  }
  toJSON() {
    return { players: this.players.map(p => ({ ...p })), sp: this.sp.map(s => [s.owner, s.houses, s.mort]), rules: this.rules,
      decks: { chance: this.decks.chance.map(c => CHANCE.indexOf(c)), chest: this.decks.chest.map(c => CHEST.indexOf(c)) },
      cur: this.cur, pot: this.pot, houses: this.houses, hotels: this.hotels };
  }
  static from(d, h) {
    const g = new Game(d.players, h, d.rules);
    d.sp.forEach((v, i) => { [g.sp[i].owner, g.sp[i].houses, g.sp[i].mort] = v; });
    g.decks = { chance: d.decks.chance.map(i => CHANCE[i]), chest: d.decks.chest.map(i => CHEST[i]) };
    Object.assign(g, { cur: d.cur, pot: d.pot, houses: d.houses, hotels: d.hotels }); return g;
  }
  p() { return this.players[this.cur]; }
  idx(p) { return this.players.indexOf(p); }
  n(p) { return `<b style="color:${p.color}">${esc(p.name)}</b>`; }
  log(m, c) { this.h.log(m, c); }
  own(i) { return this.sp.filter(s => s.owner === i); }
  grp(s) { return s.type === "property" ? this.sp.filter(x => x.g === s.g) : [s]; }
  hasSet(i, g) { return this.sp.filter(x => x.g === g).every(x => x.owner === i); }
  worth(p) { return p.money + this.own(this.idx(p)).reduce((t, s) => t + (s.mort ? s.price / 2 : s.price) + (s.houses ? s.houses * G[s.g][1] : 0), 0); }
  choose(p, t, x, o) { return p.bot ? Promise.resolve(this.ai.choose(p, o)) : this.h.ask(t, x, o); }

  rent(s, roll) {
    const mine = this.own(s.owner);
    if (s.type === "railroad") return 25 * 2 ** (mine.filter(x => x.type === "railroad").length - 1);
    if (s.type === "utility") return roll * (mine.filter(x => x.type === "utility").length > 1 ? 10 : 4);
    if (s.houses) return Math.round(s.r * MULT[s.g][s.houses - 1]);
    return this.hasSet(s.owner, s.g) ? s.r * 2 : s.r;
  }

  // --- Construcción (uniforme, con límite de 32 casas y 12 hoteles) e hipotecas ---
  canBuild(s) { return s.type === "property" && s.owner !== null && s.houses < 5 && (s.houses < 4 ? this.houses > 0 : this.hotels > 0) && this.hasSet(s.owner, s.g) && this.grp(s).every(x => !x.mort && x.houses >= s.houses) && this.players[s.owner].money >= G[s.g][1]; }
  build(s) { this.players[s.owner].money -= G[s.g][1]; if (s.houses < 4) this.houses--; else { this.hotels--; this.houses += 4; } s.houses++; }
  canSell(s) { return s.houses > 0 && this.grp(s).every(x => x.houses <= s.houses) && (s.houses < 5 || this.houses >= 4); }
  sell(s) { this.players[s.owner].money += G[s.g][1] / 2; if (s.houses === 5) { this.hotels++; this.houses -= 4; } else this.houses++; s.houses--; }
  canMort(s) { return s.owner !== null && !s.mort && this.grp(s).every(x => !x.houses); }
  mort(s) { this.players[s.owner].money += s.price / 2; s.mort = true; }
  unmortCost(s) { return Math.ceil(s.price * 0.55); }
  canUnmort(s) { return s.mort && this.players[s.owner].money >= this.unmortCost(s); }
  unmort(s) { this.players[s.owner].money -= this.unmortCost(s); s.mort = false; }

  // --- Dinero ---
  async pay(p, amt, to) {
    while (p.money < amt && !p.out) {
      if (p.bot) { if (!this.ai.raise(p, amt)) await this.bankrupt(p, to); continue; }
      const c = await this.h.ask("Fondos insuficientes", `${this.n(p)} debe ${amt}M y solo tiene ${p.money}M.`, ["Gestionar propiedades", "Declarar bancarrota"]);
      if (c === "Gestionar propiedades") await this.h.manage(this, p); else await this.bankrupt(p, to);
    }
    if (p.out) return false;
    p.money -= amt; this.h.flash(p, -amt);
    if (to) { to.money += amt; this.h.flash(to, amt); }
    this.h.render(); return true;
  }
  async fine(p, amt) { if (await this.pay(p, amt, null) && this.rules.pot) this.pot += amt; this.h.render(); }
  gain(p, amt) { p.money += amt; this.h.flash(p, amt); this.h.render(); }

  async bankrupt(p, to) {
    this.log(`${this.n(p)} se declara en bancarrota.`, "neg");
    const i = this.idx(p);
    this.own(i).forEach(s => {
      if (s.houses === 5) this.hotels++; else this.houses += s.houses;
      s.houses = 0; if (to) s.owner = this.idx(to); else { s.owner = null; s.mort = false; }
    });
    if (to) { to.money += p.money; to.cards += p.cards; }
    p.money = 0; p.cards = 0; p.out = true;
    const alive = this.players.filter(q => !q.out);
    if (alive.length === 1) { this.over = true; this.h.render(); await this.h.win(alive[0]); }
  }

  // --- Subastas e intercambios ---
  async auction(s, from) {
    const k = this.idx(from) + 1, order = [...this.players.slice(k), ...this.players.slice(0, k)].filter(q => !q.out);
    this.log(`Subasta de <b>${s.name}</b>.`);
    let bid = 0, win = null; const out = new Set();
    for (;;) {
      let moved = false;
      for (const q of order) {
        if (out.has(q) || q === win) continue;
        if (q.money <= bid) { out.add(q); continue; }
        const b = q.bot ? this.ai.bid(s, q, bid) : await this.h.bid(s, q, bid);
        if (b > bid && b <= q.money) { bid = b; win = q; moved = true; this.log(`${this.n(q)} puja ${b}M.`); } else out.add(q);
      }
      if (!moved || order.every(q => out.has(q) || q === win)) break;
    }
    if (win) { win.money -= bid; s.owner = this.idx(win); this.h.flash(win, -bid); this.log(`${this.n(win)} gana <b>${s.name}</b> por ${bid}M.`, "buy"); this.h.render(); }
    else this.log("Nadie puja: la propiedad sigue libre.");
  }
  async proposeTrade(a, b, o) {
    if (o.gm > a.money || o.rm > b.money || !(o.gi.length + o.ri.length + o.gm + o.rm)) { await this.h.ask("Oferta no válida", "Revisa los importes: nadie puede dar más dinero del que tiene, y la oferta no puede estar vacía.", ["Entendido"]); return false; }
    const ok = b.bot ? this.ai.trade(b, o) : await this.h.confirmTrade(a, b, o);
    if (!ok) { this.log(`${this.n(b)} rechaza el intercambio de ${this.n(a)}.`); return false; }
    o.gi.forEach(i => this.sp[i].owner = this.idx(b)); o.ri.forEach(i => this.sp[i].owner = this.idx(a));
    a.money += o.rm - o.gm; b.money += o.gm - o.rm;
    this.log(`${this.n(a)} y ${this.n(b)} cierran un intercambio.`, "buy"); this.h.render(); return true;
  }

  // --- Movimiento ---
  async roll() {
    const a = r6(), b = r6(); await this.h.dice(a, b);
    this.log(`${this.n(this.p())} saca ${a} + ${b} = ${a + b}.`); return [a, b];
  }
  async moveBy(p, n) {
    for (let i = 0; i < n; i++) {
      p.pos = (p.pos + 1) % 40;
      if (!p.pos) { this.log(`${this.n(p)} cobra 200M al pasar por la Ronda de Inversión.`, "pos"); this.gain(p, 200); }
      await this.h.step(p);
    }
  }
  async jail(p) {
    p.pos = 10; p.inJail = true; p.jail = 0;
    this.log(`${this.n(p)} va a la Auditoría Fiscal.`, "neg"); await this.h.step(p); this.h.render();
  }

  async turn() {
    const p = this.p();
    if (p.bot) this.ai.manage(p);
    if (p.inJail) {
      const o = ["Pagar 50M"]; if (p.cards) o.push("Usar carta"); o.push("Intentar dobles");
      const c = await this.choose(p, "Auditoría Fiscal", `${this.n(p)} está en la Auditoría. ¿Cómo quiere salir?`, o);
      if (c === "Pagar 50M") { if (await this.pay(p, 50, null)) { p.inJail = false; this.log(`${this.n(p)} paga 50M y sale.`); } }
      else if (c === "Usar carta") { p.cards--; p.inJail = false; this.log(`${this.n(p)} usa su carta y sale.`); }
      else {
        const [a, b] = await this.roll();
        if (a === b) { p.inJail = false; this.log("¡Dobles! Sale de la Auditoría."); await this.moveBy(p, a + b); await this.land(p, a + b); }
        else if (++p.jail >= 3) { this.log("Tercer intento fallido: paga 50M."); if (await this.pay(p, 50, null)) { p.inJail = false; await this.moveBy(p, a + b); await this.land(p, a + b); } }
        else this.log("No saca dobles.");
        if (!this.over) this.next(); return;
      }
    }
    let again = true, n = 0;
    while (again && !p.out && !this.over && !p.inJail) {
      const [a, b] = await this.roll(); again = a === b;
      if (again && ++n === 3) { this.log("Tres dobles seguidos.", "neg"); await this.jail(p); break; }
      await this.moveBy(p, a + b); await this.land(p, a + b);
      if (again && !p.out && !this.over && !p.inJail) { if (!p.bot) await this.h.ask("¡Dobles!", `${this.n(p)} tira otra vez.`, ["Tirar de nuevo"]); } else again = false;
    }
    if (!this.over) this.next();
  }
  next() { do { this.cur = (this.cur + 1) % this.players.length; } while (this.p().out); this.h.render(); }

  // --- Casillas ---
  async land(p, roll) {
    const s = this.sp[p.pos];
    this.log(`${this.n(p)} cae en <b>${s.name}</b>.`);
    if (["property", "railroad", "utility"].includes(s.type)) await this.landOwn(p, s, roll);
    else if (s.type === "tax") { this.log(`${this.n(p)} paga ${s.amount}M por ${s.name}.`, "neg"); await this.fine(p, s.amount); }
    else if (s.type === "chance" || s.type === "chest") await this.draw(p, s.type);
    else if (s.id === 30) await this.jail(p);
    else if (s.id === 20 && this.rules.pot && this.pot) { this.log(`${this.n(p)} se lleva el bote del Paraíso Fiscal: ${this.pot}M.`, "pos"); const v = this.pot; this.pot = 0; this.gain(p, v); }
  }
  async landOwn(p, s, roll) {
    const me = this.idx(p);
    if (s.owner === null) {
      let buy = false;
      if (p.money >= s.price) buy = p.bot ? this.ai.buy(s, p) : await this.h.buy(s, p);
      if (buy) { p.money -= s.price; s.owner = me; this.log(`${this.n(p)} compra <b>${s.name}</b> por ${s.price}M.`, "buy"); this.h.flash(p, -s.price); this.h.render(); }
      else { this.log(`${this.n(p)} no compra ${s.name}.`); if (this.rules.auction) await this.auction(s, p); }
    } else if (s.owner !== me && !s.mort) {
      const o = this.players[s.owner], r = this.rent(s, roll || r6() + r6());
      this.log(`${this.n(p)} paga ${r}M de alquiler a ${this.n(o)}.`, "neg"); await this.pay(p, r, o);
    }
  }
  async draw(p, k) {
    const d = this.decks[k], c = d.shift(); d.push(c);
    await this.h.card(k, c.t, p.bot); this.log(`${this.n(p)} roba: ${c.t}.`);
    if (c.m > 0) this.gain(p, c.m);
    else if (c.m < 0) await this.fine(p, -c.m);
    else if (c.g !== undefined) { await this.moveBy(p, (c.g - p.pos + 40) % 40); await this.land(p, 0); }
    else if (c.b) { p.pos = (p.pos + 40 - c.b) % 40; await this.h.step(p); await this.land(p, 0); }
    else if (c.j) await this.jail(p);
    else if (c.f) p.cards++;
    else if (c.e) for (const q of this.players) { if (q === p || q.out || p.out || this.over) continue; c.e > 0 ? await this.pay(q, c.e, p) : await this.pay(p, -c.e, q); }
  }
}
