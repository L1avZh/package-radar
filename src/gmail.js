// Gmail access, entirely from the browser.
// - Uses Google Identity Services' token model: a short-lived access token (about an hour)
//   held only in memory. No refresh token, nothing written to storage, no backend.
// - Read-only scope. The app cannot send, delete or change mail.
// - Google's script is loaded only after the person clicks "Connect", so visitors who
//   never connect never talk to Google.

import { fromGmailApi } from './mime.js';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let token = null; // { access_token, expires_at }
let account = '';
let gisLoading = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error('gis_load_failed')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

export function isConnected() {
  return !!token && Date.now() < token.expires_at - 60_000;
}

export function connectedAccount() {
  return isConnected() ? account : '';
}

/** Ask Google for a read-only token. Must be called from a click handler (popup). */
export async function connect(clientId) {
  if (!clientId) throw new Error('no_client_id');
  await loadGis();
  const resp = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => (r.error ? reject(new Error(r.error)) : resolve(r)),
      error_callback: (e) => reject(new Error(e?.type || 'popup_failed')),
    });
    client.requestAccessToken({ prompt: '' });
  });
  if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
    throw new Error('scope_denied');
  }
  token = { access_token: resp.access_token, expires_at: Date.now() + Number(resp.expires_in || 3600) * 1000 };
  const profile = await api('/profile');
  account = profile.emailAddress || '';
  return account;
}

/** Revoke the token at Google and forget it. */
export function disconnect() {
  const t = token?.access_token;
  token = null;
  account = '';
  if (t && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(t, () => {}); } catch { /* already gone */ }
  }
}

async function api(path, params = {}, signal) {
  if (!isConnected()) throw new Error('not_connected');
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else if (v != null) url.searchParams.set(k, v);
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal,
      referrerPolicy: 'no-referrer',
      credentials: 'omit',
    });
    if (res.ok) return res.json();
    if (res.status === 401) { token = null; throw new Error('expired'); }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt + Math.random() * 300));
      continue;
    }
    throw new Error(`gmail_${res.status}`);
  }
  throw new Error('gmail_busy');
}

/**
 * Search the inbox and download matching messages.
 * @param {{query:string, max?:number, signal?:AbortSignal, onProgress?:(done:number,total:number)=>void}} opts
 */
export async function fetchMessages({ query, max = 250, signal, onProgress }) {
  const ids = [];
  let pageToken;
  do {
    const page = await api('/messages', { q: query, maxResults: Math.min(100, max - ids.length), pageToken }, signal);
    for (const m of page.messages || []) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);

  const out = [];
  let done = 0;
  onProgress?.(0, ids.length);
  const queue = ids.slice();
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      const full = await api(`/messages/${encodeURIComponent(id)}`, { format: 'full' }, signal);
      out.push(fromGmailApi(full, account));
      onProgress?.(++done, ids.length);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return out;
}
