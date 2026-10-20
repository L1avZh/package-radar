// Minimal MIME helpers shared by the Gmail API reader and the .eml importer.
// Everything here works on strings/bytes only; no DOM, no network.

/** Decode a byte array in the given charset, falling back to UTF-8. */
export function decodeBytes(bytes, charset = 'utf-8') {
  const cs = (charset || 'utf-8').toLowerCase().replace(/^"|"$/g, '');
  try {
    return new TextDecoder(cs === 'iso-8859-8-i' ? 'iso-8859-8' : cs, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function base64ToBytes(b64) {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/=]/g, '');
  const padded = norm + '==='.slice((norm.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function quotedPrintableToBytes(s) {
  const src = s.replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '=' && /^[0-9A-F]{2}$/i.test(src.slice(i + 1, i + 3))) {
      out.push(parseInt(src.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const code = src.charCodeAt(i);
      if (code < 128) out.push(code);
      else for (const b of new TextEncoder().encode(ch)) out.push(b);
    }
  }
  return new Uint8Array(out);
}

/** RFC 2047 encoded-words in headers: =?utf-8?B?...?= / =?utf-8?Q?...?= */
export function decodeHeader(value) {
  if (!value) return '';
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (all, cs, enc, data) => {
      try {
        const bytes = enc.toLowerCase() === 'b'
          ? base64ToBytes(data)
          : quotedPrintableToBytes(data.replace(/_/g, ' '));
        return decodeBytes(bytes, cs);
      } catch {
        return all;
      }
    });
}

function splitHeadersBody(raw) {
  const m = /\r?\n\r?\n/.exec(raw);
  if (!m) return [raw, ''];
  return [raw.slice(0, m.index), raw.slice(m.index + m[0].length)];
}

export function parseHeaders(block) {
  const headers = {};
  const unfolded = block.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (!(k in headers)) headers[k] = v;
  }
  return headers;
}

function param(headerValue, name) {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i');
  const m = re.exec(headerValue || '');
  return m ? (m[2] ?? m[1]) : '';
}

function decodeBody(body, headers) {
  const enc = (headers['content-transfer-encoding'] || '').toLowerCase();
  const charset = param(headers['content-type'], 'charset') || 'utf-8';
  let bytes;
  if (enc === 'base64') bytes = base64ToBytes(body);
  else if (enc === 'quoted-printable') bytes = quotedPrintableToBytes(body);
  else bytes = Uint8Array.from(body, (c) => c.charCodeAt(0) & 0xff);
  return decodeBytes(bytes, charset);
}

/** Walk a MIME tree, collecting the first text/plain and text/html bodies. */
function walk(raw, out, depth = 0) {
  if (depth > 8) return;
  const [headBlock, body] = splitHeadersBody(raw);
  const headers = parseHeaders(headBlock);
  const type = (headers['content-type'] || 'text/plain').toLowerCase();
  if (type.startsWith('multipart/')) {
    const boundary = param(headers['content-type'], 'boundary');
    if (!boundary) return;
    const parts = body.split(new RegExp(`\\r?\\n?--${escapeRe(boundary)}(?:--)?[ \\t]*\\r?\\n?`));
    for (const p of parts) if (p.trim()) walk(p, out, depth + 1);
    return;
  }
  if (/attachment/i.test(headers['content-disposition'] || '')) return;
  if (type.startsWith('text/plain') && !out.text) out.text = decodeBody(body, headers);
  else if (type.startsWith('text/html') && !out.html) out.html = decodeBody(body, headers);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse a raw .eml file (as a binary string: one char per byte).
 * @returns {{id:string, from:string, subject:string, date:number, text:string, html:string, link:string}}
 */
export function parseEml(raw, id = '') {
  const [headBlock] = splitHeadersBody(raw);
  const h = parseHeaders(headBlock);
  const out = { text: '', html: '' };
  walk(raw, out);
  const date = Date.parse(h.date || '') || 0;
  return {
    id: id || h['message-id'] || `eml-${date}-${(h.subject || '').length}`,
    from: decodeHeader(h.from || ''),
    subject: decodeHeader(h.subject || ''),
    date,
    text: out.text,
    html: out.html,
    link: '',
  };
}

/**
 * Convert a Gmail API "full" message into the RawMessage shape.
 * @param {any} msg Gmail users.messages.get?format=full response
 * @param {string} account the signed-in address, for the "open in Gmail" link
 */
export function fromGmailApi(msg, account = '') {
  const headers = {};
  for (const hd of msg.payload?.headers || []) {
    const k = hd.name.toLowerCase();
    if (!(k in headers)) headers[k] = hd.value;
  }
  const out = { text: '', html: '' };
  const visit = (part, depth = 0) => {
    if (!part || depth > 8) return;
    const type = (part.mimeType || '').toLowerCase();
    if (part.filename) return;
    if (part.body?.data) {
      const charset = /charset="?([^";]+)/i.exec(
        (part.headers || []).find((x) => x.name.toLowerCase() === 'content-type')?.value || '',
      )?.[1] || 'utf-8';
      const decoded = decodeBytes(base64ToBytes(part.body.data), charset);
      if (type === 'text/plain' && !out.text) out.text = decoded;
      if (type === 'text/html' && !out.html) out.html = decoded;
    }
    for (const p of part.parts || []) visit(p, depth + 1);
  };
  visit(msg.payload);
  const authuser = account ? `?authuser=${encodeURIComponent(account)}` : '';
  return {
    id: msg.id,
    from: headers.from || '',
    subject: headers.subject || '',
    date: Number(msg.internalDate) || Date.parse(headers.date || '') || 0,
    text: out.text,
    html: out.html,
    link: `https://mail.google.com/mail/${authuser}#all/${encodeURIComponent(msg.id)}`,
  };
}
