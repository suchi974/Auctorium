/*
 * Compatibility layer for the shipped React bundle.
 *
 * The bundle's seller form expects /api/categories to be an array of names,
 * while the API correctly returns category objects. It also stores the selected
 * name under `category` but submits `category_id`. Convert the response for the
 * UI and restore the selected numeric ID immediately before submission.
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

          // The bundle's <Select> renders each entry directly as text/value, so it
          // needs plain strings here, not {category_id, name} objects (that object
          // shape was slipping through and crashing React on the seller page).
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