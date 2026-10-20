// Turns shipping/order emails into package records. Pure functions only (no DOM, no
// network) so the same code runs in the browser and in the unit tests.

import { findTrackingNumbers, trackingUrl, carrierById } from './carriers.js';

/** Status ladder. Higher = further along. */
export const STATUS = Object.freeze({
  ordered: 1,
  shipped: 2,
  pickup: 3,
  out: 3,
  delivered: 4,
});

export const STATUS_LABEL = Object.freeze({
  ordered: 'הוזמנה',
  shipped: 'בדרך',
  out: 'יצאה לחלוקה',
  pickup: 'מחכה לאיסוף',
  delivered: 'נמסרה',
});

// Senders that send receipts but never parcels (food delivery, ride hailing, etc.).
const NOT_PARCELS = /(wolt\.com|10bis|uber(eats)?\.com|cibus|gett\.com|yango|bolt\.eu|spotify|netflix|apple\.com\/bill)/i;
// Marketing senders that talk about shipping without being about a real order.
const MARKETING = /(store-news@|newsletter|marketing@|promo|deals@|offers@|news@)/i;

const STORES = [
  [/amazon\./i, 'Amazon'],
  [/aliexpress/i, 'AliExpress'],
  [/goat\.com/i, 'GOAT'],
  [/ebay\./i, 'eBay'],
  [/shein/i, 'SHEIN'],
  [/temu/i, 'Temu'],
  [/iherb/i, 'iHerb'],
  [/asos/i, 'ASOS'],
  [/nike\./i, 'Nike'],
  [/zara\./i, 'Zara'],
  [/next\.co/i, 'NEXT'],
  [/terminalx/i, 'Terminal X'],
  [/ksp\.co\.il/i, 'KSP'],
  [/ivory\.co\.il/i, 'Ivory'],
  [/bug\.co\.il/i, 'BUG'],
  [/dynamica\.co\.il/i, 'דינמיקה'],
  [/apple\.com/i, 'Apple'],
];

const CARRIER_SENDERS = /(dhl\.|aramex|ups\.com|fedex|usps|israelpost|bar-ltd|cheetah|hfd\.co\.il|dpd|17track|cainiao)/i;

// ---------------------------------------------------------------------------
// Text helpers

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+|#39);/gi, (all, e) => {
    const k = e.toLowerCase();
    if (k in ENTITIES) return ENTITIES[k];
    if (k.startsWith('#x')) return safeChar(parseInt(k.slice(2), 16), all);
    if (k.startsWith('#')) return safeChar(parseInt(k.slice(1), 10), all);
    return all;
  });
}

function safeChar(code, fallback) {
  try { return Number.isFinite(code) ? String.fromCodePoint(code) : fallback; } catch { return fallback; }
}

/** Crude but safe HTML → text. The output is only ever used as text, never as HTML. */
export function htmlToText(html) {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h\d|table|td)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[͏​-‏‪-‮⁠﻿­]/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function clean(s, max = 90) {
  if (!s) return '';
  let t = s.replace(/\s+/g, ' ').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').trim();
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + '…';
  return t;
}

// ---------------------------------------------------------------------------
// Field extractors

