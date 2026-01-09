<?php
/**
 * CRM Zlecenia Montażowe - Autoryzacja
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';

/**
 * POST /api/login
 * Body: { "login": "email lub telefon", "password": "hasło" }
 */
function handleLogin() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(array('error' => 'Method not allowed'), 405);
    }
    
    $input = getJsonInput();
    
    $login = isset($input['login']) ? trim($input['login']) : '';
    $password = isset($input['password']) ? $input['password'] : '';
    
    if (empty($login) || empty($password)) {
        jsonResponse(array('error' => 'Podaj login i hasło'), 400);
    }
    
    $pdo = getDB();
    
    // Szukaj użytkownika po email lub telefonie
    $stmt = $pdo->prepare('
        SELECT * FROM users 
        WHERE (email = ? OR phone = ?) AND is_active = 1
    ');
    $stmt->execute(array($login, $login));
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonResponse(array('error' => 'Nieprawidłowy login lub hasło'), 401);
    }
    
    // Weryfikacja hasła
    if (!password_verify($password, $user['password_hash'])) {
        jsonResponse(array('error' => 'Nieprawidłowy login lub hasło'), 401);
    }
    
    // Generuj token sesji
    $token = generateToken(SESSION_TOKEN_LENGTH);
    $expiresTimestamp = time() + (isset($input['rememberMe']) && $input['rememberMe'] ? 86400 * 30 : SESSION_LIFETIME);
    $expiresAt = date('Y-m-d H:i:s', $expiresTimestamp);
    
    // Zapisz sesję
    $stmt = $pdo->prepare('
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
    ');
    $stmt->execute(array(
        $user['id'],
        $token,
        $expiresAt
    ));
    
    // Ustaw HttpOnly Cookie
    $cookiePath = '/';
    $cookieDomain = ''; // Domyślna domena
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    
    setcookie('crm_auth_token', $token, array(
        'expires' => $expiresTimestamp,
        'path' => $cookiePath,
        'domain' => $cookieDomain,
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict'
    ));
    
    // Aktualizuj last_login (jeśli kolumna istnieje)
    try {
        $stmt = $pdo->prepare('UPDATE users SET updated_at = NOW() WHERE id = ?');
        $stmt->execute(array($user['id']));
    } catch (Exception $e) {
        // Ignoruj jeśli kolumna nie istnieje
    }
    
    // Zwróć dane użytkownika (bez hasła)
    unset($user['password_hash']);
    
    jsonResponse(array(
        'success' => true,
        'token' => $token,
        'expires_at' => $expiresAt,
        'user' => $user
    ));
}

/**
 * POST /api/logout
 */
function handleLogout() {
    $token = getAuthToken();
    
    if ($token) {
        $pdo = getDB();
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE token = ?');
        $stmt->execute(array($token));
    }
    
    // Usuń ciasteczko
    setcookie('crm_auth_token', '', time() - 3600, '/');
    
    jsonResponse(array('success' => true, 'message' => 'Wylogowano'));
}

/**
 * GET /api/me
 * Zwraca dane zalogowanego użytkownika
 */
function handleMe() {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        jsonResponse(array('error' => 'Method not allowed'), 405);
    }
    
    $user = requireAuth();
    unset($user['password_hash']);
    
    jsonResponse(array(
        'success' => true,
        'user' => $user
    ));
}

/**
 * Zmiana hasła (dla zalogowanego użytkownika)
 */
function handleChangePassword() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(array('error' => 'Method not allowed'), 405);
    }
    
    $user = requireAuth();
    $input = getJsonInput();
    
    $currentPassword = isset($input['current_password']) ? $input['current_password'] : '';
    $newPassword = isset($input['new_password']) ? $input['new_password'] : '';
    
    if (empty($currentPassword) || empty($newPassword)) {
        jsonResponse(array('error' => 'Podaj obecne i nowe hasło'), 400);
    }
    
    if (strlen($newPassword) < 6) {
        jsonResponse(array('error' => 'Nowe hasło musi mieć min. 6 znaków'), 400);
    }
    
    $pdo = getDB();
    
    // Pobierz aktualne hasło
    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute(array($user['id']));
    $row = $stmt->fetch();
    
    if (!password_verify($currentPassword, $row['password_hash'])) {
        jsonResponse(array('error' => 'Nieprawidłowe obecne hasło'), 401);
    }
    
    // Zaktualizuj hasło
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, array('cost' => PASSWORD_COST));
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt->execute(array($newHash, $user['id']));
    
    jsonResponse(array('success' => true, 'message' => 'Hasło zmienione'));
}

// =========================================================================
// FUNKCJE POMOCNICZE AUTORYZACJI
// =========================================================================

/**
 * Sprawdź autoryzację (Token sesji lub API Secret)
 */
function requireAuth() {
    $token = getAuthToken();
    
    // 1. Sprawdź Secret Token (dla Extension)
    if (defined('CRM_API_SECRET') && $token === CRM_API_SECRET) {
        return array(
            'id' => 1, // Zawsze Admin (lub pierwszy user)
            'role' => 'admin',
            'name' => 'API Extension',
            'email' => 'extension@crm'
        );
    }
    
    // 2. Sprawdź sesję użytkownika
    if (!$token) {
        // Jeśli ALLOW_ANONYMOUS_DEV to pozwól bez logowania (tylko na localhost w trybie dev)
        if (defined('ALLOW_ANONYMOUS_DEV') && ALLOW_ANONYMOUS_DEV === true && defined('DEV_MODE') && DEV_MODE === true) {
             return array(
                'id' => 1,
                'role' => 'admin',
                'name' => 'Dev Admin',
                'email' => 'admin@dev'
            );
        }
        jsonResponse(array('error' => 'Unauthorized'), 401);
    }
    
    $pdo = getDB();
    
    // Pobierz sesję
    $stmt = $pdo->prepare('
        SELECT s.*, u.role, u.name, u.email 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = ? AND s.expires_at > NOW()
    ');
    $stmt->execute(array($token));
    $session = $stmt->fetch();
    
    if (!$session) {
        jsonResponse(array('error' => 'Unauthorized or session expired'), 401);
    }
    
    return $session;
}

/**
 * Pobierz token z nagłówka lub ciasteczka
 */
function getAuthToken() {
    // 1. Sprawdź nagłówek Authorization
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        return $matches[1];
    }
    
    // 2. Sprawdź ciasteczko
    if (isset($_COOKIE['crm_auth_token'])) {
        return $_COOKIE['crm_auth_token'];
    }
    
    return null;
}

// Polyfill dla getallheaders() na nginx/fpm (czasem brakuje)
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}
