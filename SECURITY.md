# Security

## Threat model

Package Radar is a static site. Its job is to read a person's mail without anyone else being able to: not the site owner, not GitHub, not other sites.

| Asset | Protection |
|---|---|
| Gmail access token | Google Identity Services token model. Read-only scope (`gmail.readonly`). Held in a JS variable only, never written to storage, URL or logs. Expires after ~1 hour; "ניתוק" revokes it at Google. No refresh token exists. |
| Email content | Fetched directly from `gmail.googleapis.com` to the browser and parsed in memory. Never sent anywhere else, never stored. |
| Package summaries | Stored in the browser's `localStorage` under the site's origin. "מחיקת כל הנתונים" removes them. |

## Controls

- **Content-Security-Policy** (meta tag, since GitHub Pages cannot send headers): `default-src 'none'`; scripts only from the site itself and `https://accounts.google.com/gsi/client`; `connect-src` only Gmail API and Google sign-in; no inline scripts, no `eval`, no third-party images, fonts or analytics; `base-uri 'none'`, `form-action 'none'`, `object-src 'none'`.
- **No untrusted HTML rendering.** Email text is converted to plain text and inserted with `textContent`. The only `innerHTML` use is a static icon table in `src/icons.js`.
- **Link hygiene.** Only `https:` URLs are rendered; all external links use `rel="noopener noreferrer"`; `<meta name="referrer" content="no-referrer">`.
- **Lazy third-party loading.** Google's sign-in script loads only after the user clicks "Connect".
- **No dependencies.** No npm packages are shipped to the browser; there is no build step. What is in this repository is what runs.
- **CI** runs unit tests and `scripts/check.js` (forbids `eval`, `new Function`, `document.write`, inline event handlers and unexpected network hosts) before every deploy.

## Known limits

- A meta-tag CSP cannot set `frame-ancestors`, so the page could be framed by another site. The app has no one-click destructive actions, and Google's consent screen cannot be framed.
- Anyone with access to the unlocked device and browser profile can read `localStorage`.
- Google requires apps that request Gmail read access from the public to pass verification. Until then, only accounts added as test users can connect.

## Reporting a vulnerability

Please open a [private security advisory](https://github.com/L1avZh/package-radar/security/advisories/new) rather than a public issue.
