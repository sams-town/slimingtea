// ============================================================
// ui-dashboard.js — Dashboard profil pasien + Auto-Calculation
// ============================================================

const UIDashboard = {
  _patientId: null,
  _patient: null,
  _assessment: null,
  _monitorings: [],   // index 0-8

  // ---- Render ----
  async render(patientId) {
    this._patientId = patientId;
    const container = document.getElementById('page-patient-detail');
    container.innerHTML = this._skeleton();

    await this._loadData();
    container.innerHTML = this._buildHTML();
    this._bindTabEvents();
  },

  async _loadData() {
    // Patient
    this._patient = await DB.get('patients', /* by id — tapi IDB key = uuid */
      null); // kita cari by id di bawah
    const allP = await DB.getAllByIndex ? null : null;
    const allPatients = await DB.getAll('patients');
    this._patient = allPatients.find(p => p.id == this._patientId || p._serverId == this._patientId) ?? null;

    // Assessment
    const assessAll = await DB.getAllByIndex('initial_assessments', 'patient_id', this._patientId);
    this._assessment = assessAll[0] ?? null;

    // Monitorings
    const monAll = await DB.getAllByIndex('weekly_monitorings', 'patient_id', this._patientId);
    this._monitorings = Array(9).fill(null).map((_, i) => monAll.find(m => m.week_number === i) ?? null);

    // Online fetch jika ada
    if (navigator.onLine) {
      const [pRes, aRes, mRes] = await Promise.all([
        API.patients.get(this._patientId),
        API.assessments.get(this._patientId),
        API.monitorings.list(this._patientId),
      ]);
      if (pRes.success && pRes.data) {
        this._patient = pRes.data;
        await DB.put('patients', { ...pRes.data, uuid: pRes.data.uuid });
      }
      if (aRes.success && aRes.data) {
        this._assessment = aRes.data;
        await DB.put('initial_assessments', { ...aRes.data, uuid: aRes.data.uuid });
      }
      if (mRes.success && mRes.monitorings?.length) {
        await DB.putBatch('weekly_monitorings', mRes.monitorings);
        this._monitorings = Array(9).fill(null).map((_, i) =>
          mRes.monitorings.find(m => m.week_number === i) ?? null
        );
      }
    }
  },

  // ---- Hitung perubahan baseline → current ----
  _calcChanges() {
    const baseline = this._monitorings[0];
    // Ambil minggu terakhir yang ada datanya
    let current = null;
    for (let i = 8; i >= 1; i--) {
      if (this._monitorings[i]) { current = this._monitorings[i]; break; }
    }
    if (!baseline || !current) return null;

    return {
      currentWeek:     current.week_number,
      weightChange:    this._diff(baseline.weight_kg,      current.weight_kg),
      bmiChange:       this._diff(baseline.bmi,            current.bmi),
      bodyFatChange:   this._diff(baseline.body_fat_pct,   current.body_fat_pct),
      bodyFatKgChange: this._diff(baseline.body_fat_kg,    current.body_fat_kg),
      waistChange:     this._diff(baseline.waist_cm,       current.waist_cm),
      visceralChange:  this._diff(baseline.visceral_fat,   current.visceral_fat),
      muscleChange:    this._diff(baseline.muscle_mass_kg, current.muscle_mass_kg),
      baseline, current,
    };
  },

  _diff(base, curr) {
    if (base == null || curr == null) return null;
    return parseFloat(curr) - parseFloat(base);
  },

  // ---- Skeleton ----
  _skeleton() {
    return `<div class="space-y-4 animate-pulse p-2">
      <div class="h-32 bg-slate-800 rounded-2xl"></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${Array(4).fill('<div class="h-24 bg-slate-800 rounded-2xl"></div>').join('')}
      </div>
      <div class="h-48 bg-slate-800 rounded-2xl"></div>
    </div>`;
  },

  // ---- Build full HTML ----
  _buildHTML() {
    const p  = this._patient ?? {};
    const a  = this._assessment ?? {};
    const ch = this._calcChanges();
    const bsl = this._monitorings[0];

    // Target progress %
    const weightProgress = this._progressPct(
      a.initial_weight, a.target_weight,
      bsl?.weight_kg ?? a.initial_weight,
      this._monitorings.filter(Boolean).slice(-1)[0]?.weight_kg
    );

    return `
    <div class="space-y-5 max-w-5xl mx-auto">

      <!-- ===== PATIENT PROFILE CARD ===== -->
      <div class="bg-gradient-to-r from-indigo-900/60 to-slate-800 rounded-2xl border border-indigo-700/40 p-5">
        <div class="flex items-start gap-4 flex-wrap">
          <!-- Avatar -->
          <div class="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
            ${getInitials(p.name)}
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <h2 class="text-xl font-bold text-white truncate">${p.name ?? '—'}</h2>
              <span class="text-xs px-2 py-0.5 rounded-full ${p.sex === 'female' ? 'bg-pink-600/30 text-pink-300' : 'bg-blue-600/30 text-blue-300'}">
                ${p.sex === 'female' ? '♀ Perempuan' : '♂ Laki-laki'}
              </span>
            </div>
            <div class="flex flex-wrap gap-3 text-sm text-slate-300 mt-1">
              ${p.dob || p.age ? `<span>📅 ${p.age ?? calcAge(p.dob) ?? '?'} tahun${p.dob ? ` (${formatDate(p.dob)})` : ''}</span>` : ''}
              ${p.phone ? `<span>📞 ${p.phone}</span>` : ''}
              ${p.registration_date ? `<span>🏥 ${formatDate(p.registration_date)}</span>` : ''}
            </div>
            <!-- Kondisi medis -->
            <div class="flex flex-wrap gap-1.5 mt-2">
              ${p.diabetes     ? '<span class="text-xs bg-red-900/40 text-red-300 border border-red-800/40 px-2 py-0.5 rounded-full">Diabetes</span>' : ''}
              ${p.hypertension ? '<span class="text-xs bg-orange-900/40 text-orange-300 border border-orange-800/40 px-2 py-0.5 rounded-full">Hipertensi</span>' : ''}
              ${p.dyslipidemia ? '<span class="text-xs bg-yellow-900/40 text-yellow-300 border border-yellow-800/40 px-2 py-0.5 rounded-full">Dyslipidemia</span>' : ''}
              ${p.hyperuricemia? '<span class="text-xs bg-purple-900/40 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded-full">Hiperurisemia</span>' : ''}
            </div>
          </div>

          <!-- Quick actions -->
          <div class="flex gap-2 flex-shrink-0">
            <button onclick="App.goToPage('assessment')"
              class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-medium transition-colors">
              Assessment
            </button>
            <button onclick="App.goToPage('monitoring')"
              class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-medium transition-colors">
              Monitoring
            </button>
            <button onclick="App.goToPage('photos')"
              class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-medium transition-colors">
              Foto
            </button>
          </div>
        </div>

        <!-- Treatment info strip -->
        ${a.medication && a.medication !== 'none' ? `
        <div class="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap gap-4 text-xs text-slate-300">
          <span>💊 <strong class="text-white">${a.medication}</strong>${a.medication_other ? ` (${a.medication_other})` : ''}</span>
          ${a.starting_dose ? `<span>Dosis: <strong class="text-white">${a.starting_dose}</strong></span>` : ''}
          ${a.date_started  ? `<span>Mulai: <strong class="text-white">${formatDate(a.date_started)}</strong></span>` : ''}
        </div>` : ''}
      </div>

      <!-- ===== AUTO-CALCULATION CHANGES ===== -->
      ${ch ? this._buildChangeCards(ch, a) : this._buildNoDataBanner()}

      <!-- ===== TARGET PROGRESS ===== -->
      ${a.initial_weight && a.target_weight ? this._buildProgressBar(a, weightProgress) : ''}

      <!-- ===== LATEST VITALS ===== -->
      ${bsl || ch?.current ? this._buildVitalsRow(bsl, ch?.current) : ''}

      <!-- ===== TABS: Assessment / Monitoring / Photos ===== -->
      <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">

        <!-- Tab header -->
        <div class="flex border-b border-slate-700 overflow-x-auto" role="tablist">
          ${[
            ['tab-assessment', 'Initial Assessment', '📋'],
            ['tab-monitoring', 'Weekly Monitoring',  '📊'],
            ['tab-photos',     'Foto & Catatan',     '📸'],
          ].map(([id, label, icon], i) => `
            <button id="${id}-btn" role="tab"
              onclick="UIDashboard.switchTab('${id}')"
              class="tab-btn flex-shrink-0 flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium text-slate-400 hover:text-white transition-colors whitespace-nowrap ${i === 0 ? 'active' : ''}">
              <span>${icon}</span>${label}
            </button>`).join('')}
        </div>

        <!-- Tab panels (rendered in separate pages, tab just navigates) -->
        <div class="p-5">
          <div id="tab-assessment-content">
            ${this._buildAssessmentSummary(a)}
          </div>
          <div id="tab-monitoring-content" class="hidden">
            ${this._buildMonitoringMiniTable()}
          </div>
          <div id="tab-photos-content" class="hidden">
            ${this._buildPhotosSummary()}
          </div>
        </div>
      </div>

    </div>`;
  },

  // ---- Change cards ----
  _buildChangeCards(ch, a) {
    const cards = [
      {
        label: 'Berat Badan',
        baseline: `${fmt(ch.baseline.weight_kg, 1)} kg`,
        current:  `${fmt(ch.current.weight_kg,  1)} kg`,
        diff:     ch.weightChange,
        unit:     ' kg',
        icon:     '⚖️',
        lowerBetter: true,
        target: a.target_weight ? `Target: ${fmt(a.target_weight,1)} kg` : null,
      },
      {
        label: 'Body Fat',
        baseline: `${fmt(ch.baseline.body_fat_pct, 1)}%`,
        current:  `${fmt(ch.current.body_fat_pct,  1)}%`,
        diff:     ch.bodyFatChange,
        unit:     '%',
        icon:     '🔥',
        lowerBetter: true,
      },
      {
        label: 'Pinggang',
        baseline: `${fmt(ch.baseline.waist_cm, 1)} cm`,
        current:  `${fmt(ch.current.waist_cm,  1)} cm`,
        diff:     ch.waistChange,
        unit:     ' cm',
        icon:     '📏',
        lowerBetter: true,
        target: a.target_waist ? `Target: ${fmt(a.target_waist,1)} cm` : null,
      },
      {
        label: 'Visceral Fat',
        baseline: `${fmt(ch.baseline.visceral_fat, 1)}`,
        current:  `${fmt(ch.current.visceral_fat,  1)}`,
        diff:     ch.visceralChange,
        unit:     '',
        icon:     '🫀',
        lowerBetter: true,
      },
      {
        label: 'Muscle Mass',
        baseline: `${fmt(ch.baseline.muscle_mass_kg, 1)} kg`,
        current:  `${fmt(ch.current.muscle_mass_kg,  1)} kg`,
        diff:     ch.muscleChange,
        unit:     ' kg',
        icon:     '💪',
        lowerBetter: false,
      },
      {
        label: 'BMI',
        baseline: `${fmt(ch.baseline.bmi, 1)}`,
        current:  `${fmt(ch.current.bmi,  1)}`,
        diff:     ch.bmiChange,
        unit:     '',
        icon:     '📐',
        lowerBetter: true,
      },
    ];

    return `
    <div>
      <div class="flex items-center gap-2 mb-3">
        <h3 class="text-sm font-bold text-white">Auto-Calculation Change</h3>
        <span class="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
          Baseline → W${ch.currentWeek}
        </span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        ${cards.map(c => this._changeCard(c)).join('')}
      </div>
    </div>`;
  },

  _changeCard(c) {
    const diff = c.diff;
    const sign = diff > 0 ? '+' : '';
    const isGood = diff === null ? null : (c.lowerBetter ? diff < 0 : diff > 0);
    const color  = diff === null ? 'slate' : (diff === 0 ? 'slate' : (isGood ? 'emerald' : 'red'));
    const arrow  = diff === null ? '→' : (diff > 0 ? '▲' : (diff < 0 ? '▼' : '→'));
    const diffText = diff === null ? '—' : `${sign}${fmt(diff, 1)}${c.unit}`;

    return `
    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <span class="text-lg">${c.icon}</span>
        <span class="text-xs font-bold ${color === 'emerald' ? 'text-emerald-400' : color === 'red' ? 'text-red-400' : 'text-slate-400'}">
          ${arrow} ${diffText}
        </span>
      </div>
      <p class="text-xs font-semibold text-white">${c.label}</p>
      <div class="text-xs text-slate-400 space-y-0.5">
        <div class="flex justify-between">
          <span>Awal</span><span class="text-slate-300 font-mono">${c.baseline}</span>
        </div>
        <div class="flex justify-between">
          <span>Saat ini</span><span class="text-slate-200 font-mono font-semibold">${c.current}</span>
        </div>
      </div>
      ${c.target ? `<p class="text-xs text-indigo-400 mt-1">${c.target}</p>` : ''}
    </div>`;
  },

  _buildNoDataBanner() {
    return `
    <div class="bg-slate-800/60 border border-dashed border-slate-600 rounded-2xl p-6 text-center">
      <p class="text-slate-400 text-sm">Belum ada data monitoring</p>
      <p class="text-slate-500 text-xs mt-1">Isi Baseline di tab Weekly Monitoring untuk melihat perubahan</p>
      <button onclick="App.goToPage('monitoring')"
        class="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl">
        Input Monitoring
      </button>
    </div>`;
  },

  // ---- Target progress bar ----
  _buildProgressBar(a, pct) {
    const clamped = Math.max(0, Math.min(100, pct ?? 0));
    const latest  = this._monitorings.filter(Boolean).slice(-1)[0];
    const remaining = latest?.weight_kg != null
      ? Math.max(0, parseFloat(latest.weight_kg) - parseFloat(a.target_weight)).toFixed(1)
      : null;

    return `
    <div class="bg-slate-800 rounded-2xl border border-slate-700 p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-white">Progress Penurunan Berat</span>
        <span class="text-sm font-bold text-indigo-400">${clamped.toFixed(0)}%</span>
      </div>
      <div class="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
        <div class="h-3 rounded-full transition-all duration-500
          ${clamped >= 100 ? 'bg-emerald-500' : clamped >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}"
          style="width: ${clamped}%"></div>
      </div>
      <div class="flex justify-between mt-1.5 text-xs text-slate-400">
        <span>Awal: ${fmt(a.initial_weight,1)} kg</span>
        ${remaining !== null ? `<span class="text-slate-300">Sisa: ${remaining} kg</span>` : ''}
        <span>Target: ${fmt(a.target_weight,1)} kg</span>
      </div>
    </div>`;
  },

  // ---- Vitals row ----
  _buildVitalsRow(bsl, current) {
    const src = current ?? bsl;
    if (!src) return '';
    const label = current ? `W${src.week_number} — ${formatDate(src.visit_date)}` : `Baseline — ${formatDate(src?.visit_date)}`;

    const items = [
      { icon: '⚖️', label: 'Berat',     val: src.weight_kg      != null ? `${fmt(src.weight_kg,1)} kg`  : '—' },
      { icon: '📐', label: 'BMI',       val: src.bmi             != null ? `${fmt(src.bmi,1)}`            : '—' },
      { icon: '🔥', label: 'Body Fat',  val: src.body_fat_pct    != null ? `${fmt(src.body_fat_pct,1)}%`  : '—' },
      { icon: '💪', label: 'Otot',      val: src.muscle_mass_kg  != null ? `${fmt(src.muscle_mass_kg,1)} kg` : '—' },
      { icon: '📏', label: 'Pinggang',  val: src.waist_cm        != null ? `${fmt(src.waist_cm,1)} cm`    : '—' },
      { icon: '🫀', label: 'Visceral',  val: src.visceral_fat    != null ? `${fmt(src.visceral_fat,1)}`   : '—' },
      { icon: '🩸', label: 'TD',        val: (src.bp_systolic && src.bp_diastolic) ? `${src.bp_systolic}/${src.bp_diastolic}` : '—' },
      { icon: '💓', label: 'Nadi',      val: src.heart_rate      != null ? `${src.heart_rate} bpm`        : '—' },
    ];

    return `
    <div class="bg-slate-800 rounded-2xl border border-slate-700 p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-white">Data Terkini</h3>
        <span class="text-xs text-slate-400">${label}</span>
      </div>
      <div class="grid grid-cols-4 md:grid-cols-8 gap-3">
        ${items.map(item => `
          <div class="text-center">
            <div class="text-xl mb-1">${item.icon}</div>
            <div class="text-sm font-bold text-white">${item.val}</div>
            <div class="text-xs text-slate-400 mt-0.5">${item.label}</div>
          </div>`).join('')}
      </div>
    </div>`;
  },

  // ---- Assessment summary (inside tab) ----
  _buildAssessmentSummary(a) {
    if (!a || !Object.keys(a).length) {
      return `<div class="text-center py-8 text-slate-500">
        <p class="text-sm">Belum ada data Initial Assessment</p>
        <button onclick="App.goToPage('assessment')" class="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs rounded-xl">
          Isi Assessment
        </button>
      </div>`;
    }
    const rows = [
      ['GDS', a.gds ? `${a.gds} mg/dL` : null],
      ['Total Cholesterol', a.total_cholesterol ? `${a.total_cholesterol} mg/dL` : null],
      ['LDL / HDL', (a.ldl || a.hdl) ? `${a.ldl ?? '?'} / ${a.hdl ?? '?'} mg/dL` : null],
      ['Trigliserida', a.triglycerides ? `${a.triglycerides} mg/dL` : null],
      ['Asam Urat', a.uric_acid ? `${a.uric_acid} mg/dL` : null],
      ['HbA1c', a.hba1c ? `${a.hba1c}%` : null],
      ['Berat Awal', a.initial_weight ? `${a.initial_weight} kg` : null],
      ['Tinggi', a.initial_height ? `${a.initial_height} cm` : null],
      ['BMI Awal', a.initial_bmi ? `${fmt(a.initial_bmi,1)} (${bmiCategory(a.initial_bmi)})` : null],
    ].filter(r => r[1]);

    return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Lab Baseline</h4>
        <dl class="space-y-2">
          ${rows.map(([k, v]) => `
            <div class="flex justify-between text-sm">
              <dt class="text-slate-400">${k}</dt>
              <dd class="text-white font-medium">${v}</dd>
            </div>`).join('')}
        </dl>
      </div>
      <div>
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Treatment Plan</h4>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between"><dt class="text-slate-400">Obat</dt><dd class="text-white">${a.medication ?? '—'}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-400">Dosis</dt><dd class="text-white">${a.starting_dose ?? '—'}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-400">Mulai</dt><dd class="text-white">${formatDate(a.date_started)}</dd></div>
        </dl>
        ${a.main_goal ? `<div class="mt-3 p-3 bg-slate-700/50 rounded-xl text-xs text-slate-300"><strong class="text-slate-200">Goal:</strong> ${a.main_goal}</div>` : ''}
      </div>
    </div>
    <div class="mt-4 flex justify-end">
      <button onclick="App.goToPage('assessment')"
        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-xl">
        Edit Assessment →
      </button>
    </div>`;
  },

  // ---- Mini monitoring table (inside tab) ----
  _buildMonitoringMiniTable() {
    const rows = this._monitorings.filter(Boolean);
    if (!rows.length) {
      return `<div class="text-center py-8 text-slate-500">
        <p class="text-sm">Belum ada data monitoring</p>
        <button onclick="App.goToPage('monitoring')" class="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs rounded-xl">
          Input Monitoring
        </button>
      </div>`;
    }
    const weeks = ['Baseline','W1','W2','W3','W4','W5','W6','W7','W8'];
    return `
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700">
            <th class="text-left py-2 pr-3">Minggu</th>
            <th class="text-right py-2 px-2">Berat</th>
            <th class="text-right py-2 px-2">BMI</th>
            <th class="text-right py-2 px-2">Fat%</th>
            <th class="text-right py-2 px-2">Otot</th>
            <th class="text-right py-2 px-2">Pinggang</th>
            <th class="text-right py-2 px-2">TD</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="border-b border-slate-700/40 hover:bg-slate-700/20">
              <td class="py-2 pr-3 font-medium text-indigo-300">${weeks[r.week_number]}</td>
              <td class="text-right px-2 font-mono">${fmt(r.weight_kg,1)}</td>
              <td class="text-right px-2 font-mono">${fmt(r.bmi,1)}</td>
              <td class="text-right px-2 font-mono">${fmt(r.body_fat_pct,1)}</td>
              <td class="text-right px-2 font-mono">${fmt(r.muscle_mass_kg,1)}</td>
              <td class="text-right px-2 font-mono">${fmt(r.waist_cm,1)}</td>
              <td class="text-right px-2 font-mono">${r.bp_systolic ? `${r.bp_systolic}/${r.bp_diastolic}` : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="flex justify-end mt-3">
      <button onclick="App.goToPage('monitoring')"
        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-xl">
        Edit Monitoring →
      </button>
    </div>`;
  },

  // ---- Photos summary ----
  _buildPhotosSummary() {
    return `
    <div class="text-center py-6">
      <p class="text-slate-400 text-sm mb-3">Lihat dan kelola foto progres di halaman Foto & Catatan</p>
      <button onclick="App.goToPage('photos')"
        class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl">
        Buka Foto & Catatan →
      </button>
    </div>`;
  },

  // ---- Tab switch (di dalam dashboard card) ----
  _bindTabEvents() {
    // handled via onclick in HTML
  },

  switchTab(tabId) {
    ['tab-assessment', 'tab-monitoring', 'tab-photos'].forEach(t => {
      document.getElementById(`${t}-content`)?.classList.toggle('hidden', t !== tabId);
      document.getElementById(`${t}-btn`)?.classList.toggle('active', t === tabId);
    });
  },

  // ---- Helper: weight progress % ----
  _progressPct(initial, target, baseline, current) {
    if (!initial || !target) return 0;
    const totalToLose = parseFloat(initial) - parseFloat(target);
    if (totalToLose <= 0) return 0;
    const currentW = current ?? baseline ?? initial;
    const lost = parseFloat(initial) - parseFloat(currentW);
    return (lost / totalToLose) * 100;
  },
};
