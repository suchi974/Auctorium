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
  selectedPaymentMethod: 'card',
  selectedImageIndex: 0,
  auctions: []
};

let socket = null;
let toastTimer = null;

const els = {
  authOverlay: document.getElementById('authOverlay'),
  authTitle: document.getElementById('authTitle'),
  authModeSwitch: document.getElementById('authModeSwitch'),
  authSubmit: document.getElementById('authSubmit'),
  authError: document.getElementById('authError'),
  authForm: document.getElementById('authForm'),
  passwordToggle: document.getElementById('passwordToggle'),
  passwordInput: document.getElementById('passwordInput'),
  roleBuyer: document.getElementById('roleBuyer'),
  roleSeller: document.getElementById('roleSeller'),
  roleAdmin: document.getElementById('roleAdmin'),
  forgotPasswordLink: document.getElementById('forgotPasswordLink'),
  navUser: document.getElementById('navUser'),
  navActions: document.getElementById('navActions'),
  homeView: document.getElementById('homeView'),
  auctionView: document.getElementById('auctionView'),
  sellerView: document.getElementById('sellerView'),
  buyerView: document.getElementById('buyerView'),
  adminView: document.getElementById('adminView'),
  productGrid: document.getElementById('productGrid'),
  categoryFilter: document.getElementById('categoryFilter'),
  statusFilter: document.getElementById('statusFilter'),
  searchInput: document.getElementById('searchInput'),
  detailName: document.getElementById('detailName'),
  detailDesc: document.getElementById('detailDesc'),
  detailSeller: document.getElementById('detailSeller'),
  detailCategory: document.getElementById('detailCategory'),
  detailPrice: document.getElementById('detailPrice'),
  detailCountdown: document.getElementById('detailCountdown'),
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
  buyerSummary: document.getElementById('buyerSummary'),
  adminStats: document.getElementById('adminStats'),
  notificationsList: document.getElementById('notificationsList')
};

function headers(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (state.token) h['Authorization'] = 'Bearer ' + state.token;
  return h;
}

function formatPrice(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function setView(view) {
  state.currentView = view;
  document.querySelectorAll('.page-section').forEach((section) => section.classList.toggle('active', section.id === `${view}View`));
  document.querySelectorAll('.nav-pill').forEach((pill) => pill.classList.toggle('active', pill.dataset.view === view));
}

function showToast(message, kind = 'success') {
  const stack = document.getElementById('toastStack');
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.innerHTML = `<span>${message}</span><button class="close-btn" onclick="this.parentElement.remove()">×</button>`;
  stack.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 3600);
}

async function loadCategories() {
  const res = await fetch(`${API}/categories`);
  state.categories = await res.json();
  els.categoryFilter.innerHTML = '<option value="">All categories</option>' + state.categories.map((c) => `<option value="${c.category_id}">${c.name}</option>`).join('');
  const createCat = document.getElementById('createCategory');
  if (createCat) createCat.innerHTML = state.categories.map((c) => `<option value="${c.category_id}">${c.name}</option>`).join('');
}

async function loadProducts() {
  const params = new URLSearchParams();
  const search = els.searchInput.value.trim();
  const category = els.categoryFilter.value;
  let status = els.statusFilter.value;
  
  // Default to showing only live auctions if on auction page and no status filter is selected
  if (!status && state.currentView === 'auction') {
    status = 'active';
  }
  
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  
  const res = await fetch(`${API}/products?${params.toString()}`);
  state.products = await res.json();
  renderProducts();
  renderHeroStats();
}

