// ============================================================
// B-CEYLON — script.js (V3: Google Sheets ticket system)
// LEARN: fetch API, async/await, live data, form → database flow
// Setup: google-apps-script/SETUP.md
// ============================================================

// --- TODO: set your NEXT event date. Format: YYYY-MM-DDTHH:MM:SS+05:30 ---
const NEXT_EVENT = new Date('2026-12-31T19:00:00+05:30');
const WHATSAPP = '94701742032'; // B-Ceylon reservations: +94 70 174 2032 ✅

// ===== TICKET SYSTEM CONFIG =====
// 1. Follow google-apps-script/SETUP.md, then paste your Web app URL here:
const SHEET_API = 'https://script.google.com/macros/s/AKfycbyubwwfy_LEcPip-XA0gwldBuqZWk9fPPWlLr6Edoo5kGBV3oE9iltXvMszdyMMW47ySQ/exec'; // e.g. 'https://script.google.com/macros/s/AKfyc.../exec'
// 2. If you set a SECRET in Code.gs, paste the SAME value here (else leave ''):
const SHEET_KEY = '';
// 3. Shown before the Sheet connects — keep identical to Code.gs CONFIG.LIMITS:
const FALLBACK_LIMITS = { normal: 220, vip: 50, vvip: 30 };
// 4. Tier → section + seats consumed per unit (⚠️ confirm table seats with team!)
const TIER_MAP = {
  '3000':  { label: 'Phase One Solo',   category: 'normal', seats: 1 },
  '15000': { label: 'Phase One Bundle', category: 'normal', seats: 5 },
  '3500':  { label: 'At Gate Solo',     category: 'normal', seats: 1 },
  '17500': { label: 'At Gate Bundle',   category: 'normal', seats: 5 },
  '35000': { label: 'Elite Pass VIP',   category: 'vip',    seats: 8 },
  '50000': { label: 'Royal Access VIP', category: 'vvip',   seats: 12 }
};

document.getElementById('year').textContent = new Date().getFullYear();

// --- Mobile menu ---
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('active');
});

// --- Countdown (with tick pop on seconds change) ---
let lastSec = -1;
function tick() {
  const diff = NEXT_EVENT - new Date();
  if (diff <= 0) return;
  const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24,
        m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
  document.getElementById('cd-d').textContent = d;
  document.getElementById('cd-h').textContent = String(h).padStart(2, '0');
  document.getElementById('cd-m').textContent = String(m).padStart(2, '0');
  const sEl = document.getElementById('cd-s');
  sEl.textContent = String(s).padStart(2, '0');
  if (s !== lastSec) { // pop animation every new second
    lastSec = s;
    sEl.classList.remove('tick'); void sEl.offsetWidth; sEl.classList.add('tick');
  }
}
tick(); setInterval(tick, 1000);

// --- Gallery filter by date (+ pop animation) ---
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    document.querySelectorAll('.g-item').forEach(item => {
      const show = f === 'all' || item.dataset.filter === f;
      item.classList.toggle('hide', !show);
      if (show) { item.classList.remove('pop'); void item.offsetWidth; item.classList.add('pop'); }
    });
  });
});

// --- Lightbox: fullscreen photo viewer ---
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCap = document.getElementById('lbCap');
let lbList = [], lbIdx = 0;

function visiblePhotos() {
  return [...document.querySelectorAll('.g-item:not(.locked):not(.hide)')];
}
function openLb(item) {
  lbList = visiblePhotos();
  lbIdx = lbList.indexOf(item);
  showLb();
  lb.classList.add('open');
  lb.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // lock scroll behind lightbox
}
function showLb() {
  const item = lbList[lbIdx];
  lbImg.src = item.querySelector('img').src;
  lbImg.alt = item.querySelector('img').alt;
  lbCap.textContent = item.querySelector('figcaption').textContent;
}
function closeLb() {
  lb.classList.remove('open');
  lb.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function stepLb(dir) { lbIdx = (lbIdx + dir + lbList.length) % lbList.length; showLb(); }

document.querySelectorAll('.g-item:not(.locked)').forEach(item => {
  item.addEventListener('click', () => openLb(item));
});
document.getElementById('lbClose').addEventListener('click', closeLb);
document.getElementById('lbPrev').addEventListener('click', e => { e.stopPropagation(); stepLb(-1); });
document.getElementById('lbNext').addEventListener('click', e => { e.stopPropagation(); stepLb(1); });
lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
document.addEventListener('keydown', e => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') closeLb();
  if (e.key === 'ArrowRight') stepLb(1);
  if (e.key === 'ArrowLeft') stepLb(-1);
});

// --- Ticket booking calculator ---
let qty = 2;
const tierSel = document.getElementById('bk-tier');
const qtyVal = document.getElementById('qty-val');
const totalEl = document.getElementById('bk-total');
const fmt = n => 'Rs. ' + n.toLocaleString('en-LK');

