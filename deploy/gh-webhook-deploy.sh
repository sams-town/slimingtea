#!/bin/bash
# ============================================================
# GitHub Webhook Deploy Script (dijalankan oleh webhook.php)
# Penggunaan: ./gh-webhook-deploy.sh <GIT_REPO_DIR>
# ============================================================
set -e  # stop on error

REPO_DIR="${1:-/home/samst652/public_html/slimingtea}"
DEPLOYPATH="/home/samst652/public_html/slimingtea"
LOG_FILE="${2:-$REPO_DIR/logs/webhook-deploy.log}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DEPLOY] $*" | tee -a "$LOG_FILE"
}

if [ ! -d "$REPO_DIR/.git" ]; then
    log "ERROR: $REPO_DIR bukan git repo"
    exit 1
fi

cd "$REPO_DIR"
log "=== Mulai deploy dari webhook ==="

# 1. Reset working tree agar clean (tanpa uncommitted changes = syarat cPanel deploy)
log "→ git reset --hard HEAD (bersihkan uncommitted changes)"
git reset --hard HEAD 2>&1 | tee -a "$LOG_FILE" || true

# 2. Pull latest dari origin main
log "→ git fetch origin main"
git fetch origin main 2>&1 | tee -a "$LOG_FILE"

log "→ git checkout -f main"
git checkout -f main 2>&1 | tee -a "$LOG_FILE" || true

log "→ git pull --ff-only origin main"
git pull --ff-only origin main 2>&1 | tee -a "$LOG_FILE"

# 3. Tampilkan HEAD commit
HEAD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
HEAD_MSG=$(git log -1 --format="%s" 2>/dev/null || echo "?")
log "→ HEAD sekarang: $HEAD_HASH — $HEAD_MSG"

# 4. Copy file ke DEPLOYPATH (jika REPO_DIR != DEPLOYPATH)
if [ -d "$DEPLOYPATH" ] && [ "$REPO_DIR" != "$DEPLOYPATH" ]; then
    log "→ rsync ke $DEPLOYPATH"
    rsync -av \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='deploy' \
        --exclude='logs' \
        --exclude='*.log' \
        --delete \
        ./ "$DEPLOYPATH/" 2>&1 | tee -a "$LOG_FILE" || true

    # Perbaiki permission
    find "$DEPLOYPATH" -type f -name "*.php" -exec chmod 644 {} \; 2>/dev/null || true
    find "$DEPLOYPATH" -type d -exec chmod 755 {} \; 2>/dev/null || true
    mkdir -p "$DEPLOYPATH/uploads/photos" "$DEPLOYPATH/logs" 2>/dev/null || true
    chmod -R 775 "$DEPLOYPATH/uploads" "$DEPLOYPATH/logs" 2>/dev/null || true
fi

# 5. Bersihkan OPcache PHP (jika tersedia via CLI)
if command -v php >/dev/null 2>&1; then
    log "→ clear PHP opcache"
    php -r "if (function_exists('opcache_reset')) opcache_reset();" 2>/dev/null || true
fi

log "=== Deploy selesai untuk $HEAD_HASH ==="
echo "" >> "$LOG_FILE"
exit 0
