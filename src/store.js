// Local persistence. Everything stays in this browser's localStorage, on this device.
// Only package summaries are kept (store, item, tracking number, status), never email bodies
// and never the Google token. Every access is wrapped: storage can be blocked or full.

const PREFIX = 'package-radar:v1:';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const store = {
  /** packages found in Gmail, replaced on every scan */
  getScanned: () => read('scanned', []),
  setScanned: (list) => write('scanned', list),
  /** packages from imported .eml files, merged over time */
  getImported: () => read('imported', []),
  setImported: (list) => write('imported', list),
  /** packages typed in by hand */
  getManual: () => read('manual', []),
  setManual: (list) => write('manual', list),
  /** { [packageKey]: true } for packages the person marked as received */
  getReceived: () => read('received', {}),
  setReceived: (map) => write('received', map),
  /** { [packageKey]: true } for packages the person removed from the list */
  getHidden: () => read('hidden', {}),
  setHidden: (map) => write('hidden', map),
  getSettings: () => read('settings', { days: 14, clientId: '', lastScan: 0 }),
  setSettings: (s) => write('settings', s),
  clearAll() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
    } catch { /* nothing to clear */ }
  },
};
