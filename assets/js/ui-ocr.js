// ============================================================
// ui-ocr.js — Modal Upload InBody + Preview Hasil OCR
// ============================================================

const UIOCR = {
  _currentFile:   null,
  _currentResult: null,
  _targetWeek:    null,   // week_number yang akan diisi
  _targetPatientId: null,

  // ---- Buka modal ----
  open(patientId, weekNumber) {
    this._targetPatientId = patientId;
    this._targetWeek      = weekNumber;
    this._currentFile     = null;
    this._currentResult   = null;

    const el = document.getElementById('modal-ocr');
    if (!el) {
      this._inject();
    }

    document.getElementById('modal-ocr').classList.remove('hidden');
    document.getElementById('modal-ocr').classList.add('flex');
    this._resetUI();

    // Pre-init Tesseract di background
    OCR.init().catch(() => {});
  },

  // ---- Tutup modal ----
  close() {
    document.getElementById('modal-ocr')?.classList.add('hidden');
    document.getElementById('modal-ocr')?.classList.remove('flex');
    this._currentFile   = null;
    this._currentResult = null;
  },

  // ---- Inject HTML modal ke body ----
  _inject() {
    const div = document.createElement('div');
    div.innerHTML = this._buildModalHTML();
    document.body.appendChild(div.firstElementChild);
    this._bindDragDrop();
  },

  _buildModalHTML() {
    return `
    <div id="modal-ocr"
      class="hidden fixed inset-0 z-50 items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="ocr-modal-title">

      <div class="relative bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-700">

        <!-- Header -->
        <div class="sticky top-0 bg-slate-800 flex items-center justify-between p-5 border-b border-slate-700 z-10">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-indigo-600/30 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div>
              <h2 id="ocr-modal-title" class="text-base font-bold text-white">Scan Hasil InBody</h2>
              <p class="text-xs text-slate-400">Upload foto/screenshot → data terbaca otomatis</p>
            </div>
          </div>
          <button onclick="UIOCR.close()" class="p-2 rounded-lg hover:bg-slate-700 text-slate-400">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-5">

          <!-- STEP 1: Upload Zone -->
          <div id="ocr-upload-section">
            <div id="ocr-drop-zone"
              class="border-2 border-dashed border-slate-600 rounded-2xl p-8 text-center cursor-pointer
                     hover:border-indigo-500 hover:bg-indigo-500/5 transition-all"
              onclick="document.getElementById('ocr-file-input').click()"
              ondragover="UIOCR.onDragOver(event)"
              ondragleave="UIOCR.onDragLeave(event)"
              ondrop="UIOCR.onDrop(event)">

              <div id="ocr-drop-content">
                <div class="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </div>
                <p class="text-sm font-medium text-white mb-1">Drop foto InBody di sini</p>
                <p class="text-xs text-slate-400 mb-4">atau klik untuk pilih dari galeri / ambil kamera</p>
                <div class="flex justify-center gap-2">
                  <label for="ocr-file-input"
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                    📁 Pilih File
                  </label>
                  <label for="ocr-camera-input"
                    class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                    📷 Kamera
                  </label>
                </div>
                <p class="text-xs text-slate-500 mt-3">JPG · PNG · WEBP · HEIC — Maks. 15MB</p>
              </div>

              <!-- Image preview dalam drop zone -->
              <div id="ocr-preview-wrap" class="hidden">
                <img id="ocr-preview-img" src="" alt="Preview"
                  class="max-h-64 mx-auto rounded-xl object-contain border border-slate-600">
                <p id="ocr-preview-name" class="text-xs text-slate-400 mt-2"></p>
              </div>
            </div>

            <input type="file" id="ocr-file-input"
              accept="image/jpeg,image/png,image/webp,image/heic,image/*"
              class="hidden" onchange="UIOCR.onFileSelect(this)">
            <input type="file" id="ocr-camera-input"
              accept="image/*" capture="environment"
              class="hidden" onchange="UIOCR.onFileSelect(this)">

            <!-- Process button -->
            <div id="ocr-process-wrap" class="hidden mt-4 flex justify-center">
              <button onclick="UIOCR.process()"
                class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                Baca Data Otomatis
              </button>
            </div>
          </div>

          <!-- STEP 2: Progress -->
          <div id="ocr-progress-section" class="hidden">
            <div class="bg-slate-700/50 rounded-2xl p-5">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-medium text-white">Memproses gambar...</p>
                  <p id="ocr-progress-text" class="text-xs text-slate-400">Mempersiapkan OCR engine...</p>
                </div>
                <span id="ocr-progress-pct" class="text-sm font-bold text-indigo-400">0%</span>
              </div>
              <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div id="ocr-progress-bar"
                  class="h-2 bg-indigo-500 rounded-full transition-all duration-300"
                  style="width: 0%"></div>
              </div>
              <p class="text-xs text-slate-500 mt-2 text-center">
                OCR berjalan di browser — tidak ada data dikirim ke luar
              </p>
            </div>
          </div>

          <!-- STEP 3: Hasil OCR -->
          <div id="ocr-result-section" class="hidden space-y-4">

            <!-- Confidence badge -->
            <div id="ocr-confidence-bar" class="flex items-center justify-between p-3 rounded-xl border">
              <div class="flex items-center gap-2">
                <span id="ocr-confidence-icon" class="text-xl"></span>
                <div>
                  <p id="ocr-confidence-label" class="text-sm font-semibold"></p>
                  <p id="ocr-confidence-sub"   class="text-xs text-slate-400"></p>
                </div>
              </div>
              <div class="text-right">
                <p id="ocr-confidence-pct" class="text-lg font-bold"></p>
                <p class="text-xs text-slate-400">akurasi</p>
              </div>
            </div>

            <!-- Source badge -->
            <div id="ocr-source-badge" class="text-xs text-slate-500 text-right"></div>

            <!-- Hasil field-by-field (editable) -->
            <div>
              <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
                Data Terbaca
                <span class="text-xs font-normal text-slate-400">(semua bisa diedit sebelum disimpan)</span>
              </h3>
              <div id="ocr-fields-grid" class="grid grid-cols-2 gap-3">
                <!-- Injected -->
              </div>
            </div>

            <!-- Raw text accordion -->
            <details class="bg-slate-900/50 rounded-xl border border-slate-700">
              <summary class="p-3 text-xs text-slate-400 cursor-pointer hover:text-slate-200">
                Lihat teks mentah OCR
              </summary>
              <pre id="ocr-raw-text"
                class="p-3 text-xs text-slate-500 whitespace-pre-wrap font-mono overflow-auto max-h-32"></pre>
            </details>

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <button onclick="UIOCR._resetUI(); UIOCR._currentFile=null"
                class="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm">
                ↩ Ulangi
              </button>
              <button onclick="UIOCR.applyToForm()"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Isi ke Form Monitoring
              </button>
            </div>

          </div>

          <!-- Error state -->
          <div id="ocr-error-section" class="hidden bg-red-900/20 border border-red-800/40 rounded-2xl p-5 text-center">
            <p class="text-2xl mb-2">⚠️</p>
            <p id="ocr-error-msg" class="text-sm text-red-300 font-medium mb-1">Gagal membaca gambar</p>
            <p class="text-xs text-slate-400 mb-4">Coba foto ulang dengan pencahayaan lebih baik</p>
            <button onclick="UIOCR._resetUI()"
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl">
              Coba Lagi
            </button>
          </div>

        </div>
      </div>
    </div>`;
  },

  // ---- Reset ke state awal ----
  _resetUI() {
    this._show('ocr-upload-section');
    this._hide('ocr-progress-section');
    this._hide('ocr-result-section');
    this._hide('ocr-error-section');
    this._hide('ocr-process-wrap');
    this._hide('ocr-preview-wrap');

    const drop = document.getElementById('ocr-drop-content');
    if (drop) drop.classList.remove('hidden');

    const inp = document.getElementById('ocr-file-input');
    if (inp) inp.value = '';
    const cam = document.getElementById('ocr-camera-input');
    if (cam) cam.value = '';
  },

  // ---- Drag & drop ----
  _bindDragDrop() {},
  onDragOver(e) {
    e.preventDefault();
    document.getElementById('ocr-drop-zone')?.classList.add('border-indigo-500', 'bg-indigo-500/10');
  },
  onDragLeave(e) {
    document.getElementById('ocr-drop-zone')?.classList.remove('border-indigo-500', 'bg-indigo-500/10');
  },
  onDrop(e) {
    e.preventDefault();
    this.onDragLeave(e);
    const file = e.dataTransfer.files[0];
    if (file) this._setFile(file);
  },

  // ---- File select ----
  onFileSelect(input) {
    const file = input.files[0];
    if (file) this._setFile(file);
  },

  _setFile(file) {
    this._currentFile = file;

    // Show preview
    const previewImg  = document.getElementById('ocr-preview-img');
    const previewName = document.getElementById('ocr-preview-name');
    const dropContent = document.getElementById('ocr-drop-content');
    const previewWrap = document.getElementById('ocr-preview-wrap');

    if (previewImg) {
      previewImg.src = URL.createObjectURL(file);
      previewImg.onload = () => URL.revokeObjectURL(previewImg.src);
    }
    if (previewName) previewName.textContent = `${file.name} (${(file.size/1024).toFixed(0)} KB)`;

    dropContent?.classList.add('hidden');
    previewWrap?.classList.remove('hidden');

    this._show('ocr-process-wrap');
  },

  // ---- Proses OCR ----
  async process() {
    if (!this._currentFile) return;

    this._hide('ocr-upload-section');
    this._show('ocr-progress-section');
    this._hide('ocr-result-section');
    this._hide('ocr-error-section');

    const result = await OCR.extractFromFile(this._currentFile);

    this._hide('ocr-progress-section');

    if (!result.success) {
      document.getElementById('ocr-error-msg').textContent = result.message || 'Gagal membaca gambar';
      this._show('ocr-error-section');
      return;
    }

    this._currentResult = result;
    this._renderResult(result);
  },

  // ---- Render hasil ----
  _renderResult(result) {
    const data   = result.data;
    const fields = data.fields     ?? {};
    const conf   = data.confidence ?? {};

    // Confidence bar
    const avg = data.avg_confidence ?? 0;
    const pct = Math.round(avg * 100);
    const level = data.raw_confidence ?? 'low';

    const confBar   = document.getElementById('ocr-confidence-bar');
    const confIcon  = document.getElementById('ocr-confidence-icon');
    const confLabel = document.getElementById('ocr-confidence-label');
    const confSub   = document.getElementById('ocr-confidence-sub');
    const confPct   = document.getElementById('ocr-confidence-pct');

    const levelConfig = {
      high:   { icon: '✅', label: 'Akurasi Tinggi',   sub: 'Data siap digunakan',         color: 'bg-emerald-900/30 border-emerald-700/50', pctColor: 'text-emerald-400' },
      medium: { icon: '⚡', label: 'Akurasi Sedang',   sub: 'Periksa kembali sebelum simpan', color: 'bg-amber-900/30 border-amber-700/50',   pctColor: 'text-amber-400' },
      low:    { icon: '⚠️', label: 'Akurasi Rendah',   sub: 'Edit manual diperlukan',       color: 'bg-red-900/30 border-red-700/50',         pctColor: 'text-red-400' },
    };
    const cfg = levelConfig[level] ?? levelConfig.low;
    if (confBar)   confBar.className   = `flex items-center justify-between p-3 rounded-xl border ${cfg.color}`;
    if (confIcon)  confIcon.textContent  = cfg.icon;
    if (confLabel) confLabel.textContent = cfg.label;
    if (confSub)   confSub.textContent   = cfg.sub;
    if (confPct)   { confPct.textContent = pct + '%'; confPct.className = `text-lg font-bold ${cfg.pctColor}`; }

    // Source
    const srcEl = document.getElementById('ocr-source-badge');
    if (srcEl) {
      const srcMap = {
        tesseract_js:     '🖥️ Browser OCR (Tesseract.js)',
        google_vision:    '☁️ Google Vision API',
        tesseract:        '🖥️ Server OCR (Tesseract CLI)',
        client_tesseract: '🖥️ Browser OCR',
        server_failed:    '⚠️ Server OCR gagal',
      };
      srcEl.textContent = 'Sumber: ' + (srcMap[data.source] ?? data.source ?? 'unknown');
    }

    // Fields grid
    const grid = document.getElementById('ocr-fields-grid');
    if (grid) {
      grid.innerHTML = '';
      const allFields = [
        'visit_date','patient_name','weight_kg','bmi',
        'body_fat_pct','body_fat_kg','muscle_mass_kg','visceral_fat',
        'inbody_score','bmr_kcal',
      ];

      allFields.forEach(key => {
        const meta    = OCR.FIELD_MAP[key];
        const val     = fields[key];
        const fieldConf = conf[key] ?? 0;
        const confPctV  = Math.round(fieldConf * 100);
        const confColor = fieldConf >= 0.85 ? 'text-emerald-400' : fieldConf >= 0.65 ? 'text-amber-400' : 'text-slate-500';
        const hasVal    = val !== undefined && val !== null && val !== '';

        const card = document.createElement('div');
        card.className = `bg-slate-700/40 rounded-xl p-3 ${hasVal ? '' : 'opacity-50'}`;
        card.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-400 font-medium">${meta?.icon ?? ''} ${meta?.label ?? key}</span>
            ${hasVal ? `<span class="text-xs font-mono ${confColor}">${confPctV}%</span>` : '<span class="text-xs text-slate-600">tidak terbaca</span>'}
          </div>
          <input type="${key === 'visit_date' ? 'date' : 'text'}"
            id="ocr-field-${key}"
            value="${hasVal ? val : ''}"
            placeholder="${hasVal ? '' : '— isi manual'}"
            class="w-full bg-transparent border-b border-slate-600 pb-1 text-sm font-semibold
                   ${hasVal ? 'text-white' : 'text-slate-500'}
                   focus:outline-none focus:border-indigo-400">
        `;
        grid.appendChild(card);
      });
    }

    // Raw text
    const rawEl = document.getElementById('ocr-raw-text');
    if (rawEl) rawEl.textContent = result.raw || '(tidak ada teks mentah)';

    this._show('ocr-result-section');
  },

  // ---- Kumpulkan nilai dari field yang sudah diedit user ----
  _collectEditedFields() {
    const result = {};
    const allFields = [
      'visit_date','patient_name','weight_kg','bmi',
      'body_fat_pct','body_fat_kg','muscle_mass_kg','visceral_fat',
      'inbody_score','bmr_kcal',
    ];
    allFields.forEach(key => {
      const el = document.getElementById(`ocr-field-${key}`);
      if (!el) return;
      const val = el.value.trim();
      if (!val) return;
      const numFields = ['weight_kg','bmi','body_fat_pct','body_fat_kg','muscle_mass_kg','visceral_fat','inbody_score','bmr_kcal'];
      result[key] = numFields.includes(key) ? parseFloat(val) : val;
    });
    return result;
  },

  // ---- Apply ke form monitoring ----
  applyToForm() {
    const edited = this._collectEditedFields();

    if (Object.keys(edited).length === 0) {
      showToast('Tidak ada data yang bisa diisi', 'warn');
      return;
    }

    let filled = 0;

    // ---- Isi ke matrix monitoring table ----
    if (this._targetWeek !== null) {
      const w = this._targetWeek;
      const fieldToInput = {
        weight_kg:      `[data-week="${w}"][data-field="weight_kg"]`,
        bmi:            `[data-week="${w}"][data-field="bmi"]`,
        body_fat_pct:   `[data-week="${w}"][data-field="body_fat_pct"]`,
        body_fat_kg:    `[data-week="${w}"][data-field="body_fat_kg"]`,
        muscle_mass_kg: `[data-week="${w}"][data-field="muscle_mass_kg"]`,
        visceral_fat:   `[data-week="${w}"][data-field="visceral_fat"]`,
        visit_date:     `[data-week="${w}"][data-field="visit_date"]`,
      };

      Object.entries(fieldToInput).forEach(([key, selector]) => {
        if (edited[key] !== undefined) {
          const el = document.querySelector(`#page-monitoring ${selector}`);
          if (el) {
            el.value = edited[key];
            // Trigger input event agar BMI auto-calc & event listener lain aktif
            el.dispatchEvent(new Event('input', { bubbles: true }));
            filled++;
          }
        }
      });

      // ---- Beritahu UIMonitoring agar update badge & flash highlight ----
      if (filled > 0 && typeof UIMonitoring !== 'undefined') {
        UIMonitoring.onOCRApplied(w, edited);
      }
    }

    // ---- Isi juga ke form assessment jika sedang terbuka (Baseline) ----
    if (this._targetWeek === 0) {
      const assessMap = {
        weight_kg:  'initial_weight',
        bmi:        'initial_bmi',
        visit_date: 'date_started',
      };
      Object.entries(assessMap).forEach(([from, to]) => {
        const el = document.getElementById(to);
        if (el && edited[from] !== undefined) {
          el.value = edited[from];
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }

    // ---- Tampilkan ringkasan ke pasien name jika terbaca ----
    if (edited.patient_name) {
      showToast(`👤 Nama terbaca: ${edited.patient_name}`, 'info', 4000);
    }
    if (edited.inbody_score) {
      showToast(`🏆 InBody Score: ${edited.inbody_score} pts`, 'info', 3500);
    }

    this.close();

    if (filled > 0) {
      showToast(`✅ ${filled} field berhasil diisi otomatis`, 'success', 4500);
    } else {
      showToast(
        'Buka halaman Weekly Monitoring terlebih dahulu, lalu scan ulang.',
        'warn', 5000
      );
    }

    return edited;
  },

  // ---- Show / Hide helpers ----
  _show(id) { document.getElementById(id)?.classList.remove('hidden'); },
  _hide(id) { document.getElementById(id)?.classList.add('hidden'); },
};
