// Interfaz: tablero, panel, ventanas, sonido y ajustes de apariencia.
const $ = i => document.getElementById(i);
const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const COLORS = ["#ff5d5d", "#4da3ff", "#3ddc97", "#ffc83d"], ICONS = ["🦊", "🤖", "🦄", "🐙", "🚀", "👾"];
const DEF = { theme: "silicio", accent: "", zoom: 100, font: "sans", anim: true, sound: true };
let S = loadSettings(), game = null, tokens = [], cells = [], pcs = [], busy = false, mid = 0, AC = null;
const wait = ms => S.anim ? sleep(ms) : Promise.resolve();
const dlg = $("dlg");

function loadSettings() { try { return { ...DEF, ...JSON.parse(localStorage.getItem("mt_set") || "{}") }; } catch (e) { return { ...DEF }; } }
function apply() {
  const r = document.documentElement;
  r.dataset.theme = S.theme; r.dataset.font = S.font; r.classList.toggle("noanim", !S.anim);
  r.style.setProperty("--zoom", S.zoom / 100);
  if (S.accent) {
    const n = parseInt(S.accent.slice(1), 16), l = .299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255);
    r.style.setProperty("--accent", S.accent); r.style.setProperty("--on", l > 150 ? "#111" : "#fff");
  } else { r.style.removeProperty("--accent"); r.style.removeProperty("--on"); }
  try { localStorage.setItem("mt_set", JSON.stringify(S)); } catch (e) {}
}
function beep(f, d = .08) {
  if (!S.sound) return;
  try { AC = AC || new AudioContext(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; g.gain.value = .04; o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d); } catch (e) {}
}
function confetti() {
  for (let i = 0; i < 50; i++) { const c = h("span", "cf", ["🎉", "💸", "⭐", "🚀"][i % 4]); c.style.left = Math.random() * 100 + "vw"; c.style.animationDelay = Math.random() * 1.2 + "s"; document.body.append(c); setTimeout(() => c.remove(), 4200); }
}
function saveGame() { try { game.over ? localStorage.removeItem("mt_game") : localStorage.setItem("mt_game", JSON.stringify(game)); } catch (e) {} }

function modal(title, body, btns, cancel, auto) {
  return new Promise(res => {
    const id = ++mid; dlg.replaceChildren();
    const a = h("div", "dact"), b = h("div");
    typeof body === "string" ? b.innerHTML = body : b.append(body);
    btns.forEach((t, i) => { const x = h("button", i ? "ghost" : "", t); x.onclick = () => { dlg.close(); res(t); }; a.append(x); });
    dlg.append(h("h2", null, title), b, a);
    dlg.oncancel = e => { if (cancel) res(null); else e.preventDefault(); };
    dlg.showModal();
    if (auto) setTimeout(() => { if (id === mid && dlg.open) { dlg.close(); res(btns[0]); } }, auto);
  });
}

function buildBoard() {
  const B = $("board"); B.querySelectorAll(".c").forEach(e => e.remove()); cells = [];
  game.sp.forEach((s, i) => {
    const [r, c] = i <= 10 ? [11, 11 - i] : i < 20 ? [21 - i, 1] : i <= 30 ? [1, i - 19] : [i - 29, 11];
    const side = i % 10 === 0 ? "" : i < 10 ? "b" : i < 20 ? "l" : i < 30 ? "t" : "r";
    const d = h("div", `c ${side} ${s.type}`); d.style.gridArea = `${r}/${c}`;
    const bar = h("div", "bar"); if (s.g) bar.style.background = G[s.g][0];
    const nm = h("div", "nm"), ic = { railroad: "☁️", utility: "📡", chance: "❓", chest: "📦", tax: "💸", corner: s.ic }[s.type];
    if (ic) nm.append(h("span", "ic", ic));
    nm.append(h("span", null, s.name));
    if (s.price || s.amount) nm.append(h("span", "pr", (s.price || s.amount) + "M"));
    if (s.price) { d.tabIndex = 0; d.onclick = () => { if (!busy) modal(s.name, propCard(s), ["Cerrar"], true); }; d.onkeydown = e => e.key === "Enter" && d.click(); }
    d.append(bar, nm, h("div", "tk")); B.append(d); cells.push(d);
  });
}

