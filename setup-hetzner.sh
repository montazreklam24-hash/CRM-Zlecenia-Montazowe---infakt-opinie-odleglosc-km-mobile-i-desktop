#!/bin/bash
###############################################################################
# AUTOMATYCZNY SKRYPT INSTALACYJNY - CRM MONTAŻ REKLAM 24
# Serwer: Hetzner VPS
# Instaluje: Docker, Docker Compose, klonuje repo, konfiguruje i uruchamia
###############################################################################

set -e  # Przerwij przy błędzie

echo "=========================================="
echo "🚀 CRM Montaż Reklam 24 - Instalacja"
echo "=========================================="
echo ""

# Kolory
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. UPDATE SYSTEMU
echo -e "${BLUE}[1/8]${NC} Aktualizacja systemu..."
apt-get update -qq
apt-get upgrade -y -qq

# 2. INSTALACJA DOCKER
echo -e "${BLUE}[2/8]${NC} Instalacja Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✓${NC} Docker zainstalowany"
else
    echo -e "${GREEN}✓${NC} Docker już zainstalowany"
fi

# 3. INSTALACJA DOCKER COMPOSE
echo -e "${BLUE}[3/8]${NC} Instalacja Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓${NC} Docker Compose zainstalowany"
else
    echo -e "${GREEN}✓${NC} Docker Compose już zainstalowany"
fi

# 4. INSTALACJA GIT
echo -e "${BLUE}[4/8]${NC} Instalacja Git..."
apt-get install -y git

# 5. KLONOWANIE REPOZYTORIUM
echo -e "${BLUE}[5/8]${NC} Klonowanie repozytorium..."
cd /opt
if [ -d "crm-app" ]; then
    echo "Usuwam stary katalog..."
    rm -rf crm-app
fi

git clone https://github.com/montazreklam24-hash/CRM-Zlecenia-Montazowe---infakt-opinie-odleglosc-km-mobile-i-desktop.git crm-app
cd crm-app

echo -e "${GREEN}✓${NC} Repozytorium sklonowane"

# 6. KONFIGURACJA ŚRODOWISKA
echo -e "${BLUE}[6/8]${NC} Konfiguracja środowiska produkcyjnego..."

# Tworzenie pliku .env dla API
cat > api/.env << 'EOF'
DB_HOST=db
DB_NAME=crm_db
DB_USER=crm_user
DB_PASS=crm_password_secure_2025
GEMINI_API_KEY=AIzaSyBoAITbGpl7lrDanvH8CadEqBjGrC9Uzx8
GEMINI_MODEL=gemini-1.5-flash
EOF

# Tworzenie docker-compose.production.yml
cat > docker-compose.production.yml << 'EOF'
services:
  # Serwer WWW (Apache + PHP)
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: crm_app_production
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./dist:/var/www/html
      - ./api:/var/www/html/api
      - ./uploads:/var/www/html/uploads
    depends_on:
      - db
    environment:
      - PHP_MEMORY_LIMIT=256M
      - PHP_UPLOAD_MAX_FILESIZE=10M
      - PHP_POST_MAX_SIZE=10M
    networks:
      - crm_network

  # Baza Danych (MySQL/MariaDB)
  db:
    image: mariadb:10.6
    container_name: crm_db_production
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root_password_secure_2025
      MYSQL_DATABASE: crm_db
      MYSQL_USER: crm_user
      MYSQL_PASSWORD: crm_password_secure_2025
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - crm_network

  # phpMyAdmin (Opcjonalnie - do zarządzania bazą)
  pma:
    image: phpmyadmin/phpmyadmin
    container_name: crm_pma_production
    restart: unless-stopped
    environment:
      PMA_HOST: db
      PMA_USER: crm_user
      PMA_PASSWORD: crm_password_secure_2025
    ports:
      - "8081:80"
    depends_on:
      - db
    networks:
      - crm_network

volumes:
  db_data:

networks:
  crm_network:
EOF

echo -e "${GREEN}✓${NC} Konfiguracja utworzona"

# 7. TWORZENIE KATALOGÓW
echo -e "${BLUE}[7/8]${NC} Tworzenie wymaganych katalogów..."
mkdir -p uploads
mkdir -p dist
chmod -R 755 uploads
chmod -R 755 api

# 8. URUCHOMIENIE APLIKACJI
echo -e "${BLUE}[8/8]${NC} Uruchamianie aplikacji..."
docker-compose -f docker-compose.production.yml up -d --build

echo ""
echo "=========================================="
echo -e "${GREEN}✓ INSTALACJA ZAKOŃCZONA POMYŚLNIE!${NC}"
echo "=========================================="
echo ""
echo "📋 Informacje:"
echo "   - Aplikacja: http://46.224.89.131"
echo "   - phpMyAdmin: http://46.224.89.131:8081"
echo "   - Baza danych:"
echo "     • Host: db (wewnątrz Docker)"
echo "     • Nazwa: crm_db"
echo "     • User: crm_user"
echo "     • Password: crm_password_secure_2025"
echo ""
echo "📦 Przydatne komendy:"
echo "   docker-compose -f docker-compose.production.yml ps     - Status kontenerów"
echo "   docker-compose -f docker-compose.production.yml logs   - Logi"
echo "   docker-compose -f docker-compose.production.yml restart - Restart"
echo "   docker-compose -f docker-compose.production.yml down   - Stop"
echo ""
echo "⚠️  NASTĘPNE KROKI:"
echo "   1. Zbuduj frontend lokalnie: npm run build"
echo "   2. Wgraj folder dist/ na serwer (scp lub rsync)"
echo "   3. Zaimportuj bazę danych przez phpMyAdmin"
echo ""
