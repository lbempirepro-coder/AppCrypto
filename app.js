// LB Desk iPhone app. Plain JS. Reads #t=/#d= (and ?t=&d=) into localStorage.
// iOS Home Screen drops the hash and uses a separate storage — config.json bootstraps Plan B.
(function () {
  const h = location.hash, q = new URLSearchParams(location.search);
  const t = h.match(/[#&]t=([^&]+)/) || (q.get("t") && [0, q.get("t")]);
  const d = h.match(/[#&]d=([^&]+)/) || (q.get("d") && [0, q.get("d")]);
  const v = h.match(/[#&]v=([^&]+)/);
  if (t) localStorage.setItem("app_token", decodeURIComponent(t[1]));
  if (d) localStorage.setItem("data_path", decodeURIComponent(d[1]));
  if (t || d || q.get("t") || q.get("d")) {
    const base = location.pathname + (location.search ? "" : "");
    history.replaceState(null, "", location.pathname + "#/" + (v ? v[1] : "home"));
  }
})();
let TOKEN = localStorage.getItem("app_token"), DATA = localStorage.getItem("data_path");
async function bootConfig() {
  if (DATA || TOKEN) return;
  try {
    const r = await fetch("config.json?_=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const c = await r.json();
    if (c && c.d) { localStorage.setItem("data_path", c.d); DATA = c.d; }
    if (c && c.t) { localStorage.setItem("app_token", c.t); TOKEN = c.t; }
  } catch (_) {}
}
const POLL_MS = 15000, STALE_S = 90;
const S = { state: null, chart: null, activity: null, coin: {}, err: null, loaded: false, at: 0 };
const $ = s => document.querySelector(s), view = $("#view");
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => /^https:\/\/(fomo\.family|t\.me)\//.test(u || "") ? u : "#";
const usd = (x, sign) => { if (x == null || !isFinite(x)) return "—"; const a = Math.abs(x), s = sign ? (x >= 0 ? "+" : "−") : (x < 0 ? "−" : "");
  return s + "$" + (a >= 1000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.toFixed(2)); };
const pct = (x, sign = true) => x == null || !isFinite(x) ? "—" : (sign && x >= 0 ? "+" : "") + (+x).toFixed(1) + "%";
const price = x => x == null ? "—" : x >= 1 ? "$" + (+x).toFixed(4) : "$" + (+x).toPrecision(4);
const cls = x => x > 0 ? "pos" : x < 0 ? "neg" : "mut";
const hm = iso => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
const day = iso => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const ago = iso => { if (!iso) return "jamais"; const s = (Date.now() - new Date(iso)) / 1000;
  return s < 60 ? "à l’instant" : s < 3600 ? Math.round(s / 60) + " min" : Math.round(s / 3600) + " h"; };
const AG = { scanner: ["S", "Scanner", "Trouve les migrations"], auditor: ["A", "Auditor", "8 couches anti-rug"],
  analyst: ["J", "Analyst", "Juge le coin"], executor: ["E", "Executor", "Taille et bouton Buy"], risk: ["R", "Risk", "Stops et sorties"] };

async function getJSON(name) {
  if (DATA) { const r = await fetch("d/" + encodeURIComponent(DATA) + "/" + name + "?_=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(r.status === 404 ? "données introuvables (404)" : "HTTP " + r.status); return r.json(); }
  if (TOKEN && name === "state.json") { const r = await fetch("api/state", { headers: { Authorization: "Bearer " + TOKEN } });
    if (!r.ok) throw new Error(r.status === 401 ? "lien expiré (401)" : "HTTP " + r.status); return r.json(); }
  throw new Error("nolink");
}

async function load() {
  try {
    const [st, ch, ac] = await Promise.all([getJSON("state.json"), getJSON("chart.json").catch(() => null), getJSON("activity.json").catch(() => null)]);
    Object.assign(S, { state: st, chart: ch, activity: ac, err: null, loaded: true, at: Date.now() });
    const m = route(); if (m.name === "coin") await loadCoin(m.arg);
  } catch (e) { S.err = e.message; S.loaded = true; }
  render();
}
async function loadCoin(mint) { try { S.coin[mint] = await getJSON("coin/" + encodeURIComponent(mint) + ".json"); } catch (e) { S.coin[mint] = { error: e.message }; } }

function route() { const p = (location.hash.replace(/^#\/?/, "") || "home").split("/"); return { name: p[0] || "home", arg: p[1] ? decodeURIComponent(p[1]) : null }; }

function chrome(title, sub) {
  $("#title").textContent = title;
  $("#back").classList.toggle("hidden", !sub);
  const m = S.state && S.state.mode, b = $("#badge");
  b.classList.toggle("hidden", !m); b.textContent = m || ""; b.classList.toggle("live", m === "LIVE");
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === (sub || route().name)));
  const bn = $("#banner");
  if (S.err && S.state) { bn.className = "banner"; bn.textContent = "Hors ligne · " + S.err + " · dernières données " + ago(S.state.ts); }
  else if (S.state && (Date.now() - new Date(S.state.ts)) / 1000 > STALE_S) { bn.className = "banner warn"; bn.textContent = "Desk muet depuis " + ago(S.state.ts) + " — les agents tournent-ils ?"; }
  else if (S.state && S.state.paused) { bn.className = "banner warn"; bn.textContent = "Desk en pause · /pause sur Telegram pour reprendre"; }
  else bn.className = "banner hidden";
}
const empty = (e, t, s) => `<div class="empty"><div class="e">${e}</div><b>${esc(t)}</b>${esc(s || "")}</div>`;

function render() {
  const m = route();
  if (!S.loaded) { chrome("LB Desk"); view.innerHTML = `<div class="loading"><div class="spin"></div><p>Chargement…</p></div>`; return; }
  if (!S.state) {
    chrome("LB Desk");
    view.innerHTML = S.err === "nolink"
      ? empty("🔗", "Ouvre le lien du desk", "Ouvre le lien Telegram dans Safari une fois, puis Ajouter à l’écran d’accueil. Si ça échoue, mets à jour l’app (supprime l’icône et réajoute).")
      : empty("⚠️", "Impossible de charger le desk", S.err) + `<button class="btn gray" onclick="load()">Réessayer</button>`;
    return;
  }
  const fn = { home, agents, activity, account, auditor, coin }[m.name] || home;
  fn(m.arg);
}

function posItem(p) {
  const last = p.status === "closed" ? p.exit_price : p.last_price, ch = p.entry_price && last ? (last / p.entry_price - 1) * 100 : null;
  const st = p.status === "closed" ? (p.pnl_usd >= 0 ? "Vendu" : "Stoppé") + " · " + hm(p.closed_at) : p.status === "exiting" ? "Vends sur FOMO !" : "Ouvert · " + hm(p.opened_at);
  const right = p.status === "closed" ? `<div class="${cls(p.pnl_usd)}">${usd(p.pnl_usd, true)}</div><div class="s">${pct(p.pct)}</div>`
    : `<div class="${cls(ch)}">${pct(ch)}</div><div class="s">${usd(p.size_usd)}</div>`;
  return `<a class="item tap" href="#/coin/${encodeURIComponent(p.mint)}"><div class="ico i-${p.status === "closed" ? "risk" : "executor"}">${esc((p.name || "?")[0])}</div>
    <div class="main"><div class="t">${esc(p.name || p.mint.slice(0, 6))}</div><div class="s">${esc(st)}</div></div><div class="r">${right}</div></a>`;
}

function home() {
  chrome("LB Desk");
  const st = S.state, start = st.start_stack, eq = st.equity_usd ?? st.stack_usd, ch = start ? eq - start : st.pnl_usd, chp = start ? ch / start * 100 : null;
  const open = st.positions.filter(p => p.status !== "closed"), closed = st.positions.filter(p => p.status === "closed").slice(0, 5);
  const ag = Object.entries(st.agents).map(([k, a]) => `<div class="ico i-${k}" title="${k}" style="opacity:${a.status === "off" ? .35 : 1}">${AG[k][0]}</div>`).join("");
  const watch = ((st.watch && st.watch.items) || []).slice(0, 12);
  const kills = (st.recent_kills || []).slice(0, 12);
  const watchHtml = watch.length
    ? `<div class="list">${watch.map(w => `<div class="item"><div class="ico i-scanner">⏳</div>
        <div class="main"><div class="t">${esc(w.name || (w.mint || "").slice(0, 6))}</div>
        <div class="s">En file · ${esc(String(w.waited_min))} min</div></div>
        <div class="r s">${esc(w.symbol || "")}</div></div>`).join("")}</div>`
    : `<div class="card small">File d’attente vide — en écoute PumpPortal…</div>`;
  const killsHtml = kills.length
    ? `<div class="list">${kills.map(k => `<div class="item"><div class="ico i-risk">✕</div>
        <div class="main"><div class="t">${esc(k.name || "?")}</div>
        <div class="s">${esc(k.reason || "")}</div></div>
        <div class="r s">${hm(k.ts)}</div></div>`).join("")}</div>`
    : `<div class="card small">Aucun kill encore.</div>`;
  view.innerHTML = `
    <div class="hero"><div class="lbl">Stack ${st.mode === "PAPER" ? "papier" : "live"}</div>
      <div class="big">${usd(eq)}</div>
      <div class="chg ${cls(ch)}">${usd(ch, true)} ${chp != null ? "(" + pct(chp) + ")" : ""} <span class="mut" style="font-weight:400">· ${st.wins}W ${st.losses}L</span></div></div>
    <canvas class="chart" id="eq"></canvas>
    <a class="card tap row" href="#/agents" style="display:flex"><div style="display:flex;gap:6px">${ag}</div><span class="small">${esc(deskLine(st))} ›</span></a>
    <h2>Positions ouvertes</h2>
    ${open.length ? `<div class="list">${open.map(posItem).join("")}</div>` : `<div class="card">${empty("🌙", "Aucune position", "Les agents cherchent. Tu recevras un bouton Buy sur Telegram.")}</div>`}
    <h2>File Scanner · ${watch.length}</h2>${watchHtml}
    <h2>Pourquoi ils sont morts</h2>${killsHtml}
    ${closed.length ? `<h2>Dernières sorties</h2><div class="list">${closed.map(posItem).join("")}</div>` : ""}
    <div class="foot">Mis à jour ${ago(st.ts)} · frais FOMO ${st.fee_pct}%</div>`;
  DeskChart.line($("#eq"), S.chart && S.chart.points, { emptyText: "La courbe apparaît après le premier trade" });
}
function deskLine(st) { const a = st.agents; if (st.paused) return "En pause";
  if (a.risk.open) return "Risk surveille " + a.risk.open; const on = Object.values(a).filter(x => x.status !== "off").length; return on + "/5 agents actifs"; }

function stBadge(a) { const s = a.status || "off", c = s === "off" ? "" : /error|reconnect/.test(s) ? "err" : /idle/.test(s) ? "" : "on";
  return `<span class="status ${c}">${esc(s === "off" ? "arrêté" : s)}</span>`; }
function agents() {
  chrome("Agents");
  const a = S.state.agents, cards = [
    ["scanner", `${a.scanner.scanned} scannés · ${a.scanner.killed} tués · ${a.scanner.passed} passés`, ""],
    ["auditor", `${a.auditor.audited} audités · ${a.auditor.cleared} validés 8/8`, "#/auditor"],
    ["analyst", `${a.analyst.judged} jugés · ${a.analyst.buys} BUY · mode ${esc(a.analyst.mode)}`, ""],
    ["executor", execLine(a.executor), ""],
    ["risk", `${a.risk.open ? "Guarding · " + a.risk.open + " ouverte(s)" : "Rien à surveiller"}${a.risk.last_exit ? " · dernière : " + a.risk.last_exit : ""}`, ""],
  ];
  view.innerHTML = cards.map(([k, stat, href]) => {
    const extra = k === "risk" ? `<div class="pills"><span class="pill red">stop -${a.risk.stop_pct}%</span><span class="pill green">trail ${a.risk.trail_pct}%</span></div>`
      : k === "executor" ? execBar(a.executor) : "";
    const tag = href ? `a href="${href}"` : "div";
    return `<${tag} class="card agent ${href ? "tap" : ""}" style="display:block"><div class="head"><div class="ico i-${k}">${AG[k][0]}</div>
      <div><div class="name">${AG[k][1]}${href ? " ›" : ""}</div><div class="role">${AG[k][2]}</div></div>${stBadge(a[k])}</div>
      <div class="stat">${stat}</div>${extra}<div class="small" style="margin-top:6px">${esc(a[k].detail || "")} · ${ago(a[k].ts)}</div></${href ? "a" : "div"}>`;
  }).join("");
}
function execLine(e) { const l = e.last; return `${e.trades} trades` + (l ? ` · ${usd(l.size_usd)} · ${l.stack_pct}% of stack` : ""); }
function execBar(e) { const l = e.last; if (!l) return "";
  if (l.status === "sent") return `<div class="small" style="margin-top:8px">Executing… attends ton tap sur FOMO</div><div class="bar"><i style="width:60%"></i></div>`;
  if (l.status === "bought") return `<div class="small pos" style="margin-top:8px">✓ Filled</div><div class="bar"><i style="width:100%"></i></div>`;
  return `<div class="small" style="margin-top:8px">${esc(l.status)}</div>`; }

function auditor() {
  chrome("Auditor", "agents");
  const au = S.state.audits;
  view.innerHTML = `<div class="card small">1 mint authority · 2 freeze · 3 dev · 4 top 10 · 5 LP lock · 6 âge pool · 7 bundles · 8 délégations. Première couche ratée = coin tué.</div>` +
    (au.length ? `<div class="list">${au.map(x => `<a class="item tap" href="#/coin/${encodeURIComponent(x.mint)}"><div class="ico i-auditor">${x.passed ? "✓" : "✕"}</div>
      <div class="main"><div class="t">${esc(x.name || x.mint.slice(0, 6))}</div><div class="s">${esc(x.passed ? "8/8 couches validées" : x.reason)}</div>
      <div class="dots">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => { const l = (x.layers || []).find(y => y.layer === n); return `<b class="${l ? (l.ok ? "ok" : "ko") : ""}"></b>`; }).join("")}</div></div>
      <div class="r s">${hm(x.ts)}</div></a>`).join("")}</div>`
      : `<div class="card">${empty("🛡️", "Aucun audit pour l’instant", "Chaque coin qui passe le Scanner apparaît ici avec ses 8 couches.")}</div>`);
}

function activity() {
  chrome("Activity");
  const items = (S.activity && S.activity.items) || [];
  if (!items.length) { view.innerHTML = `<div class="card">${empty("📭", "Rien encore", "Les achats, ventes, stops et coins tués s’affichent ici.")}</div>`; return; }
  let out = "", cur = "";
  items.forEach(i => { const dd = day(i.ts); if (dd !== cur) { if (cur) out += "</div>"; out += `<h2>${esc(dd)}</h2><div class="list">`; cur = dd; }
    const amtCls = /^\+/.test(i.amount) ? "pos" : /^[-−]/.test(i.amount) ? "neg" : "";
    out += `<div class="item"><div class="ico i-${esc(i.agent)}">${(AG[i.agent] || ["•"])[0]}</div><div class="main"><div class="t">${esc(i.title)}</div>
      <div class="s">${esc(i.sub || "")} · ${hm(i.ts)}</div></div><div class="r"><div class="${amtCls}">${esc(i.amount || "")}</div><div class="s">${esc(i.pct || "")}</div></div></div>`; });
  view.innerHTML = out + "</div>";
}

function account() {
  chrome("Account");
  const st = S.state, s = st.settings, kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`;
  const grp = (t, keys) => `<h2>${t}</h2><div class="list">${keys.map(([k, lbl, f]) => kv(lbl, esc(f ? f(s[k]) : s[k]))).join("")}</div>`;
  const P = v => v + "%", U = v => usd(v), M = v => v + " min";
  view.innerHTML = `
    <h2>FOMO</h2><div class="list">
      ${kv("Compte", "@" + esc(st.fomo_handle || "—"))}
      <a class="item tap" href="${safeUrl(st.profile_url)}" target="_blank" rel="noopener"><div class="main"><div class="t" style="color:var(--blue)">Ouvrir mon profil FOMO</div></div><div class="r">›</div></a>
      ${kv("Frais (parrainage)", st.fee_pct + "% par côté")}</div>
    <h2>Mode</h2><div class="card"><div class="row"><div><div style="font-weight:600">${st.mode === "PAPER" ? "PAPER · argent fictif" : "LIVE · vrais trades"}</div>
      <div class="small">${st.mode === "PAPER" ? "Envoie /live sur Telegram pour passer en LIVE." : "Envoie /paper sur Telegram pour revenir en PAPER."}</div></div>
      <span class="badge ${st.mode === "LIVE" ? "live" : ""}" style="position:static">${st.mode}</span></div></div>
    ${grp("Scanner", [["min_liquidity_usd", "Liquidité min", U], ["max_top10_pct", "Top 10 max", P], ["max_h1_change_pct", "Hausse 1h max", P], ["min_pool_age_min", "Âge pool min", M], ["runner_h24_pct", "Runner 24h", P]])}
    ${grp("Auditor", [["max_dev_pct", "Dev max", P], ["min_lp_locked_pct", "LP bloqué min", P], ["max_bundled", "Bundles max"], ["max_delegated_accounts", "Délégations max"]])}
    ${grp("Analyst", [["analyst_mode", "Mode"], ["min_alive_6h", "Alive 6h min"], ["min_organic", "Organic min"], ["max_chase", "Chase max"], ["min_score", "Score min"]])}
    ${grp("Executor", [["stack_pct", "Taille", v => v + "% du stack"], ["max_pool_pct", "Max du pool", P], ["min_ticket_usd", "Ticket min", U], ["confirm_window_min", "Fenêtre tap", M]])}
    ${grp("Risk", [["stop_pct", "Stop", v => "-" + v + "%"], ["trail_start_pct", "Trail dès", v => "+" + v + "%"], ["trail_pct", "Trail", P], ["timeout_h", "Timeout", v => v + " h"]])}
    <div class="card small">Pour changer un réglage : <span class="code">/set stop_pct 5</span> sur Telegram. Un stop plus large ne s’applique qu’aux nouvelles positions.</div>
    <h2>Telegram</h2><div class="list">${st.tg_bot ? `<a class="item tap" href="${safeUrl("https://t.me/" + st.tg_bot)}" target="_blank" rel="noopener"><div class="main"><div class="t" style="color:var(--blue)">@${esc(st.tg_bot)}</div><div class="s">/status /why /report /set /pause</div></div><div class="r">›</div></a>` : kv("Bot", "—")}</div>
    <h2>Inviter</h2><div class="list"><a class="item tap" href="${safeUrl(st.signup_url)}" target="_blank" rel="noopener"><div class="main"><div class="t" style="color:var(--blue)">Lien d’invitation FOMO</div><div class="s">−10 % de frais à vie pour ton invité</div></div><div class="r">›</div></a></div>
    <button class="btn gray" style="margin-top:22px" onclick="if(confirm('Déconnecter cet iPhone ?')){localStorage.clear();location.reload()}">Déconnecter cet iPhone</button>
    <div class="foot">Mis à jour ${ago(st.ts)} · ${DATA ? "plan B (fichiers)" : "plan A (API)"}</div>`;
}

function coin(mint) {
  const c = S.coin[mint];
  chrome(c && c.name || "Coin", "home");
  if (!c) { view.innerHTML = `<div class="loading"><div class="spin"></div><p>Chargement…</p></div>`; loadCoin(mint).then(render); return; }
  if (c.error) { view.innerHTML = empty("⚠️", "Coin introuvable", c.error); return; }
  const p = c.position, L = c.lines || {}, last = c.prices.length ? c.prices[c.prices.length - 1][1] : (p && (p.last_price || p.exit_price));
  const ch = p && last ? (last / p.entry_price - 1) * 100 : null, au = c.audit, v = c.verdict;
  const kv = (k, val) => `<div class="kv"><span>${esc(k)}</span><span>${val}</span></div>`;
  view.innerHTML = `
    <div class="hero"><div class="lbl">${esc(c.symbol ? "$" + c.symbol : "")} · <span class="code">${esc(mint.slice(0, 4) + "…" + mint.slice(-4))}</span></div>
      <div class="big" style="font-size:34px">${price(last)}</div>${ch != null ? `<div class="chg ${cls(ch)}">${pct(ch)} depuis l’entrée</div>` : ""}</div>
    <canvas class="chart tall" id="pc"></canvas>
    <div class="legend">${p ? `<span><i class="entry"></i>Entrée</span>` : ""}${L.exit_line ? `<span><i></i>Risk trailing stop</span>` : ""}</div>
    <a class="btn ${p && p.status !== "closed" ? "red" : "green"}" style="margin-top:14px" href="${safeUrl(c.link)}" target="_blank" rel="noopener">${p && p.status !== "closed" ? "Sell on FOMO" : "Open on FOMO"}</a>
    ${p ? `<h2>Position</h2><div class="list">${kv("Statut", esc(p.status))}${kv("Entrée", price(p.entry_price))}${kv("Taille", usd(p.size_usd) + " · " + p.stack_pct + "%")}
      ${kv("Plus haut", price(p.peak))}${L.stop_line ? kv("Stop", price(L.stop_line) + ` <span class="neg">-${p.stop_pct}%</span>`) : ""}
      ${L.trail_line ? kv("Trail", price(L.trail_line)) : L.trail_on_at ? kv("Trail s’active à", price(L.trail_on_at)) : ""}
      ${p.status === "closed" ? kv("Sortie", esc(p.exit_reason) + " · " + price(p.exit_price)) + kv("PnL net", `<span class="${cls(p.pnl_usd)}">${usd(p.pnl_usd, true)} (${pct(p.pct)})</span>`) + kv("Frais", usd(p.fees_usd)) : ""}</div>` : ""}
    ${v ? `<h2>Analyst · ${esc(v.mode)}</h2><div class="list">${kv("Verdict", `<b class="${v.verdict === "BUY" ? "pos" : "neg"}">${esc(v.verdict)}</b>`)}
      ${["alive_6h", "organic", "flush", "chase"].map(k => kv(k, (+v[k]).toFixed(2))).join("")}${v.reason ? kv("Raison", esc(v.reason)) : ""}</div>` : ""}
    ${au ? `<h2>Auditor · ${au.passed ? "8/8" : "tué L" + au.failed_layer}</h2><div class="list">${au.layers.map(l => `<div class="item"><div class="ico ${l.ok ? "i-executor" : "i-risk"}" style="${l.ok ? "" : "color:var(--red);background:#ff453a26"}">${l.ok ? "✓" : "✕"}</div>
      <div class="main"><div class="t">${l.layer}. ${esc(l.name)}</div><div class="s">${esc(l.detail)}</div></div></div>`).join("")}</div>` : ""}
    ${c.scan ? `<h2>Scanner</h2><div class="list">${kv("Statut", esc(c.scan.status) + (c.scan.reason ? " · " + esc(c.scan.reason) : ""))}${kv("Liquidité", usd(c.scan.liquidity_usd))}${kv("Holders", esc(c.holders ?? "—"))}</div>` : ""}`;
  const lines = [];
  if (p) lines.push({ y: p.entry_price, color: "#8e8e93", width: 1, label: "Entrée" });
  if (L.exit_line) lines.push({ y: L.exit_line, color: "#ff9f0a", dash: [6, 5], label: "Risk trailing stop" });
  DeskChart.line($("#pc"), c.prices, { lines, fill: true, emptyText: "Pas encore de prix" });
}

$("#back").onclick = () => history.length > 1 ? history.back() : (location.hash = "#/home");
window.addEventListener("hashchange", () => { const m = route(); if (m.name === "coin" && !S.coin[m.arg]) loadCoin(m.arg).then(render); render(); window.scrollTo(0, 0); });
window.addEventListener("resize", render);
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
bootConfig().then(() => { load(); setInterval(load, POLL_MS); });
