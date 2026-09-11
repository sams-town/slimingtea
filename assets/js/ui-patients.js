// ============================================================
// ui-patients.js  —  Daftar Pasien + Quick Register
//
// ALUR:
//   1. Tombol "+ Pasien Baru" → modal Quick Register (4 field)
//   2. Kartu pasien → klik "Buka Kunjungan" → patient-detail (3 tab)
//   3. Ikon pensil di kartu → edit data lengkap via modal Full Edit
// ============================================================

const UIPatients = {
  _query:       '',
  _activeFilter:'all',
  _editingUuid: null,   // null = tambah baru

  // ──────────────────────────────────────────────────────────
  // RENDER HALAMAN DAFTAR
  // ──────────────────────────────────────────────────────────
  async render() {
    const container = document.getElementById('page-patients');
    container.innerHTML = this._buildPageHTML();
    await this.loadList();
    this._bindSearch();
  },

  _buildPageHTML() {
    return `
    <div class="space-y-5 max-w-5xl mx-auto">

      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 class="text-xl font-bold text-white">Daftar Pasien</h2>
          <p id="patient-count-text" class="text-sm text-slate-400 mt-0.5">Memuat...</p>
        </div>
        <button onclick="UIPatients.openQuickRegister()"
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500
                 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Daftarkan Pasien
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="patient-search" type="search"
          placeholder="Cari nama atau nomor telepon..."
          class="w-full h-12 bg-slate-800 border border-slate-600 rounded-xl pl-10 pr-4
                 text-sm text-white placeholder-slate-500 focus:border-indigo-500">
      </div>

      <!-- Filter chips -->
      <div class="flex gap-2 flex-wrap">
        ${[
          ['all',         'Semua',        true ],
          ['quick',       'Baru Daftar',  false],
          ['full',        'Aktif',        false],
          ['diabetes',    'Diabetes',     false],
          ['hypertension','Hipertensi',   false],
          ['male',        'Laki-laki',    false],
          ['female',      'Perempuan',    false],
        ].map(([k, label, active]) => `
          <button onclick="UIPatients.setFilter('${k}')" id="filter-${k}"
            class="filter-btn px-3 py-1.5 rounded-xl text-xs font-medium transition-colors
                   ${active ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">
            ${label}
          </button>`).join('')}
      </div>

      <!-- Patient list -->
      <div id="patient-list" class="space-y-3">
        ${Array(3).fill('<div class="h-24 skeleton rounded-2xl"></div>').join('')}
      </div>

    </div>`;
  },

  // ──────────────────────────────────────────────────────────
  // LOAD & RENDER LIST
  // ──────────────────────────────────────────────────────────
  async loadList(query = this._query, filter = this._activeFilter) {
    let patients = await DB.searchPatients(query);

    // Apply filter
    const filterMap = {
      quick:       p => p.registration_status === 'quick' || !p.registration_status,
      full:        p => p.registration_status === 'full',
      diabetes:    p => p.diabetes,
      hypertension:p => p.hypertension,
      male:        p => p.sex === 'male',
      female:      p => p.sex === 'female',
    };
    if (filter !== 'all' && filterMap[filter]) {
      patients = patients.filter(filterMap[filter]);
    }

    patients.sort((a, b) => new Date(b.updated_at ?? b.created_at ?? 0)
                          - new Date(a.updated_at ?? a.created_at ?? 0));

    const countEl = document.getElementById('patient-count-text');
    if (countEl) countEl.textContent = `${patients.length} pasien`;

    const list = document.getElementById('patient-list');
    if (!list) return;

    if (!patients.length) {
      list.innerHTML = `
      <div class="text-center py-16 text-slate-500">
        <svg class="w-14 h-14 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857
               M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857
               m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <p class="text-sm font-medium">
          ${query ? `Tidak ada hasil untuk "${query}"` : 'Belum ada pasien terdaftar'}
        </p>
        <button onclick="UIPatients.openQuickRegister()"
          class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl">
          + Daftarkan Pasien Pertama
        </button>
      </div>`;
      return;
    }

    list.innerHTML = patients.map(p => this._patientCard(p)).join('');

    // Background merge dari server
    if (navigator.onLine) {
      const res = await API.patients.list(query, 1, 100);
      if (res.success && res.data?.length) {
        await DB.putBatch('patients', res.data.map(p => ({ ...p, _serverId: p.id })));
        // Re-render hanya jika count berubah (hindari flicker)
        const fresh = await DB.searchPatients(query);
        if (fresh.length !== patients.length) await this.loadList(query, filter);
      }
    }
  },

  // ──────────────────────────────────────────────────────────
  // PATIENT CARD
  // ──────────────────────────────────────────────────────────
  _patientCard(p) {
    const isQuick      = !p.registration_status || p.registration_status === 'quick';
    const avatarColor  = p.sex === 'female' ? 'bg-pink-600' : 'bg-indigo-600';
    const age          = p.age ?? calcAge(p.dob);
    const visitCount   = p.visit_count ?? 0;
    const lastVisit    = p.last_visit_date ? formatDate(p.last_visit_date) : null;

    const conditions = [
      p.diabetes      && '<span class="badge-cond">Diabetes</span>',
      p.hypertension  && '<span class="badge-cond">Hipertensi</span>',
      p.dyslipidemia  && '<span class="badge-cond">Dyslipidemia</span>',
      p.hyperuricemia && '<span class="badge-cond">Hiperurisemia</span>',
    ].filter(Boolean).join('');

    // Status badge
    const statusBadge = isQuick
      ? `<span class="inline-flex items-center gap-1 text-xs bg-amber-900/40 text-amber-300
                      border border-amber-700/40 px-2 py-0.5 rounded-full">
           <span class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
           Baru Daftar
         </span>`
      : `<span class="inline-flex items-center gap-1 text-xs bg-emerald-900/40 text-emerald-300
                      border border-emerald-700/40 px-2 py-0.5 rounded-full">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
           Pasien Aktif
         </span>`;

    return `
    <div class="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden
                hover:border-slate-600 transition-all group">

      <!-- Top row: avatar + info + aksi -->
      <div class="flex items-start gap-4 p-4">

        <!-- Avatar -->
        <div class="w-12 h-12 rounded-xl ${avatarColor} flex items-center justify-center
                    text-lg font-bold text-white flex-shrink-0">
          ${getInitials(p.name)}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2 flex-wrap">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base font-semibold text-white leading-tight">${p.name}</h3>
                ${statusBadge}
                ${p._pending ? `<span class="text-xs bg-slate-700 text-amber-400 px-2 py-0.5 rounded-full">⏳ Pending sync</span>` : ''}
              </div>
              <div class="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                ${p.sex ? `<span>${p.sex === 'female' ? '♀' : '♂'}</span>` : ''}
                ${age   ? `<span>${age} thn</span>` : ''}
                ${p.phone ? `<span>📞 ${p.phone}</span>` : ''}
                ${p.address ? `<span class="truncate max-w-[160px]">📍 ${p.address}</span>` : ''}
              </div>
              ${conditions ? `<div class="flex flex-wrap gap-1 mt-1.5">${conditions}</div>` : ''}
            </div>

            <!-- Edit & Delete -->
            <div class="flex gap-1.5 flex-shrink-0" onclick="event.stopPropagation()">
              <button onclick="UIPatients.openFullEdit('${p.uuid}')"
                title="Edit data"
                class="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                       m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button onclick="UIPatients.deletePatient('${p.uuid}', '${p.name.replace(/'/g, "\\'")}')"
                title="Hapus"
                class="p-2 bg-slate-700 hover:bg-red-900/60 text-slate-300
                       hover:text-red-400 rounded-lg transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858
                       L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom row: stats + CTA -->
      <div class="flex items-center justify-between px-4 py-3
                  bg-slate-900/40 border-t border-slate-700/60">
        <!-- Kunjungan stats -->
        <div class="flex items-center gap-4 text-xs text-slate-400">
          <span>🏥 ${visitCount} kunjungan</span>
          ${lastVisit
            ? `<span>📅 Terakhir: ${lastVisit}</span>`
            : `<span class="text-slate-600">Belum ada kunjungan</span>`}
          <span>🗓 Daftar: ${formatDate(p.registration_date)}</span>
        </div>

        <!-- CTA Utama -->
        <button
          onclick="App.goToPatient('${p.uuid}')"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                 transition-all
                 ${isQuick
                   ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                   : 'bg-emerald-700 hover:bg-emerald-600 text-white'}">
          ${isQuick
            ? `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                   d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7
                      a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2
                      M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
               </svg>
               Mulai Assessment`
            : `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                   d="M13 7l5 5m0 0l-5 5m5-5H6"/>
               </svg>
               Buka Kunjungan`}
        </button>
      </div>
    </div>`;
  },

  // ──────────────────────────────────────────────────────────
  // QUICK REGISTER — 4 field saja
  // ──────────────────────────────────────────────────────────
  openQuickRegister() {
    this._editingUuid = null;
    document.getElementById('modal-patient-title').textContent = '✚ Daftarkan Pasien Baru';
    document.getElementById('modal-patient-body').innerHTML    = this._buildQuickForm();
    openPatientModal();
  },

  _buildQuickForm() {
    return `
    <form id="patient-form" onsubmit="UIPatients.submitQuick(event)" class="space-y-5">

      <!-- Info tip -->
      <div class="flex items-start gap-3 bg-indigo-900/20 border border-indigo-700/30
                  rounded-xl px-4 py-3">
        <span class="text-lg flex-shrink-0">💡</span>
        <p class="text-xs text-indigo-200 leading-relaxed">
          Isi data dasar pasien sekarang. Detail lengkap (riwayat medis, lab, obat)
          dapat dilengkapi saat <strong>kunjungan pertama</strong>.
        </p>
      </div>

      <div class="space-y-4">

        <!-- Nama -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">
            Nama Lengkap <span class="text-red-400">*</span>
          </label>
          <input type="text" name="name" required
            placeholder="Nama pasien"
            class="w-full h-12 bg-slate-700/60 border border-slate-600 rounded-xl
                   px-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500">
        </div>

        <!-- No. HP -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">
            No. HP / WhatsApp <span class="text-red-400">*</span>
          </label>
          <input type="tel" name="phone" required
            placeholder="08xx-xxxx-xxxx"
            class="w-full h-12 bg-slate-700/60 border border-slate-600 rounded-xl
                   px-4 text-sm text-white placeholder-slate-500 focus:border-indigo-500">
        </div>

        <!-- Jenis Kelamin -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">
            Jenis Kelamin <span class="text-red-400">*</span>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex items-center gap-3 p-3 bg-slate-700/40 border border-slate-600
                          rounded-xl cursor-pointer hover:bg-slate-700 transition-colors
                          has-[:checked]:border-blue-500 has-[:checked]:bg-blue-900/20">
              <input type="radio" name="sex" value="male" required class="accent-indigo-500">
              <span class="text-sm text-slate-200">♂ Laki-laki</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-700/40 border border-slate-600
                          rounded-xl cursor-pointer hover:bg-slate-700 transition-colors
                          has-[:checked]:border-pink-500 has-[:checked]:bg-pink-900/20">
              <input type="radio" name="sex" value="female" class="accent-pink-500">
              <span class="text-sm text-slate-200">♀ Perempuan</span>
            </label>
          </div>
        </div>

        <!-- Alamat -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1.5">Alamat</label>
          <textarea name="address" rows="2"
            placeholder="Alamat lengkap pasien (opsional)"
            class="w-full bg-slate-700/60 border border-slate-600 rounded-xl
                   px-4 py-3 text-sm text-white placeholder-slate-500
                   resize-none focus:border-indigo-500"></textarea>
        </div>

        <!-- Tanggal daftar -->
        <input type="hidden" name="registration_date" value="${today()}">
        <input type="hidden" name="registration_status" value="quick">
      </div>

      <!-- Actions -->
      <div class="flex gap-3 pt-1">
        <button type="button" onclick="closePatientModal()"
          class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">
          Batal
        </button>
        <button type="submit"
          class="flex-1 flex items-center justify-center gap-2 py-3
                 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Daftarkan
        </button>
      </div>
    </form>`;
  },

  async submitQuick(e) {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());

    // Bersihkan field kosong
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null; });

    data.uuid                = generateUUID();
    data.registration_status = 'quick';
    data.registration_date   = data.registration_date ?? today();
    data.visit_count         = 0;
    data.synced              = 0;

    await Sync.saveLocal('patients', data, 'insert');

    if (navigator.onLine) {
      const res = await API.patients.create(data);
      if (res.success && res.id) {
        data.id = res.id;
        data._serverId = res.id;
        await DB.put('patients', data);
      }
    }

    closePatientModal();
    showToast(`✅ ${data.name} berhasil didaftarkan`, 'success');
    await this.loadList();

    // Langsung buka halaman detail untuk mulai assessment
    setTimeout(() => App.goToPatient(data.uuid), 400);
  },

  // ──────────────────────────────────────────────────────────
  // FULL EDIT MODAL — semua field
  // ──────────────────────────────────────────────────────────
  async openFullEdit(uuid) {
    const all = await DB.getAll('patients');
    const p   = all.find(x => x.uuid === uuid);
    if (!p) { showToast('Data tidak ditemukan', 'error'); return; }

    this._editingUuid = uuid;
    document.getElementById('modal-patient-title').textContent = '✏️ Edit Data Pasien';
    document.getElementById('modal-patient-body').innerHTML    = this._buildFullForm(p);
    this._bindDobAge();
    openPatientModal();
  },

  _buildFullForm(p = {}) {
    const v  = (k, def = '') => p?.[k] ?? def;
    const ck = k => p?.[k] ? 'checked' : '';
    const sel = (k, opt) => v(k) === opt ? 'selected' : '';

    return `
    <form id="patient-form" onsubmit="UIPatients.submitFullEdit(event)" class="space-y-6">

      <!-- Identitas Dasar -->
      <div>
        <h4 class="section-title">👤 Identitas</h4>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="field-label">Nama Lengkap *</label>
            <input type="text" name="name" value="${v('name')}" required
              class="field-input">
          </div>
          <div>
            <label class="field-label">No. HP / WhatsApp</label>
            <input type="tel" name="phone" value="${v('phone')}" placeholder="08xx-xxxx-xxxx"
              class="field-input">
          </div>
          <div>
            <label class="field-label">Jenis Kelamin *</label>
            <select name="sex" required class="field-select">
              <option value="">Pilih...</option>
              <option value="male"   ${sel('sex','male')}>♂ Laki-laki</option>
              <option value="female" ${sel('sex','female')}>♀ Perempuan</option>
            </select>
          </div>
          <div>
            <label class="field-label">Tanggal Lahir</label>
            <input type="date" name="dob" id="f-dob" value="${v('dob')}" class="field-input">
          </div>
          <div>
            <label class="field-label">Umur (tahun)</label>
            <input type="number" name="age" id="f-age" value="${v('age')}"
              min="1" max="120" placeholder="tahun" class="field-input">
          </div>
          <div>
            <label class="field-label">Tgl. Registrasi</label>
            <input type="date" name="registration_date" value="${v('registration_date', today())}"
              class="field-input">
          </div>
          <div class="col-span-2">
            <label class="field-label">Alamat</label>
            <textarea name="address" rows="2" class="field-textarea">${v('address')}</textarea>
          </div>
        </div>
      </div>

      <!-- Riwayat Medis -->
      <div>
        <h4 class="section-title">🏥 Riwayat Medis</h4>
        <div class="grid grid-cols-2 gap-2 mb-3">
          ${[['diabetes','Diabetes'],['hypertension','Hipertensi'],
             ['dyslipidemia','Dyslipidemia'],['hyperuricemia','Hiperurisemia'],
             ['heart_disease','Penyakit Jantung']].map(([k,l]) => `
            <label class="flex items-center gap-2 p-3 bg-slate-700/40 rounded-xl cursor-pointer hover:bg-slate-700">
              <input type="checkbox" name="${k}" value="1" ${ck(k)}
                class="w-4 h-4 rounded accent-indigo-500">
              <span class="text-sm text-slate-200">${l}</span>
            </label>`).join('')}
        </div>
        <div class="grid grid-cols-1 gap-2">
          <div>
            <label class="field-label">Kondisi lain</label>
            <input type="text" name="other_conditions" value="${v('other_conditions')}"
              placeholder="Kondisi medis lainnya..." class="field-input">
          </div>
          <div>
            <label class="field-label">Alergi</label>
            <input type="text" name="allergies" value="${v('allergies')}"
              placeholder="Alergi obat / makanan..." class="field-input">
          </div>
        </div>
      </div>

      <!-- Gaya Hidup -->
      <div>
        <h4 class="section-title">🌙 Gaya Hidup</h4>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Jam Tidur/malam</label>
            <input type="number" name="sleep_hours" value="${v('sleep_hours')}"
              min="1" max="24" step="0.5" placeholder="jam" class="field-input">
          </div>
          <div>
            <label class="field-label">Kualitas Tidur</label>
            <select name="sleep_quality" class="field-select">
              <option value="">Pilih...</option>
              <option value="good" ${sel('sleep_quality','good')}>Baik</option>
              <option value="fair" ${sel('sleep_quality','fair')}>Cukup</option>
              <option value="poor" ${sel('sleep_quality','poor')}>Buruk</option>
            </select>
          </div>
          <div>
            <label class="field-label">Tingkat Aktivitas</label>
            <select name="activity_level" class="field-select">
              <option value="">Pilih...</option>
              <option value="sedentary"         ${sel('activity_level','sedentary')}>Sedentary</option>
              <option value="lightly_active"    ${sel('activity_level','lightly_active')}>Ringan 1-2x/minggu</option>
              <option value="moderately_active" ${sel('activity_level','moderately_active')}>Sedang 3-5x/minggu</option>
              <option value="very_active"       ${sel('activity_level','very_active')}>Aktif >5x/minggu</option>
            </select>
          </div>
          <div>
            <label class="field-label">Pola Diet</label>
            <select name="diet_pattern" class="field-select">
              <option value="">Pilih...</option>
              <option value="regular"              ${sel('diet_pattern','regular')}>Regular</option>
              <option value="low_carb"             ${sel('diet_pattern','low_carb')}>Low Carb</option>
              <option value="vegetarian"           ${sel('diet_pattern','vegetarian')}>Vegetarian</option>
              <option value="vegan"                ${sel('diet_pattern','vegan')}>Vegan</option>
              <option value="intermittent_fasting" ${sel('diet_pattern','intermittent_fasting')}>Intermittent Fasting</option>
              <option value="other"                ${sel('diet_pattern','other')}>Lainnya</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-3 pt-1">
        <button type="button" onclick="closePatientModal()"
          class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">
          Batal
        </button>
        <button type="submit"
          class="flex-1 flex items-center justify-center gap-2 py-3
                 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Simpan Perubahan
        </button>
      </div>
    </form>`;
  },

  async submitFullEdit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {};

    form.querySelectorAll('[name]').forEach(el => {
      if (el.type === 'checkbox') {
        data[el.name] = el.checked ? 1 : 0;
      } else {
        const val = el.value.trim();
        data[el.name] = val === '' ? null : val;
      }
    });

    ['age','sleep_hours','diabetes','hypertension','dyslipidemia',
     'hyperuricemia','heart_disease'].forEach(k => {
      if (data[k] != null) data[k] = parseFloat(data[k]) || 0;
    });

    data.uuid = this._editingUuid;
    // Pertahankan status (tidak downgrade ke quick)
    const existing = await DB.get('patients', data.uuid);
    data.registration_status = existing?.registration_status ?? 'quick';

    await Sync.saveLocal('patients', data, 'update');

    if (navigator.onLine) {
      const id = existing?.id ?? existing?._serverId;
      if (id) await API.patients.update(id, data);
    }

    closePatientModal();
    showToast('Data pasien diperbarui', 'success');
    await this.loadList();
  },

  // ──────────────────────────────────────────────────────────
  // FILTER  /  SEARCH  /  DELETE
  // ──────────────────────────────────────────────────────────
  setFilter(filter) {
    this._activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      const on = btn.id === `filter-${filter}`;
      btn.className = btn.className
        .replace('bg-indigo-600 text-white', '')
        .replace('bg-slate-700 text-slate-300 hover:bg-slate-600', '')
        .trim();
      btn.classList.add(on ? 'bg-indigo-600' : 'bg-slate-700',
                        on ? 'text-white'    : 'text-slate-300');
      if (!on) btn.classList.add('hover:bg-slate-600');
    });
    this.loadList(this._query, filter);
  },

  _bindSearch() {
    document.getElementById('patient-search')?.addEventListener(
      'input', debounce(e => {
        this._query = e.target.value;
        this.loadList(this._query, this._activeFilter);
      }, 300)
    );
  },

  async deletePatient(uuid, name) {
    if (!confirm(`Hapus pasien "${name}"?\nSeluruh data kunjungan akan ikut terhapus.`)) return;

    await DB.delete('patients', uuid);
    await DB.addToSyncQueue('patients', uuid, 'delete', { uuid });

    if (navigator.onLine) {
      const all = await DB.getAll('patients');
      const p   = all.find(x => x.uuid === uuid);
      if (p?.id) await API.patients.delete(p.id);
    }

    showToast(`Pasien "${name}" dihapus`, 'info');
    await this.loadList();
  },

  _bindDobAge() {
    document.getElementById('f-dob')?.addEventListener('change', function () {
      const age = calcAge(this.value);
      if (age) document.getElementById('f-age').value = age;
    });
  },
};