function render() {
  if (!game) return;
  game.sp.forEach((s, i) => {
    const d = cells[i], o = s.owner === null ? null : game.players[s.owner];
    d.style.setProperty("--own", o ? o.color : "transparent");
    d.classList.toggle("owned", !!o); d.classList.toggle("mort", s.mort);
    if (s.g) d.firstChild.textContent = s.houses > 4 ? "🏨" : "🏠".repeat(s.houses);
  });
  game.players.forEach((p, i) => {
    const c = pcs[i];
    c.classList.toggle("act", i === game.cur && !game.over); c.classList.toggle("out", p.out);
    c.querySelector(".mn").textContent = p.money + "M";
    c.querySelector(".nw").textContent = "Patrimonio " + game.worth(p) + "M" + (p.bot ? " · bot" : "");
    c.querySelector(".pp").replaceChildren(...game.own(i).map(s => { const x = h("i", s.mort ? "m" : ""); x.style.background = s.g ? G[s.g][0] : "var(--mut)"; x.title = s.name; return x; }));
    if (p.out) tokens[i].remove();
  });
  const p = game.p(), off = busy || game.over || p.bot;
  $("turn").textContent = game.over ? "Partida terminada" : `Turno de ${p.name}` + (p.inJail ? " · en la Auditoría" : "") + (p.cards ? ` · ${p.cards} carta(s) de salida` : "");
  $("pot").textContent = game.rules.pot ? "Bote del Paraíso Fiscal: " + game.pot + "M" : "";
  $("roll").disabled = $("manage").disabled = $("trade").disabled = off;
}

function propCard(s) {
  const d = h("div", "pcard"), b = h("div", "pband", s.name);
  b.style.background = s.g ? G[s.g][0] : "var(--panel2)"; d.append(b);
  const rows = s.type === "property"
    ? [["Alquiler", s.r + "M"], ["Con el set completo", s.r * 2 + "M"], ...[1, 2, 3, 4, 5].map(k => [k < 5 ? k + " 🏠" : "🏨", Math.round(s.r * MULT[s.g][k - 1]) + "M"]), ["Coste por casa", G[s.g][1] + "M"]]
    : s.type === "railroad" ? [["1 nube", "25M"], ["2 nubes", "50M"], ["3 nubes", "100M"], ["4 nubes", "200M"]]
    : [["1 servicio", "4× dados"], ["2 servicios", "10× dados"]];
  rows.push(["Hipoteca", s.price / 2 + "M"]);
  if (s.owner !== null) rows.push(["Propietario", game.players[s.owner].name]);
  rows.forEach(([a, c]) => { const r = h("div", "pr2"); r.append(h("span", null, a), h("b", null, c)); d.append(r); });
  return d;
}

async function manage(g, p) {
  const i = g.idx(p), body = h("div"), top = h("p");
  const draw = () => {
    body.replaceChildren(top); top.textContent = `Fondos: ${p.money}M · Banco: ${g.houses} casas, ${g.hotels} hoteles`;
    const mine = g.own(i); if (!mine.length) body.append(h("p", "mut", "Aún no tienes propiedades."));
    mine.forEach(s => {
      const r = h("div", "mrow"), dot = h("i"); dot.style.background = s.g ? G[s.g][0] : "var(--mut)";
      const btn = (t, ok, fn) => { const b = h("button", "ghost sm", t); b.disabled = !ok; b.onclick = () => { fn(); beep(500); render(); draw(); }; return b; };
      r.append(dot, h("span", null, s.name + (s.houses ? ` (${s.houses > 4 ? "🏨" : s.houses + "🏠"})` : "") + (s.mort ? " · hipotecada" : "")));
      if (s.type === "property") r.append(btn("+", g.canBuild(s), () => g.build(s)), btn("−", g.canSell(s), () => g.sell(s)));
      r.append(s.mort ? btn(`Pagar ${g.unmortCost(s)}M`, g.canUnmort(s), () => g.unmort(s)) : btn(`Hipotecar +${s.price / 2}M`, g.canMort(s), () => g.mort(s)));
      body.append(r);
    });
  };
  draw(); await modal("Gestionar propiedades", body, ["Cerrar"], true);
}

