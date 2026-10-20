// Carrier definitions: how to recognise a tracking number and where to track it.
// Patterns with `context` only match when the carrier's name appears near the number,
// which keeps generic digit runs (phone numbers, order ids) from being misread.

const enc = encodeURIComponent;

export const UNIVERSAL_TRACKER = (n) => `https://t.17track.net/en#nums=${enc(n)}`;

export const CARRIERS = [
  {
    id: 'ups',
    name: 'UPS',
    pattern: /\b(1Z[0-9A-Z]{16})\b/g,
    url: (n) => `https://www.ups.com/track?tracknum=${enc(n)}`,
  },
  {
    id: 'usps',
    name: 'USPS',
    pattern: /\b(9[2-5]\d{20})\b/g,
    url: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${enc(n)}`,
  },
  {
    id: 'amazon',
    name: 'Amazon Logistics',
    pattern: /\b(TBA\d{12})\b/g,
    url: (n) => UNIVERSAL_TRACKER(n),
  },
  {
    id: 'bar',
    name: 'בר הפצה',
    pattern: /\b(GWD\d{9})\b/g,
    url: (n) => UNIVERSAL_TRACKER(n),
  },
  {
    id: 'cainiao',
    name: 'Cainiao',
    pattern: /\b(LP\d{14}|CNIL\d{12,16})\b/g,
    url: (n) => `https://global.cainiao.com/newDetail.htm?mailNoList=${enc(n)}`,
  },
  {
    // UPU S10 international postal format, e.g. RR123456785IL
    id: 'post',
    name: 'דואר',
    pattern: /\b([A-Z]{2}\d{9}[A-Z]{2})\b/g,
    url: (n) => UNIVERSAL_TRACKER(n),
  },
  {
    id: 'dhl',
    name: 'DHL',
    context: /\bDHL\b/i,
    pattern: /\b(\d{10})\b/g,
    url: (n) => `https://www.dhl.com/il-he/home/tracking.html?tracking-id=${enc(n)}`,
  },
  {
    id: 'aramex',
    name: 'Aramex',
    context: /\baramex\b|ארמקס/i,
    pattern: /\b(\d{11})\b/g,
    url: (n) => `https://www.aramex.com/track/results?ShipmentNumber=${enc(n)}`,
  },
  {
    id: 'fedex',
    name: 'FedEx',
    context: /\bfedex\b/i,
    pattern: /\b(\d{12}|\d{15})\b/g,
    url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${enc(n)}`,
  },
];

const BY_ID = Object.fromEntries(CARRIERS.map((c) => [c.id, c]));

export function carrierById(id) {
  return BY_ID[id] || null;
}

export function trackingUrl(carrierId, number) {
  const c = BY_ID[carrierId];
  return c ? c.url(number) : UNIVERSAL_TRACKER(number);
}

// How far around a context word (e.g. "DHL") a number may sit and still count.
const CONTEXT_WINDOW = 160;

/**
 * Find tracking numbers in text. Returns [{carrier, number}] without duplicates.
 * @param {string} text
 */
export function findTrackingNumbers(text) {
  const found = [];
  const seen = new Set();
  const add = (carrier, number) => {
    if (seen.has(number)) return;
    seen.add(number);
    found.push({ carrier, number });
  };

  for (const c of CARRIERS) {
    if (c.context) {
      const ctx = new RegExp(c.context.source, c.context.flags.includes('g') ? c.context.flags : c.context.flags + 'g');
      let m;
      while ((m = ctx.exec(text))) {
        const start = Math.max(0, m.index - CONTEXT_WINDOW);
        const slice = text.slice(start, m.index + m[0].length + CONTEXT_WINDOW);
        for (const n of slice.matchAll(c.pattern)) {
          if (!looksLikePhone(slice, n)) add(c.id, n[1]);
        }
      }
    } else {
      for (const n of text.matchAll(c.pattern)) add(c.id, n[1]);
    }
  }

  // Explicitly labelled numbers ("Tracking number: XYZ", "מספר מעקב: XYZ")
  const labelled = /(?:tracking\s*(?:number|no\.?|#|id)|מספר\s*(?:מעקב|משלוח))\s*[:#]?\s*([A-Z0-9]{8,30})\b/gi;
  for (const m of text.matchAll(labelled)) {
    const n = m[1].toUpperCase();
    if (/\d/.test(n) && !seen.has(n)) add(guessCarrier(text) || 'unknown', n);
  }
  return found;
}

function looksLikePhone(slice, match) {
  // Israeli mobile numbers are 10 digits starting with 05 — never a DHL waybill.
  return /^05\d{8}$/.test(match[1]);
}

function guessCarrier(text) {
  for (const c of CARRIERS) {
    if (c.context && c.context.test(text)) return c.id;
  }
  return null;
}
