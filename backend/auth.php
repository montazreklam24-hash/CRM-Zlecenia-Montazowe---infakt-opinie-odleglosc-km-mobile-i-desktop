<?php
/**
 * CRM Zlecenia Montażowe - Autoryzacja
 * Kompatybilny z PHP 5.6
 */

/**
 * Logowanie użytkownika
 */
function handleLogin() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    $data = getRequestBody();
    $login = isset($data['login']) ? sanitize($data['login']) : '';
    $password = isset($data['password']) ? $data['password'] : '';
    
    if (empty($login) || empty($password)) {
        errorResponse('Login i hasło są wymagane', 400);
    }
    
    $pdo = getDB();
    
    // Szukaj po emailu lub telefonie
    $stmt = $pdo->prepare("
        SELECT * FROM users 
        WHERE (email = ? OR phone = ?) AND is_active = 1
    ");
    $stmt->execute(array($login, $login));
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($password, $user['password_hash'])) {
        errorResponse('Nieprawidłowy login lub hasło', 401);
    }
    
    // Generuj token sesji
    $token = generateToken();
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
    $ipAddress = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : null;
    $userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : null;
    
    // Zapisz sesję
    $stmt = $pdo->prepare("
        INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute(array($user['id'], $token, $expiresAt, $ipAddress, $userAgent));
    
    // Aktualizuj last_login
    $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $stmt->execute(array($user['id']));
    
    // Usuń stare sesje tego użytkownika (max 5)
    $stmt = $pdo->prepare("
        DELETE FROM sessions 
        WHERE user_id = ? AND id NOT IN (
            SELECT id FROM (
                SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
            ) as t
        )
    ");
    $stmt->execute(array($user['id'], $user['id']));
    
    // Ustaw cookie
    setcookie('auth_token', $token, time() + SESSION_LIFETIME, '/', '', false, true);
    
    jsonResponse(array(
        'success' => true,
        'token' => $token,
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
function handleLogout() {
    $headers = array();
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    }
    
    $token = null;
    if (isset($headers['Authorization'])) {
        if (preg_match('/Bearer\s+(.+)$/i', $headers['Authorization'], $matches)) {
            $token = $matches[1];
        }
    }
    if (!$token && isset($_COOKIE['auth_token'])) {
        $token = $_COOKIE['auth_token'];
    }
    
    if ($token) {
        $pdo = getDB();
        $stmt = $pdo->prepare("DELETE FROM sessions WHERE token = ?");
        $stmt->execute(array($token));
    }
    
    // Usuń cookie
    setcookie('auth_token', '', time() - 3600, '/', '', false, true);
    
    jsonResponse(array('success' => true));
}

/**
 * Pobierz dane aktualnego użytkownika
 */
function handleMe() {
    $user = requireAuth();
    
    jsonResponse(array(
        'id' => (int)$user['id'],
        'email' => $user['email'],
        'phone' => $user['phone'],
        'name' => $user['name'],
        'role' => $user['role'],
        'created_at' => $user['created_at'],
        'last_login' => $user['last_login']
    ));
}

/**
 * Rejestracja nowego użytkownika (tylko admin)
 */
function handleRegister() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        errorResponse('Method not allowed', 405);
    }
    
    // Tylko admin może dodawać użytkowników
    $admin = requireAdmin();
    
    $data = getRequestBody();
    
    $email = isset($data['email']) ? sanitize($data['email']) : null;
    $phone = isset($data['phone']) ? sanitize($data['phone']) : null;
    $password = isset($data['password']) ? $data['password'] : '';
    $name = isset($data['name']) ? sanitize($data['name']) : '';
    $role = isset($data['role']) ? $data['role'] : 'worker';
    
    // Walidacja
    if (empty($email) && empty($phone)) {
        errorResponse('Email lub telefon jest wymagany', 400);
    }
    if (empty($password) || strlen($password) < 6) {
        errorResponse('Hasło musi mieć minimum 6 znaków', 400);
    }
    if (empty($name)) {
        errorResponse('Imię jest wymagane', 400);
    }
    if (!in_array($role, array('admin', 'worker'))) {
        errorResponse('Nieprawidłowa rola', 400);
    }
    
    $pdo = getDB();
    
    // Sprawdź czy email/telefon już istnieje
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? OR phone = ?");
    $stmt->execute(array($email, $phone));
    if ($stmt->fetch()) {
        errorResponse('Użytkownik o tym emailu lub telefonie już istnieje', 409);
    }
    
    // Hash hasła
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    
    // Wstaw użytkownika
    $stmt = $pdo->prepare("
        INSERT INTO users (email, phone, password_hash, role, name)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute(array($email, $phone, $passwordHash, $role, $name));
    
    $userId = $pdo->lastInsertId();
    
    jsonResponse(array(
        'success' => true,
        'user' => array(
            'id' => (int)$userId,
            'email' => $email,
            'phone' => $phone,
            'name' => $name,
            'role' => $role
        )
    ), 201);
}

