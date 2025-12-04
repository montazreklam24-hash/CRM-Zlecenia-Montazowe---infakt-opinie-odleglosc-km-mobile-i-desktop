<?php
/**
 * CRM Zlecenia Montażowe - Router API
 * Kompatybilny z PHP 5.6
 */

require_once __DIR__ . '/config.php';

// =====================================================
// CORS Headers
// =====================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, CORS_ALLOWED_ORIGINS)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');

// Obsługa preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// =====================================================
// ROUTING
// =====================================================
$requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Usuń query string i bazowy path
$path = parse_url($requestUri, PHP_URL_PATH);
$path = preg_replace('#^/api#', '', $path);
$path = preg_replace('#^/backend#', '', $path);
$path = trim($path, '/');

// Parsuj segmenty
$segments = $path ? explode('/', $path) : array();
$resource = isset($segments[0]) ? $segments[0] : '';
$id = isset($segments[1]) ? $segments[1] : null;
$action = isset($segments[2]) ? $segments[2] : null;

// =====================================================
// AUTORYZACJA
// =====================================================
function getCurrentUser() {
    $headers = array();
    
    // Pobierz nagłówki (różne metody dla różnych serwerów)
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    } else {
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
                $headers[$header] = $value;
            }
        }
    }
    
    $token = null;
    
    // Sprawdź Authorization header
    if (isset($headers['Authorization'])) {
        if (preg_match('/Bearer\s+(.+)$/i', $headers['Authorization'], $matches)) {
            $token = $matches[1];
        }
    }
    
    // Fallback na cookie
    if (!$token && isset($_COOKIE['auth_token'])) {
        $token = $_COOKIE['auth_token'];
    }
    
    if (!$token) {
        return null;
    }
    
    // Sprawdź token w bazie
    $pdo = getDB();
    $stmt = $pdo->prepare("
        SELECT u.* FROM users u
        JOIN sessions s ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > NOW() AND u.is_active = 1
    ");
    $stmt->execute(array($token));
    
    return $stmt->fetch();
}

function requireAuth() {
    $user = getCurrentUser();
    if (!$user) {
        errorResponse('Unauthorized', 401);
    }
    return $user;
}

function requireAdmin() {
    $user = requireAuth();
    if ($user['role'] !== 'admin') {
        errorResponse('Forbidden - Admin required', 403);
    }
    return $user;
}

// =====================================================
// ENDPOINTY
// =====================================================

try {
    switch ($resource) {
        
        // ----- AUTH -----
        case 'login':
            require_once __DIR__ . '/auth.php';
            handleLogin();
            break;
            
        case 'logout':
            require_once __DIR__ . '/auth.php';
            handleLogout();
            break;
            
        case 'me':
            require_once __DIR__ . '/auth.php';
            handleMe();
            break;
            
        case 'register':
            require_once __DIR__ . '/auth.php';
            handleRegister();
            break;
        
        // ----- JOBS -----
        case 'jobs':
            require_once __DIR__ . '/jobs.php';
            
            if ($requestMethod === 'GET' && !$id) {
                handleGetJobs();
            } elseif ($requestMethod === 'GET' && $id) {
                handleGetJob($id);
            } elseif ($requestMethod === 'POST' && !$id) {
                handleCreateJob();
            } elseif ($requestMethod === 'PUT' && $id) {
                handleUpdateJob($id);
            } elseif ($requestMethod === 'DELETE' && $id) {
                handleDeleteJob($id);
            } elseif ($requestMethod === 'POST' && $id === 'duplicate') {
                handleDuplicateJob($action); // action = jobId
            } else {
                errorResponse('Invalid request', 400);
            }
            break;
        
        // ----- GEMINI AI -----
        case 'gemini':
            require_once __DIR__ . '/gemini.php';
            handleGeminiRequest();
            break;
        
        // ----- IMAGES -----
        case 'images':
            require_once __DIR__ . '/images.php';
            
            if ($requestMethod === 'POST') {
                handleUploadImage();
            } elseif ($requestMethod === 'DELETE' && $id) {
                handleDeleteImage($id);
            } else {
                errorResponse('Invalid request', 400);
            }
            break;
        
        // ----- HEALTH CHECK -----
        case 'health':
        case '':
            jsonResponse(array(
                'status' => 'ok',
                'version' => '1.0.0',
                'php' => PHP_VERSION,
                'time' => date('Y-m-d H:i:s')
            ));
            break;
        
        default:
            errorResponse('Endpoint not found', 404);
    }
    
} catch (PDOException $e) {
    logError('Database error: ' . $e->getMessage());
    errorResponse('Database error', 500);
} catch (Exception $e) {
    logError('Error: ' . $e->getMessage());
    errorResponse($e->getMessage(), 500);
}

