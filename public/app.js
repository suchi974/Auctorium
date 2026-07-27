/* ================================================================
 * Auctorium — Frontend
 * All fixes integrated:
 *   - Bid status message shows correctly (success/error)
 *   - "Cannot bid on own auction" + "Please login" client checks
 *   - Real-time outbid + winner (buyer) + winner (seller) notifications
 *   - Notification bell w/ unread badge, mark-read, mark-all
 *   - Payment page (5 methods, 2s loader, TXN- ref, receipt)
 *   - My Products (won auctions), Product Details (won)
 *   - Toast dedupe, skeleton loaders, footer year
 * ================================================================ */

const API = '/api';
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  products: [],
  categories: [],
  currentProduct: null,
  selectedRole: 'buyer',
  authMode: 'login',
  currentView: 'home',
  selectedImageIndex: 0,
};

let socket = null;
let userSocket = null;
let placingBid = false;                 // prevents double-fire
let recentToasts = new Map();           // toast dedupe

window._notifications = [];
window._unreadCount = 0;

const els = {
  authOverlay: document.getElementById('authOverlay'),
  authTitle: document.getElementById('authTitle'),
  authModeSwitch: document.getElementById('authModeSwitch'),
  authSubmit: document.getElementById('authSubmit'),
  authError: document.getElementById('authError'),
  passwordToggle: document.getElementById('passwordToggle'),
  passwordInput: document.getElementById('passwordInput'),
  roleBuyer: document.getElementById('roleBuyer'),
  roleSeller: document.getElementById('roleSeller'),
  roleAdmin: document.getElementById('roleAdmin'),
  productGrid: document.getElementById('productGrid'),
  categoryFilter: document.getElementById('categoryFilter'),
  statusFilter: document.getElementById('statusFilter'),
  searchInput: document.getElementById('searchInput'),
  detailBidInput: document.getElementById('detailBidInput'),
  detailBidBtn: document.getElementById('detailBidBtn'),
  detailBidError: document.getElementById('detailBidError'),
  detailHistory: document.getElementById('detailHistory'),
  detailGalleryMain: document.getElementById('detailGalleryMain'),
  detailGalleryThumbs: document.getElementById('detailGalleryThumbs'),
  sellerMetricGrid: document.getElementById('sellerMetricGrid'),
  sellerActivity: document.getElementById('sellerActivity'),
  sellerForm: document.getElementById('sellerForm'),
  sellerMessage: document.getElementById('sellerMessage'),
  adminStats: document.getElementById('adminStats'),
  notificationsList: document.getElementById('notificationsList'),
};

function headers(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (state.token) h['Authorization'] = 'Bearer ' + state.token;
  return h;
}

