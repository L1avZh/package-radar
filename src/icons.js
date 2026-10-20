// One line-icon family, drawn the same size and weight, so every card looks consistent.
// Paths are static strings defined here, never built from email content.

const ICONS = {
  boot: '<path d="M6 3.5h5v7.5l6.5 2.3c1.9.7 3 2.2 3 3.9V18H4.5V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M4.5 20.5h16"/><path d="M11 7H8.5M11 10H8.5"/>',
  cap: '<path d="M3.5 15.5a8.5 8.5 0 0 1 17 0z"/><path d="M20.5 15.5h1a1.5 1.5 0 0 1 0 3H7"/><path d="M12 7V5.5"/><path d="M9 8.2C10 11 10 13 9.6 15.5M15 8.2c-1 2.8-1 4.8-.6 7.3"/>',
  charger: '<rect x="5.5" y="8" width="13" height="13" rx="2.5"/><path d="M9.5 8V3.5M14.5 8V3.5"/><rect x="8.5" y="11.5" width="7" height="3.5" rx="1"/><path d="M10 18h4"/>',
  cable: '<rect x="8.5" y="2.5" width="7" height="7.5" rx="1.8"/><path d="M10.8 5h2.4"/><path d="M12 10v3.5c0 3.5-2.5 6-6 6H4.5"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><circle cx="10" cy="6.3" r="1.3"/><circle cx="10" cy="10" r="1.3"/><path d="M10.5 18.5h3"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 18.5h19"/>',
  headphones: '<path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
  shirt: '<path d="M8.5 3.5 4 6l1.8 4 2.2-1v11.5h8V9l2.2 1L20 6l-4.5-2.5c-.5 1.6-1.9 2.5-3.5 2.5s-3-.9-3.5-2.5z"/>',
  bottle: '<path d="M10 2.5h4v3l1.5 2v13a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-13l1.5-2z"/><path d="M8.5 12h7"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
  watch: '<rect x="7" y="7" width="10" height="10" rx="2.5"/><path d="M9 7l.7-4h4.6l.7 4M9 17l.7 4h4.6l.7-4"/><path d="M12 10v2.2l1.4 1"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/><path d="m7.8 5.2 8.5 4.6"/>',
};

const RULES = [
  [/iphone|galaxy|pixel|טלפון|סמארטפון|smartphone|אייפון/i, 'phone'],
  [/charger|מטען|power ?bank|adapter|מתאם/i, 'charger'],
  [/airpods|earbud|headphone|אוזניות|earphone|speaker|רמקול/i, 'headphones'],
  [/cable|כבל|usb|phone accessor|case\b|כיסוי|מגן מסך|screen protector/i, 'cable'],
  [/laptop|macbook|מחשב|ipad|tablet|טאבלט|monitor|מסך/i, 'laptop'],
  [/shoe|boot|sneaker|נעל|samba|jordan|\bdunk\b|vans|hiking|sandal|סנדל/i, 'boot'],
  [/\bcap\b|\bhat\b|כובע|beanie/i, 'cap'],
  [/shirt|hoodie|jacket|pants|jeans|חולצ|מכנס|מעיל|dress|שמלה|sweat/i, 'shirt'],
  [/vitamin|supplement|ויטמין|תוסף|bottle|בקבוק|cream|קרם|serum|perfume|בושם|shampoo/i, 'bottle'],
  [/book|ספר|kindle/i, 'book'],
  [/watch|שעון|band|רצועה/i, 'watch'],
];

export function iconFor(text) {
  for (const [re, name] of RULES) if (re.test(text || '')) return name;
  return 'box';
}

export function iconSvg(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  // Static markup from the ICONS table above (no user data reaches innerHTML).
  svg.innerHTML = ICONS[name] || ICONS.box;
  return svg;
}
