const API_BASE = '/api';

const PLACEHOLDER_IMG = 'https://placehold.co/600x800/391925/FFEAD4?text=فستان';

// XSS protection: escape HTML entities
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

let currentFilters = {
  category: '',
  search: '',
  sort: '',
  inStock: '',
  isNew: '',
  isOnSale: '',
  page: 1
};

let pagination = { page: 1, pages: 1, total: 0 };
let viewMode = localStorage.getItem('rf_view_mode') || 'grid';

function buildQueryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return params.toString();
}

function renderDressCard(dress) {
  const imgSrc = dress.images?.[0] || 'https://placehold.co/600x800/391925/FFEAD4?text=فستان';
  const hasDiscount = dress.discountPrice && dress.discountPrice < dress.price;
  const displayPrice = hasDiscount ? dress.discountPrice : dress.price;
  const isOutOfStock = !dress.inStock;
  const name = escapeHtml(dress.name || '');
  const desc = escapeHtml(dress.description || '');

  if (viewMode === 'list') {
    return `
      <div class="dress-card list-view" data-id="${dress._id}">
        <div class="dress-image-wrapper">
          <img src="${imgSrc}" alt="${name}" loading="lazy" />
          ${dress.isNew ? '<span class="dress-badge new">جديد</span>' : ''}
          ${dress.isOnSale ? '<span class="dress-badge sale">تخفيض</span>' : ''}
          ${isOutOfStock ? '<span class="dress-badge out">نفذت</span>' : ''}
        </div>
        <div class="dress-info">
          <h3 class="dress-name">${name}</h3>
          <p class="dress-desc">${desc}</p>
          <div class="dress-meta">
            <div class="dress-price">
              ${hasDiscount ? `<span class="original-price">${dress.price} رس</span>` : ''}
              <span class="current-price">${displayPrice ? displayPrice + ' رس' : 'السعر يحدد بعد الاستشارة'}</span>
            </div>
            <div class="dress-actions">
              <button class="btn-primary book-btn" data-id="${dress._id}">احجز الآن</button>
              <button class="btn-secondary details-btn" data-id="${dress._id}">التفاصيل</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="dress-card grid-view" data-id="${dress._id}">
      <div class="dress-image-wrapper">
        <img src="${imgSrc}" alt="${name}" loading="lazy" />
        ${dress.isNew ? '<span class="dress-badge new">جديد</span>' : ''}
        ${dress.isOnSale ? '<span class="dress-badge sale">تخفيض</span>' : ''}
        ${isOutOfStock ? '<span class="dress-badge out">نفذت</span>' : ''}
      </div>
      <div class="dress-info">
        <h3 class="dress-name">${name}</h3>
        <p class="dress-desc">${desc}</p>
        <div class="dress-price">
          ${hasDiscount ? `<span class="original-price">${dress.price} رس</span>` : ''}
          <span class="current-price">${displayPrice ? displayPrice + ' رس' : 'السعر يحدد بعد الاستشارة'}</span>
        </div>
        <div class="dress-actions">
          <button class="btn-primary book-btn" data-id="${dress._id}">احجز الآن</button>
          <button class="btn-secondary details-btn" data-id="${dress._id}">المزيد</button>
        </div>
      </div>
    </div>
  `;
}

function renderDresses(dresses) {
  const grid = document.querySelector('.dresses-grid');
  if (!grid) return;

  grid.className = 'dresses-grid container ' + viewMode;

  if (!dresses || dresses.length === 0) {
    grid.innerHTML = '<div class="no-results"><i class="fas fa-clock"></i><p style="font-size: 18px; margin-bottom: 10px;">قريباً</p><p style="color: #999; font-size: 14px;">تشكيلة جديدة قريباً</p></div>';
    return;
  }

  grid.innerHTML = dresses.map(renderDressCard).join('');

  grid.querySelectorAll('.book-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openBookingModal(btn.dataset.id);
    });
  });

  grid.querySelectorAll('.details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showDressDetails(btn.dataset.id);
    });
  });
}

