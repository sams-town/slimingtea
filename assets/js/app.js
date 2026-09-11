// ============================================================
// app.js — Router & Application Entry Point
//
// ALUR UTAMA:
//   patients  → goToPatient(uuid)  → patient-detail (hub 3 tab)
//                                      └─ tab: assessment
//                                      └─ tab: monitoring
//                                      └─ tab: photos
//
// App.goToPage(page)       — navigasi halaman statis
// App.goToPatient(uuid)    — buka detail pasien by UUID
// App.setActivePatient(p)  — set state + navigasi ke detail
// ============================================================

const App = {
  _currentPage:    'patients',
  _activePatient:  null,

  // ──────────────────────────────────────────────────────────
  // BOOT
  // ──────────────────────────────────────────────────────────
  async init() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg  => console.log('[SW] Registered:', reg.scope))
        .catch(err => console.warn('[SW] Failed:', err));
    }

    // Buka IndexedDB
    await DB.open();

    // Inisialisasi Sync engine
    Sync.init();

    // Manual sync button (sidebar)
    document.getElementById('btn-manual-sync')?.addEventListener('click', () => {
      showToast('Memulai sinkronisasi...', 'info');
      Sync.run();
    });

    // Restore last sync time label
    const lastSync = await DB.getMeta('last_sync');
    if (lastSync) Sync._updateLastSyncUI(lastSync);

    // Render halaman default
    await this.goToPage('patients');

    console.log('[App] Homecare WMS v1.1.0 — ready');
  },

  // ──────────────────────────────────────────────────────────
  // ROUTER HALAMAN
  // ──────────────────────────────────────────────────────────
  async goToPage(page, params = {}) {
    // Sembunyikan semua page
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));

    // Aktifkan page target
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.remove('hidden');

    // Update nav highlight
    this._setNavActive(page);

    this._currentPage = page;
    this._updateTopbar(page);

    // Tutup sidebar di mobile
    closeSidebar();

    // Render konten
    switch (page) {

      case 'patients':
        // Reset active patient saat kembali ke daftar
        this._clearActivePatientUI();
        await UIPatients.render();
        break;

      case 'patient-detail':
        if (!this._activePatient) {
          await this.goToPage('patients');
          return;
        }
        await UIPatientDetail.render(
          this._activePatient.uuid,
          params.tab ?? null
        );
        break;

      // Page standalone (tetap bisa diakses langsung dari sidebar)
      case 'assessment':
        if (!this._requirePatient()) return;
        await UIAssessment.render(this._pid());
        break;

      case 'monitoring':
        if (!this._requirePatient()) return;
        {
          const aArr = await DB.getAllByIndex(
            'initial_assessments', 'patient_id', this._pid()
          );
          await UIMonitoring.render(this._pid(), aArr[0]?.initial_height ?? null);
        }
        break;

      case 'photos':
        if (!this._requirePatient()) return;
        await UIPhotos.render(this._pid());
        break;
    }
  },

  // ──────────────────────────────────────────────────────────
  // NAVIGASI KE DETAIL PASIEN (by UUID)
  // Dipanggil dari: tombol "Buka Kunjungan" di patient card
  //                 dan submitQuick() setelah daftar
  // ──────────────────────────────────────────────────────────
  async goToPatient(uuid, tab = null) {
    // Cari di IndexedDB
    const all = await DB.getAll('patients');
    const p   = all.find(x => x.uuid === uuid);

    if (!p) {
      showToast('Data pasien tidak ditemukan', 'error');
      return;
    }

    await this.setActivePatient(p, tab);
  },

  // ──────────────────────────────────────────────────────────
  // SET ACTIVE PATIENT — update state + UI
  // ──────────────────────────────────────────────────────────
  async setActivePatient(patient, tab = null) {
    this._activePatient = patient;

    // Update topbar pill
    const pill    = document.getElementById('active-patient-pill');
    const avatar  = document.getElementById('patient-pill-avatar');
    const nameEl  = document.getElementById('patient-pill-name');
    if (pill)   { pill.classList.remove('hidden'); pill.classList.add('flex'); }
    if (avatar) avatar.textContent = getInitials(patient.name);
    if (nameEl) nameEl.textContent = patient.name;

    // Tampilkan nav "Detail Pasien" di sidebar
    const navDetail = document.getElementById('nav-patient-detail');
    if (navDetail) navDetail.classList.remove('hidden');

    // Update status registration jika belum 'full' dan ada assessment
    await this._maybeUpgradeStatus(patient);

    // Navigasi ke halaman detail
    await this.goToPage('patient-detail', { tab });
  },

  // ──────────────────────────────────────────────────────────
  // AUTO-UPGRADE STATUS: quick → full saat assessment tersimpan
  // ──────────────────────────────────────────────────────────
  async _maybeUpgradeStatus(patient) {
    if (patient.registration_status === 'full') return;

    const pid = patient.id ?? patient._serverId;
    if (!pid) return;

    const assessArr = await DB.getAllByIndex('initial_assessments', 'patient_id', pid);
    if (!assessArr.length) return;

    // Upgrade lokal
    patient.registration_status = 'full';
    patient.updated_at          = new Date().toISOString();
    await DB.put('patients', patient);

    // Sync ke server
    if (navigator.onLine && pid) {
      await API.patients.update(pid, { registration_status: 'full' });
    }
  },

  // Dipanggil dari UIAssessment.save() setelah berhasil simpan
  async onAssessmentSaved() {
    if (!this._activePatient) return;
    await this._maybeUpgradeStatus(this._activePatient);

    // Refresh topbar pill kalau ada perubahan
    const p = await DB.get('patients', this._activePatient.uuid);
    if (p) this._activePatient = p;

    this._updateTopbar('patient-detail');
  },

  // ──────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────
  _pid() {
    return this._activePatient?.id ?? this._activePatient?._serverId;
  },

  _requirePatient() {
    if (!this._activePatient) {
      showToast('Pilih pasien terlebih dahulu', 'warn');
      this.goToPage('patients');
      return false;
    }
    return true;
  },

  _clearActivePatientUI() {
    // Sembunyikan pill & nav detail saat di halaman daftar
    document.getElementById('active-patient-pill')?.classList.add('hidden');
    document.getElementById('active-patient-pill')?.classList.remove('flex');
    document.getElementById('nav-patient-detail')?.classList.add('hidden');
  },

  _setNavActive(page) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const active = link.dataset.page === page;
      link.classList.toggle('bg-slate-700', active);
      link.classList.toggle('text-white',   active);
      link.classList.toggle('text-slate-300', !active);
      link.classList.toggle('font-medium',  active);
    });
  },

  _updateTopbar(page) {
    const p = this._activePatient;
    const titles = {
      'patients':       { title: 'Daftar Pasien',            subtitle: '' },
      'patient-detail': { title: p?.name ?? 'Profil Pasien', subtitle: 'Kunjungan & Monitoring' },
      'assessment':     { title: 'Initial Assessment',       subtitle: p?.name ?? '' },
      'monitoring':     { title: 'Weekly Monitoring',        subtitle: p?.name ?? '' },
      'photos':         { title: 'Foto & Catatan',           subtitle: p?.name ?? '' },
    };

    const t        = titles[page] ?? { title: page, subtitle: '' };
    const titleEl  = document.getElementById('page-title');
    const subEl    = document.getElementById('page-subtitle');

    if (titleEl) titleEl.textContent = t.title;
    if (subEl) {
      subEl.textContent = t.subtitle;
      subEl.classList.toggle('hidden', !t.subtitle);
    }
    document.title = t.title + ' — Homecare WMS';
  },
};

// ──────────────────────────────────────────────────────────────
// DOM READY — bind navigasi & keyboard shortcuts
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Sidebar nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) App.goToPage(page);
    });
  });

  // Escape: tutup modal / lightbox
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePatientModal();
      if (typeof UIPhotos !== 'undefined') UIPhotos.closeLightbox?.();
      if (typeof UIOCR   !== 'undefined') UIOCR.close?.();
    }
  });

  // Boot
  App.init();
});