const tradeList = (ids, m) => [...ids.map(i => game.sp[i].name), m ? m + "M" : ""].filter(Boolean).map(esc).join(", ") || "nada";
async function tradeUI() {
  const g = game, a = g.p(), os = g.players.filter(q => q !== a && !q.out);
  const sel = h("select"); os.forEach(q => { const o = h("option", null, q.name); o.value = g.idx(q); sel.append(o); });
  const body = h("div"), cols = h("div", "trade"); body.append(sel, cols);
  let ch;
  const draw = () => {
    const b = g.players[sel.value]; cols.replaceChildren(); ch = { 0: [], 1: [], m0: 0, m1: 0 };
    [[a, "Tú das"], [b, "Tú recibes"]].forEach(([p, l], k) => {
      const c = h("div"); c.append(h("b", null, l));
      g.own(g.idx(p)).filter(s => !g.grp(s).some(x => x.houses)).forEach(s => {
        const lb = h("label", "chk"), cb = h("input"); cb.type = "checkbox";
        cb.onchange = () => { ch[k] = cb.checked ? [...ch[k], s.id] : ch[k].filter(x => x !== s.id); };
        lb.append(cb, h("span", null, s.name)); c.append(lb);
      });
      const m = h("input"); m.type = "number"; m.min = 0; m.max = p.money; m.value = 0; m.setAttribute("aria-label", "Dinero de " + p.name); m.oninput = () => { ch["m" + k] = +m.value || 0; };
      c.append(m); cols.append(c);
    });
  };
  sel.onchange = draw; draw();
  if (await modal("Intercambio", body, ["Proponer", "Cancelar"], true) !== "Proponer") return;
  await g.proposeTrade(a, g.players[sel.value], { gi: ch[0], gm: ch.m0, ri: ch[1], rm: ch.m1 });
}

const hooks = {
  render, manage,
  log: (m, c) => { const d = h("div", c || ""), L = $("log"); d.innerHTML = m; L.append(d); while (L.children.length > 150) L.firstChild.remove(); L.scrollTop = L.scrollHeight; },
  step: async p => { const t = tokens[game.idx(p)]; cells[p.pos].querySelector(".tk").append(t); t.classList.remove("hop"); void t.offsetWidth; t.classList.add("hop"); beep(300 + p.pos % 10 * 25, .04); await wait(140); },
  dice: async (a, b) => {
    const D = [$("d1"), $("d2")], F = "⚀⚁⚂⚃⚄⚅"; D.forEach(d => d.classList.add("roll"));
    if (S.anim) for (let k = 0; k < 6; k++) { D.forEach(d => d.textContent = F[Math.random() * 6 | 0]); beep(200 + k * 40, .05); await sleep(80); }
    D[0].textContent = F[a - 1]; D[1].textContent = F[b - 1]; D.forEach(d => d.classList.remove("roll")); await wait(250);
  },
  flash: (p, v) => { if (!v) return; const f = h("span", "fl " + (v < 0 ? "neg" : "pos"), (v > 0 ? "+" : "") + v + "M"); pcs[game.idx(p)].append(f); beep(v > 0 ? 700 : 200, .1); setTimeout(() => f.remove(), 1300); },
  ask: (t, x, b) => modal(t, "<p>" + x + "</p>", b),
  card: (k, t, auto) => { beep(520, .15); return modal(k === "chance" ? "Noticias Tech" : "Tendencias Tech", `<p class="cardtxt">${t}</p>`, ["Entendido"], false, auto ? 1600 : 0); },
  buy: async (s, p) => (await modal(`${p.name}: ¿comprar ${s.name}?`, propCard(s), [`Comprar por ${s.price}M`, "No comprar"]) || "").startsWith("Comprar"),
  bid: async (s, q, cur) => {
    const inp = h("input"), b = h("div"); inp.type = "number"; inp.min = cur + 1; inp.max = q.money; inp.value = Math.min(q.money, cur + 10);
    inp.setAttribute("aria-label", "Tu puja");
    b.append(propCard(s), h("p", null, `${q.name}: puja actual ${cur}M · tienes ${q.money}M`), inp);
    return await modal("Subasta: " + s.name, b, ["Pujar", "Pasar"]) === "Pujar" ? +inp.value || 0 : 0;
  },
  confirmTrade: async (a, b, o) => await modal(`${b.name}: ¿aceptas el intercambio?`, `<p>${esc(a.name)} te da: <b>${tradeList(o.gi, o.gm)}</b></p><p>Tú das: <b>${tradeList(o.ri, o.rm)}</b></p>`, ["Aceptar", "Rechazar"]) === "Aceptar",
  win: async p => { confetti(); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .2), i * 150)); await sleep(2200); await modal(`¡${p.name} gana la partida!`, `<p>Se queda como único inversor con ${p.money}M.</p>`, ["Continuar"]); }
};

