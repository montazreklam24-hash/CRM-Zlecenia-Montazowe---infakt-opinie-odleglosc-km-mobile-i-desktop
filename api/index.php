<?php
/**
 * CRM Zlecenia Montażowe - API Router
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';

// Handle CORS
handleCORS();

// Get request path
$requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
$basePath = '/crm-api';

// Remove base path and query string
$path = parse_url($requestUri, PHP_URL_PATH);
$path = str_replace($basePath, '', $path);
$path = trim($path, '/');

// Get ID from path if present (e.g., jobs/123)
$pathParts = explode('/', $path);
$endpoint = isset($pathParts[0]) ? $pathParts[0] : '';
$id = isset($pathParts[1]) ? $pathParts[1] : null;

$method = $_SERVER['REQUEST_METHOD'];

// Route to appropriate handler
switch ($endpoint) {
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
        
    case 'change-password':
        require_once __DIR__ . '/auth.php';
        handleChangePassword();
        break;
        
    case 'jobs':
        require_once __DIR__ . '/jobs.php';
        handleJobs($method, $id);
        break;
        
    case 'clients':
        require_once __DIR__ . '/clients.php';
        handleClients($method, $id);
        break;
        
    case 'invoices':
        require_once __DIR__ . '/invoices.php';
        handleInvoices($method, $id);
        break;
        
    case 'offers':
        require_once __DIR__ . '/offers.php';
        handleOffers($method, $id);
        break;
        
    case 'gemini':
        require_once __DIR__ . '/gemini.php';
        handleGemini();
        break;
        
    case 'settings':
        require_once __DIR__ . '/settings.php';
        handleSettings($method);
        break;
        
    case '':
    case 'status':
        // Health check
        jsonResponse(array(
            'status' => 'ok',
            'version' => '2.0',
            'timestamp' => date('c'),
            'php_version' => PHP_VERSION
        ));
        break;
        
    default:
        jsonResponse(array('error' => 'Endpoint not found: ' . $endpoint), 404);
}
