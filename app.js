// ============================================================
// B-CEYLON NEXT — app.js (V3 FINALE 🏁)
// Tamil DJ Party • Vol. 2 NYE • Badulla, Sri Lanka
// Pages: index / event / select / checkout / confirmation / reservations / ticket
//
// DEMO MODE (SHEET_API = '') → bookings save in browser localStorage only.
// LIVE MODE (paste your Apps Script Web app URL below) → real seat counts,
// server-side oversell protection, BC- Booking IDs + Sheet cancellations.
// Full wiring guide: CONNECT.md
// ============================================================

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

// ===== LIVE BACKEND CONFIG =====
// 1. Deploy Code.gs (V5+ with the ?action=cancel endpoint), paste the Web app URL here:
const SHEET_API = 'https://script.google.com/macros/s/AKfycbx4sjtizA3vngzIlnsivFtBuC6bogF1uIWrtkKqtj3kQ-dbSA8JDWUD5PY9oePmev1L/exec'; // e.g. 'https://script.google.com/macros/s/AKfyc.../exec'
// 2. If you set a SECRET in Code.gs, paste the SAME value here (else leave ''):
const SHEET_KEY = 'https://script.google.com/macros/s/AKfycbx4sjtizA3vngzIlnsivFtBuC6bogF1uIWrtkKqtj3kQ-dbSA8JDWUD5PY9oePmev1L/exec';
// 3. Package tier → Sheet section (each ticket here = 1 seat):
const SHEET_CAT = { 'Phase One': 'normal', 'At Gate': 'normal', 'VIP': 'vip', 'Royal Access': 'vvip' };

const WA_NUMBER = '94701742032'; // B-Ceylon reservations: +94 70 174 2032
const NEXT_EVENT = new Date('2026-12-31T19:00:00+05:30'); // Vol. 2 — New Year's Eve

const STORE = 'bceylon_reservations_v2';
const TIERS = {
  'Phase One': { category: 'Standard', price: 3000, section: 'Main Floor', desc: 'Early-bird • Rs. 1,500 redeemable 🍾' },
  'At Gate': { category: 'Economy', price: 3500, section: 'Main Floor', desc: 'Entrance rate • Rs. 1,500 redeemable' },
  'VIP': { category: 'Premium', price: 35000, section: 'VIP Deck', desc: 'VIP deck + seating • up to Rs. 10,000 redeemable' },
  'Royal Access': { category: 'VIP', price: 50000, section: 'Royal Deck', desc: 'Royal deck • priority entry • meet the DJs' }
};
const EVENT = { name: 'B-CEYLON VOL. 2', venue: 'Secret Venue • Badulla, Sri Lanka', date: '31 December 2026', time: '7:00 PM', instructions: 'Bring your ticket QR code and a valid ID (21+). Entry opens 6:30 PM. BYOB 🍾. Follow venue/security instructions on arrival.' };

let liveCounts = null; // latest {sections:{normal:{limit,sold,left},...}} from the Sheet

function read() { try { return JSON.parse(localStorage.getItem(STORE) || '[]') } catch { return [] } }
function write(v) { localStorage.setItem(STORE, JSON.stringify(v)) }
function money(n) { return 'Rs. ' + Number(n).toLocaleString('en-LK') }
function id() { return 'BC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() }
function getParam(k) { return new URLSearchParams(location.search).get(k) }
function escape(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])) }
function waLink(r) {
  const msg = `Hello B-Ceylon Entertainment! 🎧\n\nMy Vol. 2 booking:\n• Booking ID: ${r.id}\n• Name: ${r.name}\n• Tier: ${r.tier} × ${r.qty}\n• Total: ${money(r.total)}\n\nConfirming my reservation ✅`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// ==================== SHEET API ====================

async function fetchCounts() {
  if (!SHEET_API) return null;
  try {
    const res = await fetch(SHEET_API + '?action=counts');
    const d = await res.json();
    if (d && d.ok) { liveCounts = d; return d; }
  } catch (err) { /* offline → demo fallback */ }
  return null;
}

async function apiBook(payload) {
  const params = new URLSearchParams(Object.assign({ action: 'book', key: SHEET_KEY }, payload));
  return (await fetch(SHEET_API + '?' + params.toString())).json();
}

async function apiCancel(bookingId) {
  const params = new URLSearchParams({ action: 'cancel', key: SHEET_KEY, id: bookingId });
  return (await fetch(SHEET_API + '?' + params.toString())).json();
}

// ==================== NAV / REVEAL / TILT ====================

function setActive() { const p = location.pathname.split('/').pop() || 'index.html'; $$('.links a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === p)) }

function initNav() {
  $('.hamb')?.addEventListener('click', () => $('.links').classList.toggle('open'));
  // Gallery link lives in every nav (points at the home-page recap section)
  const links = $('.links');
  if (links && !links.querySelector('[data-gal]')) {
    const page = location.pathname.split('/').pop() || 'index.html';
    const a = document.createElement('a');
    a.href = page === 'index.html' ? '#gallery' : 'index.html#gallery';
    a.textContent = 'Gallery'; a.setAttribute('data-gal', '1');
    links.insertBefore(a, links.querySelector('.btn') || null);
  }
  // close the mobile menu as soon as a link is picked
  $$('.links a').forEach(a => a.addEventListener('click', () => $('.links')?.classList.remove('open')));
  setActive();
}

let revObserver = null;
function initReveal() {
  revObserver = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('show'); revObserver.unobserve(e.target); }
  }), { threshold: .12 });
  observeReveals();
}
function observeReveals() {
  if (!revObserver) return;
  $$('.reveal:not([data-rev])').forEach(x => { x.dataset.rev = '1'; revObserver.observe(x); });
}

