// ============================================================
// utils.js — Shared utilities
// ============================================================

// --- UUID v4 ---
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// --- Toast notification ---
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// --- Format tanggal Indonesia ---
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// --- Format angka desimal ---
function fmt(val, dec = 1) {
  if (val === null || val === undefined || val === '') return '-';
  const n = parseFloat(val);
  return isNaN(n) ? '-' : n.toFixed(dec);
}

// --- Hitung BMI ---
function calcBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

// --- BMI Category ---
function bmiCategory(bmi) {
  if (!bmi) return '';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 23)   return 'Normal';
  if (bmi < 25)   return 'Overweight';
  if (bmi < 30)   return 'Obesitas I';
  return 'Obesitas II';
}

// --- Change indicator HTML ---
function changeIndicator(baseline, current, unit = '', lowerIsBetter = false) {
  if (baseline === null || baseline === undefined || current === null || current === undefined) {
    return '<span class="change-neu">-</span>';
  }
  const diff = parseFloat(current) - parseFloat(baseline);
  if (isNaN(diff)) return '<span class="change-neu">-</span>';

  const sign    = diff > 0 ? '+' : '';
  const isGood  = lowerIsBetter ? diff < 0 : diff > 0;
  const cls     = diff === 0 ? 'change-neu' : (isGood ? 'change-pos' : 'change-neg');
  const arrow   = diff === 0 ? '→' : (diff > 0 ? '▲' : '▼');
  return `<span class="${cls}">${arrow} ${sign}${fmt(diff, 1)}${unit}</span>`;
}

// --- Debounce ---
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// --- Deep clone ---
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

// --- Today YYYY-MM-DD ---
function today() { return new Date().toISOString().slice(0, 10); }

// --- Sidebar toggle ---
function toggleSidebar() {
  const sb  = document.getElementById('sidebar');
  const ov  = document.getElementById('drawer-overlay');
  const open = sb.classList.toggle('translate-x-0');
  sb.classList.toggle('-translate-x-full', !open);
  ov.classList.toggle('open', open);
}
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.remove('translate-x-0');
  sb.classList.add('-translate-x-full');
  document.getElementById('drawer-overlay').classList.remove('open');
}

// --- Modal helpers ---
function openPatientModal(title = 'Tambah Pasien Baru') {
  document.getElementById('modal-patient-title').textContent = title;
  document.getElementById('modal-patient').classList.remove('hidden');
  document.getElementById('modal-patient').classList.add('flex');
}
function closePatientModal() {
  document.getElementById('modal-patient').classList.add('hidden');
  document.getElementById('modal-patient').classList.remove('flex');
}

// --- Avatar initials ---
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// --- Age dari DOB ---
function calcAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  return age;
}

// --- Skeleton line ---
function skeletonLine(w = 'w-full', h = 'h-4') {
  return `<div class="skeleton ${w} ${h} mb-2"></div>`;
}