// Bucle de turnos: el humano pulsa "Tirar dados"; los bots juegan solos hasta que vuelva a tocar a una persona.
async function play() {
  if (busy || !game || game.over) return; busy = true; render();
  do { await game.turn(); saveGame(); render(); if (game.over) break; if (game.p().bot) await wait(500); } while (game.p().bot);
  busy = false; render(); if (game.over) setup();
}

function start(cfg, rules, saved) {
  game = saved ? Game.from(saved, hooks) : new Game(cfg, hooks, rules); busy = false; $("log").replaceChildren(); buildBoard();
  const P = $("players"); P.replaceChildren(); pcs = []; tokens = [];
  game.players.forEach(p => {
    const c = h("div", "pc"); c.style.setProperty("--pcol", p.color);
    c.append(h("span", "pi", p.icon), h("b", null, p.name), h("span", "mn"), h("div", "nw"), h("div", "pp")); P.append(c); pcs.push(c);
    const t = h("div", "tok", p.icon); t.style.background = p.color; tokens.push(t); cells[p.pos].querySelector(".tk").append(t);
  });
  hooks.log(saved ? "Partida recuperada." : `Bienvenidos. Cada inversor empieza con ${game.rules.cash}M.`); render(); saveGame();
  if (game.p().bot) play();
}

