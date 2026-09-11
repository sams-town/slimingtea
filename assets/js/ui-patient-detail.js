// ============================================================
// ui-patient-detail.js — Hub Halaman Detail Pasien
//
// Layout:
//   ┌─ Header profil pasien (nama, badge, stats, quick-edit) ─┐
//   ├─ Tab bar: [Assessment] [Monitoring] [Foto & Catatan]    ─┤
//   └─ Tab content (render masing-masing modul di sini)       ┘
//
// Alur:
//   1. Pasien baru (quick) → tab Assessment aktif, banner arahan
//   2. Pasien lama (full)  → tab Monitoring aktif, tampil progress
// ============================================================

const UIPatientDetail = {
  _patient:    null,
  _assessment: null,
  _monitorings:[],        // index 0–8
  _activeTab:  'assessment',

  // ──────────────────────────────────────────────────────────
  // RENDER UTAMA
  // ──────────────────────────────────────────────────────────
  async render(patientUuid, defaultTab = null) {
    const container = document.getElementById('page-patient-detail');
    container.innerHTML = this._skeleton();

    // 1. Load data
    await this._loadData(patientUuid);

    if (!this._patient) {
      container.innerHTML = `
        <div class="text-center py-20 text-slate-500">
          <p class="text-lg">Pasien tidak ditemukan</p>
          <button onclick="App.goToPage('patients')"
            class="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm">
            ← Kembali ke Daftar
          </button>
        </div>`;
      return;
    }

    // 2. Tentukan tab default
    const isQuick = !this._patient.registration_status ||
                    this._patient.registration_status === 'quick';
    this._activeTab = defaultTab ?? (isQuick ? 'assessment' : 'monitoring');

    // 3. Render shell
    container.innerHTML = this._buildShell();

    // 4. Render tab content aktif
    await this._renderTab(this._activeTab);
  },

  // ──────────────────────────────────────────────────────────
  // LOAD DATA
  // ──────────────────────────────────────────────────────────
  async _loadData(uuid) {
    // Lokal dulu (offline-first)
    const allP = await DB.getAll('patients');
    this._patient = allP.find(p => p.uuid === uuid) ?? null;

    if (!this._patient) return;

    const pid = this._patient.id ?? this._patient._serverId;

    // Assessment
    if (pid) {
      const aArr = await DB.getAllByIndex('initial_assessments', 'patient_id', pid);
      this._assessment = aArr[0] ?? null;
    }

    // Monitorings
    if (pid) {
      const monArr = await DB.getAllByIndex('weekly_monitorings', 'patient_id', pid);
      this._monitorings = Array(9).fill(null)
        .map((_, i) => monArr.find(m => m.week_number === i) ?? null);
    }

    // Online sync di background
    if (navigator.onLine && pid) {
      const [pRes, aRes, mRes] = await Promise.all([
        API.patients.get(pid),
        API.assessments.get(pid),
        API.monitorings.list(pid),
      ]);

      if (pRes.success && pRes.data) {
        this._patient = { ...pRes.data, uuid };
        await DB.put('patients', this._patient);
      }
      if (aRes.success && aRes.data) {
        this._assessment = aRes.data;
        if (aRes.data.uuid) await DB.put('initial_assessments', aRes.data);
      }
      if (mRes.success && mRes.monitorings?.length) {
        await DB.putBatch('weekly_monitorings', mRes.monitorings);
        this._monitorings = Array(9).fill(null)
          .map((_, i) => mRes.monitorings.find(m => m.week_number === i) ?? null);
      }
    }
  },

  // ──────────────────────────────────────────────────────────
  // BUILD SHELL (header + tab bar + content area)
  // ──────────────────────────────────────────────────────────
  _buildShell() {
    const p       = this._patient;
    const isQuick = !p.registration_status || p.registration_status === 'quick';
    const age     = p.age ?? calcAge(p.dob);
    const pid     = p.id ?? p._serverId;

    // Auto-calc changes
    const changes = this._calcChanges();

    return `
    <div class="max-w-5xl mx-auto space-y-4" id="patient-detail-root">

      <!-- ── BACK BUTTON ── -->
      <button onclick="App.goToPage('patients')"
        class="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
        Kembali ke Daftar
      </button>

      <!-- ── PROFIL HEADER ── -->
      <div class="bg-gradient-to-br from-slate-800 to-slate-800/60
                  border border-slate-700 rounded-2xl p-5">
        <div class="flex items-start gap-4 flex-wrap">

          <!-- Avatar -->
          <div class="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center
                      text-2xl font-bold text-white
                      ${p.sex === 'female' ? 'bg-pink-600' : 'bg-indigo-600'}">
            ${getInitials(p.name)}
          </div>

          <!-- Info utama -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-xl font-bold text-white">${p.name}</h2>
              ${isQuick
                ? `<span class="text-xs bg-amber-900/40 text-amber-300 border border-amber-700/40
                               px-2 py-0.5 rounded-full">Baru Daftar</span>`
                : `<span class="text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-700/40
                               px-2 py-0.5 rounded-full">Pasien Aktif</span>`}
            </div>
            <div class="flex flex-wrap gap-3 mt-1 text-sm text-slate-400">
              ${p.sex   ? `<span>${p.sex === 'female' ? '♀ Perempuan' : '♂ Laki-laki'}</span>` : ''}
              ${age     ? `<span>🎂 ${age} thn</span>` : ''}
              ${p.phone ? `<span>📞 ${p.phone}</span>` : ''}
              ${p.address ? `<span class="truncate max-w-xs">📍 ${p.address}</span>` : ''}
            </div>

            <!-- Kondisi medis -->
            <div class="flex flex-wrap gap-1.5 mt-2">
              ${[
                [p.diabetes,     'Diabetes',     'red'],
                [p.hypertension, 'Hipertensi',   'orange'],
                [p.dyslipidemia, 'Dyslipidemia', 'yellow'],
                [p.hyperuricemia,'Hiperurisemia','purple'],
              ].filter(([v]) => v).map(([,l,c]) =>
                `<span class="text-xs bg-${c}-900/40 text-${c}-300
                             border border-${c}-800/40 px-2 py-0.5 rounded-full">${l}</span>`
              ).join('')}
            </div>
          </div>

          <!-- Quick actions -->
          <div class="flex gap-2 flex-shrink-0">
            <button onclick="UIPatients.openFullEdit('${p.uuid}')"
              class="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600
                     text-white rounded-xl text-xs font-medium transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                     m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit Profil
            </button>
          </div>
        </div>

        <!-- Treatment strip (jika sudah ada assessment) -->
        ${this._assessment?.medication && this._assessment.medication !== 'none' ? `
          <div class="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>💊 <strong class="text-white">${this._assessment.medication}</strong>
              ${this._assessment.medication_other ? `(${this._assessment.medication_other})` : ''}
            </span>
            ${this._assessment.starting_dose
              ? `<span>Dosis: <strong class="text-white">${this._assessment.starting_dose}</strong></span>` : ''}
            ${this._assessment.date_started
              ? `<span>Mulai: <strong class="text-white">${formatDate(this._assessment.date_started)}</strong></span>` : ''}
          </div>` : ''}
      </div>

      <!-- ── AUTO-CALC CHANGES (jika ada data monitoring) ── -->
      ${changes ? this._buildChangeCards(changes) : ''}

      <!-- ── PROGRESS BAR TARGET ── -->
      ${this._buildProgressBar()}

      <!-- ── TAB BAR ── -->
      <div class="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">

        <div class="flex border-b border-slate-700 overflow-x-auto" role="tablist">
          ${[
            ['assessment', '📋', 'Initial Assessment',
             this._assessment ? '✓' : (isQuick ? '!' : '')],
            ['monitoring',  '📊', 'Weekly Monitoring',
             this._monitorings.filter(Boolean).length
               ? `${this._monitorings.filter(Boolean).length}/9` : ''],
            ['photos',      '📸', 'Foto & Catatan', ''],
          ].map(([id, icon, label, badge]) => `
            <button id="tab-btn-${id}" role="tab"
              onclick="UIPatientDetail.switchTab('${id}')"
              class="tab-detail-btn flex-shrink-0 flex items-center gap-2
                     px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap
                     ${this._activeTab === id
                       ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-700/30'
                       : 'text-slate-400 hover:text-white hover:bg-slate-700/20'}">
              <span>${icon}</span>
              <span>${label}</span>
              ${badge ? `<span class="text-xs px-1.5 py-0.5 rounded-full
                ${id === 'assessment' && badge === '!'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-600 text-slate-300'}">${badge}</span>` : ''}
            </button>`).join('')}
        </div>

        <!-- Tab content area -->
        <div id="tab-content-area" class="min-h-[400px]">
          <!-- Injected by _renderTab() -->
        </div>
      </div>

    </div>`;
  },

  // ──────────────────────────────────────────────────────────
  // TAB SWITCHING
  // ──────────────────────────────────────────────────────────
  async switchTab(tabId) {
    this._activeTab = tabId;

    // Update tab button styles
    document.querySelectorAll('.tab-detail-btn').forEach(btn => {
      const active = btn.id === `tab-btn-${tabId}`;
      btn.className = btn.className
        .replace(/text-indigo-400 border-b-2 border-indigo-500 bg-slate-700\/30/g, '')
        .replace(/text-slate-400 hover:text-white hover:bg-slate-700\/20/g, '')
        .trim();
      if (active) {
        btn.classList.add('text-indigo-400', 'border-b-2', 'border-indigo-500', 'bg-slate-700/30');
      } else {
        btn.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-slate-700/20');
      }
    });

    await this._renderTab(tabId);
  },

  async _renderTab(tabId) {
    const area = document.getElementById('tab-content-area');
    if (!area) return;

    const pid = this._patient?.id ?? this._patient?._serverId;

    switch (tabId) {
      case 'assessment': {
        // Render banner arahan jika pasien baru & belum ada assessment
        const isQuick = !this._patient.registration_status ||
                        this._patient.registration_status === 'quick';
        area.innerHTML = `
          <div class="p-4 md:p-5">
            ${isQuick && !this._assessment ? this._buildAssessmentBanner() : ''}
            <div id="assessment-form-area"></div>
          </div>`;
        await UIAssessment.render(pid, 'assessment-form-area');
        break;
      }

      case 'monitoring': {
        area.innerHTML = `<div id="monitoring-area" class="p-1"></div>`;
        const heightCm = this._assessment?.initial_height ?? null;
        await UIMonitoring.render(pid, heightCm, 'monitoring-area');
        break;
      }

      case 'photos': {
        area.innerHTML = `<div id="photos-area" class="p-1"></div>`;
        await UIPhotos.render(pid, 'photos-area');
        break;
      }
    }
  },

  // ──────────────────────────────────────────────────────────
  // BANNER ARAHAN UNTUK PASIEN BARU
  // ──────────────────────────────────────────────────────────
  _buildAssessmentBanner() {
    return `
    <div class="flex items-start gap-4 bg-indigo-900/20 border border-indigo-700/40
                rounded-2xl p-5 mb-5">
      <div class="w-10 h-10 bg-indigo-600/30 rounded-xl flex items-center justify-center
                  flex-shrink-0">
        <svg class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div class="flex-1">
        <p class="text-sm font-semibold text-indigo-200 mb-1">
          Kunjungan pertama — lengkapi Initial Assessment
        </p>
        <p class="text-xs text-slate-400 leading-relaxed">
          Isi data baseline (lab, berat awal, target, obat) di bawah ini.
          Setelah disimpan, lanjutkan ke tab
          <strong class="text-white">Weekly Monitoring</strong> untuk input data InBody.
        </p>
      </div>
    </div>`;
  },

  // ──────────────────────────────────────────────────────────
  // AUTO-CALCULATION CHANGE CARDS
  // ──────────────────────────────────────────────────────────
  _calcChanges() {
    const baseline = this._monitorings[0];
    if (!baseline) return null;
    let current = null;
    for (let i = 8; i >= 1; i--) {
      if (this._monitorings[i]) { current = this._monitorings[i]; break; }
    }
    if (!current) return null;

    const diff = (a, b) => (a != null && b != null)
      ? parseFloat(b) - parseFloat(a) : null;

    return {
      weekLabel:     `W${current.week_number}`,
      visitDate:     current.visit_date,
      weight:        { base: baseline.weight_kg,      curr: current.weight_kg,      diff: diff(baseline.weight_kg,      current.weight_kg)      },
      bmi:           { base: baseline.bmi,            curr: current.bmi,            diff: diff(baseline.bmi,            current.bmi)            },
      bodyFatPct:    { base: baseline.body_fat_pct,   curr: current.body_fat_pct,   diff: diff(baseline.body_fat_pct,   current.body_fat_pct)   },
      bodyFatKg:     { base: baseline.body_fat_kg,    curr: current.body_fat_kg,    diff: diff(baseline.body_fat_kg,    current.body_fat_kg)    },
      waist:         { base: baseline.waist_cm,       curr: current.waist_cm,       diff: diff(baseline.waist_cm,       current.waist_cm)       },
      visceral:      { base: baseline.visceral_fat,   curr: current.visceral_fat,   diff: diff(baseline.visceral_fat,   current.visceral_fat)   },
      muscle:        { base: baseline.muscle_mass_kg, curr: current.muscle_mass_kg, diff: diff(baseline.muscle_mass_kg, current.muscle_mass_kg) },
    };
  },

  _buildChangeCards(ch) {
    const cards = [
      { label:'Berat',        icon:'⚖️', val:ch.weight,     unit:' kg', lower:true  },
      { label:'BMI',          icon:'📐', val:ch.bmi,        unit:'',    lower:true  },
      { label:'Body Fat %',   icon:'🔥', val:ch.bodyFatPct, unit:'%',   lower:true  },
      { label:'Body Fat kg',  icon:'🔥', val:ch.bodyFatKg,  unit:' kg', lower:true  },
      { label:'Pinggang',     icon:'📏', val:ch.waist,      unit:' cm', lower:true  },
      { label:'Visceral Fat', icon:'🫀', val:ch.visceral,   unit:'',    lower:true  },
      { label:'Muscle Mass',  icon:'💪', val:ch.muscle,     unit:' kg', lower:false },
    ];

    return `
    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-3">
        <h3 class="text-sm font-bold text-white">Perubahan</h3>
        <span class="text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-700/40
                     px-2 py-0.5 rounded-full">
          Baseline → ${ch.weekLabel}
          ${ch.visitDate ? ' · ' + formatDate(ch.visitDate) : ''}
        </span>
      </div>
      <div class="grid grid-cols-3 md:grid-cols-7 gap-2">
        ${cards.map(c => {
          const d = c.val.diff;
          const sign   = d > 0 ? '+' : '';
          const isGood = d == null ? null : (c.lower ? d < 0 : d > 0);
          const cls    = d == null ? 'text-slate-500'
                       : d === 0  ? 'text-slate-400'
                       : isGood   ? 'text-emerald-400' : 'text-red-400';
          const arrow  = d == null ? '—' : d > 0 ? '▲' : d < 0 ? '▼' : '→';
          return `
          <div class="bg-slate-700/40 rounded-xl p-3 text-center">
            <div class="text-lg mb-1">${c.icon}</div>
            <div class="text-xs text-slate-400 mb-1">${c.label}</div>
            <div class="text-xs font-mono text-slate-300">
              ${fmt(c.val.base, 1)}${c.unit}
            </div>
            <div class="text-sm font-bold text-white">
              ${fmt(c.val.curr, 1)}${c.unit}
            </div>
            <div class="text-xs font-semibold mt-1 ${cls}">
              ${arrow} ${d != null ? sign + fmt(d,1) + c.unit : '—'}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // ── Progress bar target berat ─────────────────────────────
  _buildProgressBar() {
    const a = this._assessment;
    if (!a?.initial_weight || !a?.target_weight) return '';

    const totalToLose = parseFloat(a.initial_weight) - parseFloat(a.target_weight);
    if (totalToLose <= 0) return '';

    const latestW = this._monitorings
      .filter(Boolean).slice(-1)[0]?.weight_kg ?? a.initial_weight;
    const lost    = parseFloat(a.initial_weight) - parseFloat(latestW);
    const pct     = Math.min(100, Math.max(0, (lost / totalToLose) * 100));
    const remain  = Math.max(0, parseFloat(latestW) - parseFloat(a.target_weight)).toFixed(1);

    const barColor = pct >= 100 ? 'bg-emerald-500'
                   : pct >= 50  ? 'bg-indigo-500' : 'bg-amber-500';

    return `
    <div class="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-white">Progress Penurunan Berat</span>
        <span class="text-sm font-bold ${pct >= 100 ? 'text-emerald-400' : 'text-indigo-400'}">
          ${pct.toFixed(0)}%
        </span>
      </div>
      <div class="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
        <div class="h-3 rounded-full transition-all duration-700 ${barColor}"
          style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between mt-1.5 text-xs text-slate-400">
        <span>Awal: <strong class="text-slate-200">${fmt(a.initial_weight,1)} kg</strong></span>
        <span>Sisa: <strong class="text-slate-200">${remain} kg</strong></span>
        <span>Target: <strong class="text-slate-200">${fmt(a.target_weight,1)} kg</strong></span>
      </div>
    </div>`;
  },

  // ── Skeleton loader ──────────────────────────────────────
  _skeleton() {
    return `
    <div class="max-w-5xl mx-auto space-y-4 animate-pulse">
      <div class="h-4 w-32 bg-slate-700 rounded"></div>
      <div class="h-36 bg-slate-800 rounded-2xl"></div>
      <div class="h-24 bg-slate-800 rounded-2xl"></div>
      <div class="h-96 bg-slate-800 rounded-2xl"></div>
    </div>`;
  },
};