// FINALE: calm, professional tilt (5°) — and booking forms stay perfectly still.
// Guarded so re-runs (after dynamic renders) never double-bind a card.
function init3D() { bindTilt(); }
function bindTilt() {
  $$('.card,.stage').forEach(el => {
    if (el.dataset.tiltBound) return;
    if (el.closest('.form')) return; // booking/checkout forms: zero movement, pro feel
    el.dataset.tiltBound = '1';
    el.addEventListener('pointermove', e => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!matchMedia('(pointer: fine)').matches) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transform = `perspective(1100px) rotateX(${(.5 - y) * 5}deg) rotateY(${(x - .5) * 5}deg) translateY(-2px)`;
      el.style.setProperty('--mx', (x * 100) + '%');
      el.style.setProperty('--my', (y * 100) + '%');
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
      el.style.setProperty('--mx', '50%'); el.style.setProperty('--my', '50%');
    });
  });
}
// Re-run after any dynamic render (discovery card, reservations list, ticket…)
function refreshMotion() { observeReveals(); bindTilt(); }

function saveDraft(data) { localStorage.setItem('bceylon_checkout', JSON.stringify(data)) }
function loadDraft() { try { return JSON.parse(localStorage.getItem('bceylon_checkout') || 'null') } catch { return null } }

// ==================== TICKET RENDER + ACTIONS ====================

function ticketHTML(r) {
  const t = TIERS[r.tier] || TIERS['Phase One'];
  return `<article class="ticket ${t.category.toLowerCase()}"><div class="ticket-main"><div class="ticket-brand"><div><div class="pill">B-CEYLON ENTERTAINMENT</div><h1>${escape(EVENT.name)}</h1><div class="muted">${escape(EVENT.venue)}</div></div><div>${t.category === 'VIP' ? '<span class="crown" title="VIP">♛ VIP</span>' : ''}<div class="status ${r.status === 'confirmed' ? 'confirmed' : 'cancelled'}">${r.status.toUpperCase()}</div></div></div><div class="ticket-grid"><div><span>Attendee</span><b>${escape(r.name)}</b></div><div><span>Date</span><b>${EVENT.date}</b></div><div><span>Time</span><b>${EVENT.time}</b></div><div><span>Seat / Section</span><b>${escape(r.section)}</b></div><div><span>Category</span><b>${escape(t.category)}</b></div><div><span>Quantity</span><b>${r.qty}</b></div><div><span>Order</span><b>${escape(r.id)}</b></div><div><span>Total</span><b>${money(r.total)}</b></div></div></div><div class="ticket-side"><div class="qr" data-code="${escape(r.id)}"></div><div class="barcode" aria-label="Barcode"></div><small class="muted">Scan at entry</small></div></article>`;
}

