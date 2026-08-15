/**
 * FlavorNest – Global Kitchen  |  script.js  (API-driven, v2)
 * ─────────────────────────────────────────────────────────────
 * Every recipe, favorite, review, meal-plan entry and shopping list now
 * lives in MongoDB behind the Express API in /routes. This file is the
 * thin client: auth (a session cookie the browser handles automatically),
 * fetch + render, and the small bits of local UI state (which cuisine/
 * search/page/sort is active).
 */

const API = '/api';

/* ════════════════════════════════════════
   IMAGE FALLBACK
   A self-contained inline SVG (no network dependency) shown whenever a
   recipe has no image or its image URL fails to load.
════════════════════════════════════════ */
const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="600" height="400" fill="#f2e5d0"/>
      <g fill="none" stroke="#c8853a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="300" cy="165" r="52"/>
        <path d="M270 155h60M270 175h60M285 195h30"/>
      </g>
      <text x="300" y="255" font-family="Georgia, serif" font-size="22" fill="#7a6248" text-anchor="middle">No Image Yet</text>
    </svg>
  `);

// Use this in any <img> tag: onerror="imgFallback(this)"
function imgFallback(el) {
  el.onerror = null;
  el.src = FALLBACK_IMG;
}

/* ════════════════════════════════════════
   AUTH STATE
════════════════════════════════════════ */
let currentUser = null; // populated by fetchMe()

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: 'include', // send the session cookie automatically
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

async function fetchMe() {
  try {
    const { user } = await apiFetch('/auth/me');
    currentUser = user;
    return user;
  } catch (err) {
    currentUser = null;
    return null;
  }
}

function isFav(recipeId) {
  return !!currentUser && currentUser.favorites.some((f) => String(f) === String(recipeId));
}

function updateAuthUI() {
  const label = document.getElementById('authNavLabel');
  const favBadge = document.getElementById('favBadge');
  favBadge.textContent = currentUser ? currentUser.favorites.length : 0;
  label.textContent = currentUser ? `👤 ${currentUser.name.split(' ')[0]}` : 'Log In';

  document.getElementById('plannerLoggedOut').style.display = currentUser ? 'none' : 'block';
  document.getElementById('plannerLoggedIn').style.display = currentUser ? 'block' : 'none';
  if (currentUser) renderPlanner();

  if (currentUser) {
    connectSocket();
    loadNotifications();
  } else {
    disconnectSocket();
    document.getElementById('notifBadge').style.display = 'none';
  }
}

/* ════════════════════════════════════════
   REAL-TIME (Socket.io) + NOTIFICATIONS
════════════════════════════════════════ */
let socket = null;

function connectSocket() {
  if (!window.io || socket) return;
  socket = window.io({ withCredentials: true });

  socket.on('notification', (notification) => {
    showToast(`🔔 ${notification.message}`);
    prependNotification(notification);
    bumpNotifBadge(1);
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function bumpNotifBadge(delta) {
  const badge = document.getElementById('notifBadge');
  const current = Number(badge.textContent) || 0;
  const next = Math.max(0, current + delta);
  badge.textContent = next;
  badge.style.display = next > 0 ? 'inline-block' : 'none';
}

function prependNotification(n) {
  const list = document.getElementById('notifList');
  if (list.querySelector('.notif-empty')) list.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'notif-item unread';
  el.dataset.id = n._id;
  el.innerHTML = `<p>${n.message}</p><span class="notif-time">${new Date(n.createdAt).toLocaleString()}</span>`;
  el.addEventListener('click', () => markNotifRead(n._id, n.link));
  list.prepend(el);
}

async function loadNotifications() {
  try {
    const { notifications, unreadCount } = await apiFetch('/notifications');
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');

    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';

    if (!notifications.length) {
      list.innerHTML = '<p class="notif-empty">No notifications yet.</p>';
      return;
    }

    list.innerHTML = '';
    notifications.forEach((n) => {
      const el = document.createElement('div');
      el.className = `notif-item ${n.read ? '' : 'unread'}`;
      el.dataset.id = n._id;
      el.innerHTML = `<p>${n.message}</p><span class="notif-time">${new Date(n.createdAt).toLocaleString()}</span>`;
      el.addEventListener('click', () => markNotifRead(n._id, n.link));
      list.appendChild(el);
    });
  } catch (err) {
    // silent - notifications are a nice-to-have, not core functionality
  }
}

async function markNotifRead(id, link) {
  try {
    await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
    const el = document.querySelector(`.notif-item[data-id="${id}"]`);
    if (el && el.classList.contains('unread')) {
      el.classList.remove('unread');
      bumpNotifBadge(-1);
    }
    if (link) window.location.href = link;
  } catch (err) {
    // ignore
  }
}

document.getElementById('notifBtn').addEventListener('click', () => {
  const dropdown = document.getElementById('notifDropdown');
  const isOpen = dropdown.style.display === 'block';
  dropdown.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) loadNotifications();
});
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notifDropdown').style.display = 'none';
  }
});
document.getElementById('notifMarkAllRead').addEventListener('click', async (e) => {
  e.stopPropagation();
  try {
    await apiFetch('/notifications/read-all', { method: 'PUT' });
    document.querySelectorAll('.notif-item.unread').forEach((el) => el.classList.remove('unread'));
    document.getElementById('notifBadge').style.display = 'none';
  } catch (err) {
    showToast(err.message);
  }
});

/* ════════════════════════════════════════
   TOAST
════════════════════════════════════════ */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ════════════════════════════════════════
   RECIPE LIST STATE + RENDERING
════════════════════════════════════════ */
let activeSearch = '';
let activeCuisine = '';
let activeSort = 'trending';
let currentPage = 1;
let lastRecipeSet = []; // recipes currently shown, for quick lookup by id

const cuisineClass = (c) => `tag-${c.toLowerCase()}`;

function difficultyClass(d) {
  return 'difficulty-' + d.toLowerCase();
}

function buildCard(r) {
  const fav = isFav(r._id);
  return `
    <div class="recipe-card reveal" data-id="${r._id}" role="button" tabindex="0" aria-label="View ${r.title}">
      <div class="rc-img-wrap">
        <img src="${r.image || FALLBACK_IMG}" alt="${r.title}" class="rc-img" loading="lazy" onerror="imgFallback(this)" />
        <span class="rc-cuisine ${cuisineClass(r.cuisine)}">${r.cuisine}</span>
        <button
          class="rc-fav ${fav ? 'is-fav' : ''}"
          data-id="${r._id}"
          aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}"
        >${fav ? '♥' : '♡'}</button>
      </div>
      <div class="rc-body">
        <h3 class="rc-title">${r.title}</h3>
        <div class="rc-meta">
          <span>🕒 ${r.timeDisplay || r.timeMinutes + ' min'}</span>
          <span class="${difficultyClass(r.difficulty)}">📊 ${r.difficulty}</span>
          <span>👤 ${r.servings}</span>
          ${r.avgRating ? `<span>⭐ ${r.avgRating.toFixed(1)}</span>` : ''}
        </div>
        <div class="rc-price-row">
          <span class="rc-price">$${(r.price ?? 8.99).toFixed(2)} kit</span>
          <button class="rc-add-cart" data-id="${r._id}">+ Cart</button>
        </div>
      </div>
    </div>
  `;
}

async function loadRecipes() {
  const grid = document.getElementById('recipesGrid');
  const noRes = document.getElementById('noResults');
  const label = document.getElementById('filterLabel');
  const chipW = document.getElementById('filterChipWrap');
  const chipTxt = document.getElementById('filterChipText');
  const pagination = document.getElementById('pagination');

  const params = new URLSearchParams();
  if (activeSearch) params.set('search', activeSearch);
  if (activeCuisine) params.set('cuisine', activeCuisine);
  params.set('sort', activeSort);
  params.set('page', currentPage);
  params.set('limit', 9);

  let data;
  try {
    data = await apiFetch(`/recipes?${params.toString()}`);
  } catch (err) {
    grid.innerHTML = `<p style="padding:2rem;">Couldn't load recipes: ${err.message}</p>`;
    return;
  }

  lastRecipeSet = data.recipes;

  if (activeCuisine) {
    label.textContent = `Showing ${data.total} ${activeCuisine} recipe${data.total !== 1 ? 's' : ''}`;
    chipW.style.display = 'block';
    chipTxt.textContent = `🍽 ${activeCuisine}`;
  } else if (activeSearch) {
    label.textContent = `${data.total} result${data.total !== 1 ? 's' : ''} for "${activeSearch}"`;
    chipW.style.display = 'none';
  } else {
    label.textContent = 'Showing all recipes';
    chipW.style.display = 'none';
  }

  if (data.recipes.length === 0) {
    grid.innerHTML = '';
    noRes.style.display = 'block';
    pagination.style.display = 'none';
  } else {
    grid.innerHTML = data.recipes.map(buildCard).join('');
    noRes.style.display = 'none';

    grid.querySelectorAll('.recipe-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.rc-fav')) return;
        openModal(card.dataset.id);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') openModal(card.dataset.id);
      });
    });
    grid.querySelectorAll('.rc-fav').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFav(btn.dataset.id);
      });
    });
    grid.querySelectorAll('.rc-add-cart').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        addToCart(btn.dataset.id);
      });
    });

    renderPagination(data, pagination);
    observeReveal();
  }
}

