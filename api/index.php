<?php
/**
 * CRM Zlecenia Montażowe - API Router
 * PHP 5.6 Compatible
 * 
 * Endpointy:
 * GET    /api/ping           - Health check dla Chrome Extension
 * POST   /api/login          - Logowanie
 * POST   /api/logout         - Wylogowanie
 * GET    /api/me             - Dane zalogowanego użytkownika
 * 
 * GET    /api/jobs           - Lista zleceń
 * GET    /api/jobs/{id}      - Szczegóły zlecenia
 * POST   /api/jobs           - Nowe zlecenie
 * PUT    /api/jobs/{id}      - Aktualizacja zlecenia
 * DELETE /api/jobs/{id}      - Usunięcie zlecenia
 * 
 * GET    /api/clients        - Lista klientów
 * GET    /api/clients/{id}   - Szczegóły klienta
 * POST   /api/clients        - Nowy klient
 * PUT    /api/clients/{id}   - Aktualizacja klienta
 * DELETE /api/clients/{id}   - Usunięcie klienta
 * POST   /api/clients/gus    - Pobierz dane firmy z GUS po NIP
 * 
 * GET    /api/invoices       - Lista faktur
 * GET    /api/invoices/{id}  - Szczegóły faktury
 * POST   /api/invoices       - Nowa faktura (wysyła do inFakt)
 * PUT    /api/invoices/{id}  - Aktualizacja faktury
 * DELETE /api/invoices/{id}  - Usunięcie faktury
 * POST   /api/invoices/{id}/send  - Wyślij fakturę emailem
 * GET    /api/invoices/{id}/pdf   - Pobierz PDF faktury
 * 
 * GET    /api/offers         - Lista ofert
 * POST   /api/offers         - Nowa oferta
 * 
 * POST   /api/gemini         - Proxy do Gemini API
 */

require_once __DIR__ . '/config.php';

// Obsługa CORS
handleCORS();

// Parsowanie ścieżki
$requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Usuń query string i prefix /api
$path = parse_url($requestUri, PHP_URL_PATH);
$path = preg_replace('#^.*/api#', '', $path);
$path = trim($path, '/');

// Parsuj segmenty ścieżki
$segments = $path ? explode('/', $path) : array();
$resource = isset($segments[0]) ? $segments[0] : '';
$resourceId = isset($segments[1]) ? $segments[1] : null;

// Routing
try {
    switch ($resource) {
        case '':
        case 'status':
            // Health check
            jsonResponse(array(
                'status' => 'ok',
                'version' => '2.0',
                'timestamp' => date('c')
            ));
            break;
        
        case 'ping':
            // Health check dla Chrome Extension (wymaga autoryzacji)
            require_once __DIR__ . '/auth.php';
            $user = requireAuth();
            jsonResponse(array(
                'status' => 'ok',
                'user' => array(
                    'id' => $user['id'],
                    'name' => $user['name'],
                    'role' => $user['role']
                )
            ));
            break;
            
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
            
        case 'jobs':
            require_once __DIR__ . '/jobs.php';
            handleJobs($requestMethod, $resourceId);
            break;
        
        case 'clients':
            require_once __DIR__ . '/clients.php';
            // Specjalny endpoint dla GUS
            if ($resourceId === 'gus' && $requestMethod === 'POST') {
                handleGusLookup();
            } else {
                handleClients($requestMethod, $resourceId);
            }
            break;
        
        case 'invoices':
            require_once __DIR__ . '/invoices.php';
            // Specjalne endpointy dla faktur
            if (isset($segments[2])) {
                $action = $segments[2];
                if ($action === 'send' && $requestMethod === 'POST') {
                    sendInvoiceEmail($resourceId);
                } elseif ($action === 'pdf' && $requestMethod === 'GET') {
                    getInvoicePdf($resourceId);
                } else {
                    jsonResponse(array('error' => 'Not Found'), 404);
                }
            } else {
                handleInvoices($requestMethod, $resourceId);
            }
            break;
        
        case 'offers':
            require_once __DIR__ . '/offers.php';
            handleOffers($requestMethod, $resourceId);
            break;
            
        case 'gemini':
            require_once __DIR__ . '/gemini.php';
            handleGemini();
            break;
            
        case 'users':
            require_once __DIR__ . '/users.php';
            handleUsers($requestMethod, $resourceId);
            break;
            
        case 'settings':
            require_once __DIR__ . '/settings.php';
            handleSettings($requestMethod);
            break;
            
        default:
            jsonResponse(array('error' => 'Not Found', 'path' => $path), 404);
    }
} catch (PDOException $e) {
    logError('Database error: ' . $e->getMessage());
    jsonResponse(array('error' => 'Database error'), 500);
} catch (Exception $e) {
    logError('Server error: ' . $e->getMessage());
    jsonResponse(array('error' => 'Server error', 'message' => DEV_MODE ? $e->getMessage() : 'Internal error'), 500);
}

