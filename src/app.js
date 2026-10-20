import { GOOGLE_CLIENT_ID, REPO_URL } from './config.js';
import { buildPackages, gmailQuery, STATUS } from './parser.js';
import { findTrackingNumbers, trackingUrl, carrierById, UNIVERSAL_TRACKER } from './carriers.js';
import { parseEml } from './mime.js';
import * as gmail from './gmail.js';
import { store } from './store.js';
import { iconFor, iconSvg } from './icons.js';
import { demoPackages } from './demo.js';

const $ = (id) => document.getElementById(id);
const MAX_EML_BYTES = 15 * 1024 * 1024;

const state = {
  settings: store.getSettings(),
  scanned: store.getScanned(),
  imported: store.getImported(),
  manual: store.getManual(),
  received: store.getReceived(),
  hidden: store.getHidden(),
  demo: false,
  demoReceived: {},
  view: location.hash === '#got' ? 'got' : 'way',
  busy: false,
};

// ---------------------------------------------------------------------------
// Helpers

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Only ever link to https URLs; anything else from an email is dropped. */
function safeHttps(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function link(cls, href, text) {
  const a = el('a', cls, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function clientId() {
  return (state.settings.clientId || GOOGLE_CLIENT_ID || '').trim();
}

function setStatus(text, isError = false) {
  const s = $('status');
  s.textContent = text;
  s.classList.toggle('err', isError);
}

function saveSettings() {
  store.setSettings(state.settings);
}

function rank(p) {
  return STATUS[p.status] || 0;
}

/** Combine every source, drop hidden ones, keep the most advanced copy of duplicates. */
function allPackages() {
  if (state.demo) return demoPackages();
  const byKey = new Map();
  for (const p of [...state.scanned, ...state.imported, ...state.manual]) {
    if (state.hidden[p.key]) continue;
    const prev = byKey.get(p.key);
    if (!prev || rank(p) > rank(prev) || (rank(p) === rank(prev) && p.date > prev.date)) byKey.set(p.key, p);
  }
  return [...byKey.values()].sort((a, b) => b.date - a.date);
}

function receivedMap() {
  return state.demo ? state.demoReceived : state.received;
}

// ---------------------------------------------------------------------------
// Rendering

const CHIP = {
  ordered: ['עוד לא נשלחה', 'wait'],
  shipped: ['בדרך', 'go'],
  out: ['יצאה לחלוקה', 'go'],
  pickup: ['מחכה לאיסוף', 'info'],
  delivered: ['נמסרה', 'go'],
};

function card(p) {
  const got = !!receivedMap()[p.key];
  const c = el('article', 'pkg' + (got ? ' is-got' : ''));

  const head = el('div', 'head');
  const thumb = el('div', 'thumb');
  thumb.appendChild(iconSvg(iconFor(`${p.item} ${p.store}`)));
  head.appendChild(thumb);

  const name = el('div', 'name');
  name.appendChild(el('h3', null, p.item));
  const meta = [p.store];
  if (p.eta && !got && p.status !== 'delivered') meta.push(`צפי: \u2066${p.eta}\u2069`);
  if (p.manual) meta.push('נוסף ידנית');
  const metaEl = el('div', 'meta');
  meta.filter(Boolean).forEach((part, i) => {
    if (i) metaEl.appendChild(document.createTextNode(' · '));
    metaEl.appendChild(el('span', 'nw', part));
  });
  name.appendChild(metaEl);
  head.appendChild(name);

  const [label, tone] = got ? ['התקבלה ✓', 'go'] : CHIP[p.status] || CHIP.shipped;
  head.appendChild(el('span', `chip ${tone}`, label));
  c.appendChild(head);

  if (p.pickup && !got) c.appendChild(el('div', 'pickup', `איסוף: ${p.pickup}`));

  const row = el('div', 'row');
  const copyValue = p.trackingNumber || p.orderNumber;
  if (copyValue) {
    const label = p.trackingNumber ? `${p.carrierName || 'מעקב'} ${p.trackingNumber}` : `הזמנה ${p.orderNumber}`;
    row.appendChild(el('span', 'num', label));
    const cp = el('button', 'ico', 'העתק');
    cp.type = 'button';
    cp.setAttribute('aria-label', `העתקת ${copyValue}`);
    cp.addEventListener('click', () => copy(copyValue, cp));
    row.appendChild(cp);
  }

  const btns = el('div', 'btns');
  const track = safeHttps(p.trackingUrl);
  if (track && !got) btns.appendChild(link('btn primary', track, 'מעקב'));
  const mail = safeHttps(p.sources?.[0]?.link || '');
  if (mail && mail.startsWith('https://mail.google.com/')) btns.appendChild(link('btn', mail, 'מייל'));

  const toggle = el('button', got ? 'btn' : 'btn got', got ? 'החזר לבדרך' : 'קיבלתי ✓');
  toggle.type = 'button';
  toggle.addEventListener('click', () => toggleReceived(p.key));
  btns.appendChild(toggle);

  if (!state.demo) {
    const rm = el('button', 'ico', 'הסר');
    rm.type = 'button';
    rm.setAttribute('aria-label', `הסרת ${p.item} מהרשימה`);
    rm.addEventListener('click', () => removePackage(p));
    btns.appendChild(rm);
  }
  row.appendChild(btns);
  c.appendChild(row);
  return c;
}

function emptyState(view, total) {
  const box = el('div', 'empty');
  if (view === 'got') {
    box.appendChild(el('strong', null, 'עוד לא סימנת חבילות'));
    box.appendChild(el('span', null, 'לחיצה על "קיבלתי ✓" בכרטיס מעבירה את החבילה לכאן.'));
  } else if (total) {
    box.appendChild(el('strong', null, 'הכל הגיע'));
    box.appendChild(el('span', null, 'אין כרגע חבילות בדרך.'));
  } else {
    box.appendChild(el('strong', null, 'עוד אין כאן חבילות'));
    box.appendChild(el('span', null, 'חברו את Gmail, ייבאו קובצי ‎.eml או הוסיפו חבילה ידנית. רוצים לראות איך זה נראה? נסו את נתוני הדוגמה.'));
  }
  return box;
}

function render() {
  const pkgs = allPackages();
  const rec = receivedMap();
  const way = pkgs.filter((p) => !rec[p.key]);
  const got = pkgs.filter((p) => rec[p.key]);
  $('n-way').textContent = way.length;
  $('n-got').textContent = got.length;
  for (const v of ['way', 'got']) $(`tab-${v}`).setAttribute('aria-selected', String(v === state.view));

  const list = $('list');
  list.textContent = '';
  const items = state.view === 'way' ? way : got;
  if (!items.length) list.appendChild(emptyState(state.view, pkgs.length));
  else for (const p of items) list.appendChild(card(p));

  $('demo-bar').hidden = !state.demo;
  const connected = gmail.isConnected();
  $('btn-disconnect').hidden = !connected;
  const btn = $('btn-connect');
  btn.disabled = state.busy || !clientId();
  btn.textContent = connected ? 'סריקה מחדש' : 'חיבור Gmail וסריקה';
  $('connect-hint').textContent = !clientId()
    ? 'חיבור Gmail עוד לא הוגדר באתר הזה. בינתיים אפשר לייבא קובצי ‎.eml או להוסיף חבילה ידנית.'
    : connected
      ? `מחובר כ‑${gmail.connectedAccount()} · קריאה בלבד`
      : 'Google תבקש אישור לקריאה בלבד. המיילים נסרקים בדפדפן הזה ולא נשלחים לשום מקום.';
}

// ---------------------------------------------------------------------------
// Actions

async function copy(value, btn) {
  try {
    await navigator.clipboard.writeText(value);
    btn.textContent = 'הועתק';
  } catch {
    btn.textContent = 'לא הועתק';
  }
  setTimeout(() => { btn.textContent = 'העתק'; }, 1400);
}

function toggleReceived(key) {
  const map = receivedMap();
  if (map[key]) delete map[key];
  else map[key] = true;
  if (!state.demo) store.setReceived(state.received);
  render();
}

function removePackage(p) {
  if (p.manual) {
    state.manual = state.manual.filter((m) => m.key !== p.key);
    store.setManual(state.manual);
  } else {
    state.hidden[p.key] = true;
    store.setHidden(state.hidden);
  }
  setStatus(`"${p.item}" הוסרה מהרשימה.`);
  render();
}

const ERRORS = {
  no_client_id: 'חיבור Gmail לא הוגדר באתר הזה.',
  gis_load_failed: 'לא הצלחתי לטעון את חלון ההתחברות של Google. בדקו את החיבור לאינטרנט או חוסם פרסומות.',
  popup_closed: 'חלון ההתחברות נסגר לפני שהחיבור הושלם.',
  popup_failed_to_open: 'הדפדפן חסם את חלון ההתחברות. אפשרו חלונות קופצים לאתר הזה ונסו שוב.',
  popup_failed: 'חלון ההתחברות לא נפתח. אפשרו חלונות קופצים לאתר הזה ונסו שוב.',
  access_denied: 'לא ניתנה הרשאה לקריאת המייל.',
  scope_denied: 'צריך לאשר קריאת מיילים כדי לסרוק. נסו שוב וסמנו את ההרשאה.',
  expired: 'החיבור ל‑Gmail פג. לחצו שוב כדי להתחבר.',
  gmail_403: 'Google חסמה את הגישה. ייתכן שהחשבון לא נוסף כמשתמש בדיקה של האפליקציה.',
  gmail_busy: 'Gmail עמוס כרגע. נסו שוב בעוד דקה.',
};

async function scanGmail() {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    if (!gmail.isConnected()) {
      setStatus('ממתין לאישור ב‑Google…');
      await gmail.connect(clientId());
    }
    setStatus('מחפש מיילים של הזמנות ומשלוחים…');
    const messages = await gmail.fetchMessages({
      query: gmailQuery(state.settings.days),
      onProgress: (done, total) => setStatus(total ? `סורק ${done} מתוך ${total} מיילים…` : 'לא נמצאו מיילים מתאימים.'),
    });
    const pkgs = buildPackages(messages);
    state.scanned = pkgs;
    state.demo = false;
    store.setScanned(pkgs);
    state.settings.lastScan = Date.now();
    saveSettings();
    setStatus(`${countLabel(pkgs.length)} ב‑${messages.length} מיילים מ${rangeLabel()} האחרונים.`);
  } catch (e) {
    setStatus(ERRORS[e.message] || 'משהו השתבש בסריקה. נסו שוב.', true);
  } finally {
    state.busy = false;
    render();
  }
}

function countLabel(n) {
  if (n === 0) return 'לא נמצאו חבילות';
  return n === 1 ? 'נמצאה חבילה אחת' : `נמצאו ${n} חבילות`;
}

function rangeLabel() {
  return { 7: 'השבוע', 14: 'השבועיים', 30: 'החודש', 60: 'החודשיים' }[state.settings.days] || 'הימים';
}

function readFileBinary(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const bytes = new Uint8Array(r.result);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      resolve(s);
    };
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

async function importFiles(files) {
  const list = [...files].filter((f) => /\.eml$/i.test(f.name) || f.type === 'message/rfc822');
  if (!list.length) {
    setStatus('אפשר לייבא רק קובצי ‎.eml.', true);
    return;
  }
  const messages = [];
  let skipped = 0;
  for (const f of list) {
    if (f.size > MAX_EML_BYTES) { skipped++; continue; }
    try {
      messages.push(parseEml(await readFileBinary(f), `eml:${f.name}:${f.size}`));
    } catch {
      skipped++;
    }
  }
  const found = buildPackages(messages);
  const byKey = new Map(state.imported.map((p) => [p.key, p]));
  for (const p of found) byKey.set(p.key, p);
  state.imported = [...byKey.values()];
  store.setImported(state.imported);
  state.demo = false;
  const note = skipped ? ` (${skipped} קבצים לא נקראו)` : '';
  setStatus(found.length
    ? `${countLabel(found.length)} ${messages.length === 1 ? 'בקובץ אחד' : `ב‑${messages.length} קבצים`}${note}.`
    : `לא נמצאו פרטי משלוח בקבצים${note}. אפשר להוסיף את החבילה ידנית.`, !found.length);
  render();
}

function openAdd() {
  $('add-form').reset();
  $('add-dialog').showModal();
  $('f-item').focus();
}

function saveManual(e) {
  e.preventDefault();
  const item = $('f-item').value.trim();
  if (!item) { $('f-item').focus(); return; }
  const tracking = $('f-tracking').value.trim().toUpperCase().replace(/\s+/g, '');
  const found = tracking ? findTrackingNumbers(tracking)[0] : null;
  const carrier = found?.carrier || '';
  const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  const p = {
    key: `manual:${id}`,
    manual: true,
    item,
    store: $('f-store').value.trim(),
    status: tracking ? 'shipped' : 'ordered',
    carrier,
    carrierName: carrier ? carrierById(carrier)?.name || '' : '',
    trackingNumber: tracking,
    trackingUrl: tracking ? (carrier ? trackingUrl(carrier, tracking) : UNIVERSAL_TRACKER(tracking)) : '',
    orderNumber: $('f-order').value.trim(),
    eta: $('f-eta').value.trim(),
    pickup: '',
    date: Date.now(),
    firstDate: Date.now(),
    sources: [],
  };
  state.manual.push(p);
  store.setManual(state.manual);
  state.demo = false;
  state.view = 'way';
  $('add-dialog').close();
  setStatus(`"${item}" נוספה.`);
  render();
}

// ---------------------------------------------------------------------------
// Wiring

function init() {
  $('repo-link').href = REPO_URL;
  $('days').value = String(state.settings.days || 14);
  $('client-id').value = state.settings.clientId || '';

  $('btn-connect').addEventListener('click', scanGmail);
  $('days').addEventListener('change', (e) => { state.settings.days = Number(e.target.value) || 14; saveSettings(); });
  $('eml-input').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
  $('btn-add').addEventListener('click', openAdd);
  $('add-form').addEventListener('submit', saveManual);
  $('add-cancel').addEventListener('click', () => $('add-dialog').close());
  $('btn-demo').addEventListener('click', () => { state.demo = true; state.demoReceived = {}; state.view = 'way'; setStatus(''); render(); });
  $('btn-exit-demo').addEventListener('click', () => { state.demo = false; render(); });
  $('btn-disconnect').addEventListener('click', () => { gmail.disconnect(); setStatus('Gmail נותק והאישור בוטל.'); render(); });
  $('btn-clear').addEventListener('click', clearAll);
  $('client-id').addEventListener('change', (e) => {
    const v = e.target.value.trim();
    state.settings.clientId = /^[\w.-]+\.apps\.googleusercontent\.com$/.test(v) ? v : '';
    if (v && !state.settings.clientId) setStatus('ה‑Client ID לא נראה תקין. הוא אמור להסתיים ב‑.apps.googleusercontent.com', true);
    saveSettings();
    render();
  });
  for (const t of document.querySelectorAll('.tab')) {
    t.addEventListener('click', () => { state.view = t.dataset.view; render(); });
  }

  // Drag & drop .eml files anywhere on the page.
  let depth = 0;
  const drop = $('drop');
  document.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; drop.hidden = false; } });
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.hidden = true; } });
  document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    drop.hidden = true;
    importFiles(e.dataTransfer.files);
  });

  if (state.settings.lastScan) {
    const when = new Date(state.settings.lastScan).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
    setStatus(`סריקה אחרונה: ${when}. לחצו "חיבור Gmail וסריקה" כדי לעדכן.`);
  }
  render();
}

let clearArmed = false;
function clearAll() {
  // Two-step confirmation inside the page (no confirm() dialogs).
  const btn = $('btn-clear');
  if (!clearArmed) {
    clearArmed = true;
    btn.textContent = 'לחצו שוב כדי למחוק הכל';
    setTimeout(() => { clearArmed = false; btn.textContent = 'מחיקת כל הנתונים מהמכשיר'; }, 4000);
    return;
  }
  clearArmed = false;
  gmail.disconnect();
  store.clearAll();
  Object.assign(state, {
    settings: store.getSettings(), scanned: [], imported: [], manual: [], received: {}, hidden: {}, demo: false,
  });
  btn.textContent = 'מחיקת כל הנתונים מהמכשיר';
  $('days').value = String(state.settings.days);
  $('client-id').value = '';
  setStatus('כל הנתונים נמחקו מהמכשיר הזה.');
  render();
}

function hasFiles(e) {
  return [...(e.dataTransfer?.types || [])].includes('Files');
}

init();