function renderPagination(data, container) {
  if (data.pages <= 1) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  let html = '';
  for (let p = 1; p <= data.pages; p++) {
    html += `<button class="page-btn ${p === data.page ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }
  container.innerHTML = html;
  container.querySelectorAll('.page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPage = Number(btn.dataset.page);
      loadRecipes();
      document.getElementById('trending').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ════════════════════════════════════════
   FAVORITES
════════════════════════════════════════ */
async function toggleFav(id) {
  if (!currentUser) {
    showToast('Log in to save favorites 🔐');
    openAuthModal();
    return;
  }
  try {
    const data = await apiFetch(`/recipes/${id}/favorite`, { method: 'POST' });
    currentUser.favorites = data.favorites;
    showToast(data.favorited ? '♥ Added to favorites!' : 'Removed from favorites');
    updateAuthUI();
    loadRecipes();
    renderFavDrawer();
  } catch (err) {
    showToast(err.message);
  }
}

async function renderFavDrawer() {
  const list = document.getElementById('favList');
  if (!currentUser || currentUser.favorites.length === 0) {
    list.innerHTML = `
      <div class="fav-empty">
        <div class="fav-icon">♡</div>
        <p>${currentUser ? 'No favorites yet.<br/>Tap the heart on any recipe!' : 'Log in to save favorites.'}</p>
      </div>`;
    return;
  }
  try {
    const results = await Promise.all(
      currentUser.favorites.map((id) => apiFetch(`/recipes/${id}`).catch(() => null))
    );
    list.innerHTML = results
      .filter(Boolean)
      .map(
        ({ recipe: r }) => `
        <div class="fav-item" data-id="${r._id}">
          <img src="${r.image || FALLBACK_IMG}" alt="${r.title}" onerror="imgFallback(this)" />
          <div class="fav-item-info">
            <h4>${r.title}</h4>
            <p>${r.cuisine} · ${r.timeDisplay || r.timeMinutes + ' min'}</p>
          </div>
        </div>`
      )
      .join('');
    list.querySelectorAll('.fav-item').forEach((item) => {
      item.addEventListener('click', () => {
        openModal(item.dataset.id);
        closeDrawer();
      });
    });
  } catch (err) {
    list.innerHTML = `<p>${err.message}</p>`;
  }
}

function openDrawer() {
  document.getElementById('favDrawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderFavDrawer();
}
function closeDrawer() {
  document.getElementById('favDrawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('favNavBtn').addEventListener('click', openDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);

/* ════════════════════════════════════════
   CART, CHECKOUT & PAYMENT
════════════════════════════════════════ */
let cartData = { items: [], subtotal: 0, count: 0 };
let orderConfig = { publishableKey: '', mock: true, currency: 'usd' };
let stripeInstance = null;
let stripeCardElement = null;
let pendingOrder = null;

async function loadOrderConfig() {
  try {
    orderConfig = await apiFetch('/orders/config');
  } catch (err) {
    // fall back to mock UI if config can't be fetched
  }
}

async function refreshCart() {
  if (!currentUser) {
    cartData = { items: [], subtotal: 0, count: 0 };
    document.getElementById('cartBadge').textContent = '0';
    return;
  }
  try {
    cartData = await apiFetch('/cart');
    document.getElementById('cartBadge').textContent = cartData.count;
  } catch (err) {
    // ignore - cart badge just won't update
  }
}

async function addToCart(recipeId) {
  if (!currentUser) {
    showToast('Log in to add items to your cart 🔐');
    openAuthModal();
    return;
  }
  try {
    cartData = await apiFetch('/cart/items', { method: 'POST', body: JSON.stringify({ recipeId, quantity: 1 }) });
    document.getElementById('cartBadge').textContent = cartData.count;
    showToast('Added to cart 🛒');
    renderCartDrawer();
  } catch (err) {
    showToast(err.message);
  }
}

async function setCartQty(recipeId, quantity) {
  try {
    cartData = await apiFetch('/cart/items', { method: 'POST', body: JSON.stringify({ recipeId, quantity }) });
    document.getElementById('cartBadge').textContent = cartData.count;
    renderCartDrawer();
  } catch (err) {
    showToast(err.message);
  }
}

function renderCartDrawer() {
  const list = document.getElementById('cartList');
  const summary = document.getElementById('cartSummary');

  if (!currentUser) {
    list.innerHTML = `<div class="fav-empty"><div class="fav-icon">🛒</div><p>Log in to use your cart.</p></div>`;
    summary.style.display = 'none';
    return;
  }

  if (!cartData.items || cartData.items.length === 0) {
    list.innerHTML = `<div class="fav-empty"><div class="fav-icon">🛒</div><p>Your cart is empty.<br/>Add a recipe kit to get started!</p></div>`;
    summary.style.display = 'none';
    return;
  }

  list.innerHTML = cartData.items
    .filter((i) => i.recipe)
    .map(
      (i) => `
    <div class="fav-item cart-item">
      <img src="${i.recipe.image || FALLBACK_IMG}" alt="${i.recipe.title}" onerror="imgFallback(this)" />
      <div class="fav-item-info">
        <h4>${i.recipe.title}</h4>
        <p>$${i.recipe.price.toFixed(2)} each</p>
        <div class="cart-qty-controls">
          <button class="qty-btn" data-id="${i.recipe._id}" data-delta="-1">−</button>
          <span>${i.quantity}</span>
          <button class="qty-btn" data-id="${i.recipe._id}" data-delta="1">+</button>
          <button class="cart-remove" data-id="${i.recipe._id}">Remove</button>
        </div>
      </div>
    </div>`
    )
    .join('');

  list.querySelectorAll('.qty-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      const item = cartData.items.find((i) => i.recipe && String(i.recipe._id) === btn.dataset.id);
      const next = (item ? item.quantity : 1) + Number(btn.dataset.delta);
      setCartQty(btn.dataset.id, next);
    })
  );
  list.querySelectorAll('.cart-remove').forEach((btn) =>
    btn.addEventListener('click', () => setCartQty(btn.dataset.id, 0))
  );

  summary.style.display = 'block';
  document.getElementById('cartSubtotalText').textContent = `$${cartData.subtotal.toFixed(2)}`;
}

function openCartDrawer() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartDrawerBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  refreshCart().then(renderCartDrawer);
}
function closeCartDrawer() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartDrawerBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('cartNavBtn').addEventListener('click', () => {
  if (!currentUser) {
    showToast('Log in to view your cart 🔐');
    openAuthModal();
    return;
  }
  openCartDrawer();
});
document.getElementById('cartDrawerClose').addEventListener('click', closeCartDrawer);
document.getElementById('cartDrawerBackdrop').addEventListener('click', closeCartDrawer);

/* ── Checkout modal ── */
async function openCheckout() {
  if (!cartData.items || cartData.items.length === 0) {
    showToast('Your cart is empty');
    return;
  }
  closeCartDrawer();
  document.getElementById('checkoutOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('checkoutSummary').innerHTML = `
    <p>${cartData.count} item${cartData.count !== 1 ? 's' : ''} · Subtotal $${cartData.subtotal.toFixed(2)}</p>
  `;
  document.getElementById('checkoutStatus').textContent = '';

  await loadOrderConfig();
  const cardBox = document.getElementById('cardElementBox');
  const mockNote = document.getElementById('mockPayNote');

  if (orderConfig.mock) {
    cardBox.style.display = 'none';
    mockNote.style.display = 'block';
  } else if (window.Stripe && orderConfig.publishableKey) {
    cardBox.style.display = 'block';
    mockNote.style.display = 'none';
    stripeInstance = window.Stripe(orderConfig.publishableKey);
    const elements = stripeInstance.elements();
    stripeCardElement = elements.create('card');
    document.getElementById('cardElement').innerHTML = '';
    stripeCardElement.mount('#cardElement');
  }
}
function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
document.getElementById('checkoutClose').addEventListener('click', closeCheckout);
document.getElementById('checkoutOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'checkoutOverlay') closeCheckout();
});

document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('checkoutStatus');
  const placeBtn = document.getElementById('placeOrderBtn');
  placeBtn.disabled = true;
  statusEl.textContent = 'Placing your order…';

  const deliveryAddress = {
    name: document.getElementById('coName').value.trim(),
    phone: document.getElementById('coPhone').value.trim(),
    line1: document.getElementById('coLine1').value.trim(),
    city: document.getElementById('coCity').value.trim(),
    state: document.getElementById('coState').value.trim(),
    zip: document.getElementById('coZip').value.trim(),
  };

  try {
    const data = await apiFetch('/orders/checkout', { method: 'POST', body: JSON.stringify({ deliveryAddress }) });
    pendingOrder = data.order;

    if (data.mock) {
      // Mock mode: simulate the payment succeeding immediately
      await apiFetch(`/orders/${pendingOrder._id}/confirm-payment`, { method: 'POST' });
    } else if (stripeInstance && stripeCardElement) {
      const result = await stripeInstance.confirmCardPayment(data.clientSecret, {
        payment_method: { card: stripeCardElement },
      });
      if (result.error) throw new Error(result.error.message);
      await apiFetch(`/orders/${pendingOrder._id}/confirm-payment`, { method: 'POST' });
    }

    statusEl.textContent = 'Order placed! Redirecting to your orders…';
    showToast('🎉 Order placed successfully!');
    await refreshCart();
    setTimeout(() => {
      window.location.href = 'orders.html';
    }, 900);
  } catch (err) {
    statusEl.textContent = err.message;
    placeBtn.disabled = false;
  }
});

/* ════════════════════════════════════════
   RECIPE DETAIL MODAL (reviews + similar + nutrition)
════════════════════════════════════════ */
async function openModal(id) {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  content.innerHTML = `<p style="padding:2rem;">Loading…</p>`;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  let data;
  try {
    data = await apiFetch(`/recipes/${id}`);
  } catch (err) {
    content.innerHTML = `<p style="padding:2rem;">Couldn't load recipe: ${err.message}</p>`;
    return;
  }

  const { recipe: r, reviews, similar } = data;
  const tagClass = cuisineClass(r.cuisine);
  const fav = isFav(r._id);
  const n = r.nutrition || {};

  content.innerHTML = `
    <img src="${r.image || FALLBACK_IMG}" alt="${r.title}" class="modal-img" onerror="imgFallback(this)" />
    <div class="modal-body">
      <span class="modal-cuisine ${tagClass}">${r.cuisine}</span>
      <h2 class="modal-title">${r.title}</h2>
      <div class="modal-meta">
        <span>🕒 ${r.timeDisplay || r.timeMinutes + ' min'}</span>
        <span>📊 ${r.difficulty}</span>
        <span>👤 ${r.servings} servings</span>
        <span>👁 ${r.views} views</span>
        ${r.avgRating ? `<span>⭐ ${r.avgRating.toFixed(1)} (${r.ratingsCount})</span>` : ''}
      </div>
      <p class="modal-desc">${r.description}</p>

      <div class="nutrition-badges">
        <span class="nutri-badge">🔥 ${n.calories || 0} kcal</span>
        <span class="nutri-badge">💪 ${n.protein || 0}g protein</span>
        <span class="nutri-badge">🌾 ${n.carbs || 0}g carbs</span>
        <span class="nutri-badge">🧈 ${n.fat || 0}g fat</span>
        <span class="nutri-note">est. per serving</span>
      </div>

      <div class="kit-price-box">
        <span>🛍 Recipe Kit: <strong>$${(r.price ?? 8.99).toFixed(2)}</strong></span>
        <button class="btn btn-outline" id="modalAddCartBtn">+ Add to Cart</button>
      </div>

      <p class="modal-h">Ingredients</p>
      <ul class="modal-ing">
        ${r.ingredients.map((i) => `<li>${i.raw || `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim()}</li>`).join('')}
      </ul>

      <p class="modal-h">Instructions</p>
      <ol class="modal-steps">
        ${r.steps.map((s) => `<li>${s}</li>`).join('')}
      </ol>

      <div class="modal-actions">
        <button class="btn btn-gold" id="modalFavBtn">${fav ? '♥ Remove from Favorites' : '♡ Add to Favorites'}</button>
        <button class="btn btn-outline" id="modalPlanBtn">📅 Add to Meal Plan</button>
      </div>

      ${similar && similar.length ? `
        <p class="modal-h">You might also like</p>
        <div class="similar-grid">
          ${similar.map((s) => `
            <div class="similar-card" data-id="${s._id}">
              <img src="${s.image || FALLBACK_IMG}" alt="${s.title}" loading="lazy" onerror="imgFallback(this)" />
              <p>${s.title}</p>
            </div>`).join('')}
        </div>
      ` : ''}

      <p class="modal-h">Reviews (${reviews.length})</p>
      <div class="reviews-list">
        ${reviews.length ? reviews.map((rv) => {
          const isMine = !!currentUser && String(rv.user?._id) === String(currentUser._id);
          return `
          <div class="review-item" data-review-id="${rv._id}">
            <strong>${rv.user?.name || 'Anonymous'}</strong>
            <span class="review-stars">${'⭐'.repeat(rv.rating)}</span>
            <p>${rv.comment || ''}</p>
            ${isMine ? `
              <div class="review-owner-actions">
                <button type="button" class="link-btn review-edit-btn" data-rating="${rv.rating}" data-comment="${(rv.comment || '').replace(/"/g, '&quot;')}">Edit</button>
                <button type="button" class="link-btn review-delete-btn" data-id="${rv._id}">Delete</button>
              </div>` : ''}
          </div>`;
        }).join('') : '<p class="review-empty">No reviews yet - be the first!</p>'}
      </div>

      <form id="reviewForm" class="review-form">
        <select id="reviewRating">
          <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
          <option value="4">⭐⭐⭐⭐ Great</option>
          <option value="3">⭐⭐⭐ Good</option>
          <option value="2">⭐⭐ Okay</option>
          <option value="1">⭐ Not for me</option>
        </select>
        <input type="text" id="reviewComment" placeholder="Add a comment (optional)" maxlength="500" />
        <button type="submit" class="btn btn-outline" id="reviewSubmitBtn">Post Review</button>
      </form>
    </div>
  `;

  document.getElementById('modalFavBtn').addEventListener('click', () => toggleFav(r._id).then(() => openModal(r._id)));
  document.getElementById('modalPlanBtn').addEventListener('click', () => addToPlanPrompt(r._id, r.title));
  document.getElementById('modalAddCartBtn').addEventListener('click', () => addToCart(r._id));
  content.querySelectorAll('.similar-card').forEach((c) => {
    c.addEventListener('click', () => openModal(c.dataset.id));
  });

  document.getElementById('reviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('Log in to leave a review 🔐');
      openAuthModal();
      return;
    }
    const rating = Number(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value.trim();
    try {
      // POST is an upsert scoped to the logged-in user - this only ever creates
      // or updates *your own* review, never anyone else's.
      await apiFetch(`/reviews/${r._id}`, { method: 'POST', body: JSON.stringify({ rating, comment }) });
      showToast('Review posted, thank you!');
      openModal(r._id);
    } catch (err) {
      showToast(err.message);
    }
  });

  // Edit: just scroll to + prefill the review form (posting again overwrites your own review)
  content.querySelectorAll('.review-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('reviewRating').value = btn.dataset.rating;
      document.getElementById('reviewComment').value = btn.dataset.comment;
      document.getElementById('reviewSubmitBtn').textContent = 'Update Review';
      document.getElementById('reviewForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('reviewComment').focus();
    });
  });

  // Delete own review
  content.querySelectorAll('.review-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete your review?')) return;
      try {
        await apiFetch(`/reviews/${btn.dataset.id}`, { method: 'DELETE' });
        showToast('Review deleted');
        openModal(r._id);
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});
document.getElementById('modalClose').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDrawer();
  }
});

/* ════════════════════════════════════════
   SEARCH / FILTER / SORT
════════════════════════════════════════ */
document.getElementById('searchInput').addEventListener('input', function debounceSearch() {
  clearTimeout(this._t);
  this._t = setTimeout(() => {
    activeSearch = this.value.trim();
    currentPage = 1;
    loadRecipes();
    if (activeSearch) document.getElementById('trending').scrollIntoView({ behavior: 'smooth' });
  }, 300);
});
document.getElementById('searchBtn').addEventListener('click', () => {
  document.getElementById('trending').scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('sortSelect').addEventListener('change', function () {
  activeSort = this.value;
  currentPage = 1;
  loadRecipes();
});

async function applyCuisineFilter(cuisine) {
  activeCuisine = cuisine;
  currentPage = 1;

  document.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p.dataset.cuisine === cuisine));

  const panel = document.getElementById('cultureFactPanel');
  if (cuisine) {
    try {
      const { culture: c } = await apiFetch(`/culture/${encodeURIComponent(cuisine)}`);
      panel.style.display = 'block';
      panel.innerHTML = `
        <div class="culture-fact-inner">
          <h4>${c.flag} ${c.name} · ${c.region}</h4>
          <p>${c.history}</p>
          <p><strong>Staples:</strong> ${c.staples.join(', ')}</p>
          <p><strong>Fun fact:</strong> ${c.funFact}</p>
          <p class="culture-count">${c.recipeCount} recipe${c.recipeCount !== 1 ? 's' : ''} in FlavorNest</p>
        </div>`;
    } catch {
      panel.style.display = 'none';
    }
  } else {
    panel.style.display = 'none';
  }

  loadRecipes();
  document.getElementById('trending').scrollIntoView({ behavior: 'smooth' });
}

document.querySelectorAll('.pill').forEach((pill) => pill.addEventListener('click', () => applyCuisineFilter(pill.dataset.cuisine)));
document.querySelectorAll('.culture-card').forEach((card) => card.addEventListener('click', () => applyCuisineFilter(card.dataset.cuisine)));
document.getElementById('clearFilter').addEventListener('click', () => applyCuisineFilter(''));
document.getElementById('clearSearchBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  activeSearch = '';
  applyCuisineFilter('');
});

/* ════════════════════════════════════════
   AI / PANTRY-MATCH RECIPE FINDER (backend-powered)
════════════════════════════════════════ */
document.getElementById('aiFindBtn').addEventListener('click', async () => {
  const rawInput = document.getElementById('aiInput').value.trim();
  const resultsEl = document.getElementById('aiResults');
  const emptyEl = document.getElementById('aiEmpty');

  if (!rawInput) {
    showToast('Please enter some ingredients first 🥄');
    return;
  }

  let data;
  try {
    data = await apiFetch(`/recipes/pantry-match?ingredients=${encodeURIComponent(rawInput)}`);
  } catch (err) {
    showToast(err.message);
    return;
  }

  if (data.results.length === 0) {
    resultsEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';
  resultsEl.style.display = 'grid';
  resultsEl.innerHTML = data.results
    .map(
      ({ recipe: r, matchPercent }) => `
    <div class="ai-result-card" data-id="${r._id}">
      <img src="${r.image || FALLBACK_IMG}" alt="${r.title}" loading="lazy" onerror="imgFallback(this)" />
      <div class="ai-result-info">
        <h4>${r.title}</h4>
        <p>${r.cuisine} · ${r.timeDisplay || r.timeMinutes + ' min'} · <strong>${matchPercent}% match</strong></p>
      </div>
    </div>`
    )
    .join('');
  resultsEl.querySelectorAll('.ai-result-card').forEach((c) => c.addEventListener('click', () => openModal(c.dataset.id)));
});
document.getElementById('aiInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('aiFindBtn').click();
});

/* ════════════════════════════════════════
   FEATURED DISH (top trending recipe)
════════════════════════════════════════ */
async function loadFeatured() {
  const card = document.getElementById('featuredCard');
  try {
    const { recipes } = await apiFetch('/analytics/trending?limit=1');
    const r = recipes[0];
    if (!r) {
      card.innerHTML = '<p style="padding:2rem;">No recipes yet.</p>';
      return;
    }
    card.innerHTML = `
      <div class="featured-visual">
        <img src="${r.image || FALLBACK_IMG}" alt="${r.title}" class="featured-img" onerror="imgFallback(this)" />
        <div class="featured-flag">${r.cuisine}</div>
      </div>
      <div class="featured-body">
        <span class="cuisine-tag ${cuisineClass(r.cuisine)}">${r.cuisine}</span>
        <h3 class="featured-title">${r.title}</h3>
        <p class="featured-desc">${r.description}</p>
        <div class="featured-meta">
          <span>🕒 ${r.timeDisplay || r.timeMinutes + ' min'}</span>
          <span>👤 ${r.servings} servings</span>
          <span>📊 ${r.difficulty}</span>
          <span>🔥 trending #1</span>
        </div>
        <button class="btn btn-gold" id="featuredViewBtn">View Full Recipe →</button>
      </div>`;
    document.getElementById('featuredViewBtn').addEventListener('click', () => openModal(r._id));
  } catch (err) {
    card.innerHTML = `<p style="padding:2rem;">${err.message}</p>`;
  }
}

/* ════════════════════════════════════════
   AUTH MODAL
════════════════════════════════════════ */
function openAuthModal() {
  document.getElementById('authOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('authClose').addEventListener('click', closeAuthModal);
document.getElementById('authOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'authOverlay') closeAuthModal();
});

document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    document.getElementById('loginForm').style.display = isLogin ? 'flex' : 'none';
    document.getElementById('registerForm').style.display = isLogin ? 'none' : 'flex';
  });
});

document.getElementById('authNavBtn').addEventListener('click', async () => {
  if (currentUser) {
    // logged in -> log out
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (err) {
      // proceed with client-side cleanup regardless
    }
    currentUser = null;
    updateAuthUI();
    loadRecipes();
    refreshCart();
    showToast('Logged out');
  } else {
    openAuthModal();
  }
});

document.getElementById('plannerLoginBtn').addEventListener('click', openAuthModal);
document.getElementById('footerSubmitLink').addEventListener('click', (e) => {
  e.preventDefault();
  openSubmitModal();
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    currentUser = data.user;
    closeAuthModal();
    updateAuthUI();
    loadRecipes();
    refreshCart();
    showToast(`Welcome back, ${currentUser.name.split(' ')[0]}!`);
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById('forgotPasswordBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim() || prompt('Enter your account email:');
  if (!email) return;
  try {
    const data = await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    showToast(data.message);
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  try {
    const data = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    currentUser = data.user;
    closeAuthModal();
    updateAuthUI();
    loadRecipes();
    refreshCart();
    showToast(`Welcome to FlavorNest, ${currentUser.name.split(' ')[0]}!`);
  } catch (err) {
    showToast(err.message);
  }
});

/* ════════════════════════════════════════
   MEAL PLANNER + SHOPPING LIST
════════════════════════════════════════ */
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

async function renderPlanner() {
  const grid = document.getElementById('plannerGrid');
  if (!currentUser) return;
  let data;
  try {
    data = await apiFetch('/mealplan');
  } catch (err) {
    grid.innerHTML = `<p>${err.message}</p>`;
    return;
  }

  grid.innerHTML = data.days
    .map((day) => {
      const entry = data.entries[day];
      const recipe = entry ? entry.recipe : null;
      return `
        <div class="planner-day" data-day="${day}">
          <h4>${DAY_LABELS[day]}</h4>
          ${
            recipe
              ? `<div class="planner-recipe" data-id="${recipe._id}">
                   <img src="${recipe.image || FALLBACK_IMG}" alt="${recipe.title}" onerror="imgFallback(this)" />
                   <p>${recipe.title}</p>
                   <button class="planner-remove" data-day="${day}">✕</button>
                 </div>`
              : `<button class="planner-add" data-day="${day}">+ Add</button>`
          }
        </div>`;
    })
    .join('');

  grid.querySelectorAll('.planner-add').forEach((btn) =>
    btn.addEventListener('click', () => addToPlanPrompt(null, null, btn.dataset.day))
  );
  grid.querySelectorAll('.planner-remove').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await apiFetch(`/mealplan/${btn.dataset.day}`, { method: 'PUT', body: JSON.stringify({ recipeId: null }) });
      renderPlanner();
    })
  );
  grid.querySelectorAll('.planner-recipe').forEach((el) =>
    el.addEventListener('click', () => openModal(el.dataset.id))
  );
}

// Simple day-picker prompt used both from a recipe modal and from an empty planner slot
async function addToPlanPrompt(recipeId, recipeTitle, forcedDay) {
  if (!currentUser) {
    showToast('Log in to use the meal planner 🔐');
    openAuthModal();
    return;
  }

  let day = forcedDay;
  let targetRecipeId = recipeId;

  if (!day) {
    day = prompt('Which day? (monday, tuesday, wednesday, thursday, friday, saturday, sunday)', 'monday');
    if (!day || !DAY_LABELS[day.toLowerCase()]) return showToast('Please enter a valid day name');
    day = day.toLowerCase();
  }

  if (!targetRecipeId) {
    const query = prompt(`Search a recipe to add to ${DAY_LABELS[day]}:`, '');
    if (!query) return;
    const { recipes } = await apiFetch(`/recipes?search=${encodeURIComponent(query)}&limit=1`);
    if (!recipes.length) return showToast('No matching recipe found');
    targetRecipeId = recipes[0]._id;
    recipeTitle = recipes[0].title;
  }

  try {
    await apiFetch(`/mealplan/${day}`, { method: 'PUT', body: JSON.stringify({ recipeId: targetRecipeId }) });
    showToast(`Added ${recipeTitle || 'recipe'} to ${DAY_LABELS[day]}`);
    renderPlanner();
  } catch (err) {
    showToast(err.message);
  }
}

document.getElementById('generateListBtn').addEventListener('click', async () => {
  const box = document.getElementById('shoppingListBox');
  box.style.display = 'block';
  box.innerHTML = '<p>Generating…</p>';
  try {
    const data = await apiFetch('/mealplan/shopping-list');
    if (!data.items.length) {
      box.innerHTML = `<p>${data.message || 'No items yet - add recipes to your plan first.'}</p>`;
      return;
    }
    box.innerHTML = `
      <h4>🛒 Shopping List (${data.count} items)</h4>
      <ul class="shopping-list">
        ${data.items
          .map((i) => `<li><strong>${i.quantity ? Math.round(i.quantity * 100) / 100 : ''} ${i.unit}</strong> ${i.name} <span class="used-in">(${i.usedIn.join(', ')})</span></li>`)
          .join('')}
      </ul>`;
  } catch (err) {
    box.innerHTML = `<p>${err.message}</p>`;
  }
});

/* ════════════════════════════════════════
   SUBMIT RECIPE
════════════════════════════════════════ */
function openSubmitModal() {
  if (!currentUser) {
    showToast('Log in to submit a recipe 🔐');
    openAuthModal();
    return;
  }
  document.getElementById('submitOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSubmitModal() {
  document.getElementById('submitOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('submitClose').addEventListener('click', closeSubmitModal);
document.getElementById('submitOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'submitOverlay') closeSubmitModal();
});
document.getElementById('submitRecipeBtn').addEventListener('click', openSubmitModal);

// Live preview of the chosen photo before submitting
document.getElementById('srImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('srImagePreview');
  if (!file) {
    preview.style.display = 'none';
    preview.src = '';
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
});

function parseIngredientLine(line) {
  const raw = line.trim();
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tsp|tbsp|cups?|fl_?oz|oz|lb|pinch)?\s+(.*)$/i);
  if (m) {
    let unit = (m[2] || '').toLowerCase().replace(/^cups$/, 'cup');
    return { quantity: parseFloat(m[1]), unit, name: m[3].trim(), raw };
  }
  return { quantity: 1, unit: '', name: raw, raw };
}

document.getElementById('submitRecipeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('submitStatus');
  const ingredients = document
    .getElementById('srIngredients')
    .value.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseIngredientLine);
  const steps = document
    .getElementById('srSteps')
    .value.split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const imageFile = document.getElementById('srImage').files[0];
  const keywords = [...new Set(ingredients.map((i) => i.name.toLowerCase()))].slice(0, 12);

  // Use multipart/form-data whenever a photo is attached (so multer can
  // pick it up as req.file); otherwise send plain JSON like before.
  let body;
  if (imageFile) {
    const fd = new FormData();
    fd.append('title', document.getElementById('srTitle').value.trim());
    fd.append('cuisine', document.getElementById('srCuisine').value.trim());
    fd.append('description', document.getElementById('srDescription').value.trim());
    fd.append('timeMinutes', String(Number(document.getElementById('srTime').value)));
    fd.append('servings', String(Number(document.getElementById('srServings').value) || 4));
    fd.append('difficulty', document.getElementById('srDifficulty').value);
    fd.append('keywords', JSON.stringify(keywords));
    fd.append('ingredients', JSON.stringify(ingredients));
    fd.append('steps', JSON.stringify(steps));
    fd.append('image', imageFile);
    body = fd;
  } else {
    body = JSON.stringify({
      title: document.getElementById('srTitle').value.trim(),
      cuisine: document.getElementById('srCuisine').value.trim(),
      description: document.getElementById('srDescription').value.trim(),
      timeMinutes: Number(document.getElementById('srTime').value),
      servings: Number(document.getElementById('srServings').value) || 4,
      difficulty: document.getElementById('srDifficulty').value,
      keywords,
      ingredients,
      steps,
    });
  }

  try {
    const data = await apiFetch('/recipes', { method: 'POST', body });
    statusEl.textContent = data.message;
    showToast(data.message);
    document.getElementById('submitRecipeForm').reset();
    document.getElementById('srImagePreview').style.display = 'none';
    setTimeout(closeSubmitModal, 1200);
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

/* ════════════════════════════════════════
   NAVBAR: scroll shadow + hamburger menu
════════════════════════════════════════ */
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

window.addEventListener(
  'scroll',
  () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  },
  { passive: true }
);

hamburger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', open);
});

navLinks.addEventListener('click', (e) => {
  if (e.target.classList.contains('nav-link')) navLinks.classList.remove('open');
});

/* ════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════ */
function observeReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const siblings = Array.from(entry.target.parentNode.children);
          const idx = siblings.indexOf(entry.target);
          entry.target.style.transitionDelay = `${Math.min(idx * 0.07, 0.42)}s`;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.reveal:not(.visible)').forEach((el) => observer.observe(el));
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await fetchMe();
  updateAuthUI();
  loadRecipes();
  loadFeatured();
  refreshCart();

  document.querySelectorAll('.sec-header, .culture-card, .featured-card').forEach((el) => el.classList.add('reveal'));
  observeReveal();
});