function renderPagination() {
  const container = document.querySelector('.pagination');
  if (!container || pagination.pages <= 1) {
    container && (container.innerHTML = '');
    return;
  }

  let html = '';
  if (currentFilters.page > 1) {
    html += `<button class="page-btn" data-page="${currentFilters.page - 1}"><i class="fas fa-chevron-right"></i></button>`;
  }

  for (let i = 1; i <= pagination.pages; i++) {
    if (i === 1 || i === pagination.pages || (i >= currentFilters.page - 1 && i <= currentFilters.page + 1)) {
      html += `<button class="page-btn ${i === currentFilters.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (i === currentFilters.page - 2 || i === currentFilters.page + 2) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }

  if (currentFilters.page < pagination.pages) {
    html += `<button class="page-btn" data-page="${currentFilters.page + 1}"><i class="fas fa-chevron-left"></i></button>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilters.page = parseInt(btn.dataset.page);
      fetchDresses();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function renderResultsCount() {
  const el = document.querySelector('.results-count');
  if (el) el.textContent = `${pagination.total} فستان`;
}

function filterDressesLocally(dresses) {
  let filtered = [...dresses];
  
  if (currentFilters.category) {
    filtered = filtered.filter(d => d.category === currentFilters.category);
  }
  
  if (currentFilters.search) {
    const search = currentFilters.search.toLowerCase();
    filtered = filtered.filter(d => 
      (d.name && d.name.toLowerCase().includes(search)) ||
      (d.description && d.description.toLowerCase().includes(search))
    );
  }
  
  if (currentFilters.inStock === 'true') {
    filtered = filtered.filter(d => d.inStock !== false);
  }
  
  if (currentFilters.isNew === 'true') {
    filtered = filtered.filter(d => d.isNew === true);
  }
  
  if (currentFilters.isOnSale === 'true') {
    filtered = filtered.filter(d => d.isOnSale === true);
  }
  
  if (currentFilters.sort) {
    switch (currentFilters.sort) {
      case 'price_asc':
        filtered.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
        break;
      case 'price_desc':
        filtered.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case 'name_asc':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
    }
  }
  
  return filtered;
}

async function fetchDresses() {
  const grid = document.querySelector('.dresses-grid');
  if (grid) grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';

  try {
    const query = buildQueryString(currentFilters);
    const res = await fetch(`${API_BASE}/dresses?${query}`);

    if (!res.ok) throw new Error('API error');

    const data = await res.json();

    if (data.dresses) {
      renderDresses(data.dresses);
      pagination = data.pagination || { page: 1, pages: 1, total: 0 };
      renderPagination();
      renderResultsCount();
      saveFallbackDresses(data.dresses);
    } else if (Array.isArray(data)) {
      renderDresses(data);
      pagination = { page: 1, pages: 1, total: data.length };
      saveFallbackDresses(data);
    }
  } catch (error) {
    await loadSampleDresses();
    const fallback = getFallbackDresses();
    const filtered = filterDressesLocally(fallback);
    renderDresses(filtered);
    pagination = { page: 1, pages: 1, total: filtered.length };
    renderPagination();
    renderResultsCount();
  }
}

function applyFilters() {
  currentFilters = {
    category: document.getElementById('categoryFilter')?.value || '',
    sort: document.getElementById('sortFilter')?.value || '',
    inStock: document.getElementById('inStockFilter')?.checked ? 'true' : '',
    isNew: document.getElementById('newFilter')?.checked ? 'true' : '',
    isOnSale: document.getElementById('saleFilter')?.checked ? 'true' : '',
    search: document.getElementById('searchInput')?.value || '',
    page: 1
  };
  updateFilterCount();
  fetchDresses();
  closeFiltersPanel();
}

function resetFilters() {
  currentFilters = { category: '', search: '', sort: '', inStock: '', isNew: '', isOnSale: '', page: 1 };
  document.getElementById('searchInput').value = '';
  document.getElementById('categoryFilter').value = '';
  document.getElementById('sortFilter').value = '';
  document.getElementById('inStockFilter').checked = false;
  document.getElementById('newFilter').checked = false;
  document.getElementById('saleFilter').checked = false;
  updateFilterCount();
  fetchDresses();
}

function updateFilterCount() {
  const countEl = document.querySelector('.filter-count');
  if (!countEl) return;
  
  let count = 0;
  if (currentFilters.category) count++;
  if (currentFilters.sort) count++;
  if (currentFilters.inStock) count++;
  if (currentFilters.isNew) count++;
  if (currentFilters.isOnSale) count++;
  
  countEl.textContent = count || '';
  countEl.style.display = count ? 'flex' : 'none';
}

function toggleViewMode() {
  viewMode = viewMode === 'grid' ? 'list' : 'grid';
  localStorage.setItem('rf_view_mode', viewMode);
  
  const btn = document.getElementById('viewToggle');
  if (btn) {
    btn.innerHTML = viewMode === 'grid' 
      ? '<i class="fas fa-list"></i>' 
      : '<i class="fas fa-th-large"></i>';
  }
  
  const fallback = getFallbackDresses();
  const filtered = filterDressesLocally(fallback);
  renderDresses(filtered);
}

function toggleFiltersPanel() {
  const panel = document.getElementById('filtersPanel');
  if (!panel) return;
  
  panel.classList.toggle('open');
  
  const btn = document.getElementById('filterToggle');
  if (btn) btn.classList.toggle('active');
}

function closeFiltersPanel() {
  const panel = document.getElementById('filtersPanel');
  if (panel) panel.classList.remove('open');
  
  const btn = document.getElementById('filterToggle');
  if (btn) btn.classList.remove('active');
}

function initSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let searchTimeout;
    const doSearch = () => {
      currentFilters.search = searchInput.value;
      currentFilters.page = 1;
      fetchDresses();
    };
    
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(doSearch, 300);
    });
    
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        doSearch();
      }
    });
  }
}

