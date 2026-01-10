# 🚀 INSTALACJA CRM NA HETZNER VPS

## 📋 DANE SERWERA

```
IP:       46.224.89.131
User:     root
Password: iTTCULm3ar9iEgtiNfpK (zmień przy pierwszym logowaniu)
```

---

## ⚡ SZYBKA INSTALACJA (1 KOMENDA)

### **KROK 1: Zaloguj się przez SSH**

**Windows PowerShell:**
```powershell
ssh root@46.224.89.131
```

Wklej hasło: `iTTCULm3ar9iEgtiNfpK`

*(System poprosi o zmianę hasła - ustaw nowe i ZAPISZ JE!)*

---

### **KROK 2: Wklej tę komendę i naciśnij Enter**

```bash
curl -fsSL https://raw.githubusercontent.com/montazreklam24-hash/CRM-Zlecenia-Montazowe---infakt-opinie-odleglosc-km-mobile-i-desktop/omega/setup-hetzner.sh | bash
```

**To wszystko!** Skrypt automatycznie:
- ✅ Zainstaluje Docker
- ✅ Sklonuje repozytorium
- ✅ Skonfiguruje bazę danych
- ✅ Uruchomi aplikację

⏱️ **Czas: 3-5 minut**

---

## 🌐 PO INSTALACJI

### Dostęp do aplikacji:
- **Frontend + API:** http://46.224.89.131
- **phpMyAdmin:** http://46.224.89.131:8081

### Dane do bazy (phpMyAdmin):
```
Host:     db
Database: crm_db
User:     crm_user
Password: crm_password_secure_2025
```

---

## ⚠️ NASTĘPNE KROKI

### 1. **Wgraj Frontend (dist/)**

Na swoim komputerze (w projekcie):

```powershell
# Zbuduj frontend
npm run build

# Wgraj na serwer (PowerShell)
scp -r dist/* root@46.224.89.131:/opt/crm-app/dist/
```

### 2. **Wgraj pliki uploads/**

```powershell
scp -r uploads/* root@46.224.89.131:/opt/crm-app/uploads/
```

### 3. **Zaimportuj bazę danych**

a) Otwórz: http://46.224.89.131:8081
b) Zaloguj się (dane powyżej)
c) Importuj plik `.sql` z lokalnej bazy

---

## 📦 PRZYDATNE KOMENDY (na serwerze)

```bash
# Przejdź do katalogu projektu
cd /opt/crm-app

# Status kontenerów
docker-compose -f docker-compose.production.yml ps

# Logi aplikacji
docker-compose -f docker-compose.production.yml logs -f app

# Logi bazy danych
docker-compose -f docker-compose.production.yml logs -f db

# Restart aplikacji
docker-compose -f docker-compose.production.yml restart

# Stop wszystko
docker-compose -f docker-compose.production.yml down

# Start ponownie
docker-compose -f docker-compose.production.yml up -d

# Aktualizacja z GitHub
git pull
docker-compose -f docker-compose.production.yml restart
```

---

## 🔒 ZABEZPIECZENIE (OPCJONALNE)

### 1. **Zmień hasła w docker-compose.production.yml**

```bash
nano /opt/crm-app/docker-compose.production.yml
```

Zmień:
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD` (i też w `PMA_PASSWORD`)

Restart:
```bash
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### 2. **Firewall (UFW)**

```bash
# Włącz firewall
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS (na przyszłość)
ufw enable
```

### 3. **SSL Certyfikat (HTTPS)**

Zainstaluj Certbot:
```bash
apt install certbot python3-certbot-apache -y
```

*(Wymaga domeny skierowanej na serwer)*

---

## 🆘 ROZWIĄZYWANIE PROBLEMÓW

### Aplikacja nie działa:
```bash
# Sprawdź status
docker-compose -f docker-compose.production.yml ps

# Sprawdź logi
docker-compose -f docker-compose.production.yml logs
```

### Folder dist/ pusty:
```bash
# Na lokalnym komputerze:
npm run build
scp -r dist/* root@46.224.89.131:/opt/crm-app/dist/
```

### Restart wszystkiego:
```bash
cd /opt/crm-app
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --build
```

---

## 📞 KONTAKT

Jeśli coś nie działa - sprawdź logi i status kontenerów.
Większość problemów to brak frontendu (dist/) lub bazy danych.
