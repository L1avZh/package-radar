import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEml, decodeHeader, fromGmailApi } from '../src/mime.js';
import { buildPackages } from '../src/parser.js';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const binary = (s) => Buffer.from(s, 'utf8').toString('latin1');

test('decodes RFC 2047 headers (Hebrew, base64 and Q)', () => {
  assert.equal(decodeHeader(`=?UTF-8?B?${b64('אישור הזמנה')}?=`), 'אישור הזמנה');
  assert.equal(decodeHeader('=?utf-8?Q?Order_=23123?='), 'Order #123');
});

test('parses a multipart .eml with a base64 Hebrew HTML part', () => {
  const html = '<p>הזמנה מס\' 7000001</p><p>צפי אספקה 23/10/2026</p>';
  const raw = binary([
    'From: Shop <no_reply@shop.example.co.il>',
    `Subject: =?UTF-8?B?${b64("אישור הזמנה מס' 7000001")}?=`,
    'Date: Fri, 16 Oct 2026 12:34:08 +0300',
    'Content-Type: multipart/alternative; boundary="XYZ"',
    '',
    '--XYZ',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html),
    '--XYZ--',
    '',
  ].join('\r\n'));
  const msg = parseEml(raw, 'e1');
  assert.equal(msg.subject, "אישור הזמנה מס' 7000001");
  assert.ok(msg.html.includes('צפי אספקה'));
  const [p] = buildPackages([msg]);
  assert.equal(p.orderNumber, '7000001');
  assert.equal(p.eta, '23.10');
});

test('reads Gmail API payloads', () => {
  const api = {
    id: 'abc', internalDate: '1792000000000',
    payload: {
      mimeType: 'multipart/alternative',
      headers: [{ name: 'From', value: 'GOAT <no-reply@e.goat.com>' }, { name: 'Subject', value: 'Your order #900000001 has been shipped' }],
      parts: [{ mimeType: 'text/plain', headers: [], body: { data: b64('Tracking Number ARAMEX 30000000001').replace(/\+/g, '-').replace(/\//g, '_') } }],
    },
  };
  const msg = fromGmailApi(api, 'me@example.com');
  assert.equal(msg.text, 'Tracking Number ARAMEX 30000000001');
  assert.match(msg.link, /authuser=me%40example\.com#all\/abc$/);
  const [p] = buildPackages([msg]);
  assert.equal(p.trackingNumber, '30000000001');
});
