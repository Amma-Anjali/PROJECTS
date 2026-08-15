const API = '/api';

const STATUS_STEPS = ['placed', 'preparing', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = { placed: 'Placed', preparing: 'Preparing', out_for_delivery: 'Out for Delivery', delivered: 'Delivered' };

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

function renderOrder(order) {
  const stepIndex = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  const timeline = isCancelled
    ? `<p style="color:#ef9a9a;">This order was cancelled.</p>`
    : `<div class="timeline">
        ${STATUS_STEPS.map(
          (s, i) => `<div class="timeline-step ${i <= stepIndex ? 'done' : ''}">${STATUS_LABELS[s]}</div>`
        ).join('')}
      </div>`;

  return `
    <div class="order-card">
      <div class="order-head">
        <div>
          <span class="status-badge status-${order.status}">${order.status.replace(/_/g, ' ')}</span>
          <p class="order-id">Order #${order._id.slice(-8).toUpperCase()} · ${new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div class="order-total">$${order.total.toFixed(2)}</div>
      </div>

      ${timeline}

      <div class="order-items">
        ${order.items.map((i) => `<div>${i.quantity} × ${i.title} — $${(i.price * i.quantity).toFixed(2)}</div>`).join('')}
      </div>

      <div class="order-actions">
        <a href="/api/orders/${order._id}/invoice" target="_blank" class="btn btn-outline" style="text-decoration:none; display:inline-block; padding:8px 16px;">📄 Download Invoice</a>
      </div>
    </div>
  `;
}

let ordersCache = [];

async function init() {
  const listEl = document.getElementById('ordersList');

  try {
    const { orders } = await apiFetch('/orders');
    ordersCache = orders;
    if (!orders.length) {
      listEl.innerHTML = `<div class="empty-state"><p>No orders yet. Head back and add a recipe kit to your cart!</p></div>`;
    } else {
      listEl.innerHTML = orders.map(renderOrder).join('');
    }
    connectLiveUpdates();
  } catch (err) {
    // A 401 here just means "not logged in" - show a friendly message either way
    listEl.innerHTML = `<div class="empty-state"><p>Please log in on the main site to view your orders.</p></div>`;
  }
}

function connectLiveUpdates() {
  if (!window.io) return;
  const socket = window.io({ withCredentials: true });

  socket.on('order:status', ({ orderId, status }) => {
    const order = ordersCache.find((o) => o._id === orderId);
    if (!order) return; // order not on this page (shouldn't happen - these are "my orders")
    order.status = status;

    const cardEls = document.querySelectorAll('.order-card');
    const idx = ordersCache.indexOf(order);
    if (cardEls[idx]) {
      cardEls[idx].outerHTML = renderOrder(order);
    }

    // Small toast so the update doesn't go unnoticed
    const banner = document.createElement('div');
    banner.textContent = `📦 Order #${orderId.slice(-8).toUpperCase()} is now ${status.replace(/_/g, ' ')}`;
    banner.style.cssText =
      'position:fixed; top:20px; right:20px; background:var(--gold); color:var(--ink); padding:12px 20px; border-radius:10px; font-weight:600; font-size:.85rem; z-index:999; box-shadow:0 10px 30px rgba(0,0,0,.3);';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3500);
  });
}

init();
