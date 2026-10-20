// Static security checks run in CI before every deploy. No dependencies.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const files = readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js')).map((f) => join('src', f));
const problems = [];

const ALLOWED_HOSTS = new Set([
  'gmail.googleapis.com', 'accounts.google.com', 'www.w3.org', 'mail.google.com', 'www.googleapis.com', 'github.com',
  // tracking pages opened as links (never fetched)
  't.17track.net', 'www.ups.com', 'tools.usps.com', 'global.cainiao.com', 'www.dhl.com', 'www.aramex.com', 'www.fedex.com',
]);

for (const f of files) {
  const src = readFileSync(join(root, f), 'utf8');
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  if (/\beval\s*\(|new\s+Function\s*\(|document\.write/.test(code)) problems.push(`${f}: dynamic code execution`);
  if (/\.innerHTML\s*=/.test(code) && f !== join('src', 'icons.js')) problems.push(`${f}: innerHTML outside the static icon table`);
  if (/localStorage\.setItem\([^)]*token/i.test(code)) problems.push(`${f}: token written to storage`);
  for (const m of code.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    if (!ALLOWED_HOSTS.has(m[1].toLowerCase())) problems.push(`${f}: unexpected host ${m[1]}`);
  }
  if (/fetch\(/.test(code) && f !== join('src', 'gmail.js')) problems.push(`${f}: network request outside gmail.js`);
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
if (/\son[a-z]+\s*=/i.test(html)) problems.push('index.html: inline event handler');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) problems.push('index.html: inline script');
const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] || '';
for (const need of ["default-src 'none'", "base-uri 'none'", "object-src 'none'", 'connect-src https://gmail.googleapis.com']) {
  if (!csp.includes(need)) problems.push(`index.html: CSP missing ${need}`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`security checks passed (${files.length} modules, index.html)`);
