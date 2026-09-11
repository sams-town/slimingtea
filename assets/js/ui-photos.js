// ============================================================
// ui-photos.js — Tab 3: Foto Progres & Doctor's Notes
// ============================================================

const UIPhotos = {
  _patientId: null,
  _photos: [],
  _notes: [],
  _currentWeek: 0,

  WEEKS: ['Baseline', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],

  // ---- Render ----
  async render(patientId, containerId = 'page-photos') {
    this._patientId = patientId;
    const container = document.getElementById(containerId) ??
                      document.getElementById('page-photos');
    container.innerHTML = `<div class="animate-pulse space-y-4">${skeletonLine('w-full','h-48')}</div>`;

    await this._loadData();
    container.innerHTML = this._buildHTML();
    this._bindEvents();
    this._renderPhotoGrid();
    this._renderNotes();
  },

  async _loadData() {
    // Local first
    this._photos = await DB.getAllByIndex('patient_photos', 'patient_id', this._patientId);
    this._notes  = await DB.getAllByIndex('doctor_notes',   'patient_id', this._patientId);

    if (navigator.onLine) {
      const [pRes, nRes] = await Promise.all([
        API.photos.list(this._patientId),
        API.notes.list(this._patientId),
      ]);
      if (pRes.success && pRes.data) {
        this._photos = pRes.data;
        await DB.putBatch('patient_photos', pRes.data.filter(p => p.uuid));
      }
      if (nRes.success && nRes.data) {
        this._notes = nRes.data;
        await DB.putBatch('doctor_notes', nRes.data.filter(n => n.uuid));
      }
    }
  },

  _buildHTML() {
    return `
    <div class="space-y-6 max-w-4xl mx-auto">

      <!-- Header -->
      <div>
        <h2 class="text-xl font-bold text-white">Foto Progres & Catatan Dokter</h2>
        <p class="text-sm text-slate-400 mt-0.5">Dokumentasi visual dan catatan klinis per kunjungan</p>
      </div>

      <!-- Week selector -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        <span class="text-xs text-slate-400 flex-shrink-0">Kunjungan:</span>
        ${this.WEEKS.map((w, i) => `
          <button onclick="UIPhotos.switchWeek(${i})"
            id="week-btn-${i}"
            class="week-btn flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors
                   ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">
            ${w}
          </button>`).join('')}
      </div>

      <!-- ===== FOTO SECTION ===== -->
      <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div class="p-4 border-b border-slate-700 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
            <h3 class="text-sm font-bold text-white">Foto Progres — <span id="current-week-label">Baseline</span></h3>
          </div>
          <!-- Upload button -->
          <label for="photo-input"
            class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Tambah Foto
          </label>
          <input type="file" id="photo-input" accept="image/*" capture="environment"
            class="hidden" multiple onchange="UIPhotos.handlePhotoSelect(this)">
        </div>

        <!-- Photo type selector -->
        <div class="px-4 pt-3 flex gap-2">
          ${['front','side','back','other'].map(t => `
            <button onclick="UIPhotos.setPhotoType('${t}')"
              id="type-btn-${t}"
              class="photo-type-btn px-3 py-1 rounded-lg text-xs capitalize transition-colors
                     ${t === 'front' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">
              ${t === 'front' ? 'Depan' : t === 'side' ? 'Samping' : t === 'back' ? 'Belakang' : 'Lainnya'}
            </button>`).join('')}
        </div>
        <input type="hidden" id="selected-photo-type" value="front">

        <!-- Photo grid -->
        <div id="photo-grid-container" class="p-4">
          <div id="photo-grid" class="photo-grid"></div>
          <div id="photo-empty" class="hidden text-center py-12 text-slate-500">
            <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p class="text-sm">Belum ada foto untuk minggu ini</p>
            <p class="text-xs mt-1">Klik "Tambah Foto" untuk mengambil dari kamera atau galeri</p>
          </div>
        </div>
      </div>

      <!-- ===== UPLOAD PREVIEW ===== -->
      <div id="upload-preview-section" class="hidden bg-slate-800 rounded-2xl border border-slate-700 p-4">
        <h3 class="text-sm font-bold text-white mb-3">Preview Upload</h3>
        <div id="upload-preview-grid" class="photo-grid mb-4"></div>
        <div class="flex gap-3 justify-end">
          <button onclick="UIPhotos.cancelUpload()"
            class="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm">
            Batal
          </button>
          <button onclick="UIPhotos.submitUpload()"
            class="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
            Upload <span id="upload-count" class="bg-white text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">0</span>
          </button>
        </div>
      </div>

      <!-- ===== DOCTOR'S NOTES ===== -->
      <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div class="p-4 border-b border-slate-700 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          <h3 class="text-sm font-bold text-white">Catatan Dokter</h3>
        </div>

        <!-- Add new note form -->
        <div class="p-4 border-b border-slate-700 bg-slate-900/40">
          <div class="flex gap-2 mb-2">
            <div class="flex-1">
              <label class="block text-xs text-slate-400 mb-1">Kunjungan</label>
              <select id="note-week" class="w-full h-10 bg-slate-700/60 border border-slate-600 rounded-xl px-3 text-sm text-white">
                ${this.WEEKS.map((w, i) => `<option value="${i}" ${i === this._currentWeek ? 'selected' : ''}>${w}</option>`).join('')}
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-xs text-slate-400 mb-1">Tanggal</label>
              <input type="date" id="note-date" value="${today()}"
                class="w-full h-10 bg-slate-700/60 border border-slate-600 rounded-xl px-3 text-sm text-white">
            </div>
            <div class="flex-1">
              <label class="block text-xs text-slate-400 mb-1">Oleh</label>
              <input type="text" id="note-author" value="Doctor" placeholder="Nama dokter"
                class="w-full h-10 bg-slate-700/60 border border-slate-600 rounded-xl px-3 text-sm text-white">
            </div>
          </div>
          <textarea id="note-input" rows="3"
            placeholder="Tulis catatan klinis, observasi, atau rekomendasi..."
            class="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:border-indigo-500"></textarea>
          <div class="flex justify-end mt-2">
            <button onclick="UIPhotos.saveNote()"
              class="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Simpan Catatan
            </button>
          </div>
        </div>

        <!-- Notes list -->
        <div id="notes-list" class="divide-y divide-slate-700/50 max-h-[400px] overflow-y-auto p-4 space-y-3">
          <!-- Injected by _renderNotes() -->
        </div>
      </div>

    </div>

    <!-- ===== LIGHTBOX ===== -->
    <div id="photo-lightbox" class="hidden fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onclick="UIPhotos.closeLightbox()">
      <img id="lightbox-img" src="" alt="Preview" class="max-w-full max-h-full rounded-xl object-contain">
      <button class="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30"
        onclick="UIPhotos.closeLightbox()">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>`;
  },

  _bindEvents() {
    // Prevent click from bubbling inside lightbox image
    document.getElementById('lightbox-img')?.addEventListener('click', e => e.stopPropagation());
    // Store container id untuk dipakai method lain
    this._containerId = this._containerId ?? 'page-photos';
  },

  // ---- Week switch ----
  switchWeek(weekIdx) {
    this._currentWeek = weekIdx;
    document.querySelectorAll('.week-btn').forEach((btn, i) => {
      btn.className = btn.className.replace(/bg-indigo-600 text-white|bg-slate-700 text-slate-300 hover:bg-slate-600/, '');
      btn.classList.add(i === weekIdx ? 'bg-indigo-600' : 'bg-slate-700', i === weekIdx ? 'text-white' : 'text-slate-300');
      if (i !== weekIdx) btn.classList.add('hover:bg-slate-600');
    });
    document.getElementById('current-week-label').textContent = this.WEEKS[weekIdx];
    document.getElementById('note-week').value = weekIdx;
    this._renderPhotoGrid();
  },

  // ---- Photo type ----
  setPhotoType(type) {
    document.getElementById('selected-photo-type').value = type;
    document.querySelectorAll('.photo-type-btn').forEach(btn => {
      const isActive = btn.id === `type-btn-${type}`;
      btn.className = btn.className
        .replace('bg-indigo-600 text-white', '')
        .replace('bg-slate-700 text-slate-300 hover:bg-slate-600', '');
      btn.classList.add(isActive ? 'bg-indigo-600' : 'bg-slate-700');
      btn.classList.add(isActive ? 'text-white' : 'text-slate-300');
      if (!isActive) btn.classList.add('hover:bg-slate-600');
    });
  },

  // ---- Render foto grid ----
  _renderPhotoGrid() {
    const grid  = document.getElementById('photo-grid');
    const empty = document.getElementById('photo-empty');
    if (!grid) return;

    const weekPhotos = this._photos.filter(p => p.week_number === this._currentWeek);

    if (weekPhotos.length === 0) {
      grid.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    grid.innerHTML = weekPhotos.map(p => {
      const typeLabel = { front: 'Depan', side: 'Samping', back: 'Belakang', other: 'Lainnya' }[p.photo_type] ?? p.photo_type;
      const src = p._localBlob ?? `/${p.photo_path}`;
      return `
      <div class="photo-item group cursor-pointer" onclick="UIPhotos.openLightbox('${src}')">
        <img src="${src}" alt="${typeLabel}" loading="lazy" onerror="this.src='assets/icons/photo-placeholder.svg'">
        <div class="photo-overlay">
          <div class="flex items-center justify-between">
            <span>${typeLabel}</span>
            <button onclick="event.stopPropagation(); UIPhotos.deletePhoto('${p.uuid}', ${p.id ?? 'null'})"
              class="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-600/80 rounded">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
  },

  // ---- Handle file selection ----
  _pendingFiles: [],
  handlePhotoSelect(input) {
    const files = Array.from(input.files);
    if (!files.length) return;
    this._pendingFiles = files;

    const preview = document.getElementById('upload-preview-section');
    const grid    = document.getElementById('upload-preview-grid');
    const countEl = document.getElementById('upload-count');

    preview?.classList.remove('hidden');
    if (countEl) countEl.textContent = files.length;

    if (grid) {
      grid.innerHTML = files.map((f, i) => {
        const url = URL.createObjectURL(f);
        return `<div class="photo-item">
          <img src="${url}" alt="preview-${i}">
          <div class="photo-overlay"><span class="text-xs">${(f.size/1024).toFixed(0)}KB</span></div>
        </div>`;
      }).join('');
    }
  },

  cancelUpload() {
    this._pendingFiles = [];
    document.getElementById('upload-preview-section')?.classList.add('hidden');
    document.getElementById('photo-input').value = '';
  },

  async submitUpload() {
    if (!this._pendingFiles.length) return;
    const type = document.getElementById('selected-photo-type')?.value ?? 'front';
    let uploaded = 0;

    for (const file of this._pendingFiles) {
      const uuid = generateUUID();

      if (navigator.onLine) {
        // Upload ke server
        const fd = new FormData();
        fd.append('photo', file);
        fd.append('patient_id',  this._patientId);
        fd.append('week_number', this._currentWeek);
        fd.append('photo_type',  type);
        fd.append('visit_date',  today());
        fd.append('uuid',        uuid);

        const res = await API.photos.upload(fd);
        if (res.success) {
          const rec = { uuid: res.uuid, patient_id: this._patientId,
            week_number: this._currentWeek, photo_type: type,
            photo_path: res.photo_path, visit_date: today(), synced: 1 };
          await DB.put('patient_photos', rec);
          this._photos.push(rec);
          uploaded++;
        }
      } else {
        // Simpan lokal sebagai blob URL (sementara)
        const blobUrl = URL.createObjectURL(file);
        const rec = {
          uuid, patient_id: this._patientId,
          week_number: this._currentWeek, photo_type: type,
          photo_path: `pending/${uuid}`, visit_date: today(),
          _localBlob: blobUrl, _file: null, synced: 0
        };
        // Simpan ke IndexedDB tanpa file blob (blob tidak bisa disimpan di IDB langsung)
        await DB.put('patient_photos', { ...rec, _localBlob: blobUrl });
        await DB.addToSyncQueue('patient_photos', uuid, 'insert', rec);
        this._photos.push(rec);
        uploaded++;
      }
    }

    showToast(`${uploaded} foto berhasil diupload`, 'success');
    this.cancelUpload();
    this._renderPhotoGrid();
  },

  // ---- Delete foto ----
  async deletePhoto(uuid, serverId) {
    if (!confirm('Hapus foto ini?')) return;

    await DB.delete('patient_photos', uuid);
    this._photos = this._photos.filter(p => p.uuid !== uuid);

    if (navigator.onLine && serverId) {
      await API.photos.delete(serverId);
    }

    this._renderPhotoGrid();
    showToast('Foto dihapus', 'info');
  },

  // ---- Lightbox ----
  openLightbox(src) {
    const lb  = document.getElementById('photo-lightbox');
    const img = document.getElementById('lightbox-img');
    if (!lb || !img) return;
    img.src = src;
    lb.classList.remove('hidden');
    lb.classList.add('flex');
  },
  closeLightbox() {
    const lb = document.getElementById('photo-lightbox');
    lb?.classList.add('hidden');
    lb?.classList.remove('flex');
  },

  // ---- Render notes list ----
  _renderNotes() {
    const list = document.getElementById('notes-list');
    if (!list) return;

    if (!this._notes.length) {
      list.innerHTML = `<p class="text-center text-slate-500 text-sm py-6">Belum ada catatan dokter</p>`;
      return;
    }

    // Sort: terbaru dulu
    const sorted = [...this._notes].sort((a, b) =>
      new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0)
    );

    list.innerHTML = sorted.map(n => {
      const wLabel = this.WEEKS[n.week_number] ?? '-';
      return `
      <div class="bg-slate-700/40 rounded-xl p-4 group">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="bg-indigo-600/30 text-indigo-300 text-xs px-2 py-0.5 rounded-full">${wLabel}</span>
            <span class="text-xs text-slate-400">${formatDate(n.visit_date ?? n.created_at)}</span>
            <span class="text-xs text-slate-500">— ${n.author ?? 'Doctor'}</span>
          </div>
          <button onclick="UIPhotos.deleteNote('${n.uuid}')"
            class="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-red-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
        <p class="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">${n.note}</p>
      </div>`;
    }).join('');
  },

  // ---- Save note ----
  async saveNote() {
    const noteEl   = document.getElementById('note-input');
    const weekEl   = document.getElementById('note-week');
    const dateEl   = document.getElementById('note-date');
    const authorEl = document.getElementById('note-author');

    const text = noteEl?.value.trim();
    if (!text) { showToast('Tulis catatan terlebih dahulu', 'warn'); return; }

    const note = {
      uuid:        generateUUID(),
      patient_id:  this._patientId,
      week_number: parseInt(weekEl?.value ?? 0),
      visit_date:  dateEl?.value ?? today(),
      author:      authorEl?.value.trim() || 'Doctor',
      note:        text,
    };

    await Sync.saveLocal('doctor_notes', note, 'insert');
    this._notes.push(note);

    if (navigator.onLine) {
      const res = await API.notes.save(note);
      if (res.success && res.id) {
        note.id = res.id;
        await DB.put('doctor_notes', note);
      }
    }

    noteEl.value = '';
    this._renderNotes();
    showToast('Catatan tersimpan', 'success');
  },

  // ---- Delete note ----
  async deleteNote(uuid) {
    if (!confirm('Hapus catatan ini?')) return;

    const note = await DB.get('doctor_notes', uuid);
    await DB.delete('doctor_notes', uuid);
    this._notes = this._notes.filter(n => n.uuid !== uuid);

    if (navigator.onLine && note?.id) {
      await API.notes.delete(note.id);
    }

    this._renderNotes();
    showToast('Catatan dihapus', 'info');
  },
};