// QR via cdnjs qrcodejs (renders <canvas>+<img> inside .qr). Guarded: no lib → empty box, no crash.
function drawQR() {
  if (!window.QRCode) return;
  $$('.qr[data-code]').forEach(el => {
    el.innerHTML = '';
    try { new QRCode(el, { text: el.dataset.code, width: 114, height: 114, correctLevel: QRCode.CorrectLevel.M }); }
    catch { /* leave empty box */ }
  });
}
function renderTickets() { drawQR() }
function current() { return read().find(r => r.id === getParam('id')) }

// ---------- REAL PDF TICKETS (jsPDF, themed, unlimited re-downloads) ----------

// PDF fonts only support Latin text — strip emoji/symbols so nothing renders as garbage.
function clean(s) {
  return String(s ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF\u2018-\u201F\u2022]/g, '').trim();
}
// Shrink font until text fits maxW (side effect: sets the size). Assumes font already set.
function fitText(doc, text, maxW, startSize) {
  let size = startSize;
  doc.setFontSize(size);
  while (size > 7 && doc.getTextWidth(text) > maxW) { size -= .5; doc.setFontSize(size); }
}
// Crisp 512px QR for print (the on-screen 114px one would blur when scaled up).
function qrDataURL(text) {
  try {
    if (!window.QRCode) return null;
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(tmp);
    new QRCode(tmp, { text, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.M });
    const cv = tmp.querySelector('canvas');
    const url = cv ? cv.toDataURL('image/png') : null;
    tmp.remove();
    return url;
  } catch (err) { return null; }
}

function pdf(r) {
  if (!r) return;
  if (!window.jspdf) { alert('PDF engine still loading — check your internet and tap Download again.'); return; }
  const t = TIERS[r.tier] || TIERS['Phase One'];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' }); // 210 × 148 mm
  const W = 210, H = 148;
  const INK = [11, 11, 22], WHITE = [255, 255, 255], GREY = [156, 163, 181],
    PURPLE = [168, 85, 247], PINK = [251, 91, 213], CYAN = [34, 211, 238],
    GREEN = [52, 211, 153], GOLD = [245, 196, 81], RED = [251, 113, 133];
  const accent = { VIP: GOLD, Premium: CYAN, Standard: PURPLE, Economy: PINK }[t.category] || PURPLE;

  // backdrop + neon frame
  doc.setFillColor(...INK); doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(...PURPLE); doc.rect(0, 0, 9, H, 'F');
  doc.setFillColor(...PINK); doc.rect(0, H - 4, W, 4, 'F');

  // header
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY); doc.setFontSize(9);
  doc.text('B-CEYLON ENTERTAINMENT', 16, 16);
  doc.setTextColor(...WHITE); doc.setFontSize(25);
  doc.text('B-CEYLON VOL. 2', 16, 27);
  // category pill
  const pillText = clean(t.category + ' - ' + t.section).toUpperCase();
  doc.setFillColor(...accent); doc.roundedRect(16, 31, 62, 9, 2, 2, 'F');
  doc.setFontSize(8.5); doc.setTextColor(...INK);
  fitText(doc, pillText, 58, 8.5);
  doc.text(pillText, 47, 37.2, { align: 'center' });
  // status dot + word
  const cancelled = r.status === 'cancelled';
  doc.setFillColor(...(cancelled ? RED : GREEN)); doc.circle(84, 35.4, 1.8, 'F');
  doc.setFontSize(10); doc.setTextColor(...(cancelled ? RED : GREEN));
  doc.text(cancelled ? 'CANCELLED' : 'CONFIRMED', 88, 37.2);

  // details grid (2 cols × 4 rows)
  const rows = [
    ['ATTENDEE', clean(r.name), 'SECTION', clean(r.section)],
    ['DATE', EVENT.date, 'QUANTITY', String(r.qty)],
    ['TIME', EVENT.time, 'TICKET', money(t.price) + ' x ' + r.qty],
    ['VENUE', clean(EVENT.venue), 'TOTAL PAID', money(r.total)]
  ];
  let y = 50;
  rows.forEach(row => {
    [[row[0], row[1], 16], [row[2], row[3], 82]].forEach(col => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GREY);
      doc.text(col[0], col[2], y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(col[0] === 'TOTAL PAID' ? CYAN : WHITE));
      fitText(doc, col[1], 56, col[0] === 'TOTAL PAID' ? 12 : 10.5);
      doc.text(col[1], col[2], y + 6.5);
    });
    y += 15;
  });

  // footer notes
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GREY);
  const notes = doc.splitTextToSize('Entry: ticket QR + valid ID (21+)  |  Gates 6:30 PM  |  BYOB  |  Support: WhatsApp +94 70 174 2032 (quote your Booking ID)', 118);
  doc.text(notes, 16, 118);

  // perforation divider
  doc.setDrawColor(90, 90, 110); doc.setLineWidth(.6); doc.setLineDashPattern([3, 2.4], 0);
  doc.line(140, 10, 140, 132);

  // stub: QR + booking id + total
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text('SCAN AT ENTRY', 175, 20, { align: 'center' });
  doc.setFillColor(...WHITE); doc.roundedRect(151, 25, 48, 48, 3, 3, 'F');
  const qr = qrDataURL(r.id);
  let placed = false;
  if (qr) { try { doc.addImage(qr, 'PNG', 153, 27, 44, 44); placed = true; } catch (e) { /* fallback below */ } }
  if (!placed) {
    doc.setFontSize(7); doc.setTextColor(...INK);
    doc.text('QR unavailable -', 175, 46, { align: 'center' });
    doc.text('show Booking ID', 175, 51, { align: 'center' });
  }
  doc.setFont('courier', 'bold'); doc.setTextColor(...WHITE);
  fitText(doc, r.id, 54, 8.2);
  doc.text(r.id, 175, 81, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text('31 DEC 2026  |  7:00 PM', 175, 88, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...CYAN);
  fitText(doc, money(r.total), 54, 11);
  doc.text(money(r.total), 175, 96, { align: 'center' });
  doc.setFontSize(7.5); doc.setTextColor(...GREY);
  doc.text(clean(r.qty + ' x ' + r.tier), 175, 102, { align: 'center' });
  doc.setFontSize(7);
  doc.text('BADULLA - 21+', 175, 126, { align: 'center' });

  doc.save('B-Ceylon-VOL2-' + r.id + '.pdf'); // real file download, unlimited re-downloads ✅
}