async function setup() {
  let n = 2; const names = ["Inversor 1", "Bot 2", "Bot 3", "Bot 4"], ics = [0, 1, 2, 3], bots = [0, 1, 1, 1], rules = { ...RULES };
  let saved = null; try { saved = JSON.parse(localStorage.getItem("mt_game")); } catch (e) {}
  const body = h("div"), cnt = h("div", "seg"), list = h("div"), opts = h("div");
  const draw = () => {
    cnt.replaceChildren(...[2, 3, 4].map(k => { const b = h("button", k === n ? "on" : "ghost", k + " jugadores"); b.onclick = () => { n = k; draw(); }; return b; }));
    list.replaceChildren(...names.slice(0, n).map((nm, i) => {
      const r = h("div", "prow"), s = h("select"), k = h("select"), t = h("input"); r.style.setProperty("--pcol", COLORS[i]);
      ICONS.forEach((ic, j) => { const o = h("option", null, ic); o.value = j; s.append(o); }); s.value = ics[i]; s.onchange = () => ics[i] = +s.value;
      [["Humano", 0], ["Bot", 1]].forEach(([l, v]) => { const o = h("option", null, l); o.value = v; k.append(o); }); k.value = bots[i]; k.onchange = () => bots[i] = +k.value;
      k.setAttribute("aria-label", "Tipo de jugador " + (i + 1));
      t.value = nm; t.maxLength = 14; t.setAttribute("aria-label", "Nombre del jugador " + (i + 1)); t.oninput = () => names[i] = t.value; r.append(s, t, k); return r;
    }));
  };
  const chk = (l, key) => { const lb = h("label", "chk"), c = h("input"); c.type = "checkbox"; c.checked = rules[key]; c.onchange = () => rules[key] = c.checked; lb.append(c, h("span", null, l)); opts.append(lb); };
  chk("Bote en el Paraíso Fiscal (impuestos y multas)", "pot"); chk("Subasta si nadie compra una propiedad", "auction");
  const cash = h("select"); [1000, 1500, 2000].forEach(v => { const o = h("option", null, v + "M iniciales"); o.value = v; cash.append(o); }); cash.value = rules.cash; cash.onchange = () => rules.cash = +cash.value; opts.append(cash);
  opts.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:10px";
  draw(); body.append(cnt, list, opts);
  const r = await modal("Nueva partida", body, saved && !saved.over ? ["Empezar", "Continuar partida"] : ["Empezar"]);
  if (r === "Continuar partida") return start(null, null, saved);
  start(names.slice(0, n).map((nm, i) => ({ name: nm.trim() || (bots[i] ? "Bot " : "Inversor ") + (i + 1), icon: ICONS[ics[i]], color: COLORS[i], bot: !!bots[i] })), rules);
}

function settings() {
  const b = h("div"), row = (l, c) => { const r = h("label", "srow"); r.append(h("span", null, l), c); b.append(r); };
  const th = h("div", "seg"); th.style.margin = 0;
  [["silicio", "Silicio"], ["plano", "Plano"], ["neon", "Neón"]].forEach(([k, l]) => {
    const x = h("button", S.theme === k ? "on" : "ghost", l);
    x.onclick = () => { S.theme = k; th.querySelectorAll("button").forEach(y => y.className = "ghost"); x.className = "on"; apply(); }; th.append(x);
  });
  const ac = h("input"); ac.type = "color"; ac.value = S.accent || "#e0a458"; ac.oninput = () => { S.accent = ac.value; apply(); };
  const z = h("input"); z.type = "range"; z.min = 70; z.max = 110; z.value = S.zoom; z.oninput = () => { S.zoom = +z.value; apply(); };
  const f = h("select"); [["sans", "Moderna"], ["mono", "Técnica"], ["serif", "Clásica"]].forEach(([k, l]) => { const o = h("option", null, l); o.value = k; f.append(o); });
  f.value = S.font; f.onchange = () => { S.font = f.value; apply(); };
  const tog = k => { const c = h("input"); c.type = "checkbox"; c.checked = S[k]; c.onchange = () => { S[k] = c.checked; apply(); }; return c; };
  const rs = h("button", "ghost sm", "Restablecer"); rs.onclick = () => { S = { ...DEF }; apply(); dlg.close(); settings(); };
  row("Tema", th); row("Color de acento", ac); row("Tamaño del tablero", z); row("Tipografía", f); row("Animaciones", tog("anim")); row("Sonidos", tog("sound")); b.append(rs);
  modal("Apariencia", b, ["Cerrar"], true);
}

$("roll").onclick = play;
$("manage").onclick = async () => { if (busy) return; busy = true; render(); await manage(game, game.p()); busy = false; saveGame(); render(); };
$("trade").onclick = async () => { if (busy) return; busy = true; render(); await tradeUI(); busy = false; saveGame(); render(); };
$("opts").onclick = settings;
$("new").onclick = async () => { if (busy) return; if (await modal("¿Empezar otra partida?", "<p>Se perderá la partida en curso.</p>", ["Cancelar", "Nueva partida"], true) === "Nueva partida") setup(); };
document.addEventListener("keydown", e => {
  if (e.code === "Space" && !dlg.open && !/INPUT|SELECT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $("roll").click(); }
});
apply(); setup();
