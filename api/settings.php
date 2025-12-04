<?php
/**
 * CRM Zlecenia Montażowe - Ustawienia
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';

/**
 * Router dla /api/settings
 */
function handleSettings($method) {
    switch ($method) {
        case 'GET':
            getSettings();
            break;
        case 'PUT':
        case 'POST':
            updateSettings();
            break;
        default:
            jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}

/**
 * GET /api/settings
 */
function getSettings() {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->query('SELECT `key`, `value` FROM settings');
    $rows = $stmt->fetchAll();
    
    $settings = array();
    foreach ($rows as $row) {
        $settings[$row['key']] = $row['value'];
    }
    
    jsonResponse(array('success' => true, 'settings' => $settings));
}

/**
 * PUT /api/settings
 */
function updateSettings() {
    $user = requireAdmin();
    $input = getJsonInput();
    $pdo = getDB();
    
    $allowedKeys = array('app_name', 'default_logo', 'base_address', 'gemini_model');
    
    foreach ($input as $key => $value) {
        if (in_array($key, $allowedKeys)) {
            $stmt = $pdo->prepare('
                INSERT INTO settings (`key`, `value`) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)
            ');
            $stmt->execute(array($key, $value));
        }
    }
    
    jsonResponse(array('success' => true, 'message' => 'Ustawienia zapisane'));
}

