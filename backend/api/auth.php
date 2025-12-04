<?php
/**
 * CRM Zlecenia Montażowe - Autoryzacja
 * PHP 5.6 Compatible
 */

if (!defined('CRM_LOADED')) {
    die('Brak dostępu');
}

/**
 * Handler autoryzacji
 */
function handleAuth($method, $action) {
    switch ($action) {
        case 'login':
            if ($method === 'POST') {
                doLogin();
            } else {
                jsonError('Metoda niedozwolona', 405);
            }
            break;
            
        case 'logout':
            if ($method === 'POST') {
                doLogout();
            } else {
                jsonError('Metoda niedozwolona', 405);
            }
            break;
            
        case 'me':
            if ($method === 'GET') {
                getCurrentUser();
            } else {
                jsonError('Metoda niedozwolona', 405);
            }
            break;
            
        case 'register':
            if ($method === 'POST') {
                doRegister();
            } else {
                jsonError('Metoda niedozwolona', 405);
            }
            break;
            
        default:
            jsonError('Akcja nieznana', 404);
    }
}

/**
 * Logowanie użytkownika
 */
function doLogin() {
    $data = getJsonInput();
    
    $login = isset($data['login']) ? trim($data['login']) : '';
    $password = isset($data['password']) ? $data['password'] : '';
    
    if (empty($login) || empty($password)) {
        jsonError('Podaj login i hasło', 400);
    }
    
    $db = getDB();
    
    // Szukaj po emailu lub telefonie
    $stmt = $db->prepare("
        SELECT id, email, phone, password_hash, role, name, is_active 
        FROM users 
        WHERE (email = ? OR phone = ?) AND is_active = 1
    ");
    $stmt->execute(array($login, $login));
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonError('Nieprawidłowy login lub hasło', 401);
    }
    
    if (!verifyPassword($password, $user['password_hash'])) {
        jsonError('Nieprawidłowy login lub hasło', 401);
    }
    
    // Generuj token sesji
    $token = generateToken();
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : null;
    $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 255) : null;
    
    // Zapisz sesję
    $stmt = $db->prepare("
        INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute(array($user['id'], $token, $expiresAt, $ip, $userAgent));
    
    // Aktualizuj ostatnie logowanie
    $stmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $stmt->execute(array($user['id']));
    
    // Loguj aktywność
    logActivity($user['id'], null, 'login', 'Zalogowano z IP: ' . $ip);
    
    jsonResponse(array(
        'success' => true,
        'token' => $token,
        'expires_at' => $expiresAt,
        'user' => array(
            'id' => (int)$user['id'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'name' => $user['name'],
            'role' => $user['role']
        )
    ));
}

/**
 * Wylogowanie
 */
function doLogout() {
    $token = getAuthToken();
    
    if ($token) {
        $db = getDB();
        $stmt = $db->prepare("DELETE FROM sessions WHERE token = ?");
        $stmt->execute(array($token));
    }
    
    jsonResponse(array('success' => true, 'message' => 'Wylogowano'));
}

/**
 * Pobiera token z nagłówka Authorization
 */
function getAuthToken() {
    $headers = array();
    
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    } else {
        // Fallback dla serwerów bez getallheaders
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
                $headers[$header] = $value;
            }
        }
    }
    
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }
    
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        return $matches[1];
    }
    
    // Fallback: sprawdź parametr GET
    if (isset($_GET['token'])) {
        return $_GET['token'];
    }
    
    return null;
}

/**
 * Weryfikuje token i zwraca dane użytkownika
 */
function verifyAuth() {
    $token = getAuthToken();
    
    if (!$token) {
        jsonError('Brak autoryzacji', 401);
    }
    
    $db = getDB();
    
    $stmt = $db->prepare("
        SELECT u.id, u.email, u.phone, u.role, u.name, s.expires_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > NOW() AND u.is_active = 1
    ");
    $stmt->execute(array($token));
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonError('Sesja wygasła lub nieprawidłowa', 401);
    }
    
    return $user;
}

/**
 * Sprawdza czy użytkownik jest adminem
 */
function requireAdmin() {
    $user = verifyAuth();
    
    if ($user['role'] !== 'admin') {
        jsonError('Brak uprawnień administratora', 403);
    }
    
    return $user;
}

/**
 * Pobiera dane aktualnie zalogowanego użytkownika
 */
function getCurrentUser() {
    $user = verifyAuth();
    
    jsonResponse(array(
        'id' => (int)$user['id'],
        'email' => $user['email'],
        'phone' => $user['phone'],
        'name' => $user['name'],
        'role' => $user['role']
    ));
}

/**
 * Rejestracja nowego użytkownika (tylko admin)
 */
function doRegister() {
    $admin = requireAdmin();
    
    $data = getJsonInput();
    
    $email = isset($data['email']) ? trim($data['email']) : null;
    $phone = isset($data['phone']) ? trim($data['phone']) : null;
    $password = isset($data['password']) ? $data['password'] : '';
    $name = isset($data['name']) ? trim($data['name']) : '';
    $role = isset($data['role']) ? $data['role'] : 'worker';
    
    if (empty($password) || strlen($password) < 6) {
        jsonError('Hasło musi mieć minimum 6 znaków', 400);
    }
    
    if (empty($name)) {
        jsonError('Podaj imię i nazwisko', 400);
    }
    
    if (empty($email) && empty($phone)) {
        jsonError('Podaj email lub telefon', 400);
    }
    
    if (!in_array($role, array('admin', 'worker', 'print_house'))) {
        $role = 'worker';
    }
    
    $db = getDB();
    
    // Sprawdź czy email/telefon nie jest zajęty
    if ($email) {
        $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute(array($email));
        if ($stmt->fetch()) {
            jsonError('Ten email jest już zarejestrowany', 400);
        }
    }
    
    if ($phone) {
        $stmt = $db->prepare("SELECT id FROM users WHERE phone = ?");
        $stmt->execute(array($phone));
        if ($stmt->fetch()) {
            jsonError('Ten numer telefonu jest już zarejestrowany', 400);
        }
    }
    
    $passwordHash = hashPassword($password);
    
    $stmt = $db->prepare("
        INSERT INTO users (email, phone, password_hash, role, name) 
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute(array($email, $phone, $passwordHash, $role, $name));
    
    $userId = $db->lastInsertId();
    
    logActivity($admin['id'], null, 'user_created', 'Utworzono użytkownika: ' . $name);
    
    jsonResponse(array(
        'success' => true,
        'user_id' => (int)$userId,
        'message' => 'Użytkownik utworzony'
    ), 201);
}

