// ============================================================
// ui-assessment.js — Tab 1: Initial Assessment
// ============================================================

const UIAssessment = {
  _patientId: null,
  _data: null,

  // ---- Render halaman assessment ----
  async render(patientId, containerId = 'page-assessment') {
    this._patientId = patientId;
    const container = document.getElementById(containerId) ??
                      document.getElementById('page-assessment');
    container.innerHTML = this._skeleton();

    // Load dari IndexedDB dulu (offline-first)
    let data = await this._loadLocal(patientId);

    // Kalau online, coba ambil dari server
    if (navigator.onLine) {
      const res = await API.assessments.get(patientId);
      if (res.success && res.data) {
        data = res.data;
        await DB.put('initial_assessments', { ...data, patient_id: patientId });
      }
    }

    this._data = data;
    container.innerHTML = this._buildHTML(data);
    this._bindEvents();
  },

  async _loadLocal(patientId) {
    const all = await DB.getAllByIndex('initial_assessments', 'patient_id', patientId);
    return all.length > 0 ? all[0] : null;
  },

  // ---- Skeleton loader ----
  _skeleton() {
    return `<div class="space-y-4 animate-pulse">
      ${skeletonLine('w-1/3','h-6')}${skeletonLine('w-full','h-40')}${skeletonLine('w-full','h-40')}
    </div>`;
  },

  // ---- Build HTML form ----
  _buildHTML(d = {}) {
    const v = (k, dec = '') => d?.[k] ?? dec;
    return `
    <div class="space-y-6 max-w-4xl mx-auto">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white">Initial Assessment</h2>
          <p class="text-sm text-slate-400 mt-0.5">Data baseline dan rencana terapi</p>
        </div>
        <button onclick="UIAssessment.save()"
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Simpan
        </button>
      </div>

      <!-- SECTION 1: Lab Baseline -->
      <div class="bg-slate-800 rounded-2xl p-5 border border-slate-700">
        <h3 class="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span class="w-6 h-6 bg-indigo-600/30 rounded-lg flex items-center justify-center text-xs">1</span>
          Lab Baseline
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          ${this._field('gds',              'GDS (mg/dL)',          v('gds'),              'number','Gula Darah Sewaktu')}
          ${this._field('total_cholesterol','Total Cholesterol',    v('total_cholesterol'),'number','mg/dL')}
          ${this._field('ldl',              'LDL (mg/dL)',          v('ldl'),              'number')}
          ${this._field('hdl',              'HDL (mg/dL)',          v('hdl'),              'number')}
          ${this._field('triglycerides',    'Trigliserida (mg/dL)', v('triglycerides'),    'number')}
          ${this._field('uric_acid',        'Asam Urat (mg/dL)',    v('uric_acid'),        'number')}
          ${this._field('hba1c',            'HbA1c (%)',            v('hba1c'),            'number')}
          ${this._field('creatinine',       'Kreatinin (mg/dL)',    v('creatinine'),       'number')}
          ${this._field('sgot',             'SGOT (U/L)',           v('sgot'),             'number')}
          ${this._field('sgpt',             'SGPT (U/L)',           v('sgpt'),             'number')}
        </div>
      </div>

      <!-- SECTION 2: Weight Management Goals -->
      <div class="bg-slate-800 rounded-2xl p-5 border border-slate-700">
        <h3 class="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span class="w-6 h-6 bg-emerald-600/30 rounded-lg flex items-center justify-center text-xs">2</span>
          Weight Management Goals
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          ${this._field('initial_weight','Berat Awal (kg)',    v('initial_weight'),'number','kg','step=0.1')}
          ${this._field('initial_height','Tinggi Badan (cm)',  v('initial_height'),'number','cm','step=0.1')}
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">BMI Awal</label>
            <div id="bmi-display"
              class="h-11 bg-slate-700/60 border border-slate-600 rounded-xl px-3 flex items-center text-sm font-mono text-white">
              ${v('initial_bmi') ? fmt(v('initial_bmi'),1) + ' — ' + bmiCategory(v('initial_bmi')) : '— (isi berat & tinggi)'}
            </div>
            <input type="hidden" id="initial_bmi" name="initial_bmi" value="${v('initial_bmi')}">
          </div>
          ${this._field('target_weight','Target Berat (kg)',   v('target_weight'),'number','kg','step=0.1')}
          ${this._field('target_waist', 'Target Pinggang (cm)',v('target_waist'), 'number','cm','step=0.1')}
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Main Goal / Motivasi Pasien</label>
          <textarea id="main_goal" name="main_goal" rows="2"
            placeholder="Contoh: Turun 10 kg dalam 3 bulan untuk persiapan operasi..."
            class="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:border-indigo-500"
          >${v('main_goal')}</textarea>
        </div>
      </div>

      <!-- SECTION 3: Treatment Plan -->
      <div class="bg-slate-800 rounded-2xl p-5 border border-slate-700">
        <h3 class="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span class="w-6 h-6 bg-amber-600/30 rounded-lg flex items-center justify-center text-xs">3</span>
          Treatment Plan
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Obat / Injeksi</label>
            <select id="medication" name="medication"
              class="w-full h-11 bg-slate-700/60 border border-slate-600 rounded-xl px-3 text-sm text-white focus:border-indigo-500"
              onchange="UIAssessment.toggleMedOther(this.value)">
              ${['none','Semaglutide','Tirzepatide','Liraglutide','Orlistat','Other'].map(m =>
                `<option value="${m}" ${v('medication','none') === m ? 'selected' : ''}>${m}</option>`
              ).join('')}
            </select>
          </div>
          <div id="med-other-wrap" class="${v('medication') === 'Other' ? '' : 'hidden'}">
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Nama Obat Lain</label>
            <input type="text" id="medication_other" name="medication_other"
              value="${v('medication_other')}" placeholder="Nama obat..."
              class="w-full h-11 bg-slate-700/60 border border-slate-600 rounded-xl px-3 text-sm text-white focus:border-indigo-500">
          </div>
          ${this._field('starting_dose','Dosis Awal',  v('starting_dose'),'text','mis. 0.25 mg/minggu')}
          ${this._field('date_started', 'Tanggal Mulai',v('date_started'), 'date')}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Meal Plan</label>
            <textarea id="meal_plan" name="meal_plan" rows="3"
              placeholder="Contoh: 1200 kkal/hari, rendah karbohidrat..."
              class="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:border-indigo-500"
            >${v('meal_plan')}</textarea>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Exercise Plan</label>
            <textarea id="exercise_plan" name="exercise_plan" rows="3"
              placeholder="Contoh: Jalan kaki 30 menit 5x/minggu..."
              class="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:border-indigo-500"
            >${v('exercise_plan')}</textarea>
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Catatan Tambahan</label>
            <textarea id="additional_notes" name="additional_notes" rows="2"
              class="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:border-indigo-500"
            >${v('additional_notes')}</textarea>
          </div>
        </div>
      </div>

      <!-- Save button bottom -->
      <div class="flex justify-end pb-4">
        <button onclick="UIAssessment.save()"
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl text-sm font-semibold transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Simpan Assessment
        </button>
      </div>
    </div>`;
  },

  // ---- Field helper ----
  _field(id, label, value = '', type = 'text', placeholder = '', extra = '') {
    return `
    <div>
      <label for="${id}" class="block text-xs font-medium text-slate-400 mb-1.5">${label}</label>
      <input type="${type}" id="${id}" name="${id}" value="${value ?? ''}"
        placeholder="${placeholder}" ${extra}
        class="w-full h-11 bg-slate-700/60 border border-slate-600 rounded-xl px-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500">
    </div>`;
  },

  // ---- Bind events: BMI auto-calc ----
  _bindEvents() {
    const wEl = document.getElementById('initial_weight');
    const hEl = document.getElementById('initial_height');
    const calc = () => {
      const w = parseFloat(wEl?.value);
      const h = parseFloat(hEl?.value);
      const bmiEl  = document.getElementById('bmi-display');
      const bmiInp = document.getElementById('initial_bmi');
      if (w && h) {
        const bmi = calcBMI(w, h);
        if (bmiEl)  bmiEl.textContent  = `${bmi} — ${bmiCategory(bmi)}`;
        if (bmiInp) bmiInp.value       = bmi;
      }
    };
    wEl?.addEventListener('input', calc);
    hEl?.addEventListener('input', calc);
  },

  toggleMedOther(val) {
    const wrap = document.getElementById('med-other-wrap');
    if (wrap) wrap.classList.toggle('hidden', val !== 'Other');
  },

  // ---- Collect form values ----
  _collect() {
    const ids = [
      'gds','total_cholesterol','ldl','hdl','triglycerides','uric_acid','hba1c','creatinine','sgot','sgpt',
      'initial_weight','initial_height','initial_bmi','target_weight','target_waist','main_goal',
      'medication','medication_other','starting_dose','date_started',
      'meal_plan','exercise_plan','additional_notes'
    ];
    const data = { patient_id: this._patientId };
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const val = el.value.trim();
      // Numerik
      if (['gds','total_cholesterol','ldl','hdl','triglycerides','uric_acid','hba1c',
           'creatinine','sgot','sgpt','initial_weight','initial_height','initial_bmi',
           'target_weight','target_waist'].includes(id)) {
        data[id] = val !== '' ? parseFloat(val) : null;
      } else {
        data[id] = val || null;
      }
    });
    return data;
  },

  // ---- Save ----
  async save() {
    const data = this._collect();
    if (!data.patient_id) { showToast('Pilih pasien terlebih dahulu', 'error'); return; }

    // Pakai uuid yang sudah ada atau buat baru
    data.uuid = this._data?.uuid ?? generateUUID();

    // Simpan lokal dulu
    await Sync.saveLocal('initial_assessments', data, this._data ? 'update' : 'insert');
    this._data = data;
    showToast('Assessment tersimpan', 'success');

    // Beritahu App untuk upgrade status pasien quick → full
    if (typeof App !== 'undefined') App.onAssessmentSaved();

    // Kalau online, langsung push ke server juga
    if (navigator.onLine) {
      const res = await API.assessments.save(data);
      if (res.success) {
        showToast('Tersinkron ke server ✓', 'success');
        // Update server ID ke lokal jika ada
        if (res.id) {
          data.id = res.id;
          await DB.put('initial_assessments', data);
        }
      }
    }

    // Refresh dashboard jika ada
    if (typeof UIDashboard !== 'undefined') {
      await UIDashboard.render(this._patientId);
    }
  },
};
