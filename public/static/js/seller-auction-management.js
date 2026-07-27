



/* Seller auction management and buyer payment-status presentation layer. */
(() => {
  const api = '/api';
  // The shipped React app persists only the JWT (not a separate user object).
  // Read its payload so seller controls can render without changing authentication.
  const getUser = () => {
    try {
      const saved = localStorage.getItem('user');
      if (saved) return JSON.parse(saved);
      const token = localStorage.getItem('token');
      if (!token) return null;
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(atob(payload).split('').map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join('')));
    } catch (_) { return null; }
  };
  const authHeaders = (json = true) => {
    const token = localStorage.getItem('token');
    return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const formatDateTime = (value) => {
    const date = new Date(value); const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  };
  const isCompleted = (auction) => auction.status === 'closed' || new Date(auction.end_time) <= new Date();
  const isLive = (auction) => auction.status === 'active' && new Date(auction.end_time) > new Date();
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const remainingTime = (value) => {
    const total = Math.max(0, new Date(value).getTime() - Date.now());
    const hours = Math.floor(total / 3600000); const minutes = Math.floor((total % 3600000) / 60000);
    return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h remaining` : `${hours}h ${minutes}m remaining`;
  };
  const timeAgo = (value) => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const style = document.createElement('style');
  style.textContent = `
    .payment-pending-strong { font-weight:800!important; color:#b91c1c!important; background:rgba(185,28,28,.16)!important; border:1px solid rgba(248,113,113,.5)!important; text-shadow:0 1px 0 rgba(0,0,0,.25); }
    #seller-auction-manager { margin:0 0 2.5rem; } #seller-auction-manager .sam-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1rem; margin-top:1rem; }
    .sam-dashboard-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-top:1.25rem}.sam-metric,.sam-panel{border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:1rem;padding:1rem}.sam-metric .label,.sam-panel .label{color:hsl(var(--muted-foreground));font-size:.72rem;text-transform:uppercase;letter-spacing:.08em}.sam-metric .value{font-family:Georgia,serif;font-size:1.7rem;margin-top:.35rem}.sam-summary{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}.sam-panel h3{margin:.25rem 0 .75rem;font-size:1rem}.sam-note{padding:.65rem 0;border-bottom:1px solid hsl(var(--border));font-size:.85rem}.sam-note:last-child{border:0}.sam-status{display:inline-block;border-radius:999px;padding:.2rem .5rem;font-size:.66rem;font-weight:800;letter-spacing:.08em;background:rgba(34,197,94,.15);color:#16a34a}.sam-status.ended{background:rgba(148,163,184,.18);color:#94a3b8}.sam-status.pending{background:rgba(234,179,8,.15);color:#ca8a04}.sam-login-role{display:block;width:100%;margin-top:.3rem;padding:.65rem;border:1px solid hsl(var(--border));border-radius:.45rem;background:hsl(var(--background));color:inherit}
    #seller-auction-manager .sam-card { border:1px solid hsl(var(--border)); background:hsl(var(--card)); border-radius:1rem; overflow:hidden; } .sam-card-image{width:100%;height:150px;object-fit:cover;background:hsl(var(--muted))}.sam-card-content{padding:1rem}.sam-card h3{margin:.4rem 0;font-size:1rem}.sam-meta{font-size:.8rem;color:hsl(var(--muted-foreground));margin:.28rem 0}.sam-detail{border-top:1px solid hsl(var(--border));margin-top:.85rem;padding-top:.75rem;font-size:.82rem;line-height:1.9}.sam-actions{margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap}.sam-button{border:0;border-radius:999px;padding:.5rem .85rem;cursor:pointer;background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-weight:700}.sam-button.secondary{background:transparent;color:inherit;border:1px solid hsl(var(--border))}.sam-button:disabled{opacity:.55;cursor:not-allowed}.sam-modal{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:9999;display:grid;place-items:center;padding:1rem}.sam-dialog{width:min(680px,100%);max-height:92vh;overflow:auto;border-radius:1rem;background:hsl(var(--card));color:hsl(var(--card-foreground));padding:1.3rem}.sam-form{display:grid;gap:.75rem}.sam-form label{font-size:.82rem;font-weight:700}.sam-form input,.sam-form textarea,.sam-form select{display:block;width:100%;margin-top:.25rem;padding:.6rem;border-radius:.45rem;border:1px solid hsl(var(--border));background:hsl(var(--background));color:inherit}.sam-form textarea{min-height:95px}.sam-form .sam-row{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.sam-view-grid{display:grid;gap:.6rem}.sam-view-row{display:grid;grid-template-columns:150px 1fr;gap:.75rem;padding:.5rem 0;border-bottom:1px solid hsl(var(--border));font-size:.85rem}.sam-view-row:last-child{border-bottom:0}.sam-view-label{color:hsl(var(--muted-foreground));font-weight:700}.sam-view-value{word-break:break-word}.sam-notice{position:fixed;right:1rem;bottom:1rem;z-index:10000;padding:.8rem 1rem;border-radius:.6rem;background:#166534;color:#fff;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.25)} @media(max-width:760px){.sam-dashboard-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sam-summary{grid-template-columns:1fr}} @media(max-width:560px){.sam-form .sam-row,.sam-dashboard-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function strengthenPaymentPending() {
    document.querySelectorAll('span').forEach((node) => {
      if (node.textContent.trim().toLowerCase() === 'payment pending') node.classList.add('payment-pending-strong');
    });
  }
  function updateSellerNavigation() {
    if (getUser()?.role !== 'seller') return;
    const link = document.querySelector('[data-testid="nav-seller"]');
    if (!link) return;
    link.childNodes[link.childNodes.length - 1].textContent = ' Dashboard';
    link.setAttribute('aria-label', 'Seller Dashboard');
    
    // Add "My Auctions" tab if it doesn't exist
    const navContainer = link.closest('.nav-links');
    if (navContainer && !navContainer.querySelector('[data-testid="nav-my-auctions"]')) {
      const myAuctionsTab = document.createElement('button');
      myAuctionsTab.setAttribute('data-testid', 'nav-my-auctions');
      myAuctionsTab.className = 'nav-pill';
      myAuctionsTab.innerHTML = '🏷️ My Auctions';
      myAuctionsTab.addEventListener('click', () => {
        const section = document.getElementById('seller-auction-manager');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const myAuctionsHeading = [...section.querySelectorAll('h2')].find((h) => h.textContent.trim() === 'My Auctions');
          if (myAuctionsHeading) {
            setTimeout(() => myAuctionsHeading.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
          }
        }
      });
      navContainer.appendChild(myAuctionsTab);
    }
  }
  function notice(message) { const node = document.createElement('div'); node.className = 'sam-notice'; node.textContent = message; document.body.appendChild(node); setTimeout(() => node.remove(), 3500); }

  // The bundled login form has no role input. Add one and send it with its existing request.
  function installLoginRoleSelector() {
    const form = document.querySelector('[data-testid="login-form"]');
    if (!form || form.querySelector('[data-testid="login-role"]')) return;
    const field = document.createElement('div');
    field.innerHTML = '<label for="login-role">Sign in as</label><select id="login-role" class="sam-login-role" data-testid="login-role"><option value="buyer">Buyer</option><option value="seller">Seller</option></select>';
    const submit = form.querySelector('[data-testid="login-submit"]');
    form.insertBefore(field, submit);
  }
  function enforcePositiveIncrementInput() {
    const form = document.querySelector('[data-testid="create-auction-form"]');
    const label = [...(form?.querySelectorAll('label') || [])].find((node) => node.textContent.trim().startsWith('Min increment'));
    const input = label?.parentElement?.querySelector('input[type="number"]');
    if (input) { input.min = '0.01'; input.step = '0.01'; }
  }
  const previousXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function roleAwareSend(body) {
    const isLogin = this.__auctionMethod === 'POST' && /\/api\/auth\/login(?:\?|$)/.test(this.__auctionUrl || '');
    if (isLogin && typeof body === 'string') {
      try {
        const selectedRole = document.querySelector('[data-testid="login-role"]')?.value || 'buyer';
        body = JSON.stringify({ ...JSON.parse(body), role: selectedRole });
      } catch (_) { /* The API retains normal validation for malformed payloads. */ }
    }
    return previousXhrSend.call(this, body);
  };

  async function uploadImage(file) {
    if (!file || !file.name) return null;
    const body = new FormData(); body.append('image', file);
    const response = await fetch(`${api}/products/upload`, { method: 'POST', headers: authHeaders(false), body });
    const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Image upload failed'); return data.url;
  }
  function openViewer(auction) {
    const liveAuction = isLive(auction); const endedAuction = isCompleted(auction);
    const status = liveAuction ? 'Live' : endedAuction ? 'Ended' : 'Pending';
    const rows = [
      ['Product name', escapeHtml(auction.name)],
      ['Category', escapeHtml(auction.category_name || '—')],
      ['Status', status],
      ['Description', escapeHtml(auction.description || '—')],
      ['Starting price', money(auction.starting_price)],
      ['Reserve price', auction.reserve_price != null && auction.reserve_price !== '' ? money(auction.reserve_price) : 'None'],
      ['Min increment', auction.min_increment != null ? money(auction.min_increment) : '—'],
      [liveAuction ? 'Current highest bid' : 'Final price', money(auction.highest_bid ?? auction.current_price)],
      ['Total bids', auction.bid_count ?? 0],
      ['Start time', auction.start_time ? new Date(auction.start_time).toLocaleString() : '—'],
      ['End time', auction.end_time ? new Date(auction.end_time).toLocaleString() : '—'],
      ['Winner', endedAuction ? (auction.winner_id ? `Buyer #${escapeHtml(auction.winner_id)}` : 'No sale') : '—'],
    ];
    const modal = document.createElement('div'); modal.className = 'sam-modal';
    modal.innerHTML = `<section class="sam-dialog" role="dialog" aria-modal="true"><h2 style="margin-top:0">Auction details</h2>
      ${auction.image_url ? `<img src="${escapeHtml(auction.image_url)}" alt="${escapeHtml(auction.name)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:.6rem;margin-bottom:1rem" onerror="this.style.display='none'">` : ''}
      <div class="sam-view-grid">${rows.map(([label, value]) => `<div class="sam-view-row"><span class="sam-view-label">${label}</span><span class="sam-view-value">${value}</span></div>`).join('')}</div>
      <div class="sam-actions"><button class="sam-button" type="button" data-close>Close</button></div></section>`;
    document.body.appendChild(modal);
    const close = () => modal.remove(); modal.querySelector('[data-close]').onclick = close;
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  }
  async function openEditor(auction, categories) {
    if (isCompleted(auction)) return;
    const modal = document.createElement('div'); modal.className = 'sam-modal';
    modal.innerHTML = `<section class="sam-dialog" role="dialog" aria-modal="true"><h2 style="margin-top:0">Edit auction</h2><form class="sam-form">
      <label>Product name<input name="name" maxlength="150" required value="${escapeHtml(auction.name)}"></label>
      <label>Description / product details<textarea name="description">${escapeHtml(auction.description || '')}</textarea></label>
      <div class="sam-row"><label>Category<select name="category_id" required>${categories.map((c) => `<option value="${c.category_id}" ${Number(c.category_id) === Number(auction.category_id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></label><label>Starting price<input name="starting_price" type="number" min="0.01" step="0.01" ${auction.bid_count ? 'disabled title="Starting price is locked after bids"' : ''} value="${auction.starting_price}" required></label></div>
      <div class="sam-row"><label>Reserve price<input name="reserve_price" type="number" min="0" step="0.01" value="${auction.reserve_price ?? ''}"></label><label>Auction end time<input name="end_time" type="datetime-local" ${auction.status === 'active' ? 'required' : 'disabled title="End time can only be changed while the auction is live"'} value="${formatDateTime(auction.end_time)}"></label></div>
      <label>Replace image<input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="sam-actions"><button class="sam-button" type="submit">Save changes</button><button class="sam-button" style="background:transparent;color:inherit;border:1px solid currentColor" type="button" data-close>Cancel</button></div><div class="sam-error" role="alert"></div></form></section>`;
    document.body.appendChild(modal);
    const close = () => modal.remove(); modal.querySelector('[data-close]').onclick = close;
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget; const error = form.querySelector('.sam-error'); error.textContent = '';
      const fd = new FormData(form); const starting = auction.bid_count ? Number(auction.starting_price) : Number(fd.get('starting_price'));
      if (!fd.get('name').trim() || starting <= 0) { error.textContent = 'Enter a product name and a valid starting price.'; return; }
      const reserve = fd.get('reserve_price'); if (reserve && Number(reserve) < starting) { error.textContent = 'Reserve price must be at least the starting price.'; return; }
      if (fd.get('end_time') && new Date(fd.get('end_time')) <= new Date()) { error.textContent = 'End time must be in the future.'; return; }
      try { const image_url = await uploadImage(fd.get('image')); const payload = { name: fd.get('name').trim(), description: fd.get('description').trim(), category_id: Number(fd.get('category_id')), starting_price: starting, reserve_price: reserve || null }; if (fd.get('end_time')) payload.end_time = new Date(fd.get('end_time')).toISOString(); if (image_url) payload.image_url = image_url;
        const response = await fetch(`${api}/seller/auctions/${auction.id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to update auction'); close(); notice('Auction updated successfully.'); renderManager();
      } catch (err) { error.textContent = err.message; }
    });
  }
  let managerRendering = false;
  let ignoreManagerMutationsUntil = 0;
  async function renderManager() {
    if (managerRendering) return;
    managerRendering = true;
    try {
    const user = getUser(); const old = document.getElementById('seller-auction-manager'); if (old) old.remove();
    if (!user || user.role !== 'seller' || !location.pathname.startsWith('/seller')) return;
    const [response, categoriesResponse, alertsResponse] = await Promise.all([
      fetch(`${api}/seller/auctions`, { headers: authHeaders() }),
      fetch(`${api}/categories`),
      fetch(`${api}/seller/auctions/recent-alerts`, { headers: authHeaders() }),
    ]);
    if (!response.ok) return; const auctions = await response.json();
    const categories = categoriesResponse.ok ? await categoriesResponse.json() : [];
    const sellerAlerts = alertsResponse.ok ? await alertsResponse.json() : [];
    const anchor = [...document.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'All auctions')?.parentElement || document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    const listingHeading = [...anchor.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'All auctions');
    if (listingHeading) { listingHeading.style.display = 'none'; if (listingHeading.nextElementSibling) listingHeading.nextElementSibling.style.display = 'none'; }
    const live = auctions.filter(isLive); const ended = auctions.filter(isCompleted);
    const bidTotal = auctions.reduce((sum, auction) => sum + Number(auction.bid_count || 0), 0);
    const sold = ended.filter((auction) => auction.winner_id);
    const revenue = sold.reduce((sum, auction) => sum + Number(auction.current_price || 0), 0);
    const soldRate = ended.length ? Math.round((sold.length / ended.length) * 100) : 0;
    const card = (auction) => {
      const liveAuction = isLive(auction); const endedAuction = isCompleted(auction);
      const status = liveAuction ? 'Live' : endedAuction ? 'Ended' : 'Pending';
      const detail = liveAuction
        ? `<div><strong>Status:</strong> Live</div><div><strong>Time:</strong> ${remainingTime(auction.end_time)}</div><div><strong>Current highest bid:</strong> ${money(auction.highest_bid ?? auction.current_price)}</div><div><strong>Total bids:</strong> ${auction.bid_count}</div>`
        : endedAuction
          ? `<div><strong>Status:</strong> Ended</div><div><strong>Final selling price:</strong> ${auction.winner_id ? money(auction.current_price) : 'No sale'}</div><div><strong>Winning bid:</strong> ${auction.winner_id ? money(auction.current_price) : '—'}</div><div><strong>Ended:</strong> ${new Date(auction.end_time).toLocaleString()}</div>`
          : `<div><strong>Status:</strong> ${status}</div><div><strong>Starts:</strong> ${new Date(auction.start_time).toLocaleString()}</div><div><strong>Starting price:</strong> ${money(auction.starting_price)}</div>`;
      return `<article class="sam-card"><img class="sam-card-image" src="${escapeHtml(auction.image_url || '')}" alt="${escapeHtml(auction.name)}" onerror="this.style.display='none'"><div class="sam-card-content"><span class="sam-status ${endedAuction ? 'ended' : liveAuction ? '' : 'pending'}">${status}</span><div class="sam-meta">${escapeHtml(auction.category_name)}</div><h3>${escapeHtml(auction.name)}</h3><div class="sam-meta">${liveAuction ? remainingTime(auction.end_time) : endedAuction ? `Ended ${new Date(auction.end_time).toLocaleDateString()}` : 'Awaiting start'}</div><div class="sam-actions"><button class="sam-button secondary" data-view-id="${auction.id}">View auction</button><button class="sam-button" data-id="${auction.id}" ${endedAuction ? 'disabled' : ''}>${endedAuction ? 'Ended auction' : 'Edit auction'}</button></div></div></article>`;
    };
    const section = document.createElement('section'); section.id = 'seller-auction-manager'; section.innerHTML = `<div class="fade-up"><div class="flex items-center justify-between gap-4"><div><div class="text-[11px] uppercase tracking-[0.3em] text-accent"></div><h1 class="serif text-4xl md:text-5xl mt-2">Dashboard</h1></div><a href="/" class="text-sm text-accent hover:underline whitespace-nowrap" data-testid="seller-dashboard-back"></a></div><p class="text-muted-foreground mt-3">Your auction performance, sales, and activity in one place.</p></div><div class="sam-dashboard-grid"><div class="sam-metric"><div class="label">Total auctions</div><div class="value">${auctions.length}</div></div><div class="sam-metric"><div class="label">Live auctions</div><div class="value">${live.length}</div></div><div class="sam-metric"><div class="label">Ended auctions</div><div class="value">${ended.length}</div></div><div class="sam-metric"><div class="label">Bids received</div><div class="value">${bidTotal}</div></div></div><div class="sam-summary"><div class="sam-panel"><div class="label">Revenue summary</div><h3>${money(revenue)} in completed sales</h3><div class="sam-meta">Across ${sold.length} sold auction${sold.length === 1 ? '' : 's'}.</div></div><div class="sam-panel"><div class="label">Auction performance</div><h3>${soldRate}% completed-auction sell-through</h3><div class="sam-meta">Average ${auctions.length ? (bidTotal / auctions.length).toFixed(1) : '0'} bids per auction.</div></div></div><div class="rounded-2xl border border-border bg-card p-6" style="margin-top:1rem"><h2 class="serif text-2xl">Recent alerts</h2><div class="mt-5 space-y-4">${sellerAlerts.slice(0, 5).map((note) => `<div class="text-sm"><div class="font-medium leading-snug">${escapeHtml(note.title)}</div><div class="text-xs text-muted-foreground mt-0.5 leading-relaxed">${escapeHtml(note.message || '')}</div><div class="text-[11px] text-muted-foreground mt-1">${timeAgo(note.created_at)}</div></div>`).join('') || '<div class="text-sm text-muted-foreground">No alerts yet.</div>'}</div></div><div style="margin-top:2.5rem"><div class="text-[11px] uppercase tracking-[0.3em] text-accent"></div><h2 class="serif text-3xl mt-2">My Auctions</h2><p class="text-muted-foreground">View, edit, and manage all your active auctions. Live cards show bidding activity; ended cards show final results.</p><div class="sam-grid">${auctions.map(card).join('') || '<p class="sam-meta">You have not created any auctions yet.</p>'}</div></div>`;
    anchor.insertBefore(section, anchor.firstElementChild); ignoreManagerMutationsUntil = Date.now() + 500;
    section.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => openEditor(auctions.find((a) => Number(a.id) === Number(button.dataset.id)), categories)));
    section.querySelectorAll('[data-view-id]').forEach((button) => button.addEventListener('click', () => openViewer(auctions.find((a) => Number(a.id) === Number(button.dataset.viewId)))));
    } finally { managerRendering = false; }
  }
  let renderScheduled = false;
  function scheduleManager() {
    if (renderScheduled) return;
    renderScheduled = true;
    setTimeout(() => { renderScheduled = false; renderManager(); }, 75);
  }
  const observer = new MutationObserver(() => { strengthenPaymentPending(); installLoginRoleSelector(); enforcePositiveIncrementInput(); updateSellerNavigation(); if (!managerRendering && Date.now() > ignoreManagerMutationsUntil) scheduleManager(); }); observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('focus', scheduleManager); setInterval(scheduleManager, 15000); strengthenPaymentPending(); installLoginRoleSelector(); enforcePositiveIncrementInput(); updateSellerNavigation(); scheduleManager();
})();