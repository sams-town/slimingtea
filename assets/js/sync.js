// ============================================================
// sync.js — Offline-first sync engine
// Push: IndexedDB pending → Server
// Pull: Server → IndexedDB (merge)
// ============================================================

const Sync = {
  _running: false,
  _interval: null,

  // ---- Inisialisasi: pasang listener online/offline ----
  init() {
    window.addEventListener('online',  () => this._onOnline());
    window.addEventListener('offline', () => this._onOffline());

    // Listen pesan dari Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'TRIGGER_SYNC') this.run();
      });
    }

    // Auto-sync setiap 60 detik saat online
    this._interval = setInterval(() => {
      if (navigator.onLine) this.run();
    }, 60_000);

    // Update UI status awal
    this._updateStatusUI(navigator.onLine ? 'online' : 'offline');
    this._refreshPendingBadge();
  },

  // ---- Event: kembali online ----
  async _onOnline() {
    console.log('[Sync] Kembali online — memulai sinkronisasi...');
    this._updateStatusUI('syncing');
    showToast('Koneksi kembali — menyinkronkan data...', 'info');

    // Daftarkan background sync jika didukung
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-offline-data').catch(() => {});
    }

    await this.run();
  },

  // ---- Event: offline ----
  _onOffline() {
    console.log('[Sync] Offline — mode lokal aktif');
    this._updateStatusUI('offline');
    showToast('Koneksi terputus — data disimpan lokal', 'warn');
  },

  // ---- Jalankan full sync ----
  async run() {
    if (this._running) return;
    if (!navigator.onLine) { this._updateStatusUI('offline'); return; }

    this._running = true;
    this._updateStatusUI('syncing');

    try {
      // 1. Push data pending ke server
      await this._push();

      // 2. Pull data terbaru dari server
      await this._pull();

      // 3. Update last sync time
      const now = new Date().toISOString();
      await DB.setMeta('last_sync', now);
      this._updateLastSyncUI(now);
      this._updateStatusUI('online');
      await this._refreshPendingBadge();

      console.log('[Sync] Selesai:', now);

    } catch (err) {
      console.error('[Sync] Error:', err);
      this._updateStatusUI('error');
    } finally {
      this._running = false;
    }
  },

  // ---- PUSH: kirim semua record pending ke server ----
  async _push() {
    const pending = await DB.getPendingSyncItems();
    if (pending.length === 0) return;

    console.log(`[Sync] Pushing ${pending.length} records...`);

    // Batch per 20
    const BATCH = 20;
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      const records = batch.map(item => ({
        table:     item.table_name,
        operation: item.operation,
        uuid:      item.record_uuid,
        data:      item.payload,
      }));

      const res = await API.sync.push(records);
      if (res.offline) break; // masih offline, stop

      if (res.success && res.results) {
        for (let j = 0; j < batch.length; j++) {
          const result = res.results[j];
          if (result && result.status !== 'error') {
            await DB.markSyncItemDone(batch[j].id);
          } else {
            await DB.markSyncItemFailed(batch[j].id);
          }
        }
      }
    }
  },

  // ---- PULL: ambil data terbaru dari server ----
  async _pull() {
    const lastSync = await DB.getMeta('last_sync') ?? '1970-01-01 00:00:00';
    const res      = await API.sync.pull(lastSync);

    if (!res.success || res.offline) return;

    // Merge ke IndexedDB — server selalu menang untuk data yang lebih baru
    const merges = [
      ['patients',            res.patients       ?? []],
      ['initial_assessments', res.assessments    ?? []],
      ['weekly_monitorings',  res.monitorings    ?? []],
      ['body_circumferences', res.circumferences ?? []],
      ['doctor_notes',        res.notes          ?? []],
      ['patient_photos',      res.photos         ?? []],
    ];

    for (const [store, rows] of merges) {
      if (rows.length > 0) {
        // Pastikan semua punya uuid
        const valid = rows.filter(r => r.uuid);
        await DB.putBatch(store, valid);
        console.log(`[Sync] Pulled ${valid.length} ${store}`);
      }
    }
  },

  // ---- Helper: simpan data lokal + tambah ke sync queue ----
  async saveLocal(storeName, record, operation = 'insert') {
    // Pastikan uuid ada
    if (!record.uuid) record.uuid = generateUUID();
    if (!record.created_at) record.created_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    record._pending   = true;

    await DB.put(storeName, record);
    await DB.addToSyncQueue(storeName, record.uuid, operation, record);

    await this._refreshPendingBadge();
    return record;
  },

  // ---- UI: update status dot & text ----
  _updateStatusUI(status) {
    const dot  = document.getElementById('sync-dot');
    const text = document.getElementById('sync-status-text');
    const net  = document.getElementById('net-dot');
    const netlb = document.getElementById('net-label');
    if (!dot) return;

    dot.className = 'w-2 h-2 rounded-full';
    switch (status) {
      case 'online':
        dot.classList.add('badge-online');
        if (text) text.textContent = 'Online';
        if (net)  { net.className = 'w-2 h-2 rounded-full bg-emerald-500'; netlb.textContent = 'Online'; }
        break;
      case 'offline':
        dot.classList.add('badge-offline');
        if (text) text.textContent = 'Offline';
        if (net)  { net.className = 'w-2 h-2 rounded-full bg-red-500'; netlb.textContent = 'Offline'; }
        break;
      case 'syncing':
        dot.classList.add('badge-syncing');
        if (text) text.textContent = 'Menyinkronkan...';
        if (net)  { net.className = 'w-2 h-2 rounded-full bg-amber-500'; netlb.textContent = 'Syncing'; }
        break;
      case 'error':
        dot.classList.add('bg-orange-500');
        if (text) text.textContent = 'Sync gagal';
        break;
    }
  },

  _updateLastSyncUI(isoStr) {
    const el = document.getElementById('sync-last-time');
    if (!el) return;
    const d = new Date(isoStr);
    el.textContent = 'Terakhir: ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  },

  async _refreshPendingBadge() {
    const count = await DB.getPendingCount();
    const badge = document.getElementById('sync-pending-badge');
    const num   = document.getElementById('sync-pending-count');
    if (!badge) return;
    if (count > 0) {
      badge.classList.remove('hidden');
      if (num) num.textContent = count;
    } else {
      badge.classList.add('hidden');
    }
  },
};