function updateTotal() {
  qtyVal.textContent = qty;
  totalEl.textContent = fmt(tierSel.value * qty);
}
document.getElementById('qty-plus').addEventListener('click', () => { if (qty < 20) qty++; updateTotal(); });
document.getElementById('qty-minus').addEventListener('click', () => { if (qty > 1) qty--; updateTotal(); });
tierSel.addEventListener('change', updateTotal);
updateTotal();

// Tier "Select" buttons sync the dropdown
document.querySelectorAll('.tier-pick').forEach(btn => {
  btn.addEventListener('click', () => {
    tierSel.value = btn.dataset.price;
    updateTotal();
    document.getElementById('bookingForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

// ============================================================
// LIVE SEATS — Google Sheets backend (near real-time, 30s refresh)
// ============================================================
let liveCounts = null; // latest {sections:{normal:{limit,sold,left},...}} from Sheet
const tierInfo = () => TIER_MAP[tierSel.value];

function showResult(type, html) {
  const el = document.getElementById('bookResult');
  el.hidden = false;
  el.className = 'book-result ' + type;
  el.innerHTML = html;
}
function hideResult() { document.getElementById('bookResult').hidden = true; }

// Seats hint under the tier dropdown ("Section VIP • 42 left • you need 8")
function updateTierHint() {
  const t = tierInfo();
  const need = t.seats * qty;
  const hint = document.getElementById('tierHint');
  if (liveCounts) {
    const left = liveCounts.sections[t.category].left;
    hint.classList.toggle('warn', need > left);
    hint.innerHTML = need > left
      ? `⚠️ Section ${t.category.toUpperCase()}: only <strong>${left}</strong> left — you need ${need}. Lower qty or pick another tier.`
      : `Section: <strong>${t.category.toUpperCase()}</strong> • <strong>${left}</strong> seats left • Your selection needs <strong>${need}</strong> seat(s) ✅`;
  } else {
    hint.classList.remove('warn');
    hint.innerHTML = `Section: <strong>${t.category.toUpperCase()}</strong> • Your selection needs <strong>${need}</strong> seat(s) • Live count connects after Sheet setup`;
  }
}
tierSel.addEventListener('change', () => { updateTierHint(); hideResult(); });
document.getElementById('qty-plus').addEventListener('click', updateTierHint);
document.getElementById('qty-minus').addEventListener('click', updateTierHint);

function renderSeats(d) {
  document.getElementById('liveDot').classList.add('on');
  document.getElementById('seatsUpdated').textContent =
    'live • updated ' + new Date().toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  let totalLeft = 0, totalLimit = 0;
  ['normal', 'vip', 'vvip'].forEach(c => {
    const s = d.sections[c];
    totalLeft += s.left; totalLimit += s.limit;
    document.getElementById('left-' + c).textContent = s.left;
    document.getElementById('sold-' + c).textContent = s.sold + ' sold / ' + s.limit + ' total';
    document.getElementById('bar-' + c).style.width = (s.limit ? (s.sold / s.limit * 100) : 0) + '%';
    document.getElementById('card-' + c).classList.toggle('soldout', s.left === 0);
  });
  document.getElementById('seatsTotal').innerHTML =
    `Total remaining: <strong>${totalLeft} / ${totalLimit}</strong> seats 🎫`;
  updateTierHint();
}

function renderOffline() {
  // Sheet not connected yet → show limits as a preview, booking falls back to WhatsApp
  document.getElementById('seatsUpdated').textContent = 'demo — connect Google Sheet for live counts';
  ['normal', 'vip', 'vvip'].forEach(c => {
    document.getElementById('left-' + c).textContent = FALLBACK_LIMITS[c];
    document.getElementById('sold-' + c).textContent = '0 sold / ' + FALLBACK_LIMITS[c] + ' total';
    document.getElementById('bar-' + c).style.width = '0%';
  });
  const total = FALLBACK_LIMITS.normal + FALLBACK_LIMITS.vip + FALLBACK_LIMITS.vvip;
  document.getElementById('seatsTotal').innerHTML = `Total capacity: <strong>${total}</strong> seats 🎫`;
  updateTierHint();
}

async function fetchCounts() {
  if (!SHEET_API) { renderOffline(); return; }
  try {
    const res = await fetch(SHEET_API + '?action=counts');
    const d = await res.json();
    if (d.ok) { liveCounts = d; renderSeats(d); } else { renderOffline(); }
  } catch (err) { renderOffline(); }
}
fetchCounts();
setInterval(fetchCounts, 30000); // refresh every 30 seconds

// WhatsApp redirect (with Booking ID when the Sheet reserved seats)
function whatsappRedirect(bookingId) {
  const name = document.getElementById('bk-name').value.trim();
  const phone = document.getElementById('bk-phone').value.trim();
  const email = document.getElementById('bk-email').value.trim();
  const event = document.getElementById('bk-event').value;
  const t = tierInfo();
  let msg = `Hello B-Ceylon! 🎧%0A%0AI want to book tickets:`;
  if (bookingId) msg += `%0A• Booking ID: ${bookingId}`;
  msg += `%0A• Name: ${encodeURIComponent(name)}%0A• Phone: ${encodeURIComponent(phone)}`;
  if (email) msg += `%0A• Email: ${encodeURIComponent(email)}`;
  msg += `%0A• Event: ${encodeURIComponent(event)}%0A• Section: ${t.category.toUpperCase()}%0A• Tier: ${encodeURIComponent(t.label)}%0A• Qty: ${qty} (= ${t.seats * qty} seats)%0A• Total: ${encodeURIComponent(totalEl.textContent)}`;
  window.location.href = `https://wa.me/${WHATSAPP}?text=${msg}`;
}

// Reserve in Sheet first, then hand off to WhatsApp for payment/confirmation
document.getElementById('bk-submit').addEventListener('click', async () => {
  const name = document.getElementById('bk-name').value.trim();
  const phone = document.getElementById('bk-phone').value.trim();
  const email = document.getElementById('bk-email').value.trim();
  if (!name || !phone) { showResult('err', '⚠️ Please enter your name and phone number 🙏'); return; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showResult('err', '⚠️ That email address looks invalid'); return; }

  // Sheet not connected yet → classic WhatsApp-only booking (old behavior)
  if (!SHEET_API) {
    whatsappRedirect(null);
    return;
  }

  const t = tierInfo();
  const need = t.seats * qty;
  if (liveCounts && need > liveCounts.sections[t.category].left) {
    showResult('err', `⚠️ Only ${liveCounts.sections[t.category].left} seat(s) left in ${t.category.toUpperCase()} — lower qty or pick another tier.`);
    return;
  }

  showResult('info', '⏳ Reserving your seats…');
  try {
    const params = new URLSearchParams({
      action: 'book', key: SHEET_KEY,
      name, phone, email,
      event: document.getElementById('bk-event').value,
      category: t.category, tier: t.label,
      units: String(qty), seatsEach: String(t.seats),
      total: String(tierSel.value * qty)
    });
    const d = await (await fetch(SHEET_API + '?' + params.toString())).json();
    if (d.ok) {
      liveCounts = d; renderSeats(d);
      showResult('ok', `✅ Reserved! Booking ID: <strong>${d.bookingId}</strong> (${d.seats} seat(s)) — taking you to WhatsApp to confirm payment…`);
      setTimeout(() => whatsappRedirect(d.bookingId), 1500);
    } else {
      showResult('err', '⚠️ ' + (d.error || 'Booking failed, try again'));
      fetchCounts();
    }
  } catch (err) {
    showResult('info', '⚠️ Could not reach booking server — continuing on WhatsApp, your seats are NOT reserved yet.');
    setTimeout(() => whatsappRedirect(null), 1500);
  }
});

// --- 3D tilt + glare on cards (desktop only) ---
if (window.matchMedia('(pointer:fine)').matches) {
  document.querySelectorAll('.tilt').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-4px)`;
      card.style.setProperty('--mx', (x * 100 + 50) + '%'); // glare follows mouse
      card.style.setProperty('--my', (y * 100 + 50) + '%');
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  // --- Hero mouse parallax: content + orbs drift in 3D ---
  const hero = document.querySelector('.hero');
  const heroInner = document.getElementById('heroInner');
  const orbs = document.querySelectorAll('.orb');
  hero.addEventListener('mousemove', e => {
    const cx = e.clientX / window.innerWidth - 0.5;
    const cy = e.clientY / window.innerHeight - 0.5;
    heroInner.style.transform = `translate3d(${cx * 16}px, ${cy * 16}px, 0)`;
    orbs.forEach((o, i) => {
      const depth = (i + 1) * 22;
      o.style.translate = `${-cx * depth}px ${-cy * depth}px`;
    });
  });

  // --- Cursor glow follows mouse ---
  const glow = document.getElementById('cursorGlow');
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });
}

// --- Scroll: progress bar + navbar glow + back-to-top ---
const progress = document.getElementById('progress');
const navbar = document.getElementById('navbar');
const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => {
  const max = document.body.scrollHeight - window.innerHeight;
  progress.style.width = (window.scrollY / max * 100) + '%';
  navbar.classList.toggle('scrolled', window.scrollY > 40);
  toTop.classList.toggle('show', window.scrollY > 600);
}, { passive: true });
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// --- Scroll reveal ---
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// --- Hero floating light particles (canvas) ---
const canvas = document.getElementById('lights');
const ctx = canvas.getContext('2d');
let dots = [];
function resize() {
  canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
  dots = Array.from({ length: 70 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    r: Math.random() * 2.5 + 0.5, s: Math.random() * 0.6 + 0.2,
    c: ['168,85,247', '34,211,238', '244,114,182'][Math.floor(Math.random() * 3)]
  }));
}
resize(); window.addEventListener('resize', resize);
(function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dots.forEach(d => {
    d.y -= d.s; if (d.y < -5) { d.y = canvas.height + 5; d.x = Math.random() * canvas.width; }
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7);
    ctx.fillStyle = `rgba(${d.c},0.7)`; ctx.fill();
  });
  requestAnimationFrame(animate);
})();

console.log('🎧 B-Ceylon V3 loaded: sheets ticket system ' + (SHEET_API ? 'CONNECTED ✅' : '(demo mode — paste SHEET_API)') );
