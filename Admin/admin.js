const API = '/api';
let token = sessionStorage.getItem('admin_token');
let uploadedImages = [];
let existingImages = [];

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span><button class="toast-close" onclick="this.parentElement.remove()">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-hide'); setTimeout(() => toast.remove(), 400); }, 4000);
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboardScreen').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboardScreen').style.display = 'flex';
  loadDresses();
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  const loginBtn = e.target.querySelector('button[type="submit"]');
  document.getElementById('loginError').textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'جاري تسجيل الدخول...';
  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      document.getElementById('loginError').textContent = data.error || 'اسم المستخدم أو كلمة السر خطأ';
      loginBtn.disabled = false;
      loginBtn.textContent = 'دخول';
      return;
    }
    const data = await res.json();
    token = data.token;
    sessionStorage.setItem('admin_token', token);
    showDashboard();
  } catch {
    document.getElementById('loginError').textContent = 'تعذر الاتصال بالسيرفر';
    loginBtn.disabled = false;
    loginBtn.textContent = 'دخول';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  token = null;
  sessionStorage.removeItem('admin_token');
  showLogin();
});

async function loadDresses() {
  const tbody = document.getElementById('dressesBody');
  const loading = document.getElementById('loadingDresses');
  loading.style.display = 'block';
  tbody.innerHTML = '';
  try {
    const res = await fetch(`${API}/dresses?limit=100`);
    const data = await res.json();
    const dresses = data.dresses || data || [];
    renderTable(dresses);
  } catch {
    tbody.innerHTML = '<tr><td colspan="9">تعذر تحميل الفساتين</td></tr>';
  }
  loading.style.display = 'none';
}