function share(r) {
  const text = `${EVENT.name} — ${r.id}\n${EVENT.date} • ${EVENT.time}\n${r.qty} × ${r.tier}\n${money(r.total)}`;
  if (navigator.share) navigator.share({ title: 'B-Ceylon Reservation', text, url: location.origin + location.pathname.replace(/[^/]+$/, '') + 'ticket.html?id=' + encodeURIComponent(r.id) });
  else navigator.clipboard?.writeText(text).then(() => alert('Reservation copied to clipboard.'));
}

function calendar(r) {
  const start = '20261231T133000Z', end = '20261231T170000Z';
  location.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(EVENT.name)}&dates=${start}/${end}&details=${encodeURIComponent('Reservation ' + r.id + ' • ' + r.section)}&location=${encodeURIComponent(EVENT.venue)}`;
}
function printTicket() { window.print() }

// ==================== PAGE INITS ====================

function initDiscovery() {
  const c = $('#featured-events');
  if (!c) return;
  c.innerHTML = `<article class="card reveal" data-tilt><span class="pill">31 DEC 2026 • NYE • 21+</span><h3>${EVENT.name}</h3><p class="muted">${EVENT.date} • ${EVENT.time}<br>${EVENT.venue}</p><p>New Year's Eve at a secret Badulla venue. 4 DJs, immersive visuals, premium tables — OG Sambavam was just the warm-up.</p><a class="btn primary" href="event.html">Explore event</a></article>`;
}

