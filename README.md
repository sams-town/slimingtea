# Homecare Weight Management System (PWA)

Aplikasi manajemen berat badan homecare berbasis tablet, offline-first, dengan sinkronisasi otomatis ke server.

---

## Tech Stack

| Layer     | Teknologi |
|-----------|-----------|
| Backend   | PHP 8.0+ (native, no framework) |
| Database  | SQLite (default) atau MySQL |
| Frontend  | Vanilla JS + Tailwind CSS (CDN) |
| Offline   | IndexedDB + Service Worker |
| PWA       | Web App Manifest + Background Sync |

---

## Struktur Folder

```
system-homecare/
├── api/
│   ├── helpers.php         # Shared utilities (auth, response, UUID)
│   ├── patients.php        # CRUD pasien
│   ├── assessments.php     # Initial assessment upsert
│   ├── monitorings.php     # Weekly monitoring + lingkar tubuh
│   ├── photos.php          # Upload foto progres
│   ├── notes.php           # Catatan dokter
│   └── sync.php            # Push/Pull offline sync
├── config/
│   ├── config.php          # Konfigurasi app (DB driver, token, upload)
│   └── database.php        # PDO connection (SQLite/MySQL)
├── database/
│   ├── schema.sql          # Schema MySQL
│   ├── schema_sqlite.sql   # Schema SQLite
│   └── migrate.php         # Migration runner
├── assets/
│   ├── css/app.css         # Custom styles
│   ├── js/
│   │   ├── utils.js        # Helper functions (UUID, toast, BMI, dll)
│   │   ├── db.js           # IndexedDB wrapper (offline storage)
│   │   ├── api.js          # HTTP client ke PHP backend
│   │   ├── sync.js         # Sync engine (push/pull, online/offline)
│   │   ├── ui-dashboard.js # Dashboard profil + auto-calculation
│   │   ├── ui-patients.js  # Daftar & form pasien
│   │   ├── ui-assessment.js# Form Initial Assessment
│   │   ├── ui-monitoring.js# Matrix monitoring mingguan
│   │   ├── ui-photos.js    # Foto & catatan dokter
│   │   └── app.js          # Router & entry point
│   └── icons/              # PWA icons (72–512px)
├── uploads/photos/         # Foto pasien (auto-created)
├── index.html              # SPA shell utama
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
└── .htaccess               # Apache config
```

---

## Instalasi

### 1. Requirements
- PHP 8.0+ dengan ekstensi: `pdo_sqlite` (atau `pdo_mysql`), `fileinfo`, `gd`
- Web server: Apache/Nginx atau PHP built-in server
- Browser modern (Chrome/Safari tablet)

### 2. Setup

```bash
# Clone/copy ke folder web server
cp -r system-homecare /var/www/html/

# Jalankan migrasi (otomatis buat file SQLite)
php database/migrate.php
```

Atau buka di browser: `http://localhost/system-homecare/database/migrate.php`

### 3. Konfigurasi

Edit `config/config.php`:

```php
// Pilih driver database
define('DB_DRIVER', 'sqlite');  // atau 'mysql'

// Token API (WAJIB diganti di production!)
define('API_TOKEN', 'ganti-dengan-token-aman-anda');

// Untuk MySQL, isi koneksi:
define('MYSQL_HOST',   'localhost');
define('MYSQL_DBNAME', 'homecare_db');
define('MYSQL_USER',   'root');
define('MYSQL_PASS',   'password');
```

### 4. Jalankan (development)

```bash
cd system-homecare
php -S localhost:8080
```

Buka `http://localhost:8080` di Chrome/Safari.

---

## Install sebagai PWA di Tablet

### iPad (Safari):
1. Buka `http://your-server/` di Safari
2. Tap ikon **Share** → **Add to Home Screen**
3. Beri nama "HCW Manager" → Add

### Android (Chrome):
1. Buka URL di Chrome
2. Tap menu ⋮ → **Install app** / **Add to Home screen**
3. Ikuti instruksi

---

## Fitur Offline

- Semua data input (pasien, assessment, monitoring, catatan) tersimpan di **IndexedDB** browser
- Saat koneksi kembali (`navigator.onLine`), data otomatis **di-push ke server**
- Server data di-**pull** dan di-merge ke lokal setiap 60 detik
- Badge "belum tersinkron" muncul di sidebar jika ada data pending

---

## API Endpoints

Semua endpoint memerlukan header: `X-API-Token: hcwm-secret-2025`

| Endpoint | Action | Method | Deskripsi |
|----------|--------|--------|-----------|
| `api/patients.php` | `list` | GET | Daftar pasien (+ ?q= search) |
| `api/patients.php` | `get&id=` | GET | Detail pasien |
| `api/patients.php` | `create` | POST | Tambah pasien |
| `api/patients.php` | `update&id=` | POST | Update pasien |
| `api/assessments.php` | `get&patient_id=` | GET | Get assessment |
| `api/assessments.php` | `save` | POST | Upsert assessment |
| `api/monitorings.php` | `list&patient_id=` | GET | Semua monitoring |
| `api/monitorings.php` | `save` | POST | Upsert monitoring + lingkar |
| `api/photos.php` | `list&patient_id=` | GET | Daftar foto |
| `api/photos.php` | `upload` | POST | Upload foto (multipart) |
| `api/notes.php` | `list&patient_id=` | GET | Daftar catatan |
| `api/notes.php` | `save` | POST | Simpan catatan |
| `api/sync.php` | `ping` | GET | Cek koneksi |
| `api/sync.php` | `push` | POST | Push batch offline data |
| `api/sync.php` | `pull&since=` | GET | Pull data terbaru |

---

## Security (Production Checklist)

- [ ] Ganti `API_TOKEN` dengan random string panjang
- [ ] Set `CORS_ORIGIN` ke domain spesifik
- [ ] Aktifkan HTTPS di `.htaccess`
- [ ] Set `display_errors = 0` di `config.php`
- [ ] Pindahkan `database/homecare.db` ke luar web root
- [ ] Atur permission folder `uploads/` ke `755`