function renderProducts() {
  const list = state.products || [];
  if (!list.length) {
    els.productGrid.innerHTML = '<div class="empty-state">No auctions match the current filters. Try broadening your search.</div>';
    return;
  }

  els.productGrid.innerHTML = list.map((p) => {
    const statusClass = p.status === 'active' ? 'live' : p.status === 'closed' ? 'closed' : 'pending';
    const image = p.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80';
    return `
      <article class="auction-card">
        <div class="auction-image" style="background-image:url('${image}')"></div>
        <div class="card-body">
          <div class="card-top">
            <span class="badge ${statusClass}">${p.status}</span>
            <span class="secondary-text">${p.bid_count || 0} bids</span>
          </div>
          <h4>${p.name}</h4>
          <p class="meta">${p.category_name} · ${p.seller_name}</p>
          <div class="price-row">
            <div>
              <div class="secondary-text">Current bid</div>
              <div class="price">${formatPrice(p.current_price)}</div>
            </div>
            <button class="btn btn-primary" onclick="openDetail(${p.id})">View</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function renderHeroStats() {
  const active = state.products.filter((p) => p.status === 'active').length;
  const closed = state.products.filter((p) => p.status === 'closed').length;
  document.getElementById('heroLiveCount').textContent = active;
  document.getElementById('heroClosedCount').textContent = closed;
}

async function openDetail(id) {
  const previousProductId = state.currentProduct?.id;
  const res = await fetch(`${API}/products/${id}`);
  const product = await res.json();
  state.currentProduct = product;
  state.selectedImageIndex = 0;
  setView('auction');
  document.getElementById('detailName').textContent = product.name;
  document.getElementById('detailDesc').textContent = product.description || 'No description provided yet.';
  document.getElementById('detailSeller').textContent = product.seller_name;
  document.getElementById('detailCategory').textContent = product.category_name;
  document.getElementById('detailPrice').textContent = formatPrice(product.current_price);
  document.getElementById('detailBidInput').value = (Number(product.current_price || 0) + Number(product.min_increment || 1)).toFixed(2);
  const badge = document.querySelector('.detail-card .badge');
  if (badge) {
    badge.textContent = product.status === 'active' ? 'Live now' : product.status === 'closed' ? 'Closed' : product.status === 'pending' ? 'Pending' : product.status === 'approved' ? 'Upcoming' : 'Auction';
    badge.className = `badge ${product.status === 'active' ? 'live' : product.status === 'closed' ? 'closed' : 'pending'}`;
  }

  const galleryImages = [product.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1524594152303-9d1a0f2c97f2?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80'];
  document.getElementById('detailGalleryMain').innerHTML = `<img src="${galleryImages[0]}" alt="${product.name}">`;
  els.detailGalleryThumbs.innerHTML = galleryImages.map((img, idx) => `<button class="${idx === 0 ? 'active' : ''}" onclick="selectDetailImage(${idx})"><img src="${img}" alt="thumb ${idx + 1}"></button>`).join('');
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
    document.getElementById('detailCountdown').textContent = data.winner_name ? `Sold to ${data.winner_name} for ${formatPrice(data.final_price)}` : 'Auction closed — reserve not met';
    if (badge) {
      badge.textContent = 'Closed';
      badge.className = 'badge closed';
    }
  });
}

function selectDetailImage(index) {
  state.selectedImageIndex = index;
  const images = [
    state.currentProduct?.image_url || 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1524594152303-9d1a0f2c97f2?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80'
  ];
  document.getElementById('detailGalleryMain').innerHTML = `<img src="${images[index]}" alt="Selected preview">`;
  Array.from(els.detailGalleryThumbs.children).forEach((btn, idx) => btn.classList.toggle('active', idx === index));
}

async function loadBidHistory(id) {
  const res = await fetch(`${API}/bids/product/${id}`);
  const bids = await res.json();
  renderBidHistory(bids);
}

function renderBidHistory(bids) {
  if (!bids.length) {
    els.detailHistory.innerHTML = '<div class="empty-state">No bids yet. Be the first to start the action.</div>';
    return;
  }
  els.detailHistory.innerHTML = bids.slice(0, 8).map((b) => `
    <div class="timeline-item">
      <strong>${b.buyer_name}</strong>
      <div class="subtle">${formatPrice(b.b_price)} · ${new Date(b.b_time).toLocaleString()}</div>
    </div>
  `).join('');
}

let countdownTimer = null;
function startCountdown(endTime) {
  if (countdownTimer) clearInterval(countdownTimer);
  const end = new Date(endTime).getTime();
  function tick() {
    const diff = end - Date.now();
    if (diff <= 0) {
      els.detailCountdown.textContent = 'Auction ended';
      clearInterval(countdownTimer);
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    els.detailCountdown.textContent = `Ends in ${h}h ${m}m ${s}s`;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

async function placeBid() {
  if (!state.user) {
    openAuthModal('login');
    return;
  }
  const amount = Number(els.detailBidInput.value);
  if (!amount || amount <= 0) {
    els.detailBidError.textContent = 'Enter a valid bid amount.';
    els.detailBidError.style.display = 'block';
    return;
  }
  els.detailBidError.style.display = 'none';
  const res = await fetch(`${API}/bids`, { method: 'POST', headers: headers(), body: JSON.stringify({ product_id: state.currentProduct.id, b_price: amount }) });
  const data = await res.json();
  if (!res.ok) {
    els.detailBidError.textContent = data.message || 'Unable to place bid.';
    els.detailBidError.style.display = 'block';
    return;
  }
  showToast('Bid placed successfully. The live feed is updating.', 'success');
  await loadBidHistory(state.currentProduct.id);
}

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
  const image_url = document.getElementById('createImageUrl').value.trim() || null;
  const sellerMessage = document.getElementById('sellerMessage');

  sellerMessage.textContent = '';
  if (!name || !category_id || !starting_price || !start_time || !end_time) {
    sellerMessage.textContent = 'Please complete all required auction fields.';
    return;
  }
  if (new Date(end_time) <= new Date(start_time)) {
    sellerMessage.textContent = 'Auction end time must be after the start time.';
    return;
  }

  const payload = {
    name,
    description,
    category_id,
    starting_price,
    reserve_price: reserve_price ? parseFloat(reserve_price) : null,
    min_increment,
    start_time,
    end_time,
    image_url
  };

  const res = await fetch(`${API}/products`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    sellerMessage.textContent = data.message || 'Unable to create auction.';
    return;
  }

  showToast('Auction submitted for approval. It will appear after admin review.', 'success');
  sellerMessage.textContent = 'Auction created and pending approval.';
  event.target.reset();
  await loadProducts();
}

function openAuthModal(mode = 'login') {
  state.authMode = mode;
  els.authTitle.textContent = mode === 'register' ? 'Create your account' : 'Welcome back';
  els.authModeSwitch.textContent = mode === 'register' ? 'Already have an account? Sign in' : 'Need an account? Create one';
  els.authSubmit.textContent = mode === 'register' ? 'Register' : 'Log in';
  els.nameField = document.getElementById('nameField');
  if (els.nameField) {
    els.nameField.style.display = mode === 'register' ? 'block' : 'none';
  }
  if (els.roleAdmin) {
    els.roleAdmin.style.display = mode === 'register' ? 'none' : 'inline-flex';
    if (mode === 'register' && state.selectedRole === 'admin') setRole('buyer');
  }
  els.authOverlay.classList.add('show');
  els.authError.style.display = 'none';
}

function closeAuthModal() {
  els.authOverlay.classList.remove('show');
}

async function submitAuth() {
  const payload = {
    email: document.getElementById('emailInput').value,
    password: document.getElementById('passwordInput').value,
    role: state.selectedRole
  };
  if (state.authMode === 'register') {
    payload.name = document.getElementById('nameInput').value;
  }
  const endpoint = state.authMode === 'register' ? 'register' : 'login';
  const res = await fetch(`${API}/auth/${endpoint}`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) {
    els.authError.textContent = data.message || 'Authentication failed.';
    els.authError.style.display = 'block';
    return;
  }
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', state.token);
  localStorage.setItem('user', JSON.stringify(state.user));
  closeAuthModal();
  updateNav();
  renderDashboard();
  showToast('Welcome back to Rostrum.', 'success');
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
  const profileLink = document.getElementById('profileLink');
  
  const sellBtn = document.getElementById('sellBtn');
  const sellerNav = document.getElementById('sellerNav');
  const buyerNav = document.getElementById('buyerNav');
  const adminNav = document.getElementById('adminNav');

  if (loginBtn) loginBtn.style.display = state.user ? 'none' : 'inline-flex';
  if (registerBtn) registerBtn.style.display = state.user ? 'none' : 'inline-flex';
  
  // Show avatar menu only when logged in
  if (avatarMenu) avatarMenu.style.display = state.user ? 'flex' : 'none';
  
  if (state.user) {
    // Update avatar with first letter of email or name
    const initials = (state.user.name || state.user.email).charAt(0).toUpperCase();
    if (avatarCircle) avatarCircle.textContent = initials;
    if (dropdownUserName) dropdownUserName.textContent = state.user.name || state.user.email;
    if (dropdownUserEmail) dropdownUserEmail.textContent = state.user.email;
    const roleText = state.user.role ? state.user.role.charAt(0).toUpperCase() + state.user.role.slice(1) : 'User';
    if (dropdownUserRole) dropdownUserRole.textContent = `Role: ${roleText}`;
    
    // Hide profile/dashboard based on role
    if (dashboardLink) dashboardLink.style.display = ['seller', 'buyer', 'admin'].includes(state.user.role) ? 'flex' : 'none';
    if (profileLink) profileLink.style.display = 'flex';
  }
  
  if (logoutBtn) logoutBtn.style.display = state.user ? 'inline-flex' : 'none';
  if (sellBtn) sellBtn.style.display = state.user?.role === 'seller' ? 'inline-flex' : 'none';
  if (sellerNav) sellerNav.style.display = state.user?.role === 'seller' ? 'inline-flex' : 'none';
  if (buyerNav) buyerNav.style.display = state.user?.role === 'buyer' ? 'inline-flex' : 'none';
  if (adminNav) adminNav.style.display = state.user?.role === 'admin' ? 'inline-flex' : 'none';

  if (state.user && !['home', 'auction'].includes(state.currentView)) {
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
  updateNav();
  showToast('Signed out successfully.', 'success');
}

function renderDashboard() {
  if (!state.user) return;
  if (state.user.role === 'seller') {
    els.sellerMetricGrid.innerHTML = [
      ['Total Auctions', '24', '+8%'],
      ['Active Auctions', '12', '+4%'],
      ['Closed Auctions', '9', '+2%'],
      ['Revenue', '$18.4k', '+12%']
    ].map(([label, value, trend]) => `
      <div class="metric-card">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
        <div class="trend">${trend}</div>
      </div>
    `).join('');
    els.sellerActivity.innerHTML = '<ul><li>New bid received on “Vintage Watch”</li><li>One auction moved to active status</li><li>3 new buyers joined your watchlist</li></ul>';
  }

  if (state.user.role === 'buyer') {
    const activeBidCount = state.products.filter((p) => p.status === 'active').length;
    const wonCount = state.products.filter((p) => p.status === 'closed').length;
    const watchlistCount = state.products.filter((p) => p.status === 'approved').length;
    const notificationCount = 3;

    els.buyerSummary.innerHTML = `
      <div class="stats-grid">
        <div class="metric-card"><div class="label">Active bids</div><div class="value">${activeBidCount}</div></div>
        <div class="metric-card"><div class="label">Won auctions</div><div class="value">${wonCount}</div></div>
        <div class="metric-card"><div class="label">Watchlist</div><div class="value">${watchlistCount}</div></div>
        <div class="metric-card"><div class="label">Notifications</div><div class="value">${notificationCount}</div></div>
      </div>
      <div class="notification-card"><div><strong>Outbid alert</strong><span>Classic radio was bumped to $920</span></div><div class="dot"></div></div>
    `;
  }

  if (state.user.role === 'admin') {
    els.adminStats.innerHTML = `
      <div class="stats-grid">
        <div class="metric-card"><div class="label">Users</div><div class="value">184</div></div>
        <div class="metric-card"><div class="label">Active auctions</div><div class="value">${state.products.filter((p) => p.status === 'active').length}</div></div>
        <div class="metric-card"><div class="label">Revenue</div><div class="value">$48k</div></div>
        <div class="metric-card"><div class="label">Reports</div><div class="value">9</div></div>
      </div>
    `;
    fetchAdminPendingAuctions();
  }
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

function bindEvents() {
  const loginButton = document.getElementById('loginButton');
  const registerButton = document.getElementById('registerButton');
  const logoutButton = document.getElementById('logoutButton');
  const avatarBtn = document.getElementById('avatarBtn');
  const avatarMenu = document.getElementById('avatarMenu');
  const avatarDropdown = document.getElementById('avatarDropdown');
  const dashboardLink = document.getElementById('dashboardLink');
  const profileLink = document.getElementById('profileLink');
  
  const sellBtn = document.getElementById('sellBtn');
  const closeAuth = document.getElementById('closeAuth');
  const authModeSwitch = document.getElementById('authModeSwitch');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const authSubmit = document.getElementById('authSubmit');
  const passwordToggle = document.getElementById('passwordToggle');
  const roleBuyer = document.getElementById('roleBuyer');
  const roleSeller = document.getElementById('roleSeller');
  const roleAdmin = document.getElementById('roleAdmin');
  const applyFilters = document.getElementById('applyFilters');
  const detailBidBtn = document.getElementById('detailBidBtn');
  const homeNav = document.getElementById('homeNav');
  const auctionNav = document.getElementById('auctionNav');
  const sellerNav = document.getElementById('sellerNav');
  const buyerNav = document.getElementById('buyerNav');
  const adminNav = document.getElementById('adminNav');
  const sellerForm = document.getElementById('sellerForm');
  const paymentGrid = document.getElementById('paymentGrid');

  if (loginButton) loginButton.addEventListener('click', () => openAuthModal('login'));
  if (registerButton) registerButton.addEventListener('click', () => openAuthModal('register'));
  if (logoutButton) logoutButton.addEventListener('click', logout);
  
  // Avatar dropdown functionality
  if (avatarBtn) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (avatarMenu) avatarMenu.classList.toggle('open');
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (avatarMenu && !avatarMenu.contains(e.target)) {
      avatarMenu.classList.remove('open');
    }
  });
  
  // Dashboard link
  if (dashboardLink) {
    dashboardLink.addEventListener('click', () => {
      if (avatarMenu) avatarMenu.classList.remove('open');
      if (state.user?.role === 'seller') setView('seller');
      if (state.user?.role === 'buyer') setView('buyer');
      if (state.user?.role === 'admin') setView('admin');
    });
  }
  
  // Profile link
  if (profileLink) {
    profileLink.addEventListener('click', () => {
      if (avatarMenu) avatarMenu.classList.remove('open');
      showToast('Profile page is not yet available. Coming soon!', 'info');
    });
  }
  
  if (sellBtn) sellBtn.addEventListener('click', () => setView('seller'));
  if (closeAuth) closeAuth.addEventListener('click', closeAuthModal);
  if (authModeSwitch) authModeSwitch.addEventListener('click', () => openAuthModal(state.authMode === 'login' ? 'register' : 'login'));
  if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', () => showToast('Forgot password flow is not enabled in this build. Contact support for assistance.', 'error'));
  if (authSubmit) authSubmit.addEventListener('click', submitAuth);
  if (passwordToggle) passwordToggle.addEventListener('click', togglePassword);
  if (roleBuyer) roleBuyer.addEventListener('click', () => setRole('buyer'));
  if (roleSeller) roleSeller.addEventListener('click', () => setRole('seller'));
  if (roleAdmin) roleAdmin.addEventListener('click', () => setRole('admin'));
  if (applyFilters) applyFilters.addEventListener('click', loadProducts);
  if (detailBidBtn) detailBidBtn.addEventListener('click', placeBid);
  if (homeNav) homeNav.addEventListener('click', () => setView('home'));
  if (auctionNav) auctionNav.addEventListener('click', () => setView('auction'));
  if (sellerNav) sellerNav.addEventListener('click', () => setView('seller'));
  if (buyerNav) buyerNav.addEventListener('click', () => setView('buyer'));
  if (adminNav) adminNav.addEventListener('click', () => setView('admin'));
  if (sellerForm) sellerForm.addEventListener('submit', handleSellerFormSubmit);
  if (paymentGrid) {
    paymentGrid.querySelectorAll('.payment-card').forEach((card) => {
      card.addEventListener('click', () => {
        state.selectedPaymentMethod = card.dataset.method;
        document.querySelectorAll('#paymentGrid .payment-card').forEach((item) => item.classList.toggle('active', item.dataset.method === state.selectedPaymentMethod));
      });
    });
  }
}

// Live Bid Notifications
let globalSocket = null;
const liveBidsCache = {};

function initLiveBidNotifications() {
  if (globalSocket) globalSocket.disconnect();
  
  globalSocket = io();
  
  globalSocket.on('newBid', (bid) => {
    // Update live bids cache
    liveBidsCache[bid.product_id] = bid;
    renderLiveBids();
  });
  
  globalSocket.on('connect', () => {
    // Emit event to listen to all bids
    globalSocket.emit('listenToAllBids');
  });
}

function renderLiveBids() {
  const liveBidsList = document.getElementById('liveBidsList');
  if (!liveBidsList) return;
  
  const bids = Object.values(liveBidsCache).sort((a, b) => new Date(b.b_time) - new Date(a.b_time)).slice(0, 5);
  
  if (bids.length === 0) {
    liveBidsList.innerHTML = '<div class="empty-state">No bids yet. Check back soon!</div>';
    return;
  }
  
  liveBidsList.innerHTML = bids.map((bid) => {
    const timeAgo = getTimeAgo(new Date(bid.b_time));
    return `
      <div class="timeline-item live-bid-item">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <strong>${bid.product_name || 'Product'}</strong>
            <div class="subtle" style="font-size:0.85rem; margin-top:4px;">${bid.buyer_name || 'Anonymous'} bid ${formatPrice(bid.b_price)}</div>
          </div>
          <span class="secondary-text" style="white-space:nowrap; font-size:0.8rem;">${timeAgo}</span>
        </div>
      </div>
    `;
  }).join('');
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function init() {
  bindEvents();
  setView('home');
  updateNav();
  await loadCategories();
  await loadProducts();
  initLiveBidNotifications();
  renderDashboard();
  if (state.user) {
    renderDashboard();
  }
}

window.setView = setView;
window.openDetail = openDetail;
window.selectDetailImage = selectDetailImage;
window.openAuthModal = openAuthModal;
window.addEventListener('DOMContentLoaded', init);
