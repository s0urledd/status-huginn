#!/bin/bash
# =============================================================
# Huginn Metrics Server - Kurulum Scripti
# Bu scripti hem mainnet hem testnet sunucusunda calistirin
# =============================================================
set -e

echo "=== Huginn Metrics Server Kurulumu ==="

# 1. Node.js kontrolu
if ! command -v node &> /dev/null; then
    echo "[!] Node.js bulunamadi. Kuruluyor..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "[+] Node.js version: $(node --version)"

# 2. Metrics server dosyalarini kopyala
INSTALL_DIR="/opt/huginn-metrics"
sudo mkdir -p "$INSTALL_DIR"
sudo cp -r src/ "$INSTALL_DIR/"
sudo cp package.json "$INSTALL_DIR/"

# 3. Dependencies kur
cd "$INSTALL_DIR"
sudo npm install --production
echo "[+] Dependencies kuruldu"

# 4. Nginx log format'i ekle
sudo cp nginx/metrics-log-format.conf /etc/nginx/conf.d/huginn-metrics-log.conf
echo "[+] Nginx log format eklendi"

# 5. Nginx'i test et ve reload et
sudo nginx -t && sudo systemctl reload nginx
echo "[+] Nginx reload edildi"

# 6. Systemd service'i kur
sudo cp huginn-metrics.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable huginn-metrics
sudo systemctl start huginn-metrics
echo "[+] Metrics service baslatildi"

# 7. Mevcut loglari import et (opsiyonel)
echo ""
read -p "Mevcut nginx loglarini import etmek ister misiniz? (y/n): " IMPORT
if [ "$IMPORT" = "y" ]; then
    cd "$INSTALL_DIR"
    sudo -u www-data node src/index.js --import &
    IMPORT_PID=$!
    sleep 5
    kill $IMPORT_PID 2>/dev/null || true
    sudo systemctl restart huginn-metrics
    echo "[+] Mevcut loglar import edildi"
fi

echo ""
echo "=== Kurulum Tamamlandi ==="
echo ""
echo "Metrics API: http://localhost:3100"
echo "Health check: curl http://localhost:3100/health"
echo "Stats:        curl http://localhost:3100/api/stats?service=rpc&period=daily"
echo "Chart:        curl http://localhost:3100/api/chart?service=rpc&period=daily"
echo "Overview:     curl http://localhost:3100/api/overview?period=daily"
echo ""
echo "Log kontrol:  sudo journalctl -u huginn-metrics -f"
echo ""
echo "ONEMLI: Nginx site config'lerinize su satiri ekleyin:"
echo "  access_log /var/log/nginx/huginn_metrics.log huginn_metrics;"