function initSelect() {
  const form = $('#selectForm');
  if (!form) return;
  const tierSelect = $('#tier'), qty = $('#qty'), name = $('#name');
  Object.keys(TIERS).forEach(k => tierSelect.add(new Option(`${k} — ${money(TIERS[k].price)}`, k)));
  // LIVE availability hint (injected — no HTML edit needed)
  const hint = document.createElement('div');
  hint.id = 'liveHint'; hint.className = 'notice'; hint.style.display = 'none';
  form.querySelector('.form-grid').insertAdjacentElement('afterend', hint);
  function paintHint(kind, html) {
    hint.style.display = '';
    hint.classList.toggle('warn', kind === 'warn');
    hint.innerHTML = html;
  }
  function calc() {
    const t = TIERS[tierSelect.value] || TIERS['Phase One'];
    const q = Math.max(1, Math.min(10, +qty.value || 1));
    const sub = t.price * q, fee = Math.round(sub * .02);
    $('#unit').textContent = money(t.price);
    $('#sub').textContent = money(sub);
    $('#fee').textContent = money(fee);
    $('#grand').textContent = money(sub + fee);
    const cat = SHEET_CAT[tierSelect.value] || 'normal';
    if (!SHEET_API) {
      paintHint('demo', `🟡 <b>Demo mode</b> — booking saves on this device only. Section: <b>${cat.toUpperCase()}</b> • you need <b>${q}</b> seat(s).`);
    } else if (!liveCounts) {
      paintHint('loading', '⏳ Checking live availability…');
    } else {
      const left = liveCounts.sections[cat].left;
      paintHint(q > left ? 'warn' : 'live', q > left
        ? `⚠️ Section <b>${cat.toUpperCase()}</b>: only <b>${left}</b> left — you need ${q}. Lower quantity or pick another tier.`
        : `Section: <b>${cat.toUpperCase()}</b> • <b>${left}</b> seats left • you need <b>${q}</b> ✅`);
    }
  }
  tierSelect.onchange = calc; qty.oninput = calc; calc();
  fetchCounts().then(calc);
  form.onsubmit = e => {
    e.preventDefault();
    if (!name.value.trim()) { alert('Please enter the attendee name.'); name.focus(); return }
    if (SHEET_API && !$('#phone').value.trim()) { alert('Phone number is required for live bookings.'); $('#phone').focus(); return }
    const q = Math.max(1, Math.min(10, +qty.value || 1));
    const cat = SHEET_CAT[tierSelect.value] || 'normal';
    if (liveCounts && q > liveCounts.sections[cat].left) {
      alert(`Only ${liveCounts.sections[cat].left} seat(s) left in ${cat.toUpperCase()} — lower quantity or pick another tier.`);
      return;
    }
    saveDraft({ tier: tierSelect.value, qty: q, name: name.value.trim(), email: $('#email').value.trim(), phone: $('#phone').value.trim() });
    location.href = 'checkout.html';
  };
}

function initCheckout() {
  const f = $('#checkoutForm');
  if (!f) return;
  const d = loadDraft();
  if (!d) { $('#checkout').innerHTML = '<div class="empty">Your booking session is empty. <a href="select.html">Choose tickets</a>.</div>'; return }
  const t = TIERS[d.tier] || TIERS['Phase One'];
  const fee = Math.round(t.price * d.qty * .02), total = t.price * d.qty + fee;
  $('#co-name').textContent = d.name;
  $('#co-tier').textContent = t.category + ' • ' + t.section;
  $('#co-qty').textContent = money(t.price * d.qty);
  $('#co-fee').textContent = money(fee);
  $('#co-total').textContent = money(total);
  f.onsubmit = async e => {
    e.preventDefault();
    if (!$('#agree').checked) { $('#co-error').textContent = 'Please accept the booking terms before continuing.'; return }
    $('#co-error').textContent = '';
    if (!SHEET_API) { finishLocal(); return; } // demo mode: local booking
    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Reserving your seats…';
    try {
      const data = await apiBook({
        name: d.name, phone: d.phone, email: d.email || '', event: EVENT.name,
        category: SHEET_CAT[d.tier] || 'normal', tier: d.tier,
        units: String(d.qty), seatsEach: '1', total: String(total)
      });
      if (data.ok) {
        liveCounts = data;
        const r = {
          id: data.bookingId, name: d.name, email: d.email, phone: d.phone,
          tier: d.tier, qty: d.qty, section: t.section, fee, total,
          status: 'confirmed', payment: $('#pay').value,
          created: new Date().toISOString(), remote: true
        };
        const arr = read(); arr.unshift(r); write(arr);
        localStorage.removeItem('bceylon_checkout');
        location.href = 'confirmation.html?id=' + encodeURIComponent(r.id);
      } else {
        $('#co-error').textContent = '⚠️ ' + (data.error || 'Booking failed, try again');
        fetchCounts();
      }
    } catch (err) {
      // Server unreachable → local fallback so the flow never dead-ends
      if (confirm('Could not reach the booking server. Save this booking on this device only (NOT synced)?')) finishLocal();
    } finally {
      btn.disabled = false; btn.textContent = 'Confirm reservation';
    }
    function finishLocal() {
      const r = {
        id: id(), name: d.name, email: d.email, phone: d.phone,
        tier: d.tier, qty: d.qty, section: t.section, fee, total,
        status: 'confirmed', payment: $('#pay').value,
        created: new Date().toISOString(), remote: false
      };
      const arr = read(); arr.unshift(r); write(arr);
      localStorage.removeItem('bceylon_checkout');
      location.href = 'confirmation.html?id=' + encodeURIComponent(r.id);
    }
  };
}

