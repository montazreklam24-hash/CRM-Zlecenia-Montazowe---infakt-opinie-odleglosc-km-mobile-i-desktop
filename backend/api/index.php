<?php
/**
 * CRM Zlecenia Montażowe - Router API
 * PHP 5.6 Compatible
 */

define('CRM_LOADED', true);
require_once __DIR__ . '/../config.php';

// Ustaw nagłówki CORS
setCorsHeaders();

// Pobierz ścieżkę i metodę
$requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
$method = $_SERVER['REQUEST_METHOD'];

// Usuń bazową ścieżkę API
$basePath = '/api';
$path = parse_url($requestUri, PHP_URL_PATH);
$path = str_replace($basePath, '', $path);
$path = trim($path, '/');

// Rozbij ścieżkę na segmenty
$segments = $path ? explode('/', $path) : array();
$endpoint = isset($segments[0]) ? $segments[0] : '';
$id = isset($segments[1]) ? $segments[1] : null;

// ============================================
// ROUTING
// ============================================

switch ($endpoint) {
    case '':
    case 'index.php':
        // Info o API
        jsonResponse(array(
            'name' => APP_NAME,
            'version' => APP_VERSION,
            'status' => 'ok',
            'endpoints' => array(
                'POST /api/auth/login' => 'Logowanie',
                'POST /api/auth/logout' => 'Wylogowanie',
                'GET /api/auth/me' => 'Dane zalogowanego użytkownika',
                'GET /api/jobs' => 'Lista zleceń',
                'GET /api/jobs/{id}' => 'Szczegóły zlecenia',
                'POST /api/jobs' => 'Tworzenie zlecenia',
                'PUT /api/jobs/{id}' => 'Aktualizacja zlecenia',
                'DELETE /api/jobs/{id}' => 'Usunięcie zlecenia',
                'POST /api/gemini' => 'Proxy do Gemini AI'
            )
        ));
        break;
        
    case 'auth':
        require_once __DIR__ . '/auth.php';
        handleAuth($method, $id);
        break;
        
    case 'jobs':
        require_once __DIR__ . '/jobs.php';
        handleJobs($method, $id);
        break;
        
    case 'gemini':
        require_once __DIR__ . '/gemini.php';
        handleGemini($method);
        break;
        
    case 'upload':
        require_once __DIR__ . '/upload.php';
        handleUpload($method);
        break;
        
    default:
        jsonError('Endpoint nie znaleziony: ' . $endpoint, 404);
}