function renderTable(dresses) {
  const tbody = document.getElementById('dressesBody');
  tbody.innerHTML = dresses.map(d => {
    const img = (d.images && d.images[0]) || 'https://placehold.co/100x133/391925/FFEAD4?text=فستان';
    const id = String(d._id).replace(/'/g, "\\'");
    const imageCount = d.images ? d.images.length : 0;
    return `<tr>
      <td data-label="الصورة"><img src="${escapeHtml(img)}" alt="${escapeHtml(d.name)}" loading="lazy">${imageCount > 1 ? `<span class="img-count">+${imageCount - 1}</span>` : ''}</td>
      <td data-label="الاسم">${escapeHtml(d.name)}</td>
      <td data-label="السعر">${d.price ? d.price + ' رس' : '-'}</td>
      <td data-label="التصنيف">${escapeHtml(d.category || '-')}</td>
      <td class="td-hide" data-label="مميز">${d.featured ? '✔' : '✘'}</td>
      <td class="td-hide" data-label="جديد">${d.isNew ? '✔' : '✘'}</td>
      <td class="td-hide" data-label="تخفيض">${d.isOnSale ? '✔' : '✘'}</td>
      <td class="td-hide" data-label="متوفر">${d.inStock !== false ? '✔' : '✘'}</td>
      <td data-label="إجراءات">
        <button class="btn-edit" data-id="${id}">تعديل</button>
        <button class="btn-delete" data-id="${id}">حذف</button>
      </td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => editDress(btn.dataset.id)));
  tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => deleteDress(btn.dataset.id)));
}

function resetForm() {
  document.getElementById('editId').value = '';
  document.getElementById('dressForm').reset();
  document.getElementById('dStock').checked = true;
  document.getElementById('imagePreview').innerHTML = '';
  uploadedImages = [];
  existingImages = [];
  document.getElementById('dImageFile').value = '';
  document.getElementById('priceError').textContent = '';
}

document.getElementById('showAddForm').addEventListener('click', () => {
  resetForm();
  document.getElementById('addForm').style.display = 'block';
  document.getElementById('showAddForm').style.display = 'none';
});

document.getElementById('cancelForm').addEventListener('click', () => {
  document.getElementById('addForm').style.display = 'none';
  document.getElementById('showAddForm').style.display = 'inline-block';
});

async function uploadSingleFile(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API}/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('upload_failed');
  const data = await res.json();
  return data.url;
}

document.getElementById('dImageFile').addEventListener('change', async function() {
  const files = Array.from(this.files);
  if (!files.length) return;
  const preview = document.getElementById('imagePreview');

  for (const file of files) {
    const tempId = 'uploading-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    preview.innerHTML += `<div class="preview-item" id="${tempId}"><div class="upload-status">جاري رفع ${escapeHtml(file.name)}...</div></div>`;
    try {
      const url = await uploadSingleFile(file);
      uploadedImages.push(url);
      const el = document.getElementById(tempId);
      if (el) {
        el.innerHTML = `<img src="${url}" class="preview-img"><div class="upload-status done">تم الرفع ✓</div><button type="button" class="remove-img-btn" data-url="${url}" title="إزالة">&times;</button>`;
      }
    } catch {
      const el = document.getElementById(tempId);
      if (el) el.innerHTML = '<div class="upload-status error">فشل الرفع</div>';
    }
  }
  this.value = '';

  preview.querySelectorAll('.remove-img-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const url = this.dataset.url;
      uploadedImages = uploadedImages.filter(u => u !== url);
      existingImages = existingImages.filter(u => u !== url);
      this.closest('.preview-item').remove();
    });
  });
});

function validatePrice() {
  const price = parseFloat(document.getElementById('dPrice').value);
  const discount = parseFloat(document.getElementById('dDiscount').value);
  const errorEl = document.getElementById('priceError');
  if (!errorEl) return true;

  if (isNaN(price) || price <= 0) {
    errorEl.textContent = 'السعر يجب أن يكون أكبر من صفر';
    return false;
  }
  if (!isNaN(discount) && discount > 0 && discount >= price) {
    errorEl.textContent = 'سعر التخفيض يجب أن يكون أقل من السعر الأصلي';
    return false;
  }
  errorEl.textContent = '';
  return true;
}

document.getElementById('dPrice').addEventListener('input', validatePrice);
document.getElementById('dDiscount').addEventListener('input', validatePrice);

function setFormLoading(loading) {
  const btn = document.querySelector('.btn-save');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'جاري الحفظ...' : 'حفظ';
}

document.getElementById('dressForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validatePrice()) return;
  setFormLoading(true);
  const editId = document.getElementById('editId').value;
  const allImages = [...existingImages, ...uploadedImages];
  const body = {
    name: document.getElementById('dName').value.trim(),
    description: document.getElementById('dDesc').value.trim(),
    price: parseFloat(document.getElementById('dPrice').value) || 0,
    discountPrice: parseFloat(document.getElementById('dDiscount').value) || 0,
    category: document.getElementById('dCategory').value.trim() || 'زفاف',
    material: document.getElementById('dMaterial').value.trim(),
    images: allImages,
    featured: document.getElementById('dFeatured').checked,
    isNew: document.getElementById('dNew').checked,
    isOnSale: document.getElementById('dSale').checked,
    inStock: document.getElementById('dStock').checked
  };
  try {
    const url = editId ? `${API}/dresses/${editId}` : `${API}/dresses`;
    const method = editId ? 'PUT' : 'POST';
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (res.status === 401) {
      setFormLoading(false);
      token = null;
      sessionStorage.removeItem('admin_token');
      document.getElementById('loginError').textContent = 'انتهت الجلسة، سجل دخول مرة أخرى';
      showLogin();
      return;
    }
    if (!res.ok) {
      setFormLoading(false);
      showToast(editId ? 'فشل التعديل' : 'فشل الإضافة', 'error');
      return;
    }
    document.getElementById('addForm').style.display = 'none';
    document.getElementById('showAddForm').style.display = 'inline-block';
    resetForm();
    loadDresses();
    showToast(editId ? 'تم تعديل الفستان بنجاح' : 'تم إضافة الفستان بنجاح');
  } catch {
    setFormLoading(false);
    showToast('خطأ في الاتصال بالسيرفر', 'error');
  }
  setFormLoading(false);
});

async function editDress(id) {
  try {
    const res = await fetch(`${API}/dresses/${id}`);
    if (!res.ok) { showToast('فشل تحميل بيانات الفستان', 'error'); return; }
    const d = await res.json();
    resetForm();
    document.getElementById('editId').value = d._id;
    document.getElementById('dName').value = d.name || '';
    document.getElementById('dDesc').value = d.description || '';
    document.getElementById('dPrice').value = d.price || '';
    document.getElementById('dDiscount').value = d.discountPrice || '';
    document.getElementById('dCategory').value = d.category || '';
    document.getElementById('dMaterial').value = d.material || '';
    document.getElementById('dFeatured').checked = d.featured || false;
    document.getElementById('dNew').checked = d.isNew || false;
    document.getElementById('dSale').checked = d.isOnSale || false;
    document.getElementById('dStock').checked = d.inStock !== false;
    if (d.images && d.images.length) {
      existingImages = [...d.images];
      const preview = document.getElementById('imagePreview');
      preview.innerHTML = d.images.map(url =>
        `<div class="preview-item"><img src="${escapeHtml(url)}" class="preview-img"><button type="button" class="remove-img-btn" data-url="${escapeHtml(url)}" title="إزالة">&times;</button></div>`
      ).join('');
      preview.querySelectorAll('.remove-img-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const url = this.dataset.url;
          existingImages = existingImages.filter(u => u !== url);
          uploadedImages = uploadedImages.filter(u => u !== url);
          this.closest('.preview-item').remove();
        });
      });
    }
    document.getElementById('addForm').style.display = 'block';
    document.getElementById('showAddForm').style.display = 'none';
  } catch {
    showToast('خطأ في تحميل بيانات الفستان', 'error');
  }
}

async function deleteDress(id) {
  if (!confirm('تأكيد حذف هذا الفستان؟ سيتم حذف جميع الصور المرتبطة.')) return;
  try {
    const res = await fetch(`${API}/dresses/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401) {
      token = null;
      sessionStorage.removeItem('admin_token');
      document.getElementById('loginError').textContent = 'انتهت الجلسة، سجل دخول مرة أخرى';
      showLogin();
      return;
    }
    if (!res.ok) { showToast('فشل الحذف', 'error'); return; }
    loadDresses();
    showToast('تم حذف الفستان بنجاح');
  } catch {
    showToast('خطأ في الحذف', 'error');
  }
}

async function init() {
  if (!token) { showLogin(); return; }
  try {
    const res = await fetch(`${API}/admin/verify`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { showDashboard(); return; }
  } catch {}
  token = null;
  sessionStorage.removeItem('admin_token');
  showLogin();
}

init();