export function detectStore(from, subject, text) {
  const globalE = /-\s*([^-]+?)\s+by Global-e/i.exec(subject) || /shopping at ([A-Z][\w&' ]{1,30})\./.exec(text);
  if (globalE) return clean(globalE[1], 40);
  for (const [re, name] of STORES) if (re.test(from)) return name;
  const shipper = /(?:מ-|from\s)\s*([A-Z][A-Z0-9&' ]{2,30})\b/.exec(text);
  if (CARRIER_SENDERS.test(from) && shipper) {
    const n = shipper[1].trim();
    return n === 'AMZON' ? 'Amazon' : titleCase(n);
  }
  const display = /^\s*"?([^"<@]+?)"?\s*</.exec(from);
  if (display && !/no.?reply|do.?not.?reply/i.test(display[1])) return clean(display[1], 40);
  const domain = /@([^>\s]+)/.exec(from);
  return domain ? domain[1].replace(/^(mail|email|e|info|notify|notifications)\./, '').split('.')[0] : '';
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function detectStatus(subject, text) {
  const s = subject || '';
  const tests = [
    ['delivered', /\b(has been |was )?delivered\b|נמסר(ה)?\b|הגיע(ה)? ליעד/i],
    ['pickup', /ready for pick-?up|ready to collect|מוכנ(ה)? לאיסוף|ממתינ(ה)? לאיסוף|בחרת לאסוף/i],
    ['out', /out for delivery|יצא(ה)? לחלוקה|בדרך אליך היום/i],
    ['shipped', /\bshipped\b|on (its|the) way|in transit|dispatched|נשלח(ה)?|יצא(ה)? לדרך|בדרכו|בדרך (אליך|לארץ)|On Demand Delivery/i],
    ['ordered', /order (confirmed|received|placed)|thanks? (you )?for your order|\bordered\b|your .* order|אישור הזמנה|הזמנתך התקבלה|order no\.?/i],
  ];
  for (const [status, re] of tests) if (re.test(s)) return status;
  // The body often contains a progress bar listing every stage ("Ordered Shipped
  // Delivered"), so only accept explicit sentences from it.
  const body = text.slice(0, 1500);
  const bodyTests = [
    ['delivered', /(package|order|parcel|item)[^.\n]{0,40}(has been|was) (successfully )?delivered|החבילה נמסרה/i],
    ['pickup', /(is )?ready for pick-?up|מוכנה לאיסוף|בחרת לאסוף/i],
    ['shipped', /(is|has been) shipped|is on (its|the) way|נמצא כעת בדרכו|יצא לדרך|headed your way/i],
    ['ordered', /order (is )?(now )?confirmed|thank(s| you) for (your order|shopping)/i],
  ];
  for (const [status, re] of bodyTests) if (re.test(body)) return status;
  return null;
}

export function detectOrderNumber(subject, text) {
  const hay = `${subject}\n${text.slice(0, 4000)}`;
  const patterns = [
    /order\s*(?:no\.?|number|num|#)\s*[:#]?\s*\(?\s*#?\s*([A-Z0-9][A-Z0-9-]{4,24})/i,
    /order\s+#?(\d{6,20})\b/i,
    /(?:מס(?:פר|['׳])?\s*)?הזמנה\s*(?:מס(?:פר|['׳])?\s*)?[:#]?\s*(\d{5,20})/,
    /\b(\d{3}-\d{7}-\d{7})\b/, // Amazon
  ];
  for (const re of patterns) {
    const m = re.exec(hay);
    if (m && /\d/.test(m[1])) return m[1].replace(/^[-#]+|[-#]+$/g, '');
  }
  return '';
}

export function detectItem(subject, text) {
  const subjectPatterns = [
    /(?:shipped|ordered|delivered|arriving)[^:]{0,20}\d+\s+items?:\s*(.+)$/i,
    /you ordered (?:the )?(.+)$/i,
  ];
  for (const re of subjectPatterns) {
    const m = re.exec(subject);
    if (m) return clean(m[1]);
  }
  const bodyPatterns = [
    /you ordered (?:the )?([^\n]{3,90}?)(?:\n|$|\s*(?:GOAT|\())/i,
    /\n\s*([A-Z][^\n|]{6,80}?)\s+x\s?\d+\s*\|/, // AliExpress "Name ... x1 |"
    /\|\s*([A-Z][A-Za-z0-9 .,'"″\-/]{6,80}?)\s+\d{8,14}\b/, // Global-e "Name 6126... "
    /(?:item|פריט|מוצר)\s*[:]\s*([^\n]{3,80})/i,
  ];
  for (const re of bodyPatterns) {
    const m = re.exec(text);
    if (m) return clean(m[1]);
  }
  return '';
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Expected arrival as a short human string (kept as text: carriers mix formats). */
export function detectEta(text) {
  const t = text.slice(0, 5000);
  let m = /Arriving\s+((?:[A-Z][a-z]+\s+\d{1,2})(?:\s*[-–]\s*(?:[A-Z][a-z]+\s+)?\d{1,2})?)/.exec(t);
  if (m) return formatMonthDay(m[1]);
  m = /[Ee]stimated (?:[Dd]elivery|[Aa]rrival)[^\n|]{0,30}?(\d{1,2}(?:st|nd|rd|th)? of (?:January|February|March|April|May|June|July|August|September|October|November|December)|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2})/.exec(t);
  if (m) return formatMonthDay(m[1]);
  m = /(?:צפי|תאריך אספקה|מועד אספקה|תגיע עד)[^\d\n]{0,15}(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/.exec(t);
  if (m) return m[1].replace(/\//g, '.').replace(/\.(\d{4}|\d{2})$/, '');
  return '';
}

function formatMonthDay(s) {
  // "October 27 - November 5" → "27.10–5.11"; "27th of October" → "27.10"
  const parts = s.split(/\s*[-–]\s*/);
  let lastMonth = null;
  const out = parts.map((p) => {
    let mm = /([A-Za-z]+)\s+(\d{1,2})/.exec(p);
    let day, mon;
    if (mm) { mon = MONTHS[mm[1].slice(0, 3).toLowerCase()]; day = +mm[2]; }
    else if ((mm = /(\d{1,2})(?:st|nd|rd|th)? of ([A-Za-z]+)/.exec(p))) { day = +mm[1]; mon = MONTHS[mm[2].slice(0, 3).toLowerCase()]; }
    else if ((mm = /^(\d{1,2})$/.exec(p.trim())) && lastMonth != null) { day = +mm[1]; mon = lastMonth; }
    if (mon == null || !day) return null;
    lastMonth = mon;
    return `${day}.${mon + 1}`;
  }).filter(Boolean);
  return out.join('–');
}

export function detectPickup(text) {
  const m = /(?:לאסוף[^\n]{0,40}?מ|pick ?up (?:point|location)[:\s]+)([^\n]{3,40}?)\s+בכתובת\s+([^\n]{3,60}?)(?:\s+לפרטים|\.|\n|$)/i.exec(text);
  if (m) return clean(`${m[1]}, ${m[2]}`, 80);
  return '';
}

// ---------------------------------------------------------------------------
// Main entry points

/**
 * @typedef {{id:string, from:string, subject:string, date:number, text?:string, html?:string, link?:string}} RawMessage
 * @typedef {{key:string, store:string, item:string, status:string|null, carrier:string, trackingNumber:string,
 *   trackingUrl:string, orderNumber:string, eta:string, pickup:string, date:number, firstDate:number,
 *   sources:{id:string, link:string, subject:string}[]}} Package
 */

/** Parse one email. Returns a package fragment, or null if the email is not about a parcel. */
export function parseMessage(msg) {
  const from = msg.from || '';
  const subject = decodeEntities(msg.subject || '');
  if (NOT_PARCELS.test(from)) return null;
  const text = msg.text && msg.text.trim() ? msg.text : htmlToText(msg.html || '');

  const tracking = findTrackingNumbers(`${subject}\n${text}`);
  const status = detectStatus(subject, text);
  const orderNumber = detectOrderNumber(subject, text);
  const fromCarrier = CARRIER_SENDERS.test(from);

  // Confidence gate: a parcel email needs a status plus something identifying.
  if (!status && !tracking.length) return null;
  if (!tracking.length && !orderNumber) return null;
  if (MARKETING.test(from) && !tracking.length && !orderNumber) return null;
  if (!tracking.length && !fromCarrier && status === null) return null;

  const t = tracking[0];
  return {
    store: detectStore(from, subject, text),
    item: detectItem(subject, text),
    status: status || (t ? 'shipped' : 'ordered'),
    carrier: t ? t.carrier : '',
    trackingNumber: t ? t.number : '',
    trackingUrl: t ? trackingUrl(t.carrier, t.number) : '',
    orderNumber,
    eta: detectEta(text),
    pickup: detectPickup(text),
    date: msg.date || 0,
    source: { id: msg.id, link: msg.link || '', subject },
  };
}

/** Parse many emails and merge fragments that describe the same package. */
export function buildPackages(messages) {
  const frags = messages
    .map(parseMessage)
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);

  /** @type {Package[]} */
  const pkgs = [];
  for (const f of frags) {
    const match = pkgs.find((p) => sameShipment(p, f));
    if (match) mergeInto(match, f);
    else pkgs.push(newPackage(f));
  }
  linkCarrierNotices(pkgs);
  return pkgs
    .map(finalize)
    .sort((a, b) => b.date - a.date);
}

function sameShipment(p, f) {
  if (f.trackingNumber && p.trackingNumber === f.trackingNumber) return true;
  if (f.orderNumber && p.orderNumber === f.orderNumber) {
    // An order can ship in several parcels: different tracking numbers = different packages.
    return !(f.trackingNumber && p.trackingNumber && p.trackingNumber !== f.trackingNumber);
  }
  if (f.orderNumber && p.orderNumber && f.orderNumber !== p.orderNumber) return false;
  return false;
}

function newPackage(f) {
  return {
    key: '',
    store: f.store,
    item: f.item,
    status: f.status,
    carrier: f.carrier,
    trackingNumber: f.trackingNumber,
    trackingUrl: f.trackingUrl,
    orderNumber: f.orderNumber,
    eta: f.eta,
    pickup: f.pickup,
    date: f.date,
    firstDate: f.date,
    sources: [f.source],
  };
}

function mergeInto(p, f) {
  // Later emails win, except a status never moves backwards.
  if (!p.status || STATUS[f.status] >= STATUS[p.status]) p.status = f.status;
  for (const k of ['item', 'carrier', 'trackingNumber', 'trackingUrl', 'orderNumber', 'eta', 'pickup']) {
    if (f[k] && (!p[k] || k === 'eta' || k === 'pickup')) p[k] = f[k];
  }
  if (!p.store || /^(dhl|aramex|ups|fedex|bar|usps)$/i.test(p.store)) p.store = f.store || p.store;
  p.date = Math.max(p.date, f.date);
  if (!p.sources.some((s) => s.id === f.source.id)) p.sources.push(f.source);
}

/**
 * Carrier notices ("your parcel from AMZON is on its way") rarely carry the shop's order
 * number. Attach such a notice to a shop package from the same store that shipped
 * without its own tracking number, choosing the one whose shipping email is closest in time.
 */
function linkCarrierNotices(pkgs) {
  const DAY = 864e5;
  for (let i = pkgs.length - 1; i >= 0; i--) {
    const c = pkgs[i];
    if (c.orderNumber || !c.trackingNumber) continue;
    const candidates = pkgs.filter((p) => p !== c && p.orderNumber && !p.trackingNumber &&
      p.store && c.store && p.store.toLowerCase() === c.store.toLowerCase() &&
      p.status !== 'ordered' && Math.abs(p.date - c.firstDate) < 3 * DAY);
    if (!candidates.length) continue;
    candidates.sort((a, b) => Math.abs(a.date - c.firstDate) - Math.abs(b.date - c.firstDate));
    const target = candidates[0];
    const keepUrl = target.trackingUrl;
    mergeInto(target, { ...c, source: c.sources[0] });
    for (const s of c.sources.slice(1)) if (!target.sources.some((x) => x.id === s.id)) target.sources.push(s);
    if (keepUrl) target.trackingUrl = keepUrl;
    target.trackingNumber = c.trackingNumber;
    target.carrier = c.carrier;
    if (!keepUrl) target.trackingUrl = c.trackingUrl;
    pkgs.splice(i, 1);
  }
}

function finalize(p) {
  p.key = p.trackingNumber ? `t:${p.trackingNumber}` : p.orderNumber ? `o:${p.orderNumber}` : `m:${p.sources[0].id}`;
  if (!p.item) p.item = p.store ? `הזמנה מ-${p.store}` : 'חבילה';
  p.carrierName = p.carrier ? (carrierById(p.carrier)?.name || p.carrier) : '';
  return p;
}

/** Gmail search query used by the scanner. */
export function gmailQuery(days) {
  const words = [
    'shipped', 'shipment', 'tracking', 'delivered', '"out for delivery"', '"order confirmed"',
    '"your order"', 'package', 'parcel', 'משלוח', 'חבילה', 'הזמנה', '"מספר מעקב"', '"נקודת איסוף"',
  ];
  return `newer_than:${days}d (${words.join(' OR ')}) -category:social`;
}
