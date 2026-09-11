// ============================================================
// api.js — HTTP client untuk PHP backend
// Semua request otomatis inject token dan handle error
// ============================================================

// Deteksi base path otomatis (kompatibel subfolder hosting)
const API_BASE  = (() => {
  const base = window.location.pathname.replace(/\/[^/]*$/, '');
  return base + '/api';
})();

const API_TOKEN = 'samstown2025'; // harus sama dengan config.php

const API = {
  // ---- Base fetch wrapper ----
  async _req(endpoint, method = 'GET', body = null, isFormData = false) {
    const headers = {
      'X-API-Token':        API_TOKEN,
      'Authorization':      `Bearer ${API_TOKEN}`,
    };
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const opts = { method, headers, credentials: 'same-origin' };
    if (body && !isFormData) opts.body = JSON.stringify(body);
    if (body && isFormData)  opts.body = body;

    try {
      const res  = await fetch(`${API_BASE}/${endpoint}`, opts);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch { json = { success: false, message: `Server error: ${res.status} — ${text.slice(0,200)}` }; }
      if (res.status === 401 && !json.success) {
        console.error('[API] 401 Unauthorized — token/header issue. Res:', json);
      }
      return json;
    } catch (err) {
      return { success: false, offline: true, message: err.message };
    }
  },

  // ---- Patients ----
  patients: {
    list: (q = '', page = 1, limit = 50) =>
      API._req(`patients.php?action=list&q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
    get: (id) =>
      API._req(`patients.php?action=get&id=${id}`),
    create: (data) =>
      API._req('patients.php?action=create', 'POST', data),
    update: (id, data) =>
      API._req(`patients.php?action=update&id=${id}`, 'POST', data),
    delete: (id) =>
      API._req(`patients.php?action=delete&id=${id}`, 'POST'),
  },

  // ---- Assessments ----
  assessments: {
    get:  (patientId) =>
      API._req(`assessments.php?action=get&patient_id=${patientId}`),
    save: (data) =>
      API._req('assessments.php?action=save', 'POST', data),
  },

  // ---- Monitorings ----
  monitorings: {
    list: (patientId) =>
      API._req(`monitorings.php?action=list&patient_id=${patientId}`),
    get:  (patientId, week) =>
      API._req(`monitorings.php?action=get&patient_id=${patientId}&week=${week}`),
    save: (data) =>
      API._req('monitorings.php?action=save', 'POST', data),
  },

  // ---- Photos ----
  photos: {
    list: (patientId) =>
      API._req(`photos.php?action=list&patient_id=${patientId}`),
    upload: (formData) =>
      API._req('photos.php?action=upload', 'POST', formData, true),
    delete: (id) =>
      API._req(`photos.php?action=delete&id=${id}`, 'POST'),
  },

  // ---- Notes ----
  notes: {
    list: (patientId) =>
      API._req(`notes.php?action=list&patient_id=${patientId}`),
    save: (data) =>
      API._req('notes.php?action=save', 'POST', data),
    delete: (id) =>
      API._req(`notes.php?action=delete&id=${id}`, 'POST'),
  },

  // ---- Sliming Treatments (Master Data) ----
  treatments: {
    list:   (q = '', activeOnly = false) =>
      API._req(`treatments.php?action=list&q=${encodeURIComponent(q)}&active=${activeOnly ? 1 : 0}`),
    get:    (id) =>
      API._req(`treatments.php?action=get&id=${id}`),
    create: (data) =>
      API._req('treatments.php?action=create', 'POST', data),
    update: (id, data) =>
      API._req(`treatments.php?action=update&id=${id}`, 'POST', data),
    delete: (id) =>
      API._req(`treatments.php?action=delete&id=${id}`, 'POST'),
  },

  // ---- Sync ----
  sync: {
    ping:  () =>
      API._req('sync.php?action=ping'),
    push:  (records) =>
      API._req('sync.php?action=push', 'POST', { records }),
    pull:  (since = '1970-01-01 00:00:00', patientId = null) => {
      const params = `action=pull&since=${encodeURIComponent(since)}` +
                     (patientId ? `&patient_id=${patientId}` : '');
      return API._req(`sync.php?${params}`);
    },
  },
};
