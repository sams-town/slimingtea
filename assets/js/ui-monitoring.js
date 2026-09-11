// ============================================================
// ui-monitoring.js — Tab 2: Weekly Monitoring Matrix + Lingkar Tubuh
// Includes: tombol "Scan InBody" per kolom minggu (OCR auto-fill)
// ============================================================

const UIMonitoring = {
  _patientId: null,
  _monitorings: [],   // index 0-8 (Baseline=0, W1–W8)
  _circumferences: [],
  _heightCm: null,

  WEEKS: ['Baseline', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],

  MON_FIELDS: [
    { key: 'visit_date',     label: 'Tanggal Kunjungan', type: 'date' },
    { key: 'weight_kg',      label: 'Berat (kg)',        type: 'num', step: '0.1' },
    { key: 'bmi',            label: 'BMI',               type: 'num', step: '0.1', auto: true },
    { key: 'body_fat_pct',   label: 'Body Fat (%)',      type: 'num', step: '0.1' },
    { key: 'body_fat_kg',    label: 'Body Fat (kg)',     type: 'num', step: '0.1' },
    { key: 'visceral_fat',   label: 'Visceral Fat',      type: 'num', step: '0.1' },
    { key: 'muscle_mass_kg', label: 'Muscle Mass (kg)',  type: 'num', step: '0.1' },
    { key: 'body_age',       label: 'Body Age',          type: 'int' },
    { key: 'waist_cm',       label: 'Pinggang (cm)',     type: 'num', step: '0.1' },
    { key: 'abdomen_cm',     label: 'Perut (cm)',        type: 'num', step: '0.1' },
    { key: 'hip_cm',         label: 'Pinggul (cm)',      type: 'num', step: '0.1' },
    { key: 'bp_systolic',    label: 'TD Sistolik',       type: 'int' },
    { key: 'bp_diastolic',   label: 'TD Diastolik',      type: 'int' },
    { key: 'heart_rate',     label: 'Nadi (bpm)',        type: 'int' },
    { key: 'fasting_glucose',label: 'GDP (mg/dL)',       type: 'num', step: '0.1' },
  ],

  CIRC_FIELDS: [
    { key: 'arm_right_cm',   label: 'Lengan Kanan (cm)' },
    { key: 'arm_left_cm',    label: 'Lengan Kiri (cm)'  },
    { key: 'chest_cm',       label: 'Dada (cm)'         },
    { key: 'waist_cm',       label: 'Pinggang (cm)'     },
    { key: 'abdomen_cm',     label: 'Perut (cm)'        },
    { key: 'hip_cm',         label: 'Pinggul (cm)'      },
    { key: 'thigh_right_cm', label: 'Paha Kanan (cm)'   },
    { key: 'thigh_left_cm',  label: 'Paha Kiri (cm)'    },
  ],

  // ──────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────
  async render(patientId, heightCm = null, containerId = 'page-monitoring') {
    this._patientId = patientId;
    this._heightCm  = heightCm;

    const container = document.getElementById(containerId) ??
                      document.getElementById('page-monitoring');
    container.innerHTML = `<div class="space-y-4 animate-pulse">${skeletonLine('w-full','h-64')}</div>`;

    await this._loadData();
    container.innerHTML = this._buildHTML();
    this._bindEvents();
  },

  async _loadData() {
    const localMon  = await DB.getAllByIndex('weekly_monitorings',  'patient_id', this._patientId);
    const localCirc = await DB.getAllByIndex('body_circumferences', 'patient_id', this._patientId);

    this._monitorings    = Array(9).fill(null).map((_, i) => localMon.find(m => m.week_number === i)  ?? null);
    this._circumferences = Array(9).fill(null).map((_, i) => localCirc.find(c => c.week_number === i) ?? null);

    if (navigator.onLine) {
      const res = await API.monitorings.list(this._patientId);
      if (res.success) {
        if (res.monitorings?.length) {
          await DB.putBatch('weekly_monitorings', res.monitorings);
          this._monitorings = Array(9).fill(null).map((_, i) =>
            res.monitorings.find(m => m.week_number === i) ?? null);
        }
        if (res.circumferences?.length) {
          await DB.putBatch('body_circumferences', res.circumferences);
          this._circumferences = Array(9).fill(null).map((_, i) =>
            res.circumferences.find(c => c.week_number === i) ?? null);
        }
      }
    }
  },

  // ──────────────────────────────────────────────────────────
  // BUILD HTML
  // ──────────────────────────────────────────────────────────
  _buildHTML() {
    return `
    <div class="space-y-6 max-w-full">

      <!-- ── Header ── -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 class="text-xl font-bold text-white">Weekly Monitoring</h2>
          <p class="text-sm text-slate-400 mt-0.5">
            Matrix Baseline → W8 &nbsp;·&nbsp;
            <span class="text-indigo-400 font-medium">📷 Scan InBody</span>
            untuk isi otomatis
          </p>
        </div>
        <div class="flex items-center gap-2">
          <!-- Scan InBody global (pilih minggu dulu) -->
          <div class="relative" id="scan-week-picker-wrap">
            <button onclick="UIMonitoring.toggleWeekPicker()"
              class="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              📷 Scan InBody
            </button>
            <!-- Dropdown pilih minggu -->
            <div id="scan-week-picker"
              class="hidden absolute right-0 mt-2 w-52 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-30 overflow-hidden">
              <p class="text-xs text-slate-400 px-4 py-2.5 border-b border-slate-700 font-medium">
                Pilih kunjungan:
              </p>
              <div class="py-1">
                ${this.WEEKS.map((w, i) => `
                  <button onclick="UIMonitoring.openOCR(${i})"
                    class="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700
                           flex items-center justify-between transition-colors">
                    <span>${w}</span>
                    ${this._monitorings[i]
                      ? `<span class="text-xs text-emerald-400">✓ ada data</span>`
                      : `<span class="text-xs text-slate-500">kosong</span>`}
                  </button>`).join('')}
              </div>
            </div>
          </div>

          <button onclick="UIMonitoring.saveAll()"
            class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Simpan Semua
          </button>
        </div>
      </div>

      <!-- ── Tip banner ── -->
      <div class="flex items-start gap-3 bg-violet-900/20 border border-violet-700/30 rounded-xl px-4 py-3">
        <span class="text-xl flex-shrink-0 mt-0.5">💡</span>
        <p class="text-xs text-violet-200 leading-relaxed">
          <strong>Cara cepat:</strong> Ambil foto / screenshot hasil InBody, lalu klik tombol
          <strong>📷 Scan InBody</strong> di header tabel — sistem akan otomatis mengisi
          Berat, BMI, Body Fat, Muscle Mass, dan Visceral Fat ke kolom yang dipilih.
        </p>
      </div>

      <!-- ── Matrix Table ── -->
      <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div class="p-4 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
            <h3 class="text-sm font-bold text-white">Komposisi Tubuh & Vital Sign</h3>
          </div>
          <p class="text-xs text-slate-500">Klik 📷 di header kolom untuk scan InBody per minggu</p>
        </div>

        <div class="matrix-table-wrapper overflow-x-auto">
          <table class="matrix-table w-full border-collapse">
            <thead>
              <tr>
                <th class="sticky left-0 z-10 px-4 py-3 text-left min-w-[160px] bg-slate-900">
                  Parameter
                </th>
                ${this.WEEKS.map((w, i) => `
                  <th class="px-2 py-2 text-center min-w-[120px]
                             ${i === 0 ? 'border-r border-indigo-800' : ''}">
                    <div class="flex flex-col items-center gap-1">
                      <!-- Tombol Scan InBody per kolom -->
                      <button onclick="UIMonitoring.openOCR(${i})"
                        title="Scan InBody untuk ${w}"
                        class="group flex items-center gap-1 px-2 py-1 rounded-lg
                               bg-violet-900/30 hover:bg-violet-600 border border-violet-700/40
                               text-violet-300 hover:text-white transition-all text-xs font-medium">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <span>${w}</span>
                      </button>
                      <!-- Tanggal kunjungan -->
                      ${this._monitorings[i]?.visit_date
                        ? `<span class="text-slate-500 font-normal text-[10px]">
                             ${formatDate(this._monitorings[i].visit_date)}
                           </span>`
                        : `<span class="text-slate-600 text-[10px]">—</span>`}
                      <!-- Badge ada data / kosong -->
                      <span id="week-status-${i}"
                        class="text-[9px] px-1.5 rounded-full
                               ${this._monitorings[i]
                                 ? 'bg-emerald-900/40 text-emerald-400'
                                 : 'bg-slate-700 text-slate-500'}">
                        ${this._monitorings[i] ? '✓ terisi' : 'kosong'}
                      </span>
                    </div>
                  </th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${this.MON_FIELDS.map(f => this._buildRow(f)).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Lingkar Tubuh Table ── -->
      <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div class="p-4 border-b border-slate-700 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <h3 class="text-sm font-bold text-white">Lingkar Tubuh (cm)</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="matrix-table w-full border-collapse">
            <thead>
              <tr>
                <th class="sticky left-0 z-10 px-4 py-3 text-left min-w-[160px] bg-slate-900">Bagian</th>
                ${this.WEEKS.map((w, i) => `
                  <th class="px-3 py-3 text-center min-w-[100px]
                             ${i === 0 ? 'border-r border-indigo-800' : ''}">
                    <span class="text-xs">${w}</span>
                  </th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${this.CIRC_FIELDS.map(f => this._buildCircRow(f)).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Notes per minggu ── -->
      ${this._buildNotesSection()}

      <!-- ── Save bottom ── -->
      <div class="flex justify-end pb-6">
        <button onclick="UIMonitoring.saveAll()"
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl text-sm font-semibold">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Simpan Semua Data Monitoring
        </button>
      </div>
    </div>`;
  },

  // ──────────────────────────────────────────────────────────
  // ROW BUILDERS
  // ──────────────────────────────────────────────────────────
  _buildRow(field) {
    const cells = this.WEEKS.map((_, wIdx) => {
      const rec = this._monitorings[wIdx];
      const val = rec?.[field.key] ?? '';
      const cls = wIdx === 0 ? 'border-r border-indigo-800/50' : '';

      // Field yang bisa diisi dari InBody OCR — highlight khusus
      const ocrFields = ['weight_kg','bmi','body_fat_pct','body_fat_kg','muscle_mass_kg','visceral_fat'];
      const isOcrField = ocrFields.includes(field.key);
      const ocrHint = isOcrField
        ? `title="Field ini bisa diisi otomatis via Scan InBody ✦"`
        : '';

      if (field.type === 'date') {
        return `<td class="px-2 py-1.5 text-center ${cls}">
          <input type="date"
            data-week="${wIdx}" data-field="${field.key}" data-store="mon"
            value="${val}"
            class="w-[120px] min-h-[36px] bg-transparent border border-slate-600 rounded-lg
                   px-2 text-xs text-white focus:border-indigo-500">
        </td>`;
      }
      return `<td class="px-2 py-1.5 text-center ${cls}">
        <input type="number"
          id="mon-${wIdx}-${field.key}"
          data-week="${wIdx}" data-field="${field.key}" data-store="mon"
          value="${val}" step="${field.step ?? '1'}"
          placeholder="—" ${ocrHint}
          class="w-[80px] min-h-[36px] bg-transparent border rounded-lg px-1
                 text-sm text-center text-white focus:border-indigo-500
                 ${isOcrField ? 'border-violet-700/40' : 'border-slate-600'}
                 transition-colors"
          ${field.auto ? 'data-auto="1"' : ''}>
      </td>`;
    }).join('');

    return `
    <tr class="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
      <td class="sticky left-0 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 whitespace-nowrap z-10">
        ${field.label}
        <!-- dot marker untuk field InBody -->
        ${['weight_kg','bmi','body_fat_pct','body_fat_kg','muscle_mass_kg','visceral_fat'].includes(field.key)
          ? '<span class="ml-1 text-violet-500" title="Bisa diisi via Scan InBody">✦</span>'
          : ''}
      </td>
      ${cells}
    </tr>`;
  },

  _buildCircRow(field) {
    const cells = this.WEEKS.map((_, wIdx) => {
      const rec = this._circumferences[wIdx];
      const val = rec?.[field.key] ?? '';
      const cls = wIdx === 0 ? 'border-r border-indigo-800/50' : '';
      return `<td class="px-2 py-1.5 text-center ${cls}">
        <input type="number"
          data-week="${wIdx}" data-field="${field.key}" data-store="circ"
          value="${val}" step="0.1" placeholder="—"
          class="w-[80px] min-h-[36px] bg-transparent border border-slate-600 rounded-lg
                 px-1 text-sm text-center text-white focus:border-indigo-500">
      </td>`;
    }).join('');

    return `
    <tr class="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
      <td class="sticky left-0 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 whitespace-nowrap z-10">
        ${field.label}
      </td>
      ${cells}
    </tr>`;
  },

  _buildNotesSection() {
    return `
    <div class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
      <h3 class="text-sm font-bold text-white mb-4">Catatan Per Kunjungan</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        ${this.WEEKS.map((w, i) => `
          <div>
            <label class="block text-xs text-slate-400 mb-1">${w}</label>
            <textarea data-week="${i}" data-field="notes" data-store="mon"
              rows="2" placeholder="Catatan ${w}..."
              class="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2
                     text-xs text-white placeholder-slate-500 resize-none focus:border-indigo-500"
            >${this._monitorings[i]?.notes ?? ''}</textarea>
          </div>`).join('')}
      </div>
    </div>`;
  },

  // ──────────────────────────────────────────────────────────
  // OCR INTEGRATION
  // ──────────────────────────────────────────────────────────

  // Buka modal OCR untuk minggu tertentu
  openOCR(weekIdx) {
    // Tutup week picker dropdown jika terbuka
    document.getElementById('scan-week-picker')?.classList.add('hidden');

    if (typeof UIOCR === 'undefined') {
      showToast('Modul OCR belum dimuat. Refresh halaman.', 'error');
      return;
    }
    UIOCR.open(this._patientId, weekIdx);
    showToast(`Scan InBody untuk ${this.WEEKS[weekIdx]}`, 'info', 2000);
  },

  // Toggle dropdown pilih minggu
  toggleWeekPicker() {
    const picker = document.getElementById('scan-week-picker');
    if (!picker) return;
    picker.classList.toggle('hidden');
    // Tutup saat klik di luar
    if (!picker.classList.contains('hidden')) {
      setTimeout(() => {
        const close = (e) => {
          if (!document.getElementById('scan-week-picker-wrap')?.contains(e.target)) {
            picker.classList.add('hidden');
            document.removeEventListener('click', close);
          }
        };
        document.addEventListener('click', close);
      }, 50);
    }
  },

  // Dipanggil dari UIOCR.applyToForm() setelah OCR selesai
  // weekIdx: nomor minggu yang diisi, data: object field→value
  onOCRApplied(weekIdx, data) {
    // Update badge status kolom
    const badge = document.getElementById(`week-status-${weekIdx}`);
    if (badge) {
      badge.textContent = '✦ OCR';
      badge.className = badge.className.replace(
        /bg-\w+-\d+\/\d+\s+text-\w+-\d+/g, ''
      ) + ' bg-violet-900/40 text-violet-400';
    }

    // Flash setiap input yang baru diisi
    const ocrFields = ['weight_kg','bmi','body_fat_pct','body_fat_kg','muscle_mass_kg','visceral_fat'];
    ocrFields.forEach(f => {
      const el = document.getElementById(`mon-${weekIdx}-${f}`);
      if (el && el.value) {
        el.classList.add('border-violet-500', 'bg-violet-500/10');
        setTimeout(() => el.classList.remove('border-violet-500', 'bg-violet-500/10'), 3000);
      }
    });

    // Trigger BMI auto-calc jika weight berisi
    this._autoBMI(weekIdx);
  },

  // ──────────────────────────────────────────────────────────
  // EVENT BINDING
  // ──────────────────────────────────────────────────────────
  _bindEvents() {
    const page = document.getElementById('page-monitoring');
    if (!page) return;

    // BMI auto-calc saat weight diinput manual
    page.addEventListener('input', (e) => {
      const el   = e.target;
      const week = parseInt(el.dataset.week);
      const field = el.dataset.field;
      if (!isNaN(week) && field === 'weight_kg') this._autoBMI(week);
    });

    // Tutup week-picker saat scroll tabel
    page.querySelector('.matrix-table-wrapper')?.addEventListener('scroll', () => {
      document.getElementById('scan-week-picker')?.classList.add('hidden');
    });
  },

  _autoBMI(weekIdx) {
    const weightEl = document.querySelector(`#page-monitoring [data-week="${weekIdx}"][data-field="weight_kg"]`);
    const bmiEl    = document.querySelector(`#page-monitoring [data-week="${weekIdx}"][data-field="bmi"]`);
    if (!weightEl || !bmiEl || !this._heightCm) return;
    const w = parseFloat(weightEl.value);
    if (w > 0) bmiEl.value = calcBMI(w, this._heightCm);
  },

  // ──────────────────────────────────────────────────────────
  // COLLECT + SAVE
  // ──────────────────────────────────────────────────────────
  _collectWeek(weekIdx) {
    const mon  = { week_number: weekIdx, patient_id: this._patientId };
    const circ = { week_number: weekIdx, patient_id: this._patientId };

    document.querySelectorAll(`#page-monitoring [data-week="${weekIdx}"]`).forEach(el => {
      const field = el.dataset.field;
      const store = el.dataset.store;
      const val   = el.value.trim();
      if (!field || val === '') return;

      const numFields = [
        'weight_kg','bmi','body_fat_pct','body_fat_kg','visceral_fat',
        'muscle_mass_kg','body_age','waist_cm','abdomen_cm','hip_cm',
        'bp_systolic','bp_diastolic','heart_rate','fasting_glucose',
        'arm_right_cm','arm_left_cm','chest_cm','thigh_right_cm','thigh_left_cm'
      ];
      const parsed = numFields.includes(field) ? (parseFloat(val) || null) : (val || null);

      if (store === 'mon')  mon[field]  = parsed;
      if (store === 'circ') circ[field] = parsed;
    });

    return { mon, circ };
  },

  async saveAll() {
    let savedCount = 0;

    for (let w = 0; w < 9; w++) {
      const { mon, circ } = this._collectWeek(w);

      const hasMonData  = Object.keys(mon).some(
        k => !['week_number','patient_id'].includes(k) && mon[k] != null
      );
      const hasCircData = Object.keys(circ).some(
        k => !['week_number','patient_id'].includes(k) && circ[k] != null
      );

      if (!hasMonData && !hasCircData) continue;

      if (!mon.visit_date)  mon.visit_date  = today();
      if (!circ.visit_date) circ.visit_date = today();

      mon.uuid  = this._monitorings[w]?.uuid    ?? generateUUID();
      circ.uuid = this._circumferences[w]?.uuid ?? generateUUID();

      const isNewMon  = !this._monitorings[w];
      const isNewCirc = !this._circumferences[w];

      if (hasMonData) {
        await Sync.saveLocal('weekly_monitorings', mon, isNewMon ? 'insert' : 'update');
        this._monitorings[w] = mon;
        // Update badge
        const badge = document.getElementById(`week-status-${w}`);
        if (badge) {
          badge.textContent = '✓ terisi';
          badge.className   = badge.className
            .replace('bg-slate-700 text-slate-500', '')
            .replace('bg-violet-900/40 text-violet-400', '') + ' bg-emerald-900/40 text-emerald-400';
        }
      }
      if (hasCircData) {
        await Sync.saveLocal('body_circumferences', circ, isNewCirc ? 'insert' : 'update');
        this._circumferences[w] = circ;
      }

      if (navigator.onLine && (hasMonData || hasCircData)) {
        await API.monitorings.save({
          patient_id:    this._patientId,
          week_number:   w,
          height_cm:     this._heightCm,
          monitoring:    hasMonData  ? mon  : undefined,
          circumference: hasCircData ? circ : undefined,
        });
      }
      savedCount++;
    }

    if (savedCount > 0) {
      showToast(`${savedCount} minggu data tersimpan`, 'success');
      if (typeof UIDashboard !== 'undefined') {
        await UIDashboard.render(this._patientId);
      }
    } else {
      showToast('Tidak ada data baru untuk disimpan', 'info');
    }
  },
};