function initConfirmation() {
  const box = $('#confirmation');
  if (!box) return;
  const r = current();
  if (!r) { box.innerHTML = '<div class="empty">Reservation not found.</div>'; return }
  const banner = r.remote ? '' : '<p class="notice warn" style="margin:0 0 16px">🟡 <b>Device-only booking</b> — saved in this browser, NOT synced to the crew Sheet. Connect SHEET_API (see CONNECT.md) for live bookings.</p>';
  box.innerHTML = `<div class="success"><div class="big">✓</div><h1>Reservation confirmed</h1><p>Your booking <b>${r.id}</b> is safely stored${r.remote ? ' in the B-Ceylon system' : ' on this device'}.</p></div><div style="height:20px"></div>${banner}${ticketHTML(r)}<div class="actions-row" style="margin-top:18px"><a class="btn primary" id="wa" target="_blank" rel="noopener">Confirm on WhatsApp</a><button class="btn primary" id="pdf">Download PDF</button><button class="btn ghost" id="print">Print</button><button class="btn ghost" id="share">Share</button><button class="btn ghost" id="cal">Add to calendar</button><a class="btn ghost" href="reservations.html">My reservations</a></div><p class="notice" style="margin-top:16px"><b>Download PDF</b> saves a themed ticket file instantly — re-download anytime. Tap <b>Confirm on WhatsApp</b> so the crew can lock in your payment + entry.</p>`;
  $('#wa').href = waLink(r);
  $('#pdf').onclick = () => pdf(r);
  $('#print').onclick = printTicket; $('#share').onclick = () => share(r); $('#cal').onclick = () => calendar(r);
  renderTickets(); refreshMotion();
}

function initReservations() {
  const list = $('#reservations');
  if (!list) return;
  const rs = read();
  if (!rs.length) { list.innerHTML = '<div class="empty">No reservations yet.<br><a class="btn primary" href="select.html" style="margin-top:14px">Book your first ticket</a></div>'; return }
  list.innerHTML = rs.map(r => `<div class="card" style="margin-bottom:14px"><div class="toolbar"><div><span class="pill">${r.id}</span><h3 style="margin:9px 0 0">${EVENT.name}</h3><div class="muted">${r.qty} × ${r.tier} • ${money(r.total)}${r.remote ? '' : ' • 📱 device-only'}</div></div><span class="status ${r.status === 'confirmed' ? 'confirmed' : 'cancelled'}">${r.status}</span></div><div class="actions-row"><a class="btn primary small" href="ticket.html?id=${encodeURIComponent(r.id)}">View ticket</a><button class="btn ghost small" data-cancel="${r.id}" ${r.status === 'cancelled' ? 'disabled' : ''}>Cancel</button></div></div>`).join('');
  $$('[data-cancel]').forEach(b => b.onclick = async () => {
    if (!confirm('Cancel this reservation?')) return;
    const rid = b.dataset.cancel;
    const rec = read().find(x => x.id === rid);
    if (rec && rec.remote && SHEET_API) {
      b.disabled = true; b.textContent = 'Cancelling…';
      try {
        const data = await apiCancel(rid);
        if (data.ok) { liveCounts = data; }
        else { alert('⚠️ ' + (data.error || 'Cancel failed')); initReservations(); return; }
      } catch (err) { alert('⚠️ Could not reach the server — booking kept. Try again.'); initReservations(); return; }
    }
    write(read().map(x => x.id === rid ? { ...x, status: 'cancelled' } : x));
    initReservations();
  });
  refreshMotion();
}

function initTicket() {
  const box = $('#ticket');
  if (!box) return;
  const r = current();
  if (!r) { box.innerHTML = '<div class="empty">Ticket not found.</div>'; return }
  box.innerHTML = ticketHTML(r) + `<div class="actions-row" style="margin-top:18px"><a class="btn primary" id="wa" target="_blank" rel="noopener">Confirm on WhatsApp</a><button class="btn primary" id="pdf">Download PDF</button><button class="btn ghost" id="print">Print</button><button class="btn ghost" id="share">Share</button><button class="btn ghost" id="cal">Add to calendar</button></div>`;
  $('#wa').href = waLink(r);
  $('#pdf').onclick = () => pdf(r); $('#print').onclick = printTicket; $('#share').onclick = () => share(r); $('#cal').onclick = () => calendar(r);
  renderTickets(); refreshMotion();
}