function initFilters() {
  document.getElementById('categoryFilter')?.addEventListener('change', applyFilters);
  document.getElementById('sortFilter')?.addEventListener('change', applyFilters);
  document.getElementById('inStockFilter')?.addEventListener('change', applyFilters);
  document.getElementById('newFilter')?.addEventListener('change', applyFilters);
  document.getElementById('saleFilter')?.addEventListener('change', applyFilters);
  
  document.getElementById('viewToggle')?.addEventListener('click', () => {
    toggleViewMode();
    const fallback = getFallbackDresses();
    const filtered = filterDressesLocally(fallback);
    renderDresses(filtered);
    pagination = { page: 1, pages: 1, total: filtered.length };
    renderPagination();
    renderResultsCount();
  });
  
  document.getElementById('filterToggle')?.addEventListener('click', toggleFiltersPanel);
}

function renderDressInModal(dress) {
  const modal = document.getElementById('dressDetailsModal');
  if (!modal) return;

  const imgSrc = dress.images?.[0] || 'https://placehold.co/600x800/391925/FFEAD4?text=فستان';
  const hasDiscount = dress.discountPrice && dress.discountPrice < dress.price;
  const displayPrice = hasDiscount ? dress.discountPrice : dress.price;

  modal.querySelector('.detail-image').innerHTML = `<img src="${imgSrc}" alt="${escapeHtml(dress.name)}" />`;
  modal.querySelector('.detail-name').textContent = dress.name;
  modal.querySelector('.detail-desc').textContent = dress.description || 'لا يوجد وصف';
  modal.querySelector('.detail-price').innerHTML = hasDiscount 
    ? `<span class="original-price">${dress.price} رس</span> <span class="current-price">${displayPrice} رس</span>`
    : (displayPrice ? `${displayPrice} رس` : 'السعر يحدد بعد الاستشارة');

  const colorsEl = modal.querySelector('.color-badges');
  if (colorsEl && dress.colors?.length) {
    colorsEl.innerHTML = dress.colors.map(c => 
      `<span class="color-badge" style="background:${escapeHtml(c.hex)}">${escapeHtml(c.name)}</span>`
    ).join('');
  }

  const sizesEl = modal.querySelector('.detail-sizes');
  if (sizesEl && dress.sizes?.length) {
    sizesEl.innerHTML = '<strong>المقاسات: </strong>' + dress.sizes.map(s => 
      `<span class="size-badge ${s.stock === 0 ? 'out-of-stock' : ''}">${escapeHtml(s.size)}</span>`
    ).join('');
  }

  modal.classList.add('show');
}

async function showDressDetails(dressId) {
  const modal = document.getElementById('dressDetailsModal');
  if (!modal) return;

  modal.dataset.dressId = dressId;
  modal.querySelector('.detail-image').innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';
  modal.querySelector('.detail-name').textContent = 'جاري التحميل...';

  try {
    const res = await fetch(`${API_BASE}/dresses/${dressId}`);
    if (res.ok) {
      const dress = await res.json();
      renderDressInModal(dress);
      return;
    }
  } catch (e) {}

  const dresses = getFallbackDresses();
  const dress = dresses.find(d => d._id === dressId);
  if (dress) {
    renderDressInModal(dress);
  }
}

function bookFromDetails() {
  const modal = document.getElementById('dressDetailsModal');
  const dressId = modal?.dataset.dressId;
  closeModal('dressDetailsModal');
  if (dressId) openBookingModal(dressId);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loader = document.querySelector('.loader');
  const body = document.body;

  function hideLoader() {
    body.style.overflow = '';
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => {
        if (loader) loader.style.display = 'none';
      }, 400);
    }
  }

  body.style.overflow = 'hidden';
  window.scrollTo({ top: 0, behavior: 'auto' });

  let loaderTimer = setTimeout(hideLoader, 300);
  window.addEventListener('load', function() {
    clearTimeout(loaderTimer);
    hideLoader();
  });
  
  initSearch();
  initFilters();
  updateFilterCount();
  
  const viewBtn = document.getElementById('viewToggle');
  if (viewBtn) {
    viewBtn.innerHTML = viewMode === 'grid' 
      ? '<i class="fas fa-list"></i>' 
      : '<i class="fas fa-th-large"></i>';
  }
  
  fetchDresses();
});

if (typeof window !== 'undefined') {
  window.closeModal = closeModal;
  window.showDressDetails = showDressDetails;
  window.bookFromDetails = bookFromDetails;
}