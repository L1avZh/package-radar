// Invented example packages, shown only when someone clicks "נסו עם נתוני דוגמה".
// Stores, items and numbers are fictional.
import { trackingUrl } from './carriers.js';

const day = 864e5;

export function demoPackages(now = Date.now()) {
  const p = (o) => ({
    sources: [], pickup: '', eta: '', orderNumber: '', carrier: '', carrierName: '',
    trackingNumber: '', trackingUrl: '', firstDate: o.date, demo: true, ...o,
  });
  return [
    p({ key: 'demo:1', store: 'Northpeak Outfitters', item: 'Leather Hiking Boots, Tan', status: 'shipped',
      carrier: 'dhl', carrierName: 'DHL', trackingNumber: '1234567890', trackingUrl: trackingUrl('dhl', '1234567890'),
      eta: '28.10', date: now - 1 * day }),
    p({ key: 'demo:2', store: 'Amazon', item: 'Wireless Earbuds', status: 'pickup',
      carrier: 'bar', carrierName: 'בר הפצה', trackingNumber: 'GWD000000001', trackingUrl: trackingUrl('bar', 'GWD000000001'),
      orderNumber: '111-1111111-1111111', eta: '6.11', pickup: 'סופר השכונה, הרימון 5, חיפה', date: now - 2 * day }),
    p({ key: 'demo:3', store: 'Linea', item: 'Linen Shirt, Navy', status: 'shipped',
      carrier: 'aramex', carrierName: 'Aramex', trackingNumber: '30000000001', trackingUrl: trackingUrl('aramex', '30000000001'),
      date: now - 4 * day }),
    p({ key: 'demo:4', store: 'Paper & Co', item: 'Dotted Notebook Set, A5', status: 'ordered',
      orderNumber: '222-2222222-2222222', eta: '10.11–24.11', date: now - 3 * day }),
    p({ key: 'demo:5', store: 'AliExpress', item: 'Vitamin D3 Drops', status: 'delivered',
      carrier: 'post', carrierName: 'דואר', trackingNumber: 'RR000000001CN', trackingUrl: trackingUrl('post', 'RR000000001CN'),
      date: now - 6 * day }),
  ];
}