// ==================== COUNTDOWN (event page) ====================

function initCountdown() {
  const box = $('#countdown');
  if (!box) return;
  function tick() {
    const diff = NEXT_EVENT - new Date();
    if (diff <= 0) {
      box.innerHTML = '<div class="cd-live"><strong>🎉 WE&rsquo;RE LIVE</strong><span>Happy New Year from B-Ceylon!</span></div>';
      return;
    }
    const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24,
      m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
    $('#cd-d').textContent = d;
    $('#cd-h').textContent = String(h).padStart(2, '0');
    $('#cd-m').textContent = String(m).padStart(2, '0');
    $('#cd-s').textContent = String(s).padStart(2, '0');
  }
  tick(); setInterval(tick, 1000);
}

// ==================== GALLERY LIGHTBOX ====================

function initLightbox() {
  const items = $$('.g-item');
  if (!items.length) return;
  const lb = document.createElement('div');
  lb.className = 'lb'; lb.id = 'lightbox'; lb.setAttribute('aria-hidden', 'true');
  lb.innerHTML = '<button class="lb-x" aria-label="Close">×</button><button class="lb-p" aria-label="Previous">‹</button><figure><img alt="Gallery photo"><figcaption></figcaption></figure><button class="lb-n" aria-label="Next">›</button>';
  document.body.appendChild(lb);
  const img = lb.querySelector('img'), cap = lb.querySelector('figcaption');
  let idx = 0;
  const list = () => $$('.g-item');
  function show() {
    const it = list()[idx];
    const im = it.querySelector('img');
    img.src = im.src; img.alt = im.alt;
    cap.textContent = it.querySelector('figcaption')?.textContent || '';
  }
  function open(i) {
    idx = (i + list().length) % list().length;
    show();
    lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  function step(d) { idx = (idx + d + list().length) % list().length; show(); }
  items.forEach((it, i) => {
    it.setAttribute('tabindex', '0'); it.setAttribute('role', 'button');
    it.addEventListener('click', () => open(i));
    it.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
  });
  lb.querySelector('.lb-x').onclick = close;
  lb.querySelector('.lb-p').onclick = e => { e.stopPropagation(); step(-1); };
  lb.querySelector('.lb-n').onclick = e => { e.stopPropagation(); step(1); };
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
}

// ==================== FINALE FOOTER (all pages, all socials) ====================

function initFooter() {
  const html = `<div class="container fin-grid">`
    + `<div><a class="logo" href="index.html"><img src="photos/logo-cube.jpg" alt="B-Ceylon"><span>B-CEYLON ENTERTAINMENT<b>.</b></span></a>`
    + `<p class="muted" style="margin:12px 0">Tamil DJ nights from Badulla, Sri Lanka. Vol. 2 lands on New Year&rsquo;s Eve. 🪩</p>`
    + `<div class="socials">`
    + `<a href="https://www.facebook.com/share/19R7tM9ejt/" target="_blank" rel="noopener" aria-label="Facebook"><i class="fab fa-facebook"></i></a>`
    + `<a href="https://www.instagram.com/bceylonentertainment" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>`
    + `<a href="https://www.tiktok.com/@b.ceylon.events" target="_blank" rel="noopener" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>`
    + `<a href="https://www.youtube.com/@BCeylonEntertainment" target="_blank" rel="noopener" aria-label="YouTube"><i class="fab fa-youtube"></i></a>`
    + `<a href="https://wa.me/94701742032" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>`
    + `<a href="mailto:bceylonentertainment@gmail.com" aria-label="Email"><i class="fas fa-envelope"></i></a>`
    + `</div></div>`
    + `<div class="fin-links"><h4>EXPLORE</h4><a href="index.html">Discover</a><a href="event.html">Vol. 2 — NYE</a><a href="index.html#gallery">OG Sambavam Recap</a><a href="reservations.html">My Reservations</a></div>`
    + `<div class="fin-links"><h4>BOOK &amp; CONTACT</h4><a href="select.html">🎟️ Book Tickets</a><a href="https://wa.me/94701742032" target="_blank" rel="noopener">WhatsApp: +94 70 174 2032</a><a href="mailto:bceylonentertainment@gmail.com">bceylonentertainment@gmail.com</a><span class="muted">Badulla, Sri Lanka • 21+</span></div>`
    + `</div><div class="fin-bottom">© 2026 B-Ceylon Entertainment • Photos: Venus Studio • Vol. 2 — the finale experience 🎧</div>`;
  let f = $('.footer');
  if (!f) { f = document.createElement('footer'); f.className = 'footer'; document.body.appendChild(f); }
  f.innerHTML = html;
}

// ==================== PREMIUM MOTION LAYER (all pages) ====================

function initMotion() {
  // scroll progress + back-to-top (injected — no HTML edits needed)
  const prog = document.createElement('div');
  prog.className = 'progress'; prog.id = 'progress';
  document.body.prepend(prog);
  const toTop = document.createElement('button');
  toTop.className = 'to-top'; toTop.id = 'toTop';
  toTop.setAttribute('aria-label', 'Back to top'); toTop.textContent = '↑';
  document.body.appendChild(toTop);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  window.addEventListener('scroll', () => {
    const max = document.body.scrollHeight - window.innerHeight;
    prog.style.width = (max > 0 ? (window.scrollY / max * 100) : 0) + '%';
    toTop.classList.toggle('show', window.scrollY > 600);
    const hero = $('.hero');
    if (hero && !reduceMotion) hero.style.setProperty('--hero-scroll', (Math.min(window.scrollY, window.innerHeight) * .15) + 'px');
  }, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  // hero depth layers (home page only)
  const hero = $('.hero');
  if (hero) hero.insertAdjacentHTML('afterbegin',
    '<div class="hero-grid"></div><div class="hero-ring hero-ring-one"></div><div class="hero-ring hero-ring-two"></div><div class="hero-noise"></div>');

  if (!finePointer || reduceMotion) return;

  // mouse spotlight position (consumed by body::after in CSS)
  document.addEventListener('pointermove', e => {
    document.documentElement.style.setProperty('--pointer-x', e.clientX + 'px');
    document.documentElement.style.setProperty('--pointer-y', e.clientY + 'px');
  });

  // magnetic buttons — delegated, so dynamically added buttons work too
  let mag = null;
  document.addEventListener('pointermove', e => {
    const b = e.target && e.target.closest ? e.target.closest('.btn') : null;
    if (b !== mag) { if (mag) mag.style.transform = ''; mag = b; }
    if (mag) {
      const r = mag.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      mag.style.transform = `translate3d(${x * .16}px, ${y * .16}px, 0) scale(1.035)`;
    }
  });
  document.addEventListener('mouseleave', () => { if (mag) { mag.style.transform = ''; mag = null; } });

  // hero parallax: copy + orbs + rings drift at different depths
  if (hero) {
    const copy = hero.querySelector('.hero-copy');
    const orbs = [...hero.querySelectorAll('.orb')];
    const rings = [...hero.querySelectorAll('.hero-ring')];
    hero.addEventListener('pointermove', e => {
      const x = e.clientX / window.innerWidth - .5, y = e.clientY / window.innerHeight - .5;
      if (copy) copy.style.transform = `translate3d(${x * 14}px, ${y * 10}px, 0)`;
      orbs.forEach((o, i) => { const d = (i + 1) * 16; o.style.translate = `${-x * d}px ${-y * d}px`; });
      rings.forEach((g, i) => { const d = (i + 1) * 8; g.style.translate = `${x * d}px ${y * d}px`; });
    });
    hero.addEventListener('pointerleave', () => {
      if (copy) copy.style.transform = '';
      orbs.forEach(o => o.style.translate = '');
      rings.forEach(g => g.style.translate = '');
    });
  }
}

// Content first (discovery card), then observers — the old order observed
// BEFORE injection, leaving the featured card invisible + un-tilted forever.
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initDiscovery();
  initSelect(); initCheckout(); initConfirmation(); initReservations(); initTicket();
  initCountdown(); initLightbox(); initFooter();
  initReveal(); init3D();
  initMotion();
});

console.log('🎧 B-Ceylon Next V3 FINALE 🏁 — sheets backend ' + (SHEET_API ? 'CONNECTED ✅' : '(demo mode — paste SHEET_API, see CONNECT.md)'));