// ============================================================
// ocr.js — InBody Image OCR + Parser
// Strategy:
//   1. Tesseract.js (browser-side, offline capable)
//   2. Server PHP fallback via api/ocr.php
// ============================================================

const OCR = {
  _worker: null,
  _initialized: false,
  _initPromise: null,

  // ---- Mapping field InBody → field monitoring form ----
  FIELD_MAP: {
    weight_kg:      { label: 'Berat (kg)',           formId: 'weight_kg',      icon: '⚖️' },
    bmi:            { label: 'BMI',                  formId: 'bmi',            icon: '📐' },
    body_fat_pct:   { label: 'Body Fat (%)',          formId: 'body_fat_pct',   icon: '🔥' },
    body_fat_kg:    { label: 'Body Fat (kg)',         formId: 'body_fat_kg',    icon: '🔥' },
    muscle_mass_kg: { label: 'Skeletal Muscle (kg)', formId: 'muscle_mass_kg', icon: '💪' },
    visceral_fat:   { label: 'Visceral Fat',          formId: 'visceral_fat',   icon: '🫀' },
    visit_date:     { label: 'Tanggal',               formId: 'visit_date',     icon: '📅' },
    patient_name:   { label: 'Nama Pasien',           formId: null,             icon: '👤' },
    inbody_score:   { label: 'InBody Score',          formId: null,             icon: '🏆' },
    bmr_kcal:       { label: 'BMR (kcal)',            formId: null,             icon: '⚡' },
  },

  // ---- Init Tesseract.js worker ----
  async init() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        // Load Tesseract.js dari CDN jika belum ada
        if (typeof Tesseract === 'undefined') {
          await this._loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
        }

        this._worker = await Tesseract.createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              OCR._updateProgress(Math.round(m.progress * 100));
            }
          },
          errorHandler: (e) => console.warn('[OCR] Tesseract error:', e),
        });

        // Set parameter OCR untuk angka dan teks campuran
        await this._worker.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,:/%+-',
          preserve_interword_spaces: '1',
        });

        this._initialized = true;
        console.log('[OCR] Tesseract.js initialized');
      } catch (err) {
        console.warn('[OCR] Tesseract init failed, will use server fallback:', err);
        this._initialized = false;
      }
    })();

    return this._initPromise;
  },

  // ---- Ekstrak dari File object ----
  async extractFromFile(file, onProgress = null) {
    this._onProgress = onProgress;
    this._updateProgress(5, 'Mempersiapkan gambar...');

    // Validasi
    if (!file.type.startsWith('image/')) {
      return { success: false, message: 'File bukan gambar' };
    }

    try {
      // Preprocess gambar di canvas untuk OCR lebih akurat
      const processedBlob = await this._preprocessCanvas(file);
      this._updateProgress(20, 'Memulai OCR...');

      let rawText = '';
      let source  = '';

      // Try Tesseract.js browser-side
      await this.init();
      if (this._initialized && this._worker) {
        try {
          rawText = await this._tesseractRecognize(processedBlob);
          source  = 'tesseract_js';
        } catch (e) {
          console.warn('[OCR] Tesseract.js failed:', e);
        }
      }

      this._updateProgress(70, 'Menganalisis teks...');

      // Parse hasil OCR
      let parsed;
      if (rawText) {
        parsed = this._parseInBodyText(rawText);
        parsed.source = source;
      } else {
        // Fallback ke server OCR
        this._updateProgress(75, 'Mengirim ke server OCR...');
        parsed = await this._serverOCR(file);
      }

      this._updateProgress(95, 'Selesai');

      return {
        success:     true,
        raw:         rawText || parsed.raw || '',
        data:        parsed,
        preview_url: URL.createObjectURL(file),
      };

    } catch (err) {
      console.error('[OCR] Extract error:', err);
      return { success: false, message: err.message };
    }
  },

  // ---- Tesseract.js recognize ----
  async _tesseractRecognize(imageBlob) {
    const url    = URL.createObjectURL(imageBlob);
    const result = await this._worker.recognize(url);
    URL.revokeObjectURL(url);
    return result.data.text;
  },

  // ---- Canvas preprocessing ----
  async _preprocessCanvas(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.naturalWidth;
          let h = img.naturalHeight;

          // Scale up jika terlalu kecil — OCR lebih akurat pada resolusi tinggi
          const minW = 1400;
          if (w < minW) {
            const scale = minW / w;
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }

          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');

          ctx.drawImage(img, 0, 0, w, h);

          // Grayscale + contrast enhancement
          const imageData = ctx.getImageData(0, 0, w, h);
          const pixels    = imageData.data;
          for (let i = 0; i < pixels.length; i += 4) {
            const gray     = 0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2];
            const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128 + 15));
            pixels[i] = pixels[i+1] = pixels[i+2] = enhanced;
            // alpha tetap
          }
          ctx.putImageData(imageData, 0, 0);

          canvas.toBlob((blob) => {
            URL.revokeObjectURL(objectUrl); // revoke SETELAH selesai render
            resolve(blob);
          }, 'image/png', 1.0);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Gagal memuat gambar untuk preprocessing'));
      };

      img.src = objectUrl;
    });
  },

  // ---- Server OCR fallback ----
  async _serverOCR(file) {
    // API_TOKEN didefinisikan di api.js (dimuat sebelum ocr.js)
    const token = (typeof API_TOKEN !== 'undefined') ? API_TOKEN : '';
    const fd    = new FormData();
    fd.append('image', file);

    try {
      const res  = await fetch('api/ocr.php?action=extract', {
        method:  'POST',
        headers: { 'X-API-Token': token },
        body:    fd,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) return { ...json.data, source: 'server_tesseract' };
    } catch (err) {
      console.warn('[OCR] Server fallback failed:', err.message);
    }

    return {
      fields: {}, confidence: {}, avg_confidence: 0,
      fields_found: 0, raw_confidence: 'low', source: 'server_failed',
    };
  },

  // ---- PARSER InBody teks → field map ----
  _parseInBodyText(text) {
    const fields     = {};
    const confidence = {};

    // Normalisasi
    const t = text.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ');

    // ---- Helper ----
    const extract = (patterns, key, transform = parseFloat, conf = 0.90) => {
      for (const pattern of patterns) {
        const m = t.match(pattern);
        if (m && m[1]) {
          const val = transform(m[1].replace(',', '.'));
          if (!isNaN(val) || typeof val === 'string') {
            fields[key] = val;
            confidence[key] = conf;
            return true;
          }
        }
      }
      return false;
    };

    // ---- Tanggal ----
    const dateM = t.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (dateM) {
      const [, d, mo, y] = dateM;
      // InBody format: DD.MM.YYYY
      if (parseInt(mo) <= 12) {
        fields.visit_date = `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
        confidence.visit_date = 0.95;
      }
    }

    // ---- Jam ----
    const timeM = t.match(/(\d{1,2}:\d{2})/);
    if (timeM) { fields.visit_time = timeM[1]; confidence.visit_time = 0.90; }

    // ---- Nama pasien (InBody: muncul setelah jam, sebelum "Weight") ----
    const nameM = t.match(/\d{1,2}:\d{2}\s+([A-Za-z][A-Za-z\s\-\.]{1,35}?)(?:\s+(?:Weight|Skeletal|Body|BMI|\d))/i);
    if (nameM) {
      const name = nameM[1].trim();
      if (name.length >= 2) { fields.patient_name = name; confidence.patient_name = 0.80; }
    }

    // ---- Weight ----
    extract(
      [/Weight\s*[\n\s]*(\d{2,3}(?:[.,]\d)?)\s*kg/i,
       /(\d{2,3}[.,]\d)\s*kg\s*[\n\s]*(?:Weight)/i],
      'weight_kg', parseFloat, 0.95
    );

    // ---- Skeletal Muscle Mass ----
    extract(
      [/Skeletal\s*Muscle\s*Mass\s*[\n\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i,
       /SMM\s*[\n\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i],
      'muscle_mass_kg', parseFloat, 0.92
    );

    // ---- Body Fat Mass ----
    extract(
      [/Body\s*Fat\s*Mass\s*[\n\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i,
       /BFM\s*[\n\s]*(\d{1,3}(?:[.,]\d)?)\s*kg/i],
      'body_fat_kg', parseFloat, 0.92
    );

    // ---- BMI ----
    extract(
      [/BMI\s*[\n\s]*(\d{1,2}(?:[.,]\d{1,2})?)\s*kg/i,
       /BMI\s*[\n\s]+(\d{1,2}[.,]\d)/i],
      'bmi', parseFloat, 0.93
    );

    // ---- Percent Body Fat ----
    extract(
      [/Percent\s*Body\s*Fat\s*[\n\s]*(\d{1,2}(?:[.,]\d)?)\s*%/i,
       /PBF\s*[\n\s]*(\d{1,2}(?:[.,]\d)?)\s*%/i,
       /Body\s*Fat\s*(?:Mass\s*)?\d+[.,]\d\s*kg.*?(\d{1,2}[.,]\d)\s*%/is],
      'body_fat_pct', parseFloat, 0.92
    );

    // ---- Visceral Fat ----
    extract(
      [/Visceral\s*Fat\s*(?:Level|Area)?\s*[\n\s]*(\d{1,3}(?:[.,]\d)?)/i],
      'visceral_fat', parseFloat, 0.85
    );

    // ---- InBody Score ----
    extract(
      [/(\d{2,3})\s*Points/i],
      'inbody_score', parseInt, 0.90
    );

    // ---- Top % ----
    extract(
      [/Top\s*(\d{1,3}(?:[.,]\d+)?)\s*%/i],
      'inbody_top_pct', parseFloat, 0.88
    );

    // ---- BMR ----
    extract(
      [/(?:BMR|Basal\s*Metabolic\s*Rate)\s*[\n\s]*(\d{3,5})\s*(?:kcal|kJ)?/i],
      'bmr_kcal', parseInt, 0.82
    );

    // ---- Auto-derive body_fat_pct ----
    if (!fields.body_fat_pct && fields.body_fat_kg && fields.weight_kg && fields.weight_kg > 0) {
      fields.body_fat_pct = Math.round(fields.body_fat_kg / fields.weight_kg * 100 * 10) / 10;
      confidence.body_fat_pct = 0.70;
    }

    const avgConf = Object.values(confidence).length > 0
      ? Object.values(confidence).reduce((a, b) => a + b, 0) / Object.values(confidence).length
      : 0;

    return {
      fields,
      confidence,
      avg_confidence:  Math.round(avgConf * 100) / 100,
      fields_found:    Object.keys(fields).length,
      raw_confidence:  avgConf >= 0.85 ? 'high' : (avgConf >= 0.65 ? 'medium' : 'low'),
      source:          'tesseract_js',
    };
  },

  // ---- Load script helper ----
  _loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
      const s  = document.createElement('script');
      s.src    = url;
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  // ---- Progress update ----
  _onProgress: null,
  _updateProgress(pct, label = '') {
    const bar   = document.getElementById('ocr-progress-bar');
    const text  = document.getElementById('ocr-progress-text');
    const pctEl = document.getElementById('ocr-progress-pct');
    if (bar)   bar.style.width   = pct + '%';
    if (text)  text.textContent  = label || `${pct}%`;
    if (pctEl) pctEl.textContent = pct + '%';
    if (this._onProgress) this._onProgress(pct, label);
  },

  // ---- Terminate worker saat tidak dipakai ----
  async terminate() {
    if (this._worker) {
      await this._worker.terminate();
      this._worker      = null;
      this._initialized = false;
      this._initPromise = null;
    }
  },
};
