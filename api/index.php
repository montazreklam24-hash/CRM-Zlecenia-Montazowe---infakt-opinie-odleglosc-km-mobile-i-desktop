<?php
/**
 * CRM Zlecenia Montażowe - API Router
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php'; // Ładuj auth.php zawsze, bo requireAuth() jest używane wszędzie

// Handle CORS
handleCORS();

// Get request path
$requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';

// Dynamically detect base path
$scriptName = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
$basePath = dirname($scriptName);

// Remove base path and query string
$path = parse_url($requestUri, PHP_URL_PATH);
if ($basePath !== '/' && $basePath !== '') {
    $path = preg_replace('#^' . preg_quote($basePath, '#') . '#', '', $path);
}
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
        
    case 'jobs-all':
        // Alias dla /jobs - zachowany dla kompatybilności
        require_once __DIR__ . '/jobs.php';
        getJobs();
        break;
        
    case 'geocode':
        require_once __DIR__ . '/geocode.php';
        break;
        
    case 'clients':
        require_once __DIR__ . '/clients.php';
        handleClients($method, $id);
        break;
        
    case 'invoices':
        require_once __DIR__ . '/invoices.php';
        handleInvoices($method, $id);
        break;
    
    case 'gus':
        require_once __DIR__ . '/gus.php';
        // gus.php ma własny router
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

    case 'import_gmail':
        require_once __DIR__ . '/import_gmail.php';
        // Skrypt import_gmail.php wykonuje się od razu, nie ma funkcji handle...
        break;

    case 'check_missing':
        require_once __DIR__ . '/check_missing_files.php';
        break;
        
    case '':
    case 'status':
    case 'ping':
        // Uruchom migrację tabeli faktur przy okazji statusu
        try {
            $pdo = getDB();
            
            // Sprawdź czy tabela istnieje
            $tableExists = $pdo->query("SHOW TABLES LIKE 'invoices'")->rowCount() > 0;
            
            if (!$tableExists) {
                $pdo->exec("CREATE TABLE invoices (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    job_id VARCHAR(50),
                    infakt_id INT,
                    infakt_number VARCHAR(50),
                    type ENUM('proforma', 'vat') DEFAULT 'proforma',
                    client_id INT,
                    total_net DECIMAL(10,2),
                    total_gross DECIMAL(10,2),
                    status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
                    share_link VARCHAR(255),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            } else {
                // Tabela istnieje - sprawdź czy ma wszystkie kolumny
                $columns = $pdo->query("SHOW COLUMNS FROM invoices")->fetchAll(PDO::FETCH_COLUMN);
                
                if (!in_array('total_net', $columns)) {
                    $pdo->exec("ALTER TABLE invoices ADD COLUMN total_net DECIMAL(10,2) DEFAULT 0");
                }
                if (!in_array('total_gross', $columns)) {
                    $pdo->exec("ALTER TABLE invoices ADD COLUMN total_gross DECIMAL(10,2) DEFAULT 0");
                }
                if (!in_array('share_link', $columns)) {
                    $pdo->exec("ALTER TABLE invoices ADD COLUMN share_link VARCHAR(255)");
                }
                if (!in_array('status', $columns)) {
                    $pdo->exec("ALTER TABLE invoices ADD COLUMN status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending'");
                }
                
                // Napraw kolumnę type - zmień z VARCHAR na ENUM
                $pdo->exec("ALTER TABLE invoices MODIFY COLUMN type VARCHAR(20) DEFAULT 'proforma'");
                
                // Usuń foreign key constraint jeśli istnieje
                try {
                    $pdo->exec("ALTER TABLE invoices DROP FOREIGN KEY invoices_ibfk_1");
                } catch (Exception $e) {}
            }
        } catch (Exception $e) {}

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