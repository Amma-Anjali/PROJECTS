const API = '/api';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: 'include', // send the session cookie automatically
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

async function login() {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.user.role !== 'admin') {
      alert('This account does not have admin access.');
      return;
    }
    showDashboard();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('adminLoginBtn').addEventListener('click', login);

async function showDashboard() {
  document.getElementById('loginGate').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  try {
    const { totals, byCuisine, topViewed, topRated, revenue, bestSellers } = await apiFetch('/analytics/overview');

    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-box"><div class="stat-num">${totals.recipes}</div><div class="stat-label">Recipes</div></div>
      <div class="stat-box"><div class="stat-num">${totals.users}</div><div class="stat-label">Users</div></div>
      <div class="stat-box"><div class="stat-num">${totals.reviews}</div><div class="stat-label">Reviews</div></div>
      <div class="stat-box"><div class="stat-num">$${revenue.total.toFixed(2)}</div><div class="stat-label">Revenue</div></div>
      <div class="stat-box"><div class="stat-num">${revenue.paidOrders}</div><div class="stat-label">Paid Orders</div></div>
    `;

    document.querySelector('#bestSellersTable tbody').innerHTML = bestSellers.length
      ? bestSellers.map((b) => `<tr><td>${b._id}</td><td>${b.qty}</td></tr>`).join('')
      : '<tr><td colspan="2" style="opacity:.6;">No paid orders yet.</td></tr>';

    document.querySelector('#cuisineTable tbody').innerHTML = byCuisine
      .map((c) => `<tr><td>${c._id}</td><td>${c.count}</td><td>${(c.avgRating || 0).toFixed(1)}</td></tr>`)
      .join('');

    document.querySelector('#viewedTable tbody').innerHTML = topViewed
      .map((r) => `<tr><td>${r.title}</td><td>${r.views}</td><td>${r.favoritesCount}</td></tr>`)
      .join('');

    document.querySelector('#ratedTable tbody').innerHTML = topRated
      .map((r) => `<tr><td>${r.title}</td><td>⭐ ${r.avgRating.toFixed(1)}</td><td>${r.ratingsCount}</td></tr>`)
      .join('');

    await loadOrders();
    connectAdminSocket();
  } catch (err) {
    document.getElementById('loginGate').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
  }
}

const ORDER_STATUSES = ['placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

async function loadOrders() {
  const box = document.getElementById('ordersList');
  const { orders } = await apiFetch('/orders/admin/all');
  if (!orders.length) {
    box.innerHTML = '<p style="opacity:.6;">No orders yet.</p>';
    return;
  }
  box.innerHTML = orders
    .slice(0, 15)
    .map(
      (o) => `
    <div class="order-row">
      <span>#${o._id.slice(-8).toUpperCase()} — ${o.user?.name || 'Unknown'} — $${o.total.toFixed(2)} — <em style="opacity:.6;">${o.paymentStatus}</em></span>
      <select data-id="${o._id}">
        ${ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
      </select>
    </div>`
    )
    .join('');

  box.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await apiFetch(`/orders/${sel.dataset.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: sel.value }),
        });
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

// On load: if there's already a valid admin session cookie (e.g. logged in
// as admin on the main site), skip straight to the dashboard.
(async () => {
  try {
    const { user } = await apiFetch('/auth/me');
    if (user.role === 'admin') showDashboard();
  } catch (err) {
    // not logged in - the login gate is already showing by default
  }
})();

/* ── Real-time admin feed ── */
let adminSocket = null;

function connectAdminSocket() {
  if (!window.io || adminSocket) return;
  adminSocket = window.io({ withCredentials: true });

  adminSocket.on('order:new', ({ orderId, total, userName }) => {
    showAdminBanner(`🛒 New order from ${userName} — $${total.toFixed(2)} (#${orderId.slice(-8).toUpperCase()})`);
    loadOrders();
  });
}

function showAdminBanner(text) {
  const banner = document.createElement('div');
  banner.textContent = text;
  banner.style.cssText =
    'position:fixed; top:20px; right:20px; background:var(--gold); color:var(--ink); padding:12px 20px; border-radius:10px; font-weight:600; font-size:.85rem; z-index:999; box-shadow:0 10px 30px rgba(0,0,0,.3); max-width:340px;';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 4000);
}
