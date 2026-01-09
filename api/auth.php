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

/**
 * POST /api/forgot-password
 * Body: { "login": "email lub telefon" }
 */
function handleForgotPassword() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(array('error' => 'Method not allowed'), 405);
    }
    
    $input = getJsonInput();
    $login = isset($input['login']) ? trim($input['login']) : '';
    
    if (empty($login)) {
        jsonResponse(array('error' => 'Podaj email lub telefon'), 400);
    }
    
    $pdo = getDB();
    
    // Szukaj użytkownika
    $stmt = $pdo->prepare('SELECT id, email, name FROM users WHERE (email = ? OR phone = ?) AND is_active = 1');
    $stmt->execute(array($login, $login));
    $user = $stmt->fetch();
    
    if (!$user || empty($user['email'])) {
        // Dla bezpieczeństwa nie informujemy czy user istnieje, chyba że nie ma maila
        if ($user && empty($user['email'])) {
             jsonResponse(array('error' => 'Użytkownik nie posiada przypisanego adresu email. Skontaktuj się z administratorem.'), 400);
        }
        jsonResponse(array('success' => true, 'message' => 'Jeśli użytkownik istnieje, instrukcja została wysłana.'));
    }
    
    // Generuj nowe hasło
    $newPassword = substr(str_shuffle('abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 8);
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, array('cost' => PASSWORD_COST));
    
    // Zaktualizuj w bazie
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt->execute(array($newHash, $user['id']));
    
    // Wyślij email
    $to = $user['email'];
    $subject = "Reset hasła - CRM Montaż Reklam 24";
    
    error_log("Attempting password reset for: " . $to);
    
    $htmlContent = "
    <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
        <h2 style='color: #f97316;'>Reset hasła w CRM</h2>
        <p>Witaj <strong>{$user['name']}</strong>,</p>
        <p>Twoje hasło do systemu CRM zostało zresetowane zgodnie z prośbą.</p>
        <div style='background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee; text-align: center;'>
            <p style='margin: 0; color: #666; font-size: 14px;'>Twoje nowe hasło tymczasowe:</p>
            <p style='margin: 10px 0 0; font-size: 24px; font-weight: bold; color: #000; letter-spacing: 2px;'>$newPassword</p>
        </div>
        <p>Zaloguj się używając powyższego hasła, a następnie <strong>niezwłocznie zmień je w ustawieniach swojego profilu</strong>.</p>
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        <p style='font-size: 12px; color: #999; text-align: center;'>
            To jest wiadomość automatyczna, prosimy na nią nie odpowiadać.<br>
            Montaż Reklam 24
        </p>
    </div>";

    // Wykorzystujemy PHPMailer jeśli jest dostępny
    $sent = false;
    $autoloadPath = null;
    if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
        $autoloadPath = __DIR__ . '/../vendor/autoload.php';
    } elseif (file_exists(__DIR__ . '/vendor/autoload.php')) {
        $autoloadPath = __DIR__ . '/vendor/autoload.php';
    }

    if ($autoloadPath) {
        @require_once $autoloadPath;
        if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
            error_log("PHPMailer class found, initializing...");
            try {
                $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                $mail->isSMTP();
                $mail->Host = SMTP_HOST;
                $mail->SMTPAuth = true;
                $mail->Username = SMTP_USERNAME;
                $mail->Password = SMTP_PASSWORD;
                $mail->SMTPSecure = SMTP_SECURE;
                $mail->Port = SMTP_PORT;
                $mail->CharSet = 'UTF-8';
                $mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
                $mail->addAddress($to);
                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body = $htmlContent;
                $mail->AltBody = strip_tags($htmlContent);
                $mail->send();
                $sent = true;
                error_log("PHPMailer: Email sent successfully to " . $to);
            } catch (Exception $e) {
                error_log("PHPMailer Error (forgot password): " . $e->getMessage());
            }
        }
    }
    
    // Fallback do mail()
    if (!$sent) {
        error_log("PHPMailer failed, trying fallback mail()...");
        $headers = array();
        $headers[] = "From: " . SMTP_FROM_NAME . " <" . SMTP_FROM_EMAIL . ">";
        $headers[] = "Content-Type: text/html; charset=UTF-8";
        $headersStr = implode("\r\n", $headers);
        $sent = @mail($to, "=?UTF-8?B?" . base64_encode($subject) . "?=", $htmlContent, $headersStr);
    }
    
    jsonResponse(array('success' => true, 'message' => 'Jeśli użytkownik istnieje, instrukcja została wysłana.'));
}

// =========================================================================
// FUNKCJE POMOCNICZE AUTORYZACJI
// =========================================================================

/**
 * Sprawdź autoryzację (Token sesji lub API Secret)
 */
function requireAuth() {
    // 0. Sprawdź czy włączony jest BYPASS (tryb bez logowania)
    if (defined('BYPASS_AUTH') && BYPASS_AUTH === true) {
        return array(
            'id' => 1,
            'role' => 'admin',
            'name' => 'Użytkownik',
            'email' => 'admin@montazreklam24.pl'
        );
    }

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
 * Wymaga uprawnień administratora
 */
function requireAdmin() {
    $user = requireAuth();
    if ($user['role'] !== 'admin') {
        jsonResponse(array('error' => 'Dostęp tylko dla administratora'), 403);
    }
    return $user;
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