<?php
/**
 * CRM Zlecenia Montażowe - Konfiguracja PRZYKŁADOWA
 * 
 * INSTRUKCJA:
 * 1. Skopiuj ten plik jako config.php
 * 2. Uzupełnij prawdziwe dane (klucze API, hasła)
 * 3. NIE COMMITUJ config.php do Git!
 */

// =====================================================
// BAZA DANYCH MySQL
// =====================================================
define('DB_HOST', 'localhost');
define('DB_NAME', 'nazwa_bazy');
define('DB_USER', 'uzytkownik');
define('DB_PASS', 'haslo');
define('DB_CHARSET', 'utf8mb4');

// =====================================================
// API KEYS - WYGENERUJ WŁASNE!
// =====================================================

// Gemini API Key (Google AI Studio)
// https://aistudio.google.com/apikey
define('GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY_HERE');
define('GEMINI_MODEL', 'gemini-2.0-flash');

// Google Maps API Key
// https://console.cloud.google.com/apis/credentials
define('GOOGLE_MAPS_API_KEY', 'YOUR_GOOGLE_MAPS_API_KEY_HERE');

// =====================================================
// INFAKT
// =====================================================
define('INFAKT_API_KEY', 'YOUR_INFAKT_API_KEY_HERE');
define('INFAKT_API_URL', 'https://api.infakt.pl/v3');

// =====================================================
// Reszta konfiguracji (bez zmian)
// =====================================================
define('DEV_MODE', false);
define('SESSION_LIFETIME', 86400 * 7);
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_UPLOAD_SIZE', 10 * 1024 * 1024);
define('BASE_ADDRESS', 'ul. Poprawna 39R, Warszawa');

// ... (skopiuj resztę z oryginalnego config.php)









