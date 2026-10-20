import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPackages, parseMessage, htmlToText, detectEta } from '../src/parser.js';
import { findTrackingNumbers } from '../src/carriers.js';
import * as f from './fixtures.js';

test('ignores food receipts and marketing', () => {
  assert.equal(parseMessage(f.woltReceipt), null);
  assert.equal(parseMessage(f.marketing), null);
});

test('DHL number is found by context, phone number is not', () => {
  const found = findTrackingNumbers(f.dhl.text);
  assert.deepEqual(found, [{ carrier: 'dhl', number: '1234567890' }]);
});

test('UPU postal numbers and UPS numbers are recognised', () => {
  assert.deepEqual(findTrackingNumbers('ref RR000000001CN ok'), [{ carrier: 'post', number: 'RR000000001CN' }]);
  assert.equal(findTrackingNumbers('1Z999AA10123456784')[0].carrier, 'ups');
});

test('GOAT order + shipping merge into one package with Aramex tracking and item name', () => {
  const pkgs = buildPackages([f.goatOrdered, f.goatShipped]);
  assert.equal(pkgs.length, 1);
  const p = pkgs[0];
  assert.equal(p.store, 'GOAT');
  assert.equal(p.status, 'shipped');
  assert.equal(p.carrier, 'aramex');
  assert.equal(p.trackingNumber, '30000000001');
  assert.equal(p.item, "Canvas Tote Bag 'Olive'");
  assert.equal(p.sources.length, 2);
});

test('Amazon order, Amazon shipping and Bar carrier notices become one package', () => {
  const pkgs = buildPackages([f.amazonOrdered, f.amazonShipped, f.barNotice, f.barPickup, f.amazonOrderedOnly]);
  const shipped = pkgs.find((p) => p.orderNumber === '111-1111111-1111111');
  assert.ok(shipped, 'shipped Amazon package exists');
  assert.equal(shipped.trackingNumber, 'GWD000000001');
  assert.equal(shipped.status, 'pickup');
  assert.equal(shipped.item, 'Wireless Earbuds Case');
  assert.equal(shipped.eta, '5.11');
  assert.match(shipped.pickup, /הרימון 5/);
  assert.equal(shipped.sources.length, 4);

  const pending = pkgs.find((p) => p.orderNumber === '222-2222222-2222222');
  assert.ok(pending, 'unshipped order kept separately');
  assert.equal(pending.status, 'ordered');
  assert.equal(pending.eta, '9.11–23.11');
  assert.equal(pkgs.length, 2);
});

test('DHL carrier notice takes the shipper name as store', () => {
  const [p] = buildPackages([f.dhl]);
  assert.equal(p.carrier, 'dhl');
  assert.equal(p.store, 'Hiker Co');
  assert.equal(p.status, 'shipped');
  assert.match(p.trackingUrl, /dhl\.com.*1234567890/);
});

test('AliExpress delivered email: status, item from HTML, postal tracking', () => {
  const [p] = buildPackages([f.aliDelivered]);
  assert.equal(p.status, 'delivered');
  assert.equal(p.trackingNumber, 'RR000000001CN');
  assert.equal(p.item, 'Desk Lamp, 10W, WHITE');
});

test('Hebrew order confirmation: order number and ETA', () => {
  const [p] = buildPackages([f.hebrewOrder]);
  assert.equal(p.orderNumber, '7000001');
  assert.equal(p.status, 'ordered');
  assert.equal(p.eta, '23.10');
});

test('status never goes backwards when an older-looking email arrives later', () => {
  const late = { ...f.goatOrdered, id: 'g9', date: f.goatShipped.date + 1000 };
  const [p] = buildPackages([f.goatShipped, late]);
  assert.equal(p.status, 'shipped');
});

test('htmlToText strips scripts and decodes entities', () => {
  assert.equal(htmlToText('<script>alert(1)</script><p>A &amp; B&#39;s</p>'), "A & B's");
});

test('ETA formats', () => {
  assert.equal(detectEta('Estimated delivery by Tuesday, the 27th of October |'), '27.10');
  assert.equal(detectEta('Arriving October 27 - November 5'), '27.10–5.11');
});
