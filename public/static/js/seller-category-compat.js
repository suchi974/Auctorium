/*
 * Compatibility layer for the shipped React bundle.
 *
 * The bundle's seller form expects /api/categories to be an array of names,
 * while the API correctly returns category objects. It also stores the selected
 * name under `category` but submits `category_id`. Only convert the response
 * on the seller page; the Browse page needs the original objects to render
 * each category name and ID. Restore the selected numeric ID immediately
 * before submission.
 */
(() => {
  const categoryIds = new Map();
  const NativeXHR = window.XMLHttpRequest;
  const open = NativeXHR.prototype.open;
  const send = NativeXHR.prototype.send;

  const isCategoryRequest = (url) => /\/api\/categories(?:\?|$)/.test(url || '');
  const isCreateProductRequest = (url, method) =>
    method === 'POST' && /\/api\/products(?:\?|$)/.test(url || '');

  NativeXHR.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__auctionMethod = String(method).toUpperCase();
    this.__auctionUrl = String(url);

    if (isCategoryRequest(this.__auctionUrl)) {
      this.addEventListener('load', () => {
        try {
          const categories = JSON.parse(this.responseText);
          if (!Array.isArray(categories)) return;

          categories.forEach(({ category_id, name }) => {
            categoryIds.set(String(name).trim(), Number(category_id));
          });

          // The seller bundle renders each entry directly as text/value, while
          // Browse uses category_id and name. Keep the API response intact
          // outside the seller page so Browse can display the category labels.
          if (!window.location.pathname.startsWith('/seller')) return;

          const response = JSON.stringify(categories.map(({ name }) => name));

          Object.defineProperties(this, {
            responseText: { configurable: true, get: () => response },
            response: { configurable: true, get: () => response },
          });
        } catch (_) {
          // Leave malformed or non-JSON responses untouched.
        }
      });
    }

    return open.call(this, method, url, ...rest);
  };

  NativeXHR.prototype.send = function patchedSend(body) {
    if (isCreateProductRequest(this.__auctionUrl, this.__auctionMethod) && typeof body === 'string') {
      try {
        const payload = JSON.parse(body);
        if (!Number.isInteger(Number(payload.category_id)) || Number(payload.category_id) < 1) {
          const selector = document.querySelector('[data-testid="create-auction-form"] [role="combobox"]');
          const categoryName = selector?.textContent?.trim();
          const categoryId = categoryIds.get(categoryName);
          if (categoryId) body = JSON.stringify({ ...payload, category_id: categoryId });
        }
      } catch (_) {
        // The API will return its usual validation response for invalid JSON.
      }
    }

    return send.call(this, body);
  };
})();