// ── Tailwind utility classes via CSS helper (lebih DRY) ──────
// Injeksikan style sekali saat pertama load
(function injectFormStyles() {
  if (document.getElementById('form-utility-styles')) return;
  const s = document.createElement('style');
  s.id = 'form-utility-styles';
  s.textContent = `
    .field-label  { display:block; font-size:0.75rem; font-weight:600;
                    color:#94a3b8; margin-bottom:0.375rem; }
    .field-input  { width:100%; height:2.75rem; background:rgba(51,65,85,0.6);
                    border:1px solid #475569; border-radius:0.75rem;
                    padding:0 0.75rem; font-size:0.875rem; color:#f1f5f9;
                    transition:border-color .15s; }
    .field-input:focus   { outline:none; border-color:#6366f1; }
    .field-select { width:100%; height:2.75rem; background:rgba(51,65,85,0.6);
                    border:1px solid #475569; border-radius:0.75rem;
                    padding:0 0.75rem; font-size:0.875rem; color:#f1f5f9; }
    .field-select:focus  { outline:none; border-color:#6366f1; }
    .field-textarea { width:100%; background:rgba(51,65,85,0.6);
                      border:1px solid #475569; border-radius:0.75rem;
                      padding:0.625rem 0.75rem; font-size:0.875rem; color:#f1f5f9;
                      resize:none; }
    .field-textarea:focus { outline:none; border-color:#6366f1; }
    .section-title { font-size:0.75rem; font-weight:700; color:#94a3b8;
                     text-transform:uppercase; letter-spacing:0.05em;
                     margin-bottom:0.75rem; }
    .badge-cond   { font-size:0.7rem; background:rgba(51,65,85,0.8);
                    color:#cbd5e1; padding:0.125rem 0.5rem;
                    border-radius:9999px; display:inline-block; }
  `;
  document.head.appendChild(s);
})();
