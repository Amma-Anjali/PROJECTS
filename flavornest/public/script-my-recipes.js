const API = '/api';

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f2e5d0"/>
      <g fill="none" stroke="#c8853a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="100" cy="80" r="26"/>
        <path d="M85 75h30M85 85h30M92.5 95h15"/>
      </g>
      <text x="100" y="130" font-family="Georgia, serif" font-size="12" fill="#7a6248" text-anchor="middle">No Image</text>
    </svg>
  `);
function imgFallback(el) {
  el.onerror = null;
  el.src = FALLBACK_IMG;
}

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

const STATUS_LABELS = { approved: 'Published', pending: 'Pending review', rejected: 'Rejected' };

let recipesCache = [];

function renderRecipe(r) {
  return `
    <div class="recipe-card2" data-id="${r._id}">
      <img src="${r.image || FALLBACK_IMG}" alt="${r.title}" onerror="imgFallback(this)" />
      <div class="rc2-body">
        <div class="rc2-head">
          <h3 class="rc2-title">${r.title}</h3>
          <span class="status-badge status-${r.status}">${STATUS_LABELS[r.status] || r.status}</span>
        </div>
        <p class="rc2-meta">${r.cuisine} · ${r.timeMinutes} min · submitted ${new Date(r.createdAt).toLocaleDateString()}</p>
        <div class="rc2-actions">
          <button class="btn btn-outline edit-btn" data-id="${r._id}">✏️ Edit</button>
          <button class="btn-danger delete-btn" data-id="${r._id}">🗑 Delete</button>
        </div>
      </div>
    </div>
  `;
}

async function init() {
  const listEl = document.getElementById('recipesList');
  try {
    const { recipes } = await apiFetch('/recipes/mine');
    recipesCache = recipes;
    if (!recipes.length) {
      listEl.innerHTML = `<div class="empty-state"><p>You haven't submitted any recipes yet. Head back and use "Submit a Recipe" to add one!</p></div>`;
      return;
    }
    listEl.innerHTML = recipes.map(renderRecipe).join('');
    wireActions();
  } catch (err) {
    // A 401 here just means "not logged in"
    listEl.innerHTML = `<div class="empty-state"><p>Please log in on the main site to view your submitted recipes.</p></div>`;
  }
}

function wireActions() {
  document.querySelectorAll('.edit-btn').forEach((btn) =>
    btn.addEventListener('click', () => openEdit(btn.dataset.id))
  );
  document.querySelectorAll('.delete-btn').forEach((btn) =>
    btn.addEventListener('click', () => deleteRecipe(btn.dataset.id))
  );
}

/* ── Edit modal ── */
let editingId = null;

function openEdit(id) {
  const r = recipesCache.find((x) => x._id === id);
  if (!r) return;
  editingId = id;

  document.getElementById('editTitle').value = r.title;
  document.getElementById('editCuisine').value = r.cuisine;
  document.getElementById('editDescription').value = r.description;
  document.getElementById('editTime').value = r.timeMinutes;
  document.getElementById('editServings').value = r.servings;
  document.getElementById('editDifficulty').value = r.difficulty;

  const preview = document.getElementById('editImagePreview');
  document.getElementById('editImage').value = '';
  if (r.image) {
    preview.src = r.image;
    preview.onerror = () => imgFallback(preview);
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  document.getElementById('editOverlay').classList.add('open');
}

function closeEdit() {
  document.getElementById('editOverlay').classList.remove('open');
  editingId = null;
}

document.getElementById('editImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('editImagePreview');
  if (!file) return; // leave existing preview as-is
  preview.onerror = null;
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
});

document.getElementById('editCancel').addEventListener('click', closeEdit);
document.getElementById('editOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'editOverlay') closeEdit();
});

document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingId) return;

  const imageFile = document.getElementById('editImage').files[0];

  let body;
  if (imageFile) {
    const fd = new FormData();
    fd.append('title', document.getElementById('editTitle').value.trim());
    fd.append('cuisine', document.getElementById('editCuisine').value.trim());
    fd.append('description', document.getElementById('editDescription').value.trim());
    fd.append('timeMinutes', String(Number(document.getElementById('editTime').value)));
    fd.append('servings', String(Number(document.getElementById('editServings').value) || 4));
    fd.append('difficulty', document.getElementById('editDifficulty').value);
    fd.append('image', imageFile);
    body = fd;
  } else {
    body = JSON.stringify({
      title: document.getElementById('editTitle').value.trim(),
      cuisine: document.getElementById('editCuisine').value.trim(),
      description: document.getElementById('editDescription').value.trim(),
      timeMinutes: Number(document.getElementById('editTime').value),
      servings: Number(document.getElementById('editServings').value) || 4,
      difficulty: document.getElementById('editDifficulty').value,
    });
  }

  try {
    await apiFetch(`/recipes/${editingId}`, { method: 'PUT', body });
    closeEdit();
    init(); // refresh list
  } catch (err) {
    alert(err.message);
  }
});

/* ── Delete ── */
async function deleteRecipe(id) {
  if (!confirm('Delete this recipe? This cannot be undone.')) return;
  try {
    await apiFetch(`/recipes/${id}`, { method: 'DELETE' });
    recipesCache = recipesCache.filter((r) => r._id !== id);
    document.querySelector(`.recipe-card2[data-id="${id}"]`)?.remove();
    if (!recipesCache.length) {
      document.getElementById('recipesList').innerHTML =
        `<div class="empty-state"><p>You haven't submitted any recipes yet. Head back and use "Submit a Recipe" to add one!</p></div>`;
    }
  } catch (err) {
    alert(err.message);
  }
}

init();
