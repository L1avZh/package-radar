// Synthetic emails modelled on the formats real shops and carriers send.
// All names, addresses and numbers here are invented.

const d = (s) => Date.parse(s);

export const amazonOrdered = {
  id: 'a1', from: 'Amazon.com <auto-confirm@amazon.com>', date: d('2026-10-17T08:40:00Z'),
  subject: 'Ordered 1 item: Wireless Earbuds Case',
  text: 'Your Orders\nDana, thanks for your order!\nOrdered\nShipped\nOut for delivery\nDelivered\nArriving October 27 - November 5\nDana - Haifa\nOrder #\n111-1111111-1111111\nView or edit order',
};

export const amazonShipped = {
  id: 'a2', from: 'Amazon.com <shipment-tracking@amazon.com>', date: d('2026-10-20T00:30:00Z'),
  subject: 'Shipped 1 item: Wireless Earbuds Case',
  text: 'Dana, your package was shipped!\nOrdered\nShipped\nOut for delivery\nDelivered\nArriving November 5\nOrder #\n111-1111111-1111111\nTrack package',
};

export const barNotice = {
  id: 'b1', from: 'do_not_replay@bar-ltd.co.il', date: d('2026-10-20T01:20:00Z'),
  subject: 'משלוח מספר GWD000000001',
  text: 'שלום dana, לעדכונך, משלוח שהזמנת מ- AMZON יצא לדרך ועושה את דרכו לישראל. המשלוח יגיע באמצעות שליח.',
};

export const barPickup = {
  id: 'b2', from: 'do_not_replay@bar-ltd.co.il', date: d('2026-10-20T04:50:00Z'),
  subject: 'משלוח מספר GWD000000001',
  text: 'שלום dana, בחרת לאסוף את החבילה שמספרה GWD000000001 מסופר השכונה בכתובת הרימון 5 חיפה לפרטים נוספים ושעות פתיחה',
};

export const amazonOrderedOnly = {
  id: 'a3', from: 'Amazon.com <auto-confirm@amazon.com>', date: d('2026-10-16T17:57:00Z'),
  subject: 'Ordered 1 item: USB-C Cable',
  text: 'Dana, thanks for your order!\nArriving November 9 - November 23\nOrder #\n222-2222222-2222222',
};

export const goatShipped = {
  id: 'g1', from: 'GOAT <no-reply@e.goat.com>', date: d('2026-10-15T15:00:00Z'),
  subject: 'Your order #900000001 has been shipped',
  text: 'Your order has been authenticated and is headed your way.\nOrder #900000001\nTracking Number\nARAMEX\n30000000001 (\nShipping\nDana Example',
};

export const goatOrdered = {
  id: 'g0', from: 'GOAT <no-reply@e.goat.com>', date: d('2026-10-14T09:00:00Z'),
  subject: 'Your GOAT order #900000001',
  text: "You ordered the Canvas Tote Bag 'Olive'\nGOAT\nOrder #900000001",
};

export const dhl = {
  id: 'd1', from: 'NoReply.ODD@dhl.com', date: d('2026-10-20T02:40:00Z'),
  subject: 'DHL On Demand Delivery',
  text: 'המשלוח שלך נמצא בדרכו לארץ שלום DANA, משלוח DHL Express מספר 1234567890 מ-HIKER CO נמצא כעת בדרכו לארץ. טלפון: 0541234567',
};

export const aliDelivered = {
  id: 'x1', from: 'AliExpress <transaction@notice.aliexpress.com>', date: d('2026-10-14T08:41:00Z'),
  subject: 'Package RR000000001CN has been delivered',
  html: '<p>Your package RR000000001CN has been successfully delivered!</p><table><tr><td>Desk Lamp, 10W, WHITE x1 | .</td></tr></table>',
};

export const woltReceipt = {
  id: 'w1', from: 'Wolt <info@wolt.com>', date: d('2026-10-18T12:00:00Z'),
  subject: 'קבלת רכישה ב-Wolt',
  text: 'תודה על ההזמנה! מס\' הזמנה: 6ad4af4ddc1e4f7f2c83d8d6 סה"כ ILS 103.60',
};

export const marketing = {
  id: 'm1', from: 'store-news@amazon.com', date: d('2026-10-20T12:00:00Z'),
  subject: 'Amazon has package pickup locations near you',
  text: 'Find a pickup point near you. Ordered Shipped Delivered.',
};

export const hebrewOrder = {
  id: 'h1', from: 'no_reply@shop.example.co.il', date: d('2026-10-16T12:00:00Z'),
  subject: 'אישור הזמנה מס\' 7000001',
  text: 'הזמנה מס\' 7000001\nתאריך הזמנה 16/10/2026\nצפי אספקה 23/10/2026',
};
