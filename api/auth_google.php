<?php
/**
 * Google OAuth - Logowanie przez Google
 */

require_once __DIR__ . '/config.php';

handleCORS();

// Krok 1: Przekieruj do Google
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !isset($_GET['code'])) {
    $clientId = GOOGLE_OAUTH_CLIENT_ID;
    $redirectUri = GOOGLE_OAUTH_REDIRECT_URI;
    $scope = 'openid email profile';
    
    if (empty($clientId)) {
        jsonResponse(['error' => 'Google OAuth nie jest skonfigurowany'], 500);
    }
    
    $authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" . http_build_query([
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => $scope,
        'access_type' => 'online',
        'prompt' => 'select_account'
    ]);
    
    header('Location: ' . $authUrl);
    exit;
}

// Krok 2: Odbierz kod i wymień na token
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['code'])) {
    $code = $_GET['code'];
    
    if (empty(GOOGLE_OAUTH_CLIENT_ID) || empty(GOOGLE_OAUTH_CLIENT_SECRET)) {
        jsonResponse(['error' => 'Google OAuth nie jest skonfigurowany'], 500);
    }
    
    // Wymień kod na token
    $tokenUrl = 'https://oauth2.googleapis.com/token';
    $data = [
        'code' => $code,
        'client_id' => GOOGLE_OAUTH_CLIENT_ID,
        'client_secret' => GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri' => GOOGLE_OAUTH_REDIRECT_URI,
        'grant_type' => 'authorization_code'
    ];
    
    $ch = curl_init($tokenUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        error_log("Google OAuth token error: " . $response);
        jsonResponse(['error' => 'Nie udało się uzyskać tokenu z Google'], 400);
    }
    
    $tokenData = json_decode($response, true);
    
    if (!isset($tokenData['access_token'])) {
        error_log("Google OAuth response: " . $response);
        jsonResponse(['error' => 'Nie udało się uzyskać tokenu'], 400);
    }
    
    // Pobierz dane użytkownika z Google
    $userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo?access_token=' . $tokenData['access_token'];
    $userInfoResponse = @file_get_contents($userInfoUrl);
    
    if (!$userInfoResponse) {
        jsonResponse(['error' => 'Nie udało się pobrać danych użytkownika'], 400);
    }
    
    $userInfo = json_decode($userInfoResponse, true);
    
    if (!isset($userInfo['email'])) {
        error_log("Google user info: " . $userInfoResponse);
        jsonResponse(['error' => 'Nie udało się pobrać danych użytkownika'], 400);
    }
    
    // Znajdź lub utwórz użytkownika w bazie
    $pdo = getDB();
    
    // Najpierw sprawdź czy istnieje użytkownik z tym google_id
    $stmt = $pdo->prepare('SELECT * FROM users WHERE google_id = ?');
    $stmt->execute([$userInfo['id']]);
    $user = $stmt->fetch();
    
    // Jeśli nie, szukaj po emailu
    if (!$user) {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$userInfo['email']]);
        $user = $stmt->fetch();
        
        if ($user) {
            // Zaktualizuj google_id dla istniejącego użytkownika
            try {
                $stmt = $pdo->prepare('UPDATE users SET google_id = ? WHERE id = ?');
                $stmt->execute([$userInfo['id'], $user['id']]);
            } catch (Exception $e) {
                // Jeśli kolumna nie istnieje, zignoruj błąd
                error_log("Nie można zaktualizować google_id: " . $e->getMessage());
            }
        }
    }
    
    if (!$user) {
        // Utwórz nowego użytkownika
        $name = $userInfo['name'] ?? $userInfo['email'];
        
        try {
            $stmt = $pdo->prepare('
                INSERT INTO users (email, name, role, is_active, google_id, created_at)
                VALUES (?, ?, ?, 1, ?, NOW())
            ');
            $stmt->execute([
                $userInfo['email'],
                $name,
                'user', // Domyślna rola
                $userInfo['id']
            ]);
            
            $userId = $pdo->lastInsertId();
            
            // Pobierz utworzonego użytkownika
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
        } catch (Exception $e) {
            // Jeśli kolumna google_id nie istnieje, spróbuj bez niej
            error_log("Błąd tworzenia użytkownika z google_id: " . $e->getMessage());
            $stmt = $pdo->prepare('
                INSERT INTO users (email, name, role, is_active, created_at)
                VALUES (?, ?, ?, 1, NOW())
            ');
            $stmt->execute([
                $userInfo['email'],
                $name,
                'user'
            ]);
            
            $userId = $pdo->lastInsertId();
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
        }
    }
    
    // Sprawdź czy użytkownik jest aktywny
    if (!$user['is_active']) {
        jsonResponse(['error' => 'Konto zostało zablokowane'], 403);
    }
    
    // Utwórz sesję (jak w zwykłym logowaniu)
    $token = generateToken(SESSION_TOKEN_LENGTH);
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
    
    $stmt = $pdo->prepare('
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
    ');
    $stmt->execute([$user['id'], $token, $expiresAt]);
    
    // Przekieruj do frontendu z tokenem
    $frontendUrl = str_replace('/api/auth/google/callback', '', GOOGLE_OAUTH_REDIRECT_URI);
    $frontendUrl = rtrim($frontendUrl, '/');
    
    header('Location: ' . $frontendUrl . '/?token=' . $token . '&google_login=1');
    exit;
}

// Jeśli błąd z Google
if (isset($_GET['error'])) {
    $error = $_GET['error'];
    $frontendUrl = str_replace('/api/auth/google/callback', '', GOOGLE_OAUTH_REDIRECT_URI);
    $frontendUrl = rtrim($frontendUrl, '/');
    header('Location: ' . $frontendUrl . '/?error=' . urlencode('Logowanie przez Google nie powiodło się: ' . $error));
    exit;
}

