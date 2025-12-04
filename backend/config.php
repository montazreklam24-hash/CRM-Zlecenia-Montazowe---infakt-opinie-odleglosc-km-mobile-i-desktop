<?php
/**
 * CRM Zlecenia Montażowe - Konfiguracja
 * Kompatybilny z PHP 5.6
 */

// Wyłącz wyświetlanie błędów na produkcji
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Strefa czasowa
date_default_timezone_set('Europe/Warsaw');

// =====================================================
// KONFIGURACJA BAZY DANYCH
// =====================================================
define('DB_HOST', 'localhost');
define('DB_NAME', 'montazreklam24_crm');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// =====================================================
// KONFIGURACJA API
// =====================================================
define('API_BASE_URL', '/api');
define('SESSION_LIFETIME', 86400 * 7); // 7 dni
define('TOKEN_LENGTH', 64);

// =====================================================
// KONFIGURACJA GEMINI API
// =====================================================
define('GEMINI_API_KEY', 'TWOJ_KLUCZ_GEMINI_API');
define('GEMINI_MODEL', 'gemini-2.5-flash');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/');

// =====================================================
// KONFIGURACJA UPLOADU
// =====================================================
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('MAX_UPLOAD_SIZE', 10 * 1024 * 1024); // 10MB
define('ALLOWED_MIME_TYPES', array('image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'));
define('STORE_IMAGES_AS_FILES', false); // true = pliki na dysku, false = base64 w bazie

// =====================================================
// KONFIGURACJA CORS
// =====================================================
define('CORS_ALLOWED_ORIGINS', array(
    'http://localhost:3000',
    'http://localhost:5173',
    'https://montazreklam24.pl',
    'https://www.montazreklam24.pl'
));

// =====================================================
// FUNKCJE POMOCNICZE
// =====================================================

/**
 * Połączenie z bazą danych (PDO)
 */
function getDB() {
    static $pdo = null;
    
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $options = array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        );
        
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(array('error' => 'Database connection failed')));
        }
    }
    
    return $pdo;
}

/**
 * Generowanie bezpiecznego tokenu
 */
function generateToken($length = TOKEN_LENGTH) {
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes($length / 2));
    } elseif (function_exists('openssl_random_pseudo_bytes')) {
        return bin2hex(openssl_random_pseudo_bytes($length / 2));
    } else {
        // Fallback dla starszych PHP
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $token = '';
        for ($i = 0; $i < $length; $i++) {
            $token .= $chars[mt_rand(0, strlen($chars) - 1)];
        }
        return $token;
    }
}

/**
 * Wysyłanie odpowiedzi JSON
 */
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Obsługa błędów
 */
function errorResponse($message, $code = 400) {
    jsonResponse(array('error' => $message), $code);
}

/**
 * Pobieranie danych z body (JSON)
 */
function getRequestBody() {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    return $data ? $data : array();
}

/**
 * Sanityzacja stringa
 */
function sanitize($str) {
    if ($str === null) return null;
    return htmlspecialchars(trim($str), ENT_QUOTES, 'UTF-8');
}

/**
 * Generowanie przyjaznego ID zlecenia
 */
function generateFriendlyId($pdo) {
    $year = date('Y');
    
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM jobs WHERE YEAR(created_at) = ?");
    $stmt->execute(array($year));
    $row = $stmt->fetch();
    
    $number = ($row['cnt'] + 1);
    return '#' . $year . '/' . str_pad($number, 3, '0', STR_PAD_LEFT);
}

/**
 * Logowanie do pliku
 */
function logError($message) {
    $logFile = __DIR__ . '/logs/error.log';
    $dir = dirname($logFile);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}
