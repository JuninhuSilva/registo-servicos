/* Registo de Serviços — PWA local-first
   Um registo por serviço: { id, data, tipo, wo, ordem, createdAt, updatedAt, deletedAt? }
   Dados guardados no IndexedDB do telemóvel (com recurso a localStorage se falhar). */
'use strict';

/* ================= Constantes e utilitários ================= */
const TIPOS = ['INSTALACAO', 'SUPORTE', 'ADICIONAL'];
const ROTULO = { INSTALACAO: 'Instalação', SUPORTE: 'Suporte', ADICIONAL: 'Adicional' };
const REMOVIDO = { INSTALACAO: 'Instalação removida', SUPORTE: 'Suporte removido', ADICIONAL: 'Adicional removido' };
const LETRA = { INSTALACAO: 'I', SUPORTE: 'S', ADICIONAL: 'A' };
const WD = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtPT = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const today = () => iso(new Date());
const monthOf = s => s.slice(0, 7);
const addMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MO[m - 1]} ${y}`; };
const dec1 = v => v.toFixed(1).replace('.', ',');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const nowISO = () => new Date().toISOString();

const ICON = {
  left: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  right: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  cal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  chev: '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  paste: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/></svg>',
  download: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFC21A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};

/* ================= Armazenamento ================= */
const DB_NAME = 'registo-servicos';
const STORE = 'servicos';
const LS_KEY = 'registo-servicos-fallback';
const PREFS_KEY = 'registo-servicos-prefs';

const Store = {
  db: null,
  useLS: false,
  async open() {
    if (!('indexedDB' in window)) { this.useLS = true; return; }
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => {
          const os = r.result.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('data', 'data');
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch (e) { this.useLS = true; }
  },
  async all() {
    if (this.useLS) { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; } }
    return new Promise((res, rej) => {
      const r = this.db.transaction(STORE).objectStore(STORE).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },
  put(rec) {
    if (this.useLS) { this.saveLS(); return; }
    try { this.db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec); } catch (e) { console.error(e); }
  },
  putMany(recs) {
    if (this.useLS) { this.saveLS(); return Promise.resolve(); }
    return new Promise((res, rej) => {
      const tx = this.db.transaction(STORE, 'readwrite');
      const os = tx.objectStore(STORE);
      recs.forEach(r => os.put(r));
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  },
  saveLS() { try { localStorage.setItem(LS_KEY, JSON.stringify(S.items)); } catch (e) { console.error(e); } },
};

function loadPrefs() {
  const def = { focusWoOnAdd: false, csvSeparator: ';', lastExport: null };
  try { return { ...def, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) }; } catch (e) { return def; }
}
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(S.prefs)); } catch (e) {} }

/* ================= Estado ================= */
const S = {
  items: [],                  // todos os registos (incluindo apagados)
  today: today(),
  selectedDate: today(),
  screen: 'registo',
  openAccordion: null,
  calendarMonth: monthOf(today()),
  dashboardMonth: monthOf(today()),
  exportRange: 'mes',
  chartDay: null,
  prefs: loadPrefs(),
};

const live = () => S.items.filter(r => !r.deletedAt);
function dayList(date, tipo) {
  return S.items.filter(r => !r.deletedAt && r.data === date && r.tipo === tipo).sort((a, b) => a.ordem - b.ordem);
}
/* Índice: data -> {I,S,A,wo,woF} */
function indexByDay() {
  const m = new Map();
  for (const r of S.items) {
    if (r.deletedAt) continue;
    let d = m.get(r.data);
    if (!d) { d = { I: 0, S: 0, A: 0, wo: 0, woF: 0 }; m.set(r.data, d); }
    d[LETRA[r.tipo]]++; d.wo++; if (r.wo) d.woF++;
  }
  return m;
}

/* ================= Ações ================= */
function addService(tipo) {
  const date = S.selectedDate;
  const all = S.items.filter(r => r.data === date && r.tipo === tipo);
  const ordem = all.reduce((mx, r) => Math.max(mx, r.ordem), 0) + 1;
  const t = nowISO();
  const rec = { id: uuid(), data: date, tipo, wo: null, ordem, createdAt: t, updatedAt: t };
  S.items.push(rec);
  Store.put(rec);
  try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
  if (S.prefs.focusWoOnAdd) {
    S.openAccordion = tipo;
    render();
    requestAnimationFrame(() => {
      const el = document.querySelector(`.wo-input[data-id="${rec.id}"]`);
      if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    });
  } else {
    render();
  }
}

function removeService(rec) {
  if (!rec) return;
  rec.deletedAt = nowISO();
  rec.updatedAt = rec.deletedAt;
  Store.put(rec);
  render();
  showToast(`${REMOVIDO[rec.tipo]}${rec.wo ? ' · ' + rec.wo : ''}`, () => {
    delete rec.deletedAt;
    rec.updatedAt = nowISO();
    Store.put(rec);
    render();
  });
}

function removeLast(tipo) {
  const list = dayList(S.selectedDate, tipo);
  if (!list.length) return;
  removeService(list[list.length - 1]);
}

let woTimers = {};
function setWO(id, value) {
  const rec = S.items.find(r => r.id === id);
  if (!rec) return;
  rec.wo = value.trim() ? value.toUpperCase() : null;
  rec.updatedAt = nowISO();
  clearTimeout(woTimers[id]);
  woTimers[id] = setTimeout(() => Store.put(rec), 300);
  // Atualiza só o contador «2/3», sem redesenhar (para não perder o foco)
  const sumEl = document.querySelector(`[data-wosum="${rec.tipo}"]`);
  if (sumEl) sumEl.textContent = woSummary(dayList(S.selectedDate, rec.tipo));
}
/* Botão «Colar»: lê a área de transferência e põe o texto na WO */
async function pasteWO(id) {
  const input = document.querySelector(`.wo-input[data-id="${id}"]`);
  let text = '';
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('sem api');
    text = await navigator.clipboard.readText();
  } catch (e) {
    if (input) input.focus();
    showToast('Não foi possível colar. Toque longo no campo e escolha «Colar».');
    return;
  }
  const wo = String(text || '').replace(/\s+/g, '').toUpperCase().slice(0, 40);
  if (!wo) { showToast('Nada copiado para colar'); return; }
  if (input) input.value = wo;
  setWO(id, wo);
  try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
  showToast(`WO colada · ${wo}`);
}

function flushWO() {
  Object.keys(woTimers).forEach(id => {
    clearTimeout(woTimers[id]);
    const rec = S.items.find(r => r.id === id);
    if (rec) Store.put(rec);
  });
  woTimers = {};
}

function setDate(date) {
  S.selectedDate = date;
  S.openAccordion = null;
}
function go(screen) {
  if (screen === 'calendario') S.calendarMonth = monthOf(S.selectedDate);
  S.screen = screen;
  render();
  document.getElementById('screen').scrollTop = 0;
}

/* ================= Toast ================= */
let toastTimer;
function showToast(text, undo) {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  el.innerHTML = `<span class="toast-text">${esc(text)}</span>${undo ? '<button class="toast-undo" type="button">Anular</button>' : ''}`;
  el.hidden = false;
  if (undo) {
    el.querySelector('.toast-undo').onclick = () => { hideToast(); undo(); };
  }
  toastTimer = setTimeout(hideToast, 4000);
}
function hideToast() {
  clearTimeout(toastTimer);
  const el = document.getElementById('toast');
  el.hidden = true; el.innerHTML = '';
}

/* ================= Ecrã: Registo ================= */
const woSummary = list => list.length ? `${list.filter(r => r.wo).length}/${list.length}` : '—';

function woListHTML(tipo, list) {
  const open = S.openAccordion === tipo;
  if (!open) return '';
  const empty = { INSTALACAO: 'Sem instalações. Toque em + para adicionar.', SUPORTE: 'Sem suportes registados.', ADICIONAL: 'Sem adicionais registados.' }[tipo];
  const rows = list.map((r, i) => `
    <div class="wo-row">
      <span class="wo-n">#${i + 1}</span>
      <input class="wo-input" data-id="${r.id}" value="${esc(r.wo || '')}" placeholder="Nº da WO"
        autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
        aria-label="WO da ${ROTULO[tipo].toLowerCase()} ${i + 1}">
      <button class="wo-paste" type="button" data-paste="${r.id}" aria-label="Colar WO na ${ROTULO[tipo].toLowerCase()} ${i + 1}">${ICON.paste}<span>Colar</span></button>
      <button class="wo-del" type="button" data-del="${r.id}" aria-label="Apagar ${ROTULO[tipo].toLowerCase()} ${i + 1}">×</button>
    </div>`).join('');
  return `<div class="wo-list" id="wo-${tipo}">${rows || `<span class="wo-empty">${empty}</span>`}</div>`;
}

function accBtn(tipo, list, label) {
  const open = S.openAccordion === tipo;
  return `<button class="acc-btn" type="button" data-acc="${tipo}" aria-expanded="${open}" aria-controls="wo-${tipo}">
      <span>${label}</span><span class="acc-right"><span data-wosum="${tipo}">${woSummary(list)}</span>${ICON.chev}</span>
    </button>`;
}

function renderRegisto() {
  const d = parse(S.selectedDate);
  const isToday = S.selectedDate === S.today;
  const I = dayList(S.selectedDate, 'INSTALACAO');
  const Su = dayList(S.selectedDate, 'SUPORTE');
  const A = dayList(S.selectedDate, 'ADICIONAL');

  const sec = (tipo, list, cls) => `
    <section class="card card-sec ${cls}" aria-label="${ROTULO[tipo]}">
      <div class="cs-row">
        <span class="cs-bar"></span>
        <div class="cs-info">
          <span class="cs-title">${ROTULO[tipo]}</span>
          <span class="cs-num">${list.length}</span>
        </div>
        <button class="cs-minus" type="button" data-dec="${tipo}" aria-label="Remover ${ROTULO[tipo].toLowerCase()}">−</button>
        <button class="cs-plus" type="button" data-inc="${tipo}" aria-label="Adicionar ${ROTULO[tipo].toLowerCase()}">+</button>
      </div>
      ${accBtn(tipo, list, 'WO')}
      ${woListHTML(tipo, list)}
    </section>`;

  return `
  <div class="stack">
    <div class="head-row">
      <button class="date-btn" type="button" data-go="calendario" aria-label="Abrir calendário">
        <span class="date-week">${WD[d.getDay()]}${isToday ? '<span class="badge-today">Hoje</span>' : ''}</span>
        <span class="date-big">${d.getDate()} ${MO[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}</span>
      </button>
      <button class="icon-btn" type="button" data-shift="-1" aria-label="Dia anterior">${ICON.left}</button>
      <button class="icon-btn" type="button" data-shift="1" aria-label="Dia seguinte">${ICON.right}</button>
      <button class="icon-btn dark" type="button" data-go="calendario" aria-label="Calendário">${ICON.cal}</button>
    </div>
    ${isToday ? '' : '<button class="back-today" type="button" data-today>A editar outro dia · Voltar a hoje</button>'}

    <div class="summary" aria-label="Resumo do dia">
      <div class="sum-col total"><span class="sum-label">Total</span><span class="sum-num">${I.length + Su.length + A.length}</span></div>
      <div class="sum-col i"><span class="sum-label"><span class="sum-dot" style="background:var(--install)"></span>Inst.</span><span class="sum-num">${I.length}</span></div>
      <div class="sum-col"><span class="sum-label"><span class="sum-dot" style="background:var(--support-dark)"></span>Sup.</span><span class="sum-num">${Su.length}</span></div>
      <div class="sum-col"><span class="sum-label"><span class="sum-dot" style="background:var(--extra-dark)"></span>Adic.</span><span class="sum-num">${A.length}</span></div>
    </div>

    <section class="card-install" aria-label="Instalação">
      <div class="ci-head"><span class="ci-title">Instalação</span><span class="ci-badge">Comissão</span></div>
      <div class="ci-row">
        <button class="ci-minus" type="button" data-dec="INSTALACAO" aria-label="Remover instalação">−</button>
        <span class="ci-num" aria-live="polite">${I.length}</span>
        <button class="ci-plus" type="button" data-inc="INSTALACAO" aria-label="Adicionar instalação">+</button>
      </div>
      ${accBtn('INSTALACAO', I, 'Ordens de serviço (WO)')}
      ${woListHTML('INSTALACAO', I)}
    </section>

    ${sec('SUPORTE', Su, 't-S')}
    ${sec('ADICIONAL', A, 't-A')}
  </div>`;
}

/* ================= Ecrã: Calendário ================= */
function renderCalendario() {
  const ym = S.calendarMonth;
  const [y, m] = ym.split('-').map(Number);
  const idx = indexByDay();
  const first = new Date(y, m - 1, 1);
  const off = (first.getDay() + 6) % 7; // semana começa à segunda
  const dim = new Date(y, m, 0).getDate();
  const total = Math.ceil((off + dim) / 7) * 7;
  let mI = 0, mS = 0, mA = 0;
  let cells = '';
  for (let i = 0; i < total; i++) {
    const num = i - off + 1;
    if (num < 1 || num > dim) { cells += '<span class="cal-cell empty" aria-hidden="true"></span>'; continue; }
    const k = `${ym}-${pad(num)}`;
    const r = idx.get(k) || { I: 0, S: 0, A: 0 };
    mI += r.I; mS += r.S; mA += r.A;
    const has = r.I + r.S + r.A > 0;
    const cls = ['cal-cell', has && 'has', k === S.today && 'today', k > S.today && 'future', k === S.selectedDate && 'sel'].filter(Boolean).join(' ');
    const sub = (r.S || r.A) ? `S${r.S} · A${r.A}` : '';
    const label = `${num} de ${MO[m - 1]}: ${r.I} instalações, ${r.S} suportes, ${r.A} adicionais`;
    cells += `<button class="${cls}" type="button" data-day="${k}" aria-label="${label}">
      <span class="cal-num">${num}</span>
      ${r.I ? `<span class="cal-pill">${r.I}</span>` : '<span></span>'}
      <span class="cal-sub">${sub}</span>
    </button>`;
  }
  return `
  <div class="stack narrow">
    <div class="head-row">
      <div class="head-title"><span class="head-kicker">Calendário</span><span class="head-big">${monthLabel(ym)}</span></div>
      <button class="icon-btn" type="button" data-calm="-1" aria-label="Mês anterior">${ICON.left}</button>
      <button class="icon-btn" type="button" data-calm="1" aria-label="Mês seguinte">${ICON.right}</button>
    </div>
    <div class="mini-grid">
      <div class="mini install"><span class="mini-label">Instalações</span><span class="mini-num">${mI}</span></div>
      <div class="mini"><span class="mini-label s">Suportes</span><span class="mini-num">${mS}</span></div>
      <div class="mini"><span class="mini-label a">Adicionais</span><span class="mini-num">${mA}</span></div>
    </div>
    <div class="card cal">
      <div class="cal-grid">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(w => `<span class="cal-wd">${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>
    <div class="legend">
      <span><span class="legend-pill">2</span>Instalações</span>
      <span>S = Suporte · A = Adicional</span>
      <span>Toque num dia para o abrir</span>
    </div>
  </div>`;
}

/* ================= Ecrã: Painel ================= */
function dashStats(ym) {
  const [y, m] = ym.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const idx = indexByDay();
  const get = k => idx.get(k) || { I: 0, S: 0, A: 0, wo: 0, woF: 0 };
  const curYM = monthOf(S.today);
  const isCur = ym === curYM;
  const isFuture = ym > curYM;
  const cut = isCur ? Number(S.today.slice(8)) : dim;

  let I = 0, Su = 0, A = 0, days = 0, woF = 0, woT = 0, max = 1;
  const per = [];
  for (let d = 1; d <= dim; d++) {
    const r = get(`${ym}-${pad(d)}`);
    per.push(r);
    I += r.I; Su += r.S; A += r.A;
    if (r.I + r.S + r.A) days++;
    woT += r.wo; woF += r.woF;
    max = Math.max(max, r.I + r.S + r.A);
  }
  // Variação: mês corrente compara dias 1..hoje com os mesmos dias do mês anterior
  const pm = addMonth(ym, -1);
  const [py, pmo] = pm.split('-').map(Number);
  const pdim = new Date(py, pmo, 0).getDate();
  let PI = 0, prevHas = false, cI = 0;
  for (let d = 1; d <= Math.min(cut, pdim); d++) { const r = get(`${pm}-${pad(d)}`); PI += r.I; if (r.I + r.S + r.A) prevHas = true; }
  for (let d = 1; d <= cut; d++) cI += per[d - 1].I;
  const delta = prevHas && PI ? Math.round((cI - PI) / PI * 100) : null;

  // Dia da semana — histórico completo
  const wkSum = [0, 0, 0, 0, 0, 0, 0], wkCnt = [0, 0, 0, 0, 0, 0, 0];
  idx.forEach((r, k) => { if (r.I + r.S + r.A) { const w = parse(k).getDay(); wkSum[w] += r.I; wkCnt[w]++; } });
  const wk = [1, 2, 3, 4, 5, 6].map(w => wkCnt[w] ? wkSum[w] / wkCnt[w] : 0);

  return { y, m, dim, per, I, Su, A, days, woF, woT, max, isCur, isFuture, cut, delta, pm, wk, avg: days ? I / days : 0 };
}

function renderPainel() {
  const st = dashStats(S.dashboardMonth);
  const tot = st.I + st.Su + st.A;
  const pct = v => tot ? Math.round(v / tot * 100) : 0;
  const ph = v => (v / st.max * 100).toFixed(1) + '%';
  const prevName = MO[Number(st.pm.slice(5)) - 1].toLowerCase();

  let deltaCls = '', deltaTxt = '—', deltaNote = 'sem dados do mês anterior';
  if (st.delta != null) {
    deltaCls = st.delta >= 0 ? 'up' : 'down';
    deltaTxt = (st.delta >= 0 ? '▲ ' : '▼ ') + Math.abs(st.delta) + '%';
    deltaNote = `vs. ${prevName}${st.isCur ? ` (até dia ${st.cut})` : ''}`;
  }

  const cols = `grid-template-columns:repeat(${st.dim},minmax(0,1fr))`;
  const bars = st.per.map((r, i) => {
    const day = i + 1;
    const fut = st.isFuture || (st.isCur && day > st.cut);
    const on = S.chartDay === day;
    const label = `Dia ${day}: ${r.I} instalações, ${r.S} suportes, ${r.A} adicionais`;
    return `<button class="bar${fut ? ' future' : ''}${on ? ' on' : ''}" type="button" data-bar="${day}" aria-label="${label}">
      ${r.I ? `<span class="seg i" style="height:${ph(r.I)}"></span>` : ''}
      ${r.S ? `<span class="seg s" style="height:${ph(r.S)}"></span>` : ''}
      ${r.A ? `<span class="seg a" style="height:${ph(r.A)}"></span>` : ''}
    </button>`;
  }).join('');
  const axis = st.per.map((_, i) => `<span>${[1, 8, 15, 22, 29].includes(i + 1) ? i + 1 : ''}</span>`).join('');

  let tip = '<span>Toque numa barra para ver o dia.</span>';
  if (S.chartDay && S.chartDay <= st.dim) {
    const r = st.per[S.chartDay - 1];
    const wd = WD[new Date(st.y, st.m - 1, S.chartDay).getDay()].split('-')[0];
    tip = `<b>${wd}, ${S.chartDay}</b> · ${r.I} inst. · ${r.S} sup. · ${r.A} adic.`;
  }

  const wmax = Math.max(...st.wk, 0.1);
  const bestV = Math.max(...st.wk);
  const week = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((lbl, i) => `
    <div class="week-row">
      <span class="week-lbl">${lbl}</span>
      <div class="week-track"><div class="week-fill${bestV > 0 && st.wk[i] === bestV ? ' best' : ''}" style="width:${(st.wk[i] / wmax * 100).toFixed(1)}%"></div></div>
      <span class="week-val">${dec1(st.wk[i])}</span>
    </div>`).join('');

  return `
  <div class="stack narrow">
    <div class="head-row">
      <div class="head-title"><span class="head-kicker">Produtividade</span><span class="head-big">${monthLabel(S.dashboardMonth)}</span></div>
      <button class="icon-btn" type="button" data-dashm="-1" aria-label="Mês anterior">${ICON.left}</button>
      <button class="icon-btn" type="button" data-dashm="1" aria-label="Mês seguinte">${ICON.right}</button>
    </div>

    <div class="hero">
      <div class="hero-left"><span class="hero-label">Instalações no mês</span><span class="hero-num">${st.I}</span></div>
      <div class="hero-right"><span class="delta ${deltaCls}">${deltaTxt}</span><span class="delta-note">${deltaNote}</span></div>
    </div>

    <div class="mini-grid">
      <div class="mini"><span class="mini-label">Média inst./dia</span><span class="mini-num sm">${dec1(st.avg)}</span></div>
      <div class="mini"><span class="mini-label">Dias trabalhados</span><span class="mini-num sm">${st.days}</span></div>
      <div class="mini"><span class="mini-label">WO preenchidas</span><span class="mini-num sm">${st.woT ? Math.round(st.woF / st.woT * 100) + '%' : '—'}</span></div>
    </div>

    <section class="card chart-card" aria-label="Serviços por dia">
      <div class="card-row"><span class="card-title">Serviços por dia</span><span class="card-meta">máx. ${tot ? st.max : 0}</span></div>
      <div class="chart-tip" aria-live="polite">${tip}</div>
      <div class="bars" style="${cols}">
        ${st.avg > 0 ? `<div class="avg-line" style="bottom:${(st.avg / st.max * 100).toFixed(1)}%"></div>` : ''}
        ${bars}
      </div>
      <div class="bar-axis" style="${cols}">${axis}</div>
      <div class="chart-legend">
        <span><span class="sw i"></span>Instalação</span>
        <span><span class="sw s"></span>Suporte</span>
        <span><span class="sw a"></span>Adicional</span>
        <span><span class="sw avg"></span>Média inst.</span>
      </div>
    </section>

    <section class="card chart-card" aria-label="Distribuição">
      <div class="card-row"><span class="card-title">Distribuição</span><span class="card-meta">${tot} serviços</span></div>
      <div class="dist">
        ${tot ? `<div style="width:${pct(st.I)}%;background:var(--install)"></div><div style="width:${pct(st.Su)}%;background:var(--support)"></div><div style="width:${pct(st.A)}%;background:var(--extra)"></div>` : ''}
      </div>
      <div class="dist-cols">
        <div><span class="dist-pct">${pct(st.I)}%</span><span class="dist-lbl">Instalação · ${st.I}</span></div>
        <div><span class="dist-pct" style="color:var(--support)">${pct(st.Su)}%</span><span class="dist-lbl">Suporte · ${st.Su}</span></div>
        <div><span class="dist-pct" style="color:var(--extra)">${pct(st.A)}%</span><span class="dist-lbl">Adicional · ${st.A}</span></div>
      </div>
    </section>

    <section class="card chart-card" aria-label="Instalações por dia da semana">
      <div style="display:flex;flex-direction:column">
        <span class="card-title">Instalações por dia da semana</span>
        <span class="card-meta" style="font-weight:500">Média por dia trabalhado · histórico completo</span>
      </div>
      ${week}
    </section>
  </div>`;
}

/* ================= Ecrã: Exportar ================= */
const ORDER = { INSTALACAO: 0, SUPORTE: 1, ADICIONAL: 2 };
function exportRows() {
  const cur = monthOf(S.today), prev = addMonth(cur, -1);
  return live()
    .filter(r => S.exportRange === 'tudo' || monthOf(r.data) === (S.exportRange === 'mes' ? cur : prev))
    .sort((a, b) => a.data.localeCompare(b.data) || ORDER[a.tipo] - ORDER[b.tipo] || a.ordem - b.ordem);
}
function exportFileName() {
  const cur = monthOf(S.today);
  if (S.exportRange === 'tudo') return 'servicos_tudo.csv';
  return `servicos_${S.exportRange === 'mes' ? cur : addMonth(cur, -1)}.csv`;
}
function buildCSV(rows) {
  const sep = S.prefs.csvSeparator;
  const q = v => /[";,\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [['Data', 'Tipo de serviço', 'WO'].join(sep)];
  rows.forEach(r => lines.push([fmtPT(r.data), ROTULO[r.tipo], r.wo || ''].map(q).join(sep)));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

async function shareOrDownload(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}

async function doExport() {
  const rows = exportRows();
  if (!rows.length) { showToast('Sem registos neste período'); return; }
  const blob = new Blob([buildCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const res = await shareOrDownload(blob, exportFileName(), 'Registo de serviços');
  if (res === 'cancelled') return;
  const now = new Date();
  S.prefs.lastExport = now.toISOString();
  savePrefs();
  render();
  showToast('Ficheiro CSV exportado');
}

async function doBackup() {
  const data = { app: 'registo-servicos', versao: 1, exportadoEm: nowISO(), servicos: S.items };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const res = await shareOrDownload(blob, `copia_servicos_${S.today}.json`, 'Cópia de segurança');
  if (res !== 'cancelled') showToast('Cópia de segurança guardada');
}

async function doRestore(file) {
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.servicos;
    if (!Array.isArray(list)) throw new Error('formato');
    const valid = list.filter(r => r && r.id && /^\d{4}-\d{2}-\d{2}$/.test(r.data) && TIPOS.includes(r.tipo));
    const byId = new Map(S.items.map(r => [r.id, r]));
    let added = 0;
    valid.forEach(r => {
      const cur = byId.get(r.id);
      if (!cur || (r.updatedAt || '') > (cur.updatedAt || '')) { byId.set(r.id, r); if (!cur) added++; }
    });
    S.items = [...byId.values()];
    await Store.putMany(S.items);
    render();
    showToast(`Cópia restaurada · ${added} novos registos`);
  } catch (e) {
    showToast('Ficheiro inválido. Escolha uma cópia .json desta app.');
  }
}

function lastExportLabel() {
  if (!S.prefs.lastExport) return '';
  const d = new Date(S.prefs.lastExport);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = iso(d);
  if (day === S.today) return ` Última exportação: hoje às ${hm}.`;
  return ` Última exportação: ${fmtPT(day)} às ${hm}.`;
}

function renderExportar() {
  const rows = exportRows();
  const preview = rows.slice(0, 6).map(r => `
    <div class="tbl-row"><span class="num">${fmtPT(r.data)}</span><span class="tp">${ROTULO[r.tipo]}</span><span class="wo">${esc(r.wo || '—')}</span></div>`).join('');
  const more = rows.length > 6 ? `+ ${rows.length - 6} linhas no ficheiro` : (rows.length ? 'Fim da lista' : 'Sem registos neste período');
  const ranges = [['mes', 'Este mês'], ['ant', 'Mês anterior'], ['tudo', 'Tudo']]
    .map(([k, l]) => `<button class="seg-btn" type="button" data-range="${k}" aria-pressed="${S.exportRange === k}">${l}</button>`).join('');
  const sep = S.prefs.csvSeparator;

  return `
  <div class="stack">
    <div class="head-title"><span class="head-kicker">Folha de cálculo</span><span class="head-big">Exportar</span></div>

    <div style="display:flex;flex-direction:column;gap:8px">
      <span class="section-label">Período</span>
      <div class="segmented">${ranges}</div>
    </div>

    <div class="card preview">
      <div class="card-row preview-head"><span class="card-title">Pré-visualização</span><span class="card-meta" style="font-size:14px">${rows.length} ${rows.length === 1 ? 'linha' : 'linhas'}</span></div>
      <div class="tbl-row th"><span>Data</span><span>Tipo de serviço</span><span>WO</span></div>
      ${preview}
      <div class="preview-foot">${more}</div>
    </div>

    <button class="btn-main" type="button" data-export ${rows.length ? '' : 'disabled'}>${ICON.download}Exportar para Excel (CSV)</button>
    <span class="note">Uma linha por serviço · colunas Data, Tipo de serviço, WO · separador «${esc(sep)}», abre diretamente no Excel.${lastExportLabel()}</span>

    <span class="section-label" style="margin-top:8px">Definições</span>
    <div class="card settings">
      <div class="set-row">
        <div class="set-text"><span class="set-title">Focar WO após «+»</span><span class="set-sub">Abre o campo da WO logo a seguir a cada registo</span></div>
        <button class="switch" type="button" role="switch" data-pref="focusWoOnAdd" aria-checked="${S.prefs.focusWoOnAdd}" aria-label="Focar WO após +"></button>
      </div>
      <div class="set-row">
        <div class="set-text"><span class="set-title">Separador do CSV</span><span class="set-sub">«;» para Excel em português</span></div>
        <div class="mini-seg">
          <button type="button" data-sep=";" aria-pressed="${sep === ';'}" aria-label="Ponto e vírgula">;</button>
          <button type="button" data-sep="," aria-pressed="${sep === ','}" aria-label="Vírgula">,</button>
        </div>
      </div>
    </div>

    <span class="section-label" style="margin-top:8px">Cópia de segurança</span>
    <span class="note" style="margin-top:-4px">Os dados ficam só neste telemóvel. Guarde uma cópia de vez em quando (por exemplo, no fim do mês) para não perder nada se trocar de telemóvel.</span>
    <div class="btn-pair">
      <button class="btn-sec" type="button" data-backup>Guardar cópia</button>
      <button class="btn-sec" type="button" data-restore>Restaurar cópia</button>
    </div>
    <span class="note" style="font-size:13px">${live().length} serviços registados no total.</span>
  </div>`;
}

/* ================= Render ================= */
function render() {
  const el = document.getElementById('screen');
  const scroll = el.scrollTop;
  el.innerHTML = ({ registo: renderRegisto, calendario: renderCalendario, painel: renderPainel, exportar: renderExportar })[S.screen]();
  el.scrollTop = scroll;
  document.querySelectorAll('.nav-item').forEach(b => {
    if (b.dataset.go === S.screen) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

/* ================= Eventos (delegação) ================= */
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  const ds = t.dataset;
  if (ds.go) { go(ds.go); return; }
  if (ds.inc) { addService(ds.inc); return; }
  if (ds.dec) { removeLast(ds.dec); return; }
  if (ds.paste) { pasteWO(ds.paste); return; }
  if (ds.del) { removeService(S.items.find(r => r.id === ds.del)); return; }
  if (ds.acc) { S.openAccordion = S.openAccordion === ds.acc ? null : ds.acc; render(); return; }
  if (ds.shift) { const d = parse(S.selectedDate); d.setDate(d.getDate() + Number(ds.shift)); setDate(iso(d)); render(); return; }
  if ('today' in ds) { setDate(S.today); render(); return; }
  if (ds.calm) { S.calendarMonth = addMonth(S.calendarMonth, Number(ds.calm)); render(); return; }
  if (ds.day) { setDate(ds.day); go('registo'); return; }
  if (ds.dashm) { S.dashboardMonth = addMonth(S.dashboardMonth, Number(ds.dashm)); S.chartDay = null; render(); return; }
  if (ds.bar) { const n = Number(ds.bar); S.chartDay = S.chartDay === n ? null : n; render(); return; }
  if (ds.range) { S.exportRange = ds.range; render(); return; }
  if ('export' in ds) { doExport(); return; }
  if (ds.pref) { S.prefs[ds.pref] = !S.prefs[ds.pref]; savePrefs(); render(); return; }
  if (ds.sep) { S.prefs.csvSeparator = ds.sep; savePrefs(); render(); return; }
  if ('backup' in ds) { doBackup(); return; }
  if ('restore' in ds) { document.getElementById('restoreInput').click(); return; }
});

document.addEventListener('input', e => {
  if (e.target.classList.contains('wo-input')) {
    const el = e.target;
    const start = el.selectionStart, end = el.selectionEnd;
    const up = el.value.toUpperCase();
    if (up !== el.value) { el.value = up; try { el.setSelectionRange(start, end); } catch (_) {} }
    setWO(el.dataset.id, up);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList.contains('wo-input')) e.target.blur();
});
// Painel: passar o rato mostra o dia (computador); no telemóvel, tocar.
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const b = e.target.closest('[data-bar]');
  if (!b || S.screen !== 'painel') return;
  const n = Number(b.dataset.bar);
  if (S.chartDay !== n) { S.chartDay = n; render(); }
});

document.getElementById('restoreInput').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) doRestore(f);
  e.target.value = '';
});

/* Mudança de dia (app aberta à meia-noite) e gravação ao sair */
function checkToday() {
  const t = today();
  if (t !== S.today) {
    const wasToday = S.selectedDate === S.today;
    S.today = t;
    if (wasToday) setDate(t);
    render();
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushWO();
  else { checkToday(); requestWakeLock(); }
});
window.addEventListener('pagehide', flushWO);
setInterval(checkToday, 60 * 1000);

/* Manter o ecrã aceso enquanto a app está aberta */
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
}

/* ================= Arranque ================= */
(async function init() {
  await Store.open();
  try { S.items = await Store.all(); } catch (e) { S.items = []; }
  render();
  requestWakeLock();
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(() => {}); }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Quando chega uma versão nova da app, recarrega uma vez para a mostrar logo
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true; flushWO(); location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
})();