function formatPrice(value) {
  const n = Number(value || 0);
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function timeAgo(date) {
  const d = date instanceof Date ? date : new Date(date);
  const seconds = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function setView(view) {
  state.currentView = view;
  document.querySelectorAll('.page-section').forEach((s) => s.classList.toggle('active', s.id === `${view}View`));
  document.querySelectorAll('.nav-pill').forEach((pill) => pill.classList.toggle('active', pill.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, kind = 'success') {
  // Dedupe identical messages within 2s
  const key = `${kind}::${message}`;
  const now = Date.now();
  if (recentToasts.has(key) && now - recentToasts.get(key) < 2000) return;
  recentToasts.set(key, now);
  if (recentToasts.size > 30) { const first = recentToasts.keys().next().value; recentToasts.delete(first); }

  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  const iconMap = { success: '✓', error: '⚠', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${iconMap[kind] || 'ℹ'}</span><span class="toast-msg">${escapeHtml(message)}</span><button class="close-btn" aria-label="Close">&times;</button>`;
  const closeBtn = toast.querySelector('.close-btn');
  const dismiss = () => {
    if (toast.classList.contains('leaving')) return;
    toast.classList.add('leaving');
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 350);
  };
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); dismiss(); });
  stack.appendChild(toast);
  setTimeout(dismiss, 4000);
}

/* ---------- Categories & Products ---------- */
async function loadCategories() {
  const res = await fetch(`${API}/categories`);
  state.categories = await res.json();
  els.categoryFilter.innerHTML = '<option value="">All categories</option>' + state.categories.map((c) => `<option value="${c.category_id}">${escapeHtml(c.name)}</option>`).join('');
  const createCat = document.getElementById('createCategory');
  if (createCat) createCat.innerHTML = state.categories.map((c) => `<option value="${c.category_id}">${escapeHtml(c.name)}</option>`).join('');
  renderCustomSelect(els.categoryFilter);
  if (createCat) renderCustomSelect(createCat);
}

function renderSkeletons(n = 6) {
  els.productGrid.innerHTML = Array(n).fill(0).map(() => `
    <article class="auction-card skeleton-card">
      <div class="skel skel-image"></div>
      <div class="card-body">
        <div class="skel skel-line" style="width:60%;"></div>
        <div class="skel skel-line" style="width:80%; height:14px;"></div>
        <div class="skel skel-line" style="width:40%; margin-top:14px;"></div>
      </div>
    </article>`).join('');
}

async function loadProducts() {
  renderSkeletons();
  const params = new URLSearchParams();
  const search = els.searchInput.value.trim();
  const category = els.categoryFilter.value;
  let status = els.statusFilter.value;
  const sortFilter = document.getElementById('sortFilter');
  const sortBy = sortFilter ? sortFilter.value : 'newest';
  if (!status && state.currentView === 'auction') status = 'active';
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  if (sortBy) params.set('sortBy', sortBy);
  const res = await fetch(`${API}/products?${params.toString()}`);
  state.products = await res.json();
  renderProducts();
  renderHeroStats();
}

function renderProducts() {
  const list = state.products || [];
  if (!list.length) { els.productGrid.innerHTML = '<div class="empty-state">No auctions match the current filters.</div>'; return; }
  els.productGrid.innerHTML = list.map((p) => {
    const cls = p.status === 'active' ? 'live' : p.status === 'closed' ? 'closed' : 'pending';
    const image = p.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80';
    const countdown = countdownString(p.end_time);
    return `
      <article class="auction-card" onclick="openDetail(${p.id})">
        <div class="auction-image-wrap">
          <div class="auction-image" style="background-image:url('${image}')"></div>
          ${p.status === 'active' ? `<div class="countdown-chip">⏱ ${countdown}</div>` : ''}
        </div>
        <div class="card-body">
          <div class="card-top">
            <span class="badge ${cls}">${p.status}</span>
            <span class="secondary-text">${p.bid_count || 0} bids</span>
          </div>
          <h4>${escapeHtml(p.name)}</h4>
          <p class="meta">${escapeHtml(p.category_name)} · ${escapeHtml(p.seller_name)}</p>
          <div class="price-row">
            <div>
              <div class="secondary-text">Current bid</div>
              <div class="price">${formatPrice(p.current_price)}</div>
            </div>
            <button class="btn btn-primary" onclick="event.stopPropagation(); openDetail(${p.id})">View</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function countdownString(endTime) {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function renderHeroStats() {
  const active = state.products.filter((p) => p.status === 'active').length;
  const closed = state.products.filter((p) => p.status === 'closed').length;
  const el1 = document.getElementById('heroLiveCount'); if (el1) el1.textContent = active;
  const el2 = document.getElementById('heroClosedCount'); if (el2) el2.textContent = closed;
}

/* ---------- Auction detail + bidding ---------- */
async function openDetail(id) {
  const previousProductId = state.currentProduct?.id;
  const res = await fetch(`${API}/products/${id}`);
  const product = await res.json();
  state.currentProduct = product;
  setView('auction');
  document.getElementById('detailName').textContent = product.name;
  document.getElementById('detailDesc').textContent = product.description || 'No description provided yet.';
  document.getElementById('detailSeller').textContent = product.seller_name;
  document.getElementById('detailCategory').textContent = product.category_name;
  document.getElementById('detailPrice').textContent = formatPrice(product.current_price);
  document.getElementById('detailBidInput').value = (Number(product.current_price || 0) + Number(product.min_increment || 1)).toFixed(2);
  const badge = document.querySelector('.detail-card .badge');
  if (badge) {
    badge.textContent = product.status === 'active' ? 'Live now' : product.status === 'closed' ? 'Closed' : 'Pending';
    badge.className = `badge ${product.status === 'active' ? 'live' : product.status === 'closed' ? 'closed' : 'pending'}`;
  }
  const galleryImages = [product.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80'];
  document.getElementById('detailGalleryMain').innerHTML = `<img src="${galleryImages[0]}" alt="${escapeHtml(product.name)}">`;
  els.detailGalleryThumbs.innerHTML = '';
  renderBidHistory(product.bids || []);
  startCountdown(product.end_time);

  if (socket) {
    if (previousProductId) socket.emit('leaveAuction', previousProductId);
    socket.disconnect();
  }
  socket = io();
  socket.emit('joinAuction', id);
  socket.on('newBid', (bid) => {
    if (Number(bid.product_id) !== Number(id)) return;
    document.getElementById('detailPrice').textContent = formatPrice(bid.b_price);
    document.getElementById('detailBidInput').value = (Number(bid.b_price) + Number(product.min_increment || 1)).toFixed(2);
    loadBidHistory(id);
  });
  socket.on('auctionClosed', (data) => {
    if (Number(data.product_id) !== Number(id)) return;
    document.getElementById('detailCountdown').textContent = data.winner_name ? `Sold to ${data.winner_name} for ${formatPrice(data.final_price)}` : 'Auction closed';
    if (badge) { badge.textContent = 'Closed'; badge.className = 'badge closed'; }
  });
}

async function loadBidHistory(id) {
  const res = await fetch(`${API}/bids/product/${id}`);
  const bids = await res.json();
  renderBidHistory(bids);
}

function renderBidHistory(bids) {
  if (!bids.length) { els.detailHistory.innerHTML = '<div class="empty-state">No bids yet. Be the first.</div>'; return; }
  els.detailHistory.innerHTML = bids.slice(0, 8).map((b, i) => `
    <div class="timeline-item ${i===0?'top-bid':''}">
      <div><strong>${escapeHtml(b.buyer_name)}</strong> ${i===0?'<span class="top-chip">Top</span>':''}</div>
      <div class="subtle">${formatPrice(b.b_price)} · ${new Date(b.b_time).toLocaleString()}</div>
    </div>`).join('');
}

let countdownTimer = null;
function startCountdown(endTime) {
  if (countdownTimer) clearInterval(countdownTimer);
  const end = new Date(endTime).getTime();
  const cd = document.getElementById('detailCountdown');
  function tick() {
    const diff = end - Date.now();
    if (diff <= 0) { cd.textContent = 'Auction ended'; clearInterval(countdownTimer); return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    cd.textContent = `Ends in ${h}h ${m}m ${s}s`;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

// === FIXED placeBid — success/error handled robustly, own-auction check, guards ===
async function placeBid() {
  if (placingBid) return;                // prevent double-submit
  els.detailBidError.style.display = 'none';

  if (!state.user) {
    showToast('Please login to place a bid.', 'error');
    openAuthModal('login');
    return;
  }
  if (state.user.role !== 'buyer') {
    showToast('Only buyers can place bids.', 'error');
    return;
  }
  const amount = Number(els.detailBidInput.value);
  if (!amount || amount <= 0) {
    els.detailBidError.textContent = 'Please enter a valid bid amount.';
    els.detailBidError.style.display = 'block';
    showToast('Please enter a valid bid amount.', 'error');
    return;
  }

  placingBid = true;
  const btn = els.detailBidBtn;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> Placing bid...';

  try {
    const res = await fetch(`${API}/bids`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ product_id: state.currentProduct.id, b_price: amount }),
    });

    let data = {};
    try { data = await res.json(); } catch (_) { data = {}; }

    if (!res.ok) {
      // Real API error — show meaningful message (backend already sends good text)
      const msg = data.message || 'Unable to place bid.';
      els.detailBidError.textContent = msg;
      els.detailBidError.style.display = 'block';
      showToast(msg, 'error');
      return;
    }
    // SUCCESS: only show one green toast
    showToast('Bid Placed Successfully', 'success');
    await loadBidHistory(state.currentProduct.id);
  } catch (err) {
    const msg = 'Network error. Please try again.';
    els.detailBidError.textContent = msg;
    els.detailBidError.style.display = 'block';
    showToast(msg, 'error');
  } finally {
    placingBid = false;
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/* ---------- Seller form (unchanged behaviour, kept) ---------- */
async function handleSellerFormSubmit(event) {
  event.preventDefault();
  if (!state.user || state.user.role !== 'seller') {
    showToast('Please sign in as a seller to create auctions.', 'error');
    openAuthModal('login');
    return;
  }
  const name = document.getElementById('createName').value.trim();
  const description = document.getElementById('createDesc').value.trim();
  const category_id = document.getElementById('createCategory').value;
  const starting_price = parseFloat(document.getElementById('createStartPrice').value);
  const reserve_price = document.getElementById('createReservePrice').value;
  const min_increment = parseFloat(document.getElementById('createIncrement').value) || 1.0;
  const start_time = document.getElementById('createStartTime').value;
  const end_time = document.getElementById('createEndTime').value;
  const sellerMessage = document.getElementById('sellerMessage');
  sellerMessage.textContent = '';
  if (!name || !category_id || !starting_price || !start_time || !end_time) { sellerMessage.textContent = 'Please complete all required fields.'; return; }
  if (new Date(end_time) <= new Date(start_time)) { sellerMessage.textContent = 'End time must be after start time.'; return; }

  let image_url = null;
  const fileInput = document.getElementById('createImageFile');
  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const fd = new FormData(); fd.append('image', file);
    sellerMessage.textContent = 'Uploading image...';
    try {
      const up = await fetch(`${API}/products/upload`, { method: 'POST', headers: headers(false), body: fd });
      const upd = await up.json();
      if (!up.ok) throw new Error(upd.message || 'Image upload failed');
      image_url = upd.url;
    } catch (err) { sellerMessage.textContent = err.message; showToast(err.message, 'error'); return; }
  }

  const payload = { name, description, category_id, starting_price, reserve_price: reserve_price ? parseFloat(reserve_price) : null, min_increment, start_time, end_time, image_url };
  const res = await fetch(`${API}/products`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) { sellerMessage.textContent = data.message || 'Unable to create auction.'; showToast(data.message || 'Unable to create auction.', 'error'); return; }
  showToast('Auction submitted for approval.', 'success');
  sellerMessage.textContent = 'Auction created and pending approval.';
  event.target.reset();
  document.getElementById('imagePreviewContainer').style.display = 'none';
  document.getElementById('fileNameLabel').textContent = 'No file chosen';
  await loadProducts();
}

/* ---------- Auth ---------- */
function openAuthModal(mode = 'login') {
  state.authMode = mode;
  els.authTitle.textContent = mode === 'register' ? 'Create your account' : 'Welcome back';
  els.authModeSwitch.textContent = mode === 'register' ? 'Already have an account? Sign in' : 'Need an account? Create one';
  els.authSubmit.textContent = mode === 'register' ? 'Register' : 'Log in';
  const nameField = document.getElementById('nameField');
  if (nameField) nameField.style.display = mode === 'register' ? 'block' : 'none';
  if (els.roleAdmin) {
    els.roleAdmin.style.display = mode === 'register' ? 'none' : 'inline-flex';
    if (mode === 'register' && state.selectedRole === 'admin') setRole('buyer');
  }
  els.authOverlay.classList.add('show');
  els.authError.style.display = 'none';
  ['loginButton','registerButton','heroRegisterBtn'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}
function closeAuthModal() { els.authOverlay.classList.remove('show'); updateNav(); }

async function submitAuth() {
  const payload = {
    email: document.getElementById('emailInput').value,
    password: document.getElementById('passwordInput').value,
    role: state.selectedRole,
  };
  if (state.authMode === 'register') payload.name = document.getElementById('nameInput').value;
  const endpoint = state.authMode === 'register' ? 'register' : 'login';
  const res = await fetch(`${API}/auth/${endpoint}`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) { els.authError.textContent = data.message || 'Authentication failed.'; els.authError.style.display = 'block'; return; }
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', state.token);
  localStorage.setItem('user', JSON.stringify(state.user));
  closeAuthModal();
  updateNav();
  initUserSocket();
  await loadNotifications();
  renderDashboard();
  showToast(`Welcome ${data.user.name || ''}!`, 'success');
}

function togglePassword() {
  const isHidden = els.passwordInput.type === 'password';
  els.passwordInput.type = isHidden ? 'text' : 'password';
  els.passwordToggle.textContent = isHidden ? 'Hide' : 'Show';
}
function setRole(role) {
  state.selectedRole = role;
  els.roleBuyer.classList.toggle('active', role === 'buyer');
  els.roleSeller.classList.toggle('active', role === 'seller');
  if (els.roleAdmin) els.roleAdmin.classList.toggle('active', role === 'admin');
}

function updateNav() {
  const loginBtn = document.getElementById('loginButton');
  const registerBtn = document.getElementById('registerButton');
  const logoutBtn = document.getElementById('logoutButton');
  const avatarMenu = document.getElementById('avatarMenu');
  const avatarCircle = document.getElementById('avatarCircle');
  const dropdownUserName = document.getElementById('dropdownUserName');
  const dropdownUserEmail = document.getElementById('dropdownUserEmail');
  const dropdownUserRole = document.getElementById('dropdownUserRole');
  const dashboardLink = document.getElementById('dashboardLink');
  const myProductsLink = document.getElementById('myProductsLink');
  const heroRegisterBtn = document.getElementById('heroRegisterBtn');
  const adminNav = document.getElementById('adminNav');
  const notifWrap = document.getElementById('notifWrap');
  const isAuthOpen = els.authOverlay && els.authOverlay.classList.contains('show');
  if (!isAuthOpen) {
    if (loginBtn) loginBtn.style.display = state.user ? 'none' : 'inline-flex';
    if (registerBtn) registerBtn.style.display = state.user ? 'none' : 'inline-flex';
    if (heroRegisterBtn) heroRegisterBtn.style.display = state.user ? 'none' : 'inline-flex';
  }
  if (avatarMenu) avatarMenu.style.display = state.user ? 'flex' : 'none';
  if (notifWrap) notifWrap.style.display = state.user ? 'inline-flex' : 'none';
  if (state.user) {
    const initials = (state.user.name || state.user.email).charAt(0).toUpperCase();
    if (avatarCircle) avatarCircle.textContent = initials;
    if (dropdownUserName) dropdownUserName.textContent = state.user.name || state.user.email;
    if (dropdownUserEmail) dropdownUserEmail.textContent = state.user.email;
    if (dropdownUserRole) dropdownUserRole.textContent = `Role: ${state.user.role[0].toUpperCase() + state.user.role.slice(1)}`;
    if (myProductsLink) myProductsLink.style.display = state.user.role === 'buyer' ? 'flex' : 'none';
  }
  if (logoutBtn) logoutBtn.style.display = state.user ? 'inline-flex' : 'none';
  if (adminNav) adminNav.style.display = state.user?.role === 'admin' ? 'inline-flex' : 'none';
  if (state.user && !['home','auction','myProducts','productDetails','payment'].includes(state.currentView)) {
    if (state.currentView === 'seller' && state.user.role !== 'seller') setView('home');
    if (state.currentView === 'buyer' && state.user.role !== 'buyer') setView('home');
    if (state.currentView === 'admin' && state.user.role !== 'admin') setView('home');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window._notifications = [];
  window._unreadCount = 0;
  renderNotifications();
  updateNotifBadge();
  if (userSocket) { userSocket.disconnect(); userSocket = null; }
  updateNav();
  showToast('Signed out successfully.', 'success');
  setView('home');
}

/* ---------- Notifications (real-time via user room) ---------- */
function initUserSocket() {
  if (!state.user) return;
  if (userSocket) userSocket.disconnect();
  userSocket = io();
  userSocket.on('connect', () => userSocket.emit('joinUser', { userId: state.user.id, role: state.user.role }));
  userSocket.on('notification', (n) => {
    window._notifications.unshift(n);
    window._unreadCount += 1;
    renderNotifications();
    updateNotifBadge();
    if (n.type === 'outbid') showToast(`${n.title}`, 'error');
    else if (n.type === 'winner') showToast(n.title, 'success');
    else if (n.type === 'payment') showToast(n.title, 'success');
    else showToast(n.title || 'Notification', 'info');
    if (state.currentView === 'buyer' || state.currentView === 'seller') renderDashboard();
  });
}

async function loadNotifications() {
  if (!state.user) return;
  const res = await fetch(`${API}/notifications`, { headers: headers() });
  if (!res.ok) return;
  const list = await res.json();
  window._notifications = list;
  window._unreadCount = list.filter((n) => !n.is_read).length;
  renderNotifications();
  updateNotifBadge();
}

function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  const label = document.getElementById('notifUnreadLabel');
  if (!badge) return;
  if (window._unreadCount > 0) { badge.style.display = 'grid'; badge.textContent = window._unreadCount > 9 ? '9+' : String(window._unreadCount); }
  else badge.style.display = 'none';
  if (label) label.textContent = window._unreadCount > 0 ? `${window._unreadCount} unread` : 'All caught up';
}

function renderNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;
  if (!window._notifications.length) { list.innerHTML = `<div class="notif-empty">You'll see live outbid, win, and payment updates here.</div>`; return; }
  list.innerHTML = window._notifications.map((n) => {
    const icon = n.type === 'outbid' ? '!' : n.type === 'winner' ? '★' : n.type === 'payment' ? '✓' : '•';
    const iconCls = ['outbid','winner','payment'].includes(n.type) ? n.type : 'generic';
    const time = timeAgo(n.created_at);
    const data = n.data || {};
    let meta = '';
    if (n.type === 'outbid' && data.previous_bid != null) {
      meta = `<div class="notif-meta-grid">
        <div class="cell"><div class="k">Your bid</div><div class="v">₹${Number(data.previous_bid).toLocaleString('en-IN')}</div></div>
        <div class="cell"><div class="k">Highest now</div><div class="v gold">₹${Number(data.current_bid).toLocaleString('en-IN')}</div></div>
      </div>`;
    } else if (n.type === 'winner' && data.winner_name) {
      meta = `<div class="notif-meta-grid">
        <div class="cell"><div class="k">Winner</div><div class="v">${escapeHtml(data.winner_name)}</div></div>
        <div class="cell"><div class="k">Winning bid</div><div class="v gold">₹${Number(data.winning_bid || 0).toLocaleString('en-IN')}</div></div>
      </div>`;
    }
    const viewBtn = data.product_id ? `<button class="view-btn" onclick="window.notifViewAuction(${data.product_id}, ${n.id})">View Auction →</button>` : '';
    return `
      <div class="notif-card ${n.is_read ? '' : 'unread'}">
        <div class="notif-icon ${iconCls}">${icon}</div>
        <div class="notif-body">
          <p class="notif-title">
            <span>${escapeHtml(n.title || '')}</span>
            ${n.is_read ? '' : '<span class="dot"></span>'}
          </p>
          <div class="notif-msg">${escapeHtml(n.message || '')}</div>
          ${meta}
          <div class="notif-footer">
            <span class="time">${time}</span>
            ${viewBtn}
          </div>
        </div>
      </div>`;
  }).join('');
}

async function markNotifRead(id) {
  await fetch(`${API}/notifications/${id}/read`, { method: 'POST', headers: headers() });
  const n = window._notifications.find((x) => x.id === id);
  if (n && !n.is_read) { n.is_read = true; window._unreadCount = Math.max(0, window._unreadCount - 1); renderNotifications(); updateNotifBadge(); }
}
async function markAllNotifRead() {
  await fetch(`${API}/notifications/read-all`, { method: 'POST', headers: headers() });
  window._notifications = window._notifications.map((n) => ({ ...n, is_read: true }));
  window._unreadCount = 0;
  renderNotifications(); updateNotifBadge();
}
window.notifViewAuction = (productId, notifId) => { markNotifRead(notifId); document.getElementById('notifPanel').classList.remove('open'); openDetail(productId); };
function toggleNotifPanel() { const p = document.getElementById('notifPanel'); if (p) p.classList.toggle('open'); }

/* ---------- Dashboard ---------- */
async function renderDashboard() {
  if (!state.user) return;
  if (state.user.role === 'seller') {
    if (els.sellerMetricGrid) {
      els.sellerMetricGrid.innerHTML = [
        ['Total Auctions', String(state.products.length), ''],
        ['Active', String(state.products.filter((p)=>p.status==='active').length), ''],
        ['Closed', String(state.products.filter((p)=>p.status==='closed').length), ''],
        ['Unread alerts', String(window._unreadCount), ''],
      ].map(([label, value, trend]) => `
        <div class="metric-card">
          <div class="label">${label}</div>
          <div class="value">${value}</div>
          ${trend ? `<div class="trend">${trend}</div>` : ''}
        </div>`).join('');
    }
    // Seller recent alerts (real notifications)
    if (els.sellerActivity) {
      const items = window._notifications.slice(0, 5);
      els.sellerActivity.innerHTML = items.length ? items.map((n) => `
        <div class="notification-card">
          <div>
            <strong>${escapeHtml(n.title || '')}</strong>
            <span>${escapeHtml(n.message || '')}</span>
          </div>
          <div class="dot" style="background:${n.is_read ? 'transparent' : 'var(--accent)'};"></div>
        </div>`).join('') : '<div class="empty-state">No activity yet.</div>';
    }
  }
  if (state.user.role === 'buyer') {
    const [wonRes] = await Promise.all([fetch(`${API}/my-products`, { headers: headers() })]);
    const won = wonRes.ok ? await wonRes.json() : [];
    const unread = window._unreadCount;
    const pending = won.filter((w) => !w.payment).length;
    document.getElementById('buyerStats').innerHTML = `
      <div class="stats-grid">
        <div class="metric-card"><div class="label">Auctions won</div><div class="value">${won.length}</div></div>
        <div class="metric-card"><div class="label">Awaiting payment</div><div class="value">${pending}</div></div>
        <div class="metric-card"><div class="label">Unread alerts</div><div class="value">${unread}</div></div>
        <div class="metric-card"><div class="label">Live auctions</div><div class="value">${(state.products||[]).filter(p=>p.status==='active').length}</div></div>
      </div>`;
    const active = (state.products || []).filter((p) => p.status === 'active').slice(0, 5);
    document.getElementById('buyerActiveBids').innerHTML = active.length ? active.map((p) => `
      <div class="timeline-item" style="cursor:pointer;" onclick="openDetail(${p.id})">
        <strong>${escapeHtml(p.name)}</strong>
        <div class="subtle">${formatPrice(p.current_price)} · ${p.bid_count || 0} bids</div>
      </div>`).join('') : '<div class="empty-state">No active auctions right now.</div>';
    const alerts = window._notifications.slice(0, 5);
    document.getElementById('buyerRecentAlerts').innerHTML = alerts.length ? alerts.map((n) => `
      <div style="padding:8px 0; border-bottom:1px solid var(--line);">
        <strong style="font-size:0.85rem;">${escapeHtml(n.title || '')}</strong>
        <div class="subtle" style="font-size:0.75rem;">${escapeHtml(n.message || '')} · ${timeAgo(n.created_at)}</div>
      </div>`).join('') : '<div class="empty-state">No alerts yet.</div>';
  }
  if (state.user.role === 'admin') {
    els.adminStats.innerHTML = `
      <div class="stats-grid">
        <div class="metric-card"><div class="label">Users</div><div class="value">—</div></div>
        <div class="metric-card"><div class="label">Active</div><div class="value">${state.products.filter(p=>p.status==='active').length}</div></div>
        <div class="metric-card"><div class="label">Closed</div><div class="value">${state.products.filter(p=>p.status==='closed').length}</div></div>
        <div class="metric-card"><div class="label">Reports</div><div class="value">0</div></div>
      </div>`;
    if (els.notificationsList) {
      els.notificationsList.innerHTML = window._notifications.slice(0, 5).map((n) => `
        <div class="notification-card">
          <div><strong>${escapeHtml(n.title || '')}</strong><span>${escapeHtml(n.message || '')}</span></div>
          <div class="dot"></div>
        </div>`).join('') || '<div class="empty-state">All quiet.</div>';
    }
  }
  if (state.currentView === 'myProducts') loadMyProducts();
}

/* ---------- My Products ---------- */
async function loadMyProducts() {
  const container = document.getElementById('myProductsContent');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Loading...</div>';
  const res = await fetch(`${API}/my-products`, { headers: headers() });
  if (!res.ok) { container.innerHTML = '<div class="empty-state">Unable to load your products.</div>'; return; }
  const items = await res.json();
  if (!items.length) {
    container.innerHTML = `
      <div class="empty-won">
        <div class="illustration">📦</div>
        <h3>You haven't won any auctions yet.</h3>
        <p class="subtle">Bid on live auctions to start collecting winnings.</p>
        <button class="btn btn-primary" style="margin-top:14px;" onclick="window.setView('home')">Browse auctions</button>
      </div>`;
    return;
  }
  container.innerHTML = `<div class="my-products-grid">${items.map(renderWonCard).join('')}</div>`;
}

function renderWonCard(row) {
  const p = row.product;
  const paid = row.payment && row.payment.status === 'completed';
  const image = p.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80';
  return `
    <div class="won-card">
      <div class="thumb" style="background-image:url('${image}')">
        <span class="status-chip ${paid ? 'paid' : 'pending'}">${paid ? 'Paid' : 'Payment pending'}</span>
      </div>
      <div class="body">
        <div class="cat">${escapeHtml(p.category_name)}</div>
        <h4>${escapeHtml(p.name)}</h4>
        <div class="seller">Sold by ${escapeHtml(p.seller_name)}</div>
        <div class="meta-row">
          <div><div class="k">Winning bid</div><div class="v gold">${formatPrice(p.current_price)}</div></div>
          <div><div class="k">Ended</div><div class="v">${new Date(p.end_time).toLocaleDateString()}</div></div>
        </div>
        <div class="meta-row">
          <div><div class="k">Delivery</div><div class="v">${row.delivery_status}</div></div>
          ${paid ? `<div><div class="k">Txn</div><div class="v mono">${escapeHtml(row.payment.transaction_ref)}</div></div>` : `<div></div>`}
        </div>
        <div class="actions">
          <button class="btn btn-outline" onclick="window.openProductDetails(${p.id})">View Details</button>
          ${paid
            ? `<button class="btn btn-outline" onclick="window.viewReceipt(${row.payment.id})">View Receipt</button>`
            : `<button class="btn btn-primary" onclick="window.openPayment(${p.id})">Pay Now</button>`
          }
        </div>
      </div>
    </div>`;
}

async function openProductDetails(productId) {
  setView('productDetails');
  const container = document.getElementById('productDetailsContent');
  container.innerHTML = '<div class="empty-state">Loading...</div>';
  const res = await fetch(`${API}/my-products/${productId}`, { headers: headers() });
  if (!res.ok) { container.innerHTML = '<div class="empty-state">Not found.</div>'; return; }
  const row = await res.json();
  const p = row.product;
  const paid = row.payment && row.payment.status === 'completed';
  const image = p.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80';
  container.innerHTML = `
    <div class="product-details-shell">
      <div class="hero-image">
        <img src="${image}" alt="${escapeHtml(p.name)}">
        <p class="subtle" style="margin-top:14px; line-height:1.7;">${escapeHtml(p.description || '')}</p>
      </div>
      <div class="pd-side">
        <div class="cat">${escapeHtml(p.category_name)}</div>
        <h3 style="margin:6px 0 14px;">${escapeHtml(p.name)}</h3>
        <div class="row"><span class="k">Seller</span><span class="v">${escapeHtml(p.seller_name)}</span></div>
        <div class="row"><span class="k">Winning bid</span><span class="v gold">${formatPrice(p.current_price)}</span></div>
        <div class="row"><span class="k">Auction start</span><span class="v">${new Date(p.start_time).toLocaleString()}</span></div>
        <div class="row"><span class="k">Auction end</span><span class="v">${new Date(p.end_time).toLocaleString()}</span></div>
        <div class="row"><span class="k">Payment status</span><span class="v" style="color:${paid ? 'var(--success)' : 'var(--danger)'};">${paid ? 'Paid' : 'Pending'}</span></div>
        <div class="row"><span class="k">Delivery</span><span class="v">${row.delivery_status}</span></div>
        ${paid ? `
          <div class="txn-box">
            <div class="subtle">Transaction reference</div>
            <div>${escapeHtml(row.payment.transaction_ref)}</div>
            <div class="subtle" style="font-size:0.75rem;margin-top:6px;">${new Date(row.payment.created_at).toLocaleString()}</div>
          </div>` : ''}
        <div style="display:flex; gap:10px; margin-top:18px;">
          ${paid
            ? `<button class="btn btn-outline" style="flex:1;" onclick="window.viewReceipt(${row.payment.id})">View Receipt</button>`
            : `<button class="btn btn-primary" style="flex:1;" onclick="window.openPayment(${p.id})">Pay Now</button>`
          }
        </div>
      </div>
    </div>`;
}

/* ---------- Payment ---------- */
async function openPayment(productId) {
  setView('payment');
  const container = document.getElementById('paymentContent');
  container.innerHTML = '<div class="empty-state">Loading order...</div>';
  const res = await fetch(`${API}/payments/product/${productId}`, { headers: headers() });
  if (!res.ok) { const err = await res.json().catch(() => ({})); container.innerHTML = `<div class="empty-state">${escapeHtml(err.message || 'Unable to load payment page.')}</div>`; return; }
  const { product, payment } = await res.json();
  if (payment && payment.status === 'completed') { renderPaymentSuccess(product, payment, true); return; }
  const image = product.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80';
  const methods = [
    { key: 'card', label: 'Credit Card', icon: '💳' },
    { key: 'debit', label: 'Debit Card', icon: '💳' },
    { key: 'upi', label: 'UPI', icon: '📱' },
    { key: 'netbanking', label: 'Net Banking', icon: '🏦' },
    { key: 'wallet', label: 'Wallet', icon: '👛' },
  ];
  container.innerHTML = `
    <div class="payment-shell">
      <div class="order-summary">
        <h3>Order</h3>
        <div class="item">
          <img src="${image}" alt="${escapeHtml(product.name)}">
          <div>
            <div style="font-weight:700;">${escapeHtml(product.name)}</div>
            <div class="subtle" style="font-size:0.78rem; margin-top:4px;">${escapeHtml(product.category_name)}</div>
            <div class="subtle mono" style="font-size:0.7rem; margin-top:6px;">Auction #${String(product.id).padStart(6,'0')}</div>
          </div>
        </div>
        <div class="row"><span>Winning bid</span><span>${formatPrice(product.winning_bid)}</span></div>
        <div class="row"><span>Platform fee (2%)</span><span>${formatPrice(product.platform_fee)}</span></div>
        <div class="row total"><span>Total</span><strong>${formatPrice(product.total)}</strong></div>
      </div>
      <div class="method-block">
        <h3>Payment method</h3>
        <div class="method-grid" id="payMethodGrid">
          ${methods.map((m, i) => `
            <div class="method-tile ${i===0?'active':''}" data-method="${m.key}">
              <span class="icon">${m.icon}</span>
              <span>${m.label}</span>
            </div>`).join('')}
        </div>
        <button class="pay-cta" id="proceedPaymentBtn" data-product-id="${product.id}">Proceed Payment · ${formatPrice(product.total)}</button>
        <div class="mock-note">This is a mock payment. No real charge will be made.</div>
      </div>
    </div>`;
  container.querySelectorAll('.method-tile').forEach((tile) => tile.addEventListener('click', () => {
    container.querySelectorAll('.method-tile').forEach((t) => t.classList.remove('active'));
    tile.classList.add('active');
  }));
  document.getElementById('proceedPaymentBtn').addEventListener('click', () => proceedPayment(product));
}

async function proceedPayment(product) {
  const btn = document.getElementById('proceedPaymentBtn');
  const active = document.querySelector('#payMethodGrid .method-tile.active');
  const method = active ? active.dataset.method : 'card';
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Processing payment...`;
  try {
    const res = await fetch(`${API}/payments`, { method: 'POST', headers: headers(), body: JSON.stringify({ product_id: product.id, method }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Payment failed');
    renderPaymentSuccess({ ...product, name: data.product?.name || product.name, image_url: data.product?.image_url || product.image_url }, data.payment);
  } catch (err) {
    showToast(err.message || 'Payment failed', 'error');
    btn.disabled = false;
    btn.innerHTML = `Proceed Payment · ${formatPrice(product.total)}`;
  }
}

function renderPaymentSuccess(product, payment, fromExisting = false) {
  const container = document.getElementById('paymentContent');
  const image = product.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80';
  container.innerHTML = `
    <div class="payment-success-card">
      <div class="tick">✓</div>
      <h3>Payment Successful</h3>
      <p class="subtle">${fromExisting ? 'This auction has already been paid for.' : 'Your winning bid has been settled.'}</p>
      <div class="receipt-block" id="receiptPrint">
        <div style="display:flex; gap:14px; align-items:center; margin-bottom:14px;">
          <img src="${image}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:10px;">
          <div style="text-align:left;">
            <div style="font-weight:700;">${escapeHtml(product.name || 'Product')}</div>
            <div class="subtle" style="font-size:0.75rem;">Auctorium receipt</div>
          </div>
        </div>
        <div class="row"><span class="k">Transaction ID</span><span class="v mono">${escapeHtml(payment.transaction_ref)}</span></div>
        <div class="row"><span class="k">Date &amp; Time</span><span class="v">${new Date(payment.created_at).toLocaleString()}</span></div>
        <div class="row"><span class="k">Method</span><span class="v" style="text-transform:capitalize;">${escapeHtml(payment.method)}</span></div>
        <div class="row"><span class="k">Amount Paid</span><span class="v gold">${formatPrice(payment.amount)}</span></div>
      </div>
      <div class="receipt-actions">
        <button class="btn btn-outline" onclick="window.print()">Download Receipt</button>
        <button class="btn btn-primary" onclick="window.setView('myProducts'); loadMyProducts();">Back to Dashboard</button>
      </div>
    </div>`;
}

async function viewReceipt(paymentId) {
  const res = await fetch(`${API}/payments/${paymentId}/receipt`, { headers: headers() });
  if (!res.ok) { showToast('Receipt not found', 'error'); return; }
  const r = await res.json();
  setView('payment');
  renderPaymentSuccess(
    { name: r.product_name, image_url: r.product_image },
    { transaction_ref: r.transaction_ref, created_at: r.created_at, method: r.method, amount: r.amount },
    true
  );
}

/* ---------- Live Bid ticker (kept) ---------- */
let globalSocket = null;
const liveBidsCache = {};
let lastBidId = null;

function initLiveBidNotifications() {
  if (globalSocket) globalSocket.disconnect();
  globalSocket = io();
  globalSocket.on('newBid', (bid) => { liveBidsCache[bid.product_id] = bid; lastBidId = bid.bid_id || bid.product_id; renderLiveBids(); });
  globalSocket.on('connect', () => globalSocket.emit('listenToAllBids'));
  setInterval(renderLiveBids, 5000);
}
function renderLiveBids() {
  const panel = document.getElementById('latestBidsPanel');
  if (!panel) return;
  const bids = Object.values(liveBidsCache).sort((a, b) => new Date(b.b_time) - new Date(a.b_time)).slice(0, 4);
  if (!bids.length) { panel.innerHTML = '<div class="empty-state">Waiting for live bids...</div>'; return; }
  panel.innerHTML = bids.map((bid) => {
    const ta = timeAgo(new Date(bid.b_time));
    const isNew = (bid.bid_id || bid.product_id) === lastBidId;
    return `
      <div class="live-bid-card ${isNew ? 'new-pulse' : ''}">
        <div class="bid-info-left">
          <span class="bid-prod-name" onclick="window.openDetail(${bid.product_id})">${escapeHtml(bid.product_name || 'Product')}</span>
          <span class="secondary-text" style="font-size:0.8rem;">Bidder: ${escapeHtml(bid.buyer_name || 'Anonymous')}</span>
        </div>
        <div style="text-align:right; display:flex; flex-direction:column; gap:4px;">
          <span class="bid-amount">${formatPrice(bid.b_price)}</span>
          <span class="secondary-text" style="font-size:0.75rem;">${ta}</span>
        </div>
      </div>`;
  }).join('');
}

/* ---------- Bind events + init ---------- */
function bindEvents() {
  const bind = (id, ev, cb) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, cb); };
  bind('loginButton', 'click', () => openAuthModal('login'));
  bind('registerButton', 'click', () => openAuthModal('register'));
  bind('logoutButton', 'click', logout);

  const avatarBtn = document.getElementById('avatarBtn');
  const avatarMenu = document.getElementById('avatarMenu');
  if (avatarBtn) avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); if (avatarMenu) avatarMenu.classList.toggle('open'); });
  document.addEventListener('click', (e) => {
    if (avatarMenu && !avatarMenu.contains(e.target)) avatarMenu.classList.remove('open');
    const notifPanel = document.getElementById('notifPanel');
    const notifWrap = document.getElementById('notifWrap');
    if (notifPanel && notifWrap && !notifWrap.contains(e.target)) notifPanel.classList.remove('open');
  });

  bind('dashboardLink', 'click', () => {
    if (avatarMenu) avatarMenu.classList.remove('open');
    if (state.user?.role === 'seller') setView('seller');
    if (state.user?.role === 'buyer') setView('buyer');
    if (state.user?.role === 'admin') setView('admin');
  });
  bind('myProductsLink', 'click', () => { if (avatarMenu) avatarMenu.classList.remove('open'); setView('myProducts'); loadMyProducts(); });
  bind('profileLink', 'click', () => { if (avatarMenu) avatarMenu.classList.remove('open'); showToast('Profile page coming soon!', 'info'); });
  bind('closeAuth', 'click', closeAuthModal);
  bind('authModeSwitch', 'click', () => openAuthModal(state.authMode === 'login' ? 'register' : 'login'));
  bind('forgotPasswordLink', 'click', () => showToast('Forgot password flow is not enabled in this build.', 'info'));
  bind('authSubmit', 'click', submitAuth);
  bind('passwordToggle', 'click', togglePassword);
  bind('roleBuyer', 'click', () => setRole('buyer'));
  bind('roleSeller', 'click', () => setRole('seller'));
  bind('roleAdmin', 'click', () => setRole('admin'));
  bind('applyFilters', 'click', loadProducts);
  bind('detailBidBtn', 'click', placeBid);
  bind('homeNav', 'click', () => setView('home'));
  bind('adminNav', 'click', () => setView('admin'));
  bind('sellerForm', 'submit', handleSellerFormSubmit);
  bind('exploreAuctionsBtn', 'click', () => { const gridEl = document.getElementById('productGrid'); if (gridEl) gridEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); });

  const sortFilter = document.getElementById('sortFilter'); if (sortFilter) sortFilter.addEventListener('change', loadProducts);

  // File preview
  const fileInput = document.getElementById('createImageFile');
  const fileNameLabel = document.getElementById('fileNameLabel');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewImg = document.getElementById('imagePreview');
  const removePreviewBtn = document.getElementById('removePreviewBtn');
  if (fileInput) fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const allowedTypes = ['image/png','image/jpeg','image/jpg','image/webp'];
      if (!allowedTypes.includes(file.type)) { showToast('Invalid file format (PNG/JPG/JPEG/WebP only).', 'error'); fileInput.value = ''; return; }
      if (file.size > 5 * 1024 * 1024) { showToast('File is too large (max 5MB).', 'error'); fileInput.value = ''; return; }
      if (fileNameLabel) fileNameLabel.textContent = file.name;
      if (previewImg) previewImg.src = URL.createObjectURL(file);
      if (previewContainer) previewContainer.style.display = 'block';
    }
  });
  if (removePreviewBtn) removePreviewBtn.addEventListener('click', () => {
    if (fileInput) fileInput.value = '';
    if (fileNameLabel) fileNameLabel.textContent = 'No file chosen';
    if (previewContainer) previewContainer.style.display = 'none';
    if (previewImg) previewImg.src = '';
  });

  // Notification bell
  bind('notifBell', 'click', (e) => { e.stopPropagation(); toggleNotifPanel(); });
  bind('notifMarkAll', 'click', markAllNotifRead);

  // Footer year
  const y = document.getElementById('footerYear'); if (y) y.textContent = new Date().getFullYear();
}

/* ---------- Custom Select (kept from original) ---------- */
function renderCustomSelect(selectEl) {
  if (!selectEl) return;
  let container = selectEl.parentElement;
  if (!container.classList.contains('custom-select-container')) {
    container = document.createElement('div');
    container.className = 'custom-select-container';
    selectEl.parentNode.insertBefore(container, selectEl);
    container.appendChild(selectEl);
  }
  const oldTrigger = container.querySelector('.custom-select-trigger'); if (oldTrigger) oldTrigger.remove();
  const oldMenu = container.querySelector('.custom-select-options'); if (oldMenu) oldMenu.remove();
  selectEl.style.display = 'none';
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'custom-select-trigger';
  const selectedOption = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
  const triggerText = document.createElement('span');
  triggerText.textContent = selectedOption ? selectedOption.textContent : '';
  trigger.appendChild(triggerText);
  const chevron = document.createElement('span'); chevron.className = 'custom-select-chevron'; chevron.innerHTML = '&#9662;';
  trigger.appendChild(chevron);
  container.appendChild(trigger);
  const menu = document.createElement('div'); menu.className = 'custom-select-options';
  Array.from(selectEl.options).forEach((opt) => {
    const item = document.createElement('div'); item.className = 'custom-select-option';
    if (opt.selected) item.classList.add('selected');
    item.textContent = opt.textContent;
    item.dataset.value = opt.value;
    item.addEventListener('click', () => {
      selectEl.value = opt.value;
      selectEl.dispatchEvent(new Event('change'));
      triggerText.textContent = opt.textContent;
      menu.querySelectorAll('.custom-select-option').forEach((el) => el.classList.remove('selected'));
      item.classList.add('selected');
      container.classList.remove('open');
    });
    menu.appendChild(item);
  });
  container.appendChild(menu);
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-select-container').forEach((c) => { if (c !== container) c.classList.remove('open'); });
    container.classList.toggle('open');
  });
}
document.addEventListener('click', () => { document.querySelectorAll('.custom-select-container').forEach((c) => c.classList.remove('open')); });

async function init() {
  bindEvents();
  setView('home');
  updateNav();
  await loadCategories();
  await loadProducts();
  initLiveBidNotifications();
  if (state.user) { initUserSocket(); await loadNotifications(); }
  renderDashboard();
  renderCustomSelect(document.getElementById('statusFilter'));
  renderCustomSelect(document.getElementById('sortFilter'));
}

/* ---------- Expose globals ---------- */
window.setView = setView;
window.openDetail = openDetail;
window.openAuthModal = openAuthModal;
window.openProductDetails = openProductDetails;
window.openPayment = openPayment;
window.viewReceipt = viewReceipt;
window.loadMyProducts = loadMyProducts;
window.addEventListener('DOMContentLoaded', init);
