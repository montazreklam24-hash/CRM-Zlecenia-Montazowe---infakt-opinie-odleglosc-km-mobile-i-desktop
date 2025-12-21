# Montaż Reklam 24 - CRM Zlecenia Montażowe

System CRM do zarządzania zleceniami montażowymi z widokiem Kanban, mapą i integracją AI (Gemini).

## 📋 Funkcjonalności

- **Panel logowania** - dla administratorów i pracowników terenowych
- **Widok Kanban** - 7+ kolumn (Do przygotowania, Pon-Pt, Sobota, Niedziela, Wykonane)
- **Mapa zleceń** - pinezki z lokalizacjami (OpenStreetMap/Leaflet)
- **Parsowanie AI** - automatyczne wypełnianie danych ze skopiowanego maila (Gemini API)
- **Udostępnianie** - eksport karty zlecenia jako PNG
- **Przyciski akcji** - szybka nawigacja Google Maps i dzwonienie

## 🛠️ Technologie

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** PHP 5.6+ REST API
- **Baza danych:** MySQL
- **Mapa:** Leaflet + OpenStreetMap
- **AI:** Google Gemini API

## 📦 Instalacja

### Metoda 1: Docker (ZALECANE dla deweloperów)

Najprostsza metoda - wszystko uruchamia się jednym poleceniem.

**Wymagania:**
- Docker Desktop zainstalowany i uruchomiony
- WSL2 (Windows Subsystem for Linux) - instaluje się automatycznie z Dockerem

**Uruchomienie:**

```bash
# 1. Sklonuj repo i wejdź do folderu
cd "CRM Zlecenia Montazowe"

# 2. Skopiuj przykładowy config (jednorazowo)
cp api/config.example.php api/config.php
# Edytuj api/config.php i ustaw:
#   - DB_HOST na 'db' (nazwa kontenera)
#   - DB_NAME na 'crm_db'
#   - DB_USER na 'crm_user'
#   - DB_PASS na 'crm_password'

# 3. Uruchom wszystko (backend + baza + phpMyAdmin)
docker-compose up -d

# 4. Zainstaluj zależności frontendu i uruchom dev server
npm install
npm run dev
```

**Dostępne adresy:**
- Frontend (Vite dev): http://localhost:3000
- Backend (Apache/PHP): http://localhost:8080
- phpMyAdmin: http://localhost:8081

**Zatrzymanie:**
```bash
docker-compose down
```

---

### Metoda 2: Tradycyjna (bez Dockera)

#### 2.1 Frontend (development)

```bash
# Zainstaluj zależności
npm install

# Uruchom serwer deweloperski
npm run dev
```

#### 2.2 Backend (PHP)

1. Skopiuj folder `api/` na serwer FTP
2. Edytuj `api/config.php`:
   - Ustaw dane dostępowe MySQL
   - Ustaw klucz Gemini API
   - Zmień `DEV_MODE` na `false` na produkcji

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'twoja_baza');
define('DB_USER', 'twoj_user');
define('DB_PASS', 'twoje_haslo');
define('GEMINI_API_KEY', 'twoj_klucz_gemini');
define('DEV_MODE', false);
```

#### 2.3 Baza danych MySQL

1. Zaloguj się do phpMyAdmin
2. Utwórz nową bazę danych (np. `montaz_crm`)
3. Zaimportuj plik `backend/database.sql`

#### 2.4 Build produkcyjny

```bash
# Zbuduj aplikację
npm run build

# Pliki znajdziesz w folderze dist/
```

#### 2.5 Deployment na FTP

Struktura na serwerze:
```
public_html/crm/
├── index.html          (z dist/)
├── assets/             (z dist/)
├── api/
│   ├── index.php
│   ├── config.php      (skonfiguruj!)
│   ├── auth.php
│   ├── jobs.php
│   ├── gemini.php
│   ├── users.php
│   ├── settings.php
│   └── .htaccess
└── uploads/            (utwórz, chmod 755)
```

## 👤 Domyślne konta

Po imporcie bazy danych:

| Rola | Login | Hasło |
|------|-------|-------|
| Admin | admin@montazreklam24.pl | admin123 |
| Pracownik | montazysta@montazreklam24.pl | worker123 |

**⚠️ ZMIEŃ HASŁA PO PIERWSZYM LOGOWANIU!**

## 🔑 Konfiguracja Gemini API

1. Wejdź na https://aistudio.google.com/
2. Utwórz nowy projekt lub wybierz istniejący
3. Wygeneruj klucz API
4. Wklej klucz do `api/config.php`

## 📱 Użycie

### Tworzenie zlecenia (Admin)
1. Kliknij "NOWE ZLECENIE"
2. Wklej skopiowany wątek mailowy
3. Dodaj załączniki (PDF, zdjęcia)
4. Kliknij "Generuj Kartę" - AI wypełni dane
5. Sprawdź i zapisz zlecenie

### Praca z Kanban
- Przeciągnij kartę między kolumnami
- Kliknij kartę aby zobaczyć szczegóły
- Użyj przycisków nawigacji/dzwonienia

### Mapa
- Przełącz na widok mapy ikoną 🗺️
- Kliknij pinezkę aby zobaczyć szczegóły
- Nawiguj bezpośrednio do Google Maps

## 📄 Licencja

Własność prywatna © 2024 Montaż Reklam 24

---

Wersja 2.0 | PHP 5.6+ Compatible
