/*
 * Compatibility module for the shipped React bundle.
 *
 * Personal events stay in the Notification Center. This replaces only the
 * Buyer Dashboard's Recent Alerts card with the dedicated recent-live feed.
 * It can be removed once the original React sources are restored and rebuilt.
 */
(() => {
  const feedUrl = '/api/products/recent-live?limit=5';
  const refreshEveryMs = 10000;
  let pending = false;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));

  const timeAgo = (value) => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  async function renderRecentLiveAuctions() {
    const heading = [...document.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'Recent alerts');
    if (!heading) return;
    const panel = heading.closest('.rounded-2xl');
    const list = panel?.querySelector('.mt-5.space-y-4');
    if (!list || list.dataset.auctoriumLiveFeed === 'rendering') return;

    try {
      const response = await fetch(feedUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const auctions = await response.json();
      list.dataset.auctoriumLiveFeed = 'rendering';
      list.innerHTML = auctions.length
        ? auctions.map((auction) => `
            <a class="block text-sm hover:text-accent transition" href="/auction/${Number(auction.id)}">
              <div class="font-medium leading-snug">New live auction: ${escapeHtml(auction.name)}</div>
              <div class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Starting at ₹${Number(auction.starting_price).toLocaleString('en-IN')} · ${escapeHtml(auction.seller_name)}
              </div>
              <div class="text-[11px] text-muted-foreground mt-1">${timeAgo(auction.created_at)}</div>
            </a>`).join('')
        : '<div class="text-sm text-muted-foreground">No new live auctions yet.</div>';
      list.dataset.auctoriumLiveFeed = 'ready';
    } catch (_) {
      // Leave the existing UI intact if the feed is temporarily unavailable.
    }
  }

  function scheduleRefresh() {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      renderRecentLiveAuctions();
    }, 50);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => !mutation.target.closest?.('[data-auctorium-live-feed="ready"]'))) scheduleRefresh();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('focus', scheduleRefresh);
  setInterval(renderRecentLiveAuctions, refreshEveryMs);
  scheduleRefresh();
})();
