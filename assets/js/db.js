// ============================================================
// db.js — IndexedDB wrapper (offline-first storage)
// DB name: hcwm_db | Version: 1
// ============================================================

const DB_NAME    = 'hcwm_db';
const DB_VERSION = 2; // bumped: fix compound index syntax

// Object store definitions
const STORES = {
  patients:            { keyPath: 'uuid' },
  initial_assessments: { keyPath: 'uuid' },
  weekly_monitorings:  { keyPath: 'uuid' },
  body_circumferences: { keyPath: 'uuid' },
  patient_photos:      { keyPath: 'uuid' },
  doctor_notes:        { keyPath: 'uuid' },
  sync_queue:          { keyPath: 'id', autoIncrement: true },
  app_meta:            { keyPath: 'key' },
};

// Indexes per store
// FIX: compound index pakai array ['field1','field2'], bukan string '[field1+field2]'
const INDEXES = {
  patients:            [['name','name',{}], ['phone','phone',{}]],
  initial_assessments: [['patient_id','patient_id',{}]],
  // FIX: hilangkan compound unique index — cukup index by patient_id
  // unique constraint sudah dijaga di level UUID (keyPath)
  weekly_monitorings:  [['patient_id','patient_id',{}]],
  body_circumferences: [['patient_id','patient_id',{}]],
  patient_photos:      [['patient_id','patient_id',{}]],
  doctor_notes:        [['patient_id','patient_id',{}]],
  sync_queue:          [['status','status',{}], ['table_name','table_name',{}]],
};

let _db = null;

const DB = {
  // ---- Open ----
  open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const [storeName, opts] of Object.entries(STORES)) {
          let store;
          if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, opts);
          } else {
            store = e.target.transaction.objectStore(storeName);
          }
          const idxDefs = INDEXES[storeName] || [];
          idxDefs.forEach(([idxName, keyPath, options]) => {
            if (!store.indexNames.contains(idxName)) {
              store.createIndex(idxName, keyPath, options);
            }
          });
        }
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
    });
  },

  // ---- Generic get one by key ----
  async get(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  },

  // ---- Get all records in a store ----
  async getAll(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  // ---- Get all by index value ----
  async getAllByIndex(storeName, indexName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const idx   = store.index(indexName);
      const req   = idx.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  // ---- Get one by index ----
  async getByIndex(storeName, indexName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const idx   = store.index(indexName);
      const req   = idx.get(value);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  },

  // ---- Put (create or update) ----
  async put(storeName, record) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  // ---- Put multiple records (batch) ----
  async putBatch(storeName, records) {
    if (!records || records.length === 0) return;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      records.forEach(r => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  },

  // ---- Delete by key ----
  async delete(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  },

  // ---- Search patients by name/phone ----
  async searchPatients(query) {
    const all = await this.getAll('patients');
    if (!query) return all.filter(p => !p.deleted_at);
    const q = query.toLowerCase();
    return all.filter(p =>
      !p.deleted_at &&
      (p.name?.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q))
    );
  },

  // ---- Meta key/value store ----
  async getMeta(key) {
    const row = await this.get('app_meta', key);
    return row?.value ?? null;
  },
  async setMeta(key, value) {
    return this.put('app_meta', { key, value });
  },

  // ---- Sync Queue helpers ----
  async addToSyncQueue(tableName, recordUuid, operation, payload) {
    return this.put('sync_queue', {
      table_name:  tableName,
      record_uuid: recordUuid,
      operation,
      payload,
      status:      'pending',
      attempts:    0,
      created_at:  new Date().toISOString(),
    });
  },

  async getPendingSyncItems() {
    const all = await this.getAll('sync_queue');
    return all.filter(i => i.status === 'pending');
  },

  async markSyncItemDone(id) {
    const item = await this.get('sync_queue', id);
    if (item) { item.status = 'synced'; await this.put('sync_queue', item); }
  },

  async markSyncItemFailed(id) {
    const item = await this.get('sync_queue', id);
    if (item) {
      item.status   = 'failed';
      item.attempts = (item.attempts || 0) + 1;
      await this.put('sync_queue', item);
    }
  },

  async getPendingCount() {
    const pending = await this.getPendingSyncItems();
    return pending.length;
  },
};
