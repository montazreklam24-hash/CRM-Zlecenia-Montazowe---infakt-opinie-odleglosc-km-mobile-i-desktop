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
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
    
    // Zapisz sesję
    $stmt = $pdo->prepare('
        INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, ?)
    ');
    $stmt->execute(array(
        $user['id'],
        $token,
        isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : null,
        isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 255) : null,
        $expiresAt
    ));
    
    // Aktualizuj last_login
    $stmt = $pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?');
    $stmt->execute(array($user['id']));
    
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



