<?php
/**
 * CRM Zlecenia Montażowe - Zarządzanie użytkownikami
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';

/**
 * Router dla /api/users
 */
function handleUsers($method, $id = null) {
    switch ($method) {
        case 'GET':
            if ($id) {
                getUser($id);
            } else {
                getUsers();
            }
            break;
        case 'POST':
            createUser();
            break;
        case 'PUT':
            if (!$id) {
                jsonResponse(array('error' => 'User ID required'), 400);
            }
            updateUser($id);
            break;
        case 'DELETE':
            if (!$id) {
                jsonResponse(array('error' => 'User ID required'), 400);
            }
            deleteUser($id);
            break;
        default:
            jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}

/**
 * GET /api/users
 */
function getUsers() {
    $user = requireAdmin();
    $pdo = getDB();
    
    $stmt = $pdo->query('
        SELECT id, email, phone, role, name, is_active, last_login, created_at
        FROM users
        ORDER BY created_at DESC
    ');
    $users = $stmt->fetchAll();
    
    jsonResponse(array('success' => true, 'users' => $users));
}

/**
 * GET /api/users/{id}
 */
function getUser($id) {
    $user = requireAdmin();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('
        SELECT id, email, phone, role, name, is_active, last_login, created_at
        FROM users WHERE id = ?
    ');
    $stmt->execute(array($id));
    $userData = $stmt->fetch();
    
    if (!$userData) {
        jsonResponse(array('error' => 'Użytkownik nie istnieje'), 404);
    }
    
    jsonResponse(array('success' => true, 'user' => $userData));
}

/**
 * POST /api/users
 */
function createUser() {
    $user = requireAdmin();
    $input = getJsonInput();
    
    // Walidacja
    $email = isset($input['email']) ? trim($input['email']) : null;
    $phone = isset($input['phone']) ? trim($input['phone']) : null;
    $password = isset($input['password']) ? $input['password'] : '';
    $name = isset($input['name']) ? trim($input['name']) : '';
    $role = isset($input['role']) ? $input['role'] : 'worker';
    
    if (empty($email) && empty($phone)) {
        jsonResponse(array('error' => 'Podaj email lub telefon'), 400);
    }
    
    if (empty($password) || strlen($password) < 6) {
        jsonResponse(array('error' => 'Hasło musi mieć min. 6 znaków'), 400);
    }
    
    if (empty($name)) {
        jsonResponse(array('error' => 'Podaj imię i nazwisko'), 400);
    }
    
    if (!in_array($role, array('admin', 'worker', 'printer'))) {
        jsonResponse(array('error' => 'Nieprawidłowa rola'), 400);
    }
    
    $pdo = getDB();
    
    // Sprawdź unikalność
    if ($email) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute(array($email));
        if ($stmt->fetch()) {
            jsonResponse(array('error' => 'Email już istnieje'), 400);
        }
    }
    
    if ($phone) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ?');
        $stmt->execute(array($phone));
        if ($stmt->fetch()) {
            jsonResponse(array('error' => 'Telefon już istnieje'), 400);
        }
    }
    
    // Hash hasła
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, array('cost' => PASSWORD_COST));
    
    // Wstaw użytkownika
    $stmt = $pdo->prepare('
        INSERT INTO users (email, phone, password_hash, role, name)
        VALUES (?, ?, ?, ?, ?)
    ');
    $stmt->execute(array($email, $phone, $passwordHash, $role, $name));
    
    $newId = $pdo->lastInsertId();
    
    jsonResponse(array(
        'success' => true, 
        'message' => 'Użytkownik utworzony',
        'user' => array(
            'id' => $newId,
            'email' => $email,
            'phone' => $phone,
            'role' => $role,
            'name' => $name
        )
    ), 201);
}

/**
 * PUT /api/users/{id}
 */
function updateUser($id) {
    $user = requireAdmin();
    $input = getJsonInput();
    $pdo = getDB();
    
    // Sprawdź czy istnieje
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute(array($id));
    $userData = $stmt->fetch();
    
    if (!$userData) {
        jsonResponse(array('error' => 'Użytkownik nie istnieje'), 404);
    }
    
    $updates = array();
    $params = array();
    
    // Aktualizuj dozwolone pola
    if (isset($input['email'])) {
        // Sprawdź unikalność
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $stmt->execute(array($input['email'], $id));
        if ($stmt->fetch()) {
            jsonResponse(array('error' => 'Email już istnieje'), 400);
        }
        $updates[] = 'email = ?';
        $params[] = $input['email'];
    }
    
    if (isset($input['phone'])) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND id != ?');
        $stmt->execute(array($input['phone'], $id));
        if ($stmt->fetch()) {
            jsonResponse(array('error' => 'Telefon już istnieje'), 400);
        }
        $updates[] = 'phone = ?';
        $params[] = $input['phone'];
    }
    
    if (isset($input['name'])) {
        $updates[] = 'name = ?';
        $params[] = $input['name'];
    }
    
    if (isset($input['role']) && in_array($input['role'], array('admin', 'worker', 'printer'))) {
        $updates[] = 'role = ?';
        $params[] = $input['role'];
    }
    
    if (isset($input['is_active'])) {
        $updates[] = 'is_active = ?';
        $params[] = $input['is_active'] ? 1 : 0;
    }
    
    if (isset($input['password']) && strlen($input['password']) >= 6) {
        $updates[] = 'password_hash = ?';
        $params[] = password_hash($input['password'], PASSWORD_BCRYPT, array('cost' => PASSWORD_COST));
    }
    
    if (count($updates) > 0) {
        $params[] = $id;
        $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    jsonResponse(array('success' => true, 'message' => 'Użytkownik zaktualizowany'));
}

/**
 * DELETE /api/users/{id}
 */
function deleteUser($id) {
    $user = requireAdmin();
    $pdo = getDB();
    
    // Nie pozwól usunąć siebie
    if ($id == $user['id']) {
        jsonResponse(array('error' => 'Nie możesz usunąć siebie'), 400);
    }
    
    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute(array($id));
    
    jsonResponse(array('success' => true, 'message' => 'Użytkownik usunięty'));
}

