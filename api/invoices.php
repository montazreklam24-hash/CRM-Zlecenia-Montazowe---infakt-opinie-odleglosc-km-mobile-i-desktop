<?php
/**
 * API Faktur - endpoint dla modułu fakturowania CRM
 * Integracja z InfaktClient.php
 * 
 * Endpoints:
 *   POST /api/invoices/proforma  - Utwórz proformę
 *   POST /api/invoices/invoice   - Utwórz fakturę VAT
 *   POST /api/invoices/send      - Wyślij fakturę emailem
 *   GET  /api/invoices/{id}      - Pobierz dane faktury
 *   GET  /api/invoices/pdf/{id}  - Pobierz PDF faktury
 */

// Wyłącz wyświetlanie błędów HTML - zawsze zwracaj JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Obsługa błędów PHP jako JSON
set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(function($exception) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(array(
        'error' => 'Błąd serwera: ' . $exception->getMessage(),
        'file' => basename($exception->getFile()),
        'line' => $exception->getLine()
    ));
    exit;
});

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/InfaktClient.php';

// INFAKT_API_KEY jest zdefiniowany w config.php

/**
 * Inicjalizuj klienta inFakt
 */
function getInfaktClient() {
    $client = new InfaktClient(INFAKT_API_KEY);
    $client->setDebug(true);
    return $client;
}

/**
 * POST /api/invoices/proforma
 * Utwórz proformę i opcjonalnie wyślij na email
 */
function handleCreateProforma() {
    $user = requireAuth();
    $input = getJsonInput();
    
    // Walidacja
    if (empty($input['items']) || !is_array($input['items'])) {
        jsonResponse(array('error' => 'Brak pozycji na fakturze'), 400);
    }
    
    $infakt = getInfaktClient();
    
    // Przygotuj dane klienta
    $clientData = array(
        'type' => !empty($input['nip']) ? 'company' : 'person',
        'company_name' => isset($input['companyName']) ? $input['companyName'] : '',
        'first_name' => isset($input['firstName']) ? $input['firstName'] : '',
        'last_name' => isset($input['lastName']) ? $input['lastName'] : '',
        'nip' => isset($input['nip']) ? $input['nip'] : '',
        'email' => isset($input['email']) ? $input['email'] : '',
        'phone' => isset($input['phone']) ? $input['phone'] : '',
        'street' => isset($input['street']) ? $input['street'] : '',
        'city' => isset($input['city']) ? $input['city'] : '',
        'post_code' => isset($input['postCode']) ? $input['postCode'] : '',
        'payment_method' => 'transfer'
    );
    
    // Nazwa klienta - priorytet: firma > imię+nazwisko > email
    if (empty($clientData['company_name'])) {
        if (!empty($clientData['first_name']) || !empty($clientData['last_name'])) {
            $clientData['company_name'] = trim($clientData['first_name'] . ' ' . $clientData['last_name']);
        } elseif (!empty($clientData['email'])) {
            $clientData['company_name'] = $clientData['email'];
        } else {
            $clientData['company_name'] = 'Klient ' . date('Y-m-d H:i');
        }
    }
    
    try {
        // Znajdź lub utwórz klienta w inFakt
        $clientId = $infakt->findOrCreateClient($clientData);
        
        if (!$clientId) {
            throw new Exception('Nie udało się utworzyć klienta w inFakt');
        }
        
        // Przygotuj pozycje faktury
        $invoiceItems = array();
        foreach ($input['items'] as $item) {
            $invoiceItems[] = array(
                'name' => $item['name'],
                'quantity' => isset($item['quantity']) ? floatval($item['quantity']) : 1,
                'unit_price_net' => isset($item['unitPriceNet']) ? floatval($item['unitPriceNet']) : 0,
                'vat_rate' => isset($item['vatRate']) ? intval($item['vatRate']) : 23
            );
        }
        
        // Opcje faktury
        $options = array(
            'type' => 'proforma',
            'due_days' => isset($input['dueDays']) ? intval($input['dueDays']) : 7,
            'description' => isset($input['description']) ? $input['description'] : '',
            'install_address' => isset($input['installAddress']) ? $input['installAddress'] : '',
            'phone' => isset($input['phone']) ? $input['phone'] : ''
        );
        
        // Utwórz proformę
        $invoice = $infakt->createInvoice($clientId, $invoiceItems, $options);
        
        if (!$invoice) {
            throw new Exception('Nie udało się utworzyć proformy');
        }
        
        // Utwórz link do udostępniania
        $shareLink = $infakt->createShareLink($invoice['id']);
        
        // Wyślij email jeśli żądano
        $emailSent = false;
        if (!empty($input['sendEmail']) && !empty($input['email'])) {
            $emailSent = $infakt->sendInvoiceByEmail($invoice['id'], $input['email']);
        }
        
        // Zapisz w bazie (opcjonalnie)
        $jobId = isset($input['jobId']) ? $input['jobId'] : null;
        if ($jobId) {
            saveInvoiceToDb($jobId, $invoice, 'proforma', $clientId);
        }
        
        jsonResponse(array(
            'success' => true,
            'invoice' => array(
                'id' => $invoice['id'],
                'number' => $invoice['number'],
                'type' => 'proforma',
                'shareLink' => $shareLink,
                'emailSent' => $emailSent
            )
        ));
        
    } catch (Exception $e) {
        error_log('Proforma error: ' . $e->getMessage());
        jsonResponse(array('error' => $e->getMessage()), 500);
    }
}

/**
 * POST /api/invoices/invoice
 * Utwórz fakturę VAT
 */
function handleCreateInvoice() {
    $user = requireAuth();
    $input = getJsonInput();
    
    // Walidacja
    if (empty($input['items']) || !is_array($input['items'])) {
        jsonResponse(array('error' => 'Brak pozycji na fakturze'), 400);
    }
    
    $infakt = getInfaktClient();
    
    // Przygotuj dane klienta (tak samo jak dla proformy)
    $clientData = array(
        'type' => !empty($input['nip']) ? 'company' : 'person',
        'company_name' => isset($input['companyName']) ? $input['companyName'] : '',
        'first_name' => isset($input['firstName']) ? $input['firstName'] : '',
        'last_name' => isset($input['lastName']) ? $input['lastName'] : '',
        'nip' => isset($input['nip']) ? $input['nip'] : '',
        'email' => isset($input['email']) ? $input['email'] : '',
        'phone' => isset($input['phone']) ? $input['phone'] : '',
        'street' => isset($input['street']) ? $input['street'] : '',
        'city' => isset($input['city']) ? $input['city'] : '',
        'post_code' => isset($input['postCode']) ? $input['postCode'] : '',
        'payment_method' => isset($input['paymentMethod']) ? $input['paymentMethod'] : 'transfer'
    );
    
    if (empty($clientData['company_name'])) {
        if (!empty($clientData['first_name']) || !empty($clientData['last_name'])) {
            $clientData['company_name'] = trim($clientData['first_name'] . ' ' . $clientData['last_name']);
        } elseif (!empty($clientData['email'])) {
            $clientData['company_name'] = $clientData['email'];
        } else {
            $clientData['company_name'] = 'Klient ' . date('Y-m-d H:i');
        }
    }
    
    try {
        $clientId = $infakt->findOrCreateClient($clientData);
        
        if (!$clientId) {
            throw new Exception('Nie udało się utworzyć klienta w inFakt');
        }
        
        // Przygotuj pozycje
        $invoiceItems = array();
        foreach ($input['items'] as $item) {
            $invoiceItems[] = array(
                'name' => $item['name'],
                'quantity' => isset($item['quantity']) ? floatval($item['quantity']) : 1,
                'unit_price_net' => isset($item['unitPriceNet']) ? floatval($item['unitPriceNet']) : 0,
                'vat_rate' => isset($item['vatRate']) ? intval($item['vatRate']) : 23
            );
        }
        
        // Opcje faktury VAT
        $markPaid = isset($input['markAsPaid']) && $input['markAsPaid'];
        
        $options = array(
            'type' => 'vat',
            'due_days' => isset($input['dueDays']) ? intval($input['dueDays']) : 14,
            'description' => isset($input['description']) ? $input['description'] : '',
            'install_address' => isset($input['installAddress']) ? $input['installAddress'] : '',
            'phone' => isset($input['phone']) ? $input['phone'] : '',
            'mark_paid' => $markPaid
        );
        
        // Utwórz fakturę
        $invoice = $infakt->createInvoice($clientId, $invoiceItems, $options);
        
        if (!$invoice) {
            throw new Exception('Nie udało się utworzyć faktury');
        }
        
        // Link do udostępniania
        $shareLink = $infakt->createShareLink($invoice['id']);
        
        // Wyślij email
        $emailSent = false;
        if (!empty($input['sendEmail']) && !empty($input['email'])) {
            $emailSent = $infakt->sendInvoiceByEmail($invoice['id'], $input['email']);
        }
        
        // Zapisz w bazie
        $jobId = isset($input['jobId']) ? $input['jobId'] : null;
        if ($jobId) {
            saveInvoiceToDb($jobId, $invoice, 'vat', $clientId);
        }
        
        jsonResponse(array(
            'success' => true,
            'invoice' => array(
                'id' => $invoice['id'],
                'number' => $invoice['number'],
                'type' => 'vat',
                'shareLink' => $shareLink,
                'emailSent' => $emailSent,
                'isPaid' => $markPaid
            )
        ));
        
    } catch (Exception $e) {
        error_log('Invoice error: ' . $e->getMessage());
        jsonResponse(array('error' => $e->getMessage()), 500);
    }
}

/**
 * POST /api/invoices/send
 * Wyślij fakturę emailem
 */
function handleSendInvoice() {
    $user = requireAuth();
    $input = getJsonInput();
    
    if (empty($input['invoiceId'])) {
        jsonResponse(array('error' => 'Brak ID faktury'), 400);
    }
    
    if (empty($input['email'])) {
        jsonResponse(array('error' => 'Brak adresu email'), 400);
    }
    
    $infakt = getInfaktClient();
    
    try {
        $result = $infakt->sendInvoiceByEmail($input['invoiceId'], $input['email']);
        
        if ($result) {
            jsonResponse(array('success' => true, 'message' => 'Email wysłany'));
        } else {
            throw new Exception('Nie udało się wysłać emaila');
        }
    } catch (Exception $e) {
        jsonResponse(array('error' => $e->getMessage()), 500);
    }
}

/**
 * GET /api/invoices/{id}
 * Pobierz dane faktury
 */
function handleGetInvoice($invoiceId) {
    $user = requireAuth();
    
    $infakt = getInfaktClient();
    
    try {
        $invoice = $infakt->getInvoice($invoiceId);
        
        if (!$invoice) {
            jsonResponse(array('error' => 'Faktura nie znaleziona'), 404);
        }
        
        jsonResponse(array('success' => true, 'invoice' => $invoice));
    } catch (Exception $e) {
        jsonResponse(array('error' => $e->getMessage()), 500);
    }
}

/**
 * GET /api/invoices/pdf/{id}
 * Pobierz PDF faktury
 */
function handleGetPdf($invoiceId) {
    $user = requireAuth();
    
    $infakt = getInfaktClient();
    
    try {
        $pdf = $infakt->getInvoicePdf($invoiceId);
        
        if (!$pdf) {
            jsonResponse(array('error' => 'Nie udało się pobrać PDF'), 500);
        }
        
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="faktura_' . $invoiceId . '.pdf"');
        echo $pdf;
        exit;
    } catch (Exception $e) {
        jsonResponse(array('error' => $e->getMessage()), 500);
    }
}

/**
 * POST /api/invoices/mark-paid
 * Oznacz fakturę jako opłaconą
 */
function handleMarkAsPaid() {
    $user = requireAuth();
    $input = getJsonInput();
    
    if (empty($input['invoiceId'])) {
        jsonResponse(array('error' => 'Brak ID faktury'), 400);
    }
    
    $infakt = getInfaktClient();
    
    try {
        $paidDate = isset($input['paidDate']) ? $input['paidDate'] : date('Y-m-d');
        $result = $infakt->markAsPaid($input['invoiceId'], $paidDate);
        
        if ($result) {
            jsonResponse(array('success' => true));
        } else {
            throw new Exception('Nie udało się oznaczyć jako opłacone');
        }
    } catch (Exception $e) {
        jsonResponse(array('error' => $e->getMessage()), 500);
    }
}

/**
 * Zapisz fakturę do lokalnej bazy danych
 */
function saveInvoiceToDb($jobId, $invoiceData, $type, $clientId) {
    try {
        $pdo = getDB();
        
        // Sprawdź czy tabela istnieje, jeśli nie - utwórz
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS invoices (
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
            )
        ");
        
        $stmt = $pdo->prepare("
            INSERT INTO invoices (job_id, infakt_id, infakt_number, type, client_id, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ");
        
        $stmt->execute(array(
            $jobId,
            $invoiceData['id'],
            isset($invoiceData['number']) ? $invoiceData['number'] : null,
            $type,
            $clientId
        ));
        
        return $pdo->lastInsertId();
    } catch (Exception $e) {
        error_log('Save invoice to DB error: ' . $e->getMessage());
        return null;
    }
}

/**
 * GET /api/invoices/check-status/{invoiceId}
 * Sprawdź status płatności faktury w inFakt
 */
function handleCheckStatus($invoiceId) {
    $user = requireAuth();
    
    if (empty($invoiceId)) {
        jsonResponse(array('error' => 'Brak ID faktury'), 400);
    }
    
    $infakt = getInfaktClient();
    
    try {
        $invoice = $infakt->getInvoice($invoiceId);
        
        if (!$invoice) {
            jsonResponse(array('error' => 'Nie znaleziono faktury w inFakt'), 404);
        }
        
        // inFakt zwraca payment_status: 'paid', 'unpaid', 'partially_paid'
        $paymentStatus = isset($invoice['payment_status']) ? $invoice['payment_status'] : 'unknown';
        $isPaid = ($paymentStatus === 'paid');
        $paidDate = isset($invoice['paid_date']) ? $invoice['paid_date'] : null;
        
        // Zwróć status
        jsonResponse(array(
            'success' => true,
            'invoiceId' => $invoiceId,
            'infaktNumber' => isset($invoice['number']) ? $invoice['number'] : null,
            'paymentStatus' => $paymentStatus,
            'isPaid' => $isPaid,
            'paidDate' => $paidDate,
            'totalGross' => isset($invoice['gross_price']) ? floatval($invoice['gross_price']) : 0,
            'clientName' => isset($invoice['client_name']) ? $invoice['client_name'] : '',
            'invoiceType' => isset($invoice['kind']) ? $invoice['kind'] : 'vat' // 'proforma' lub 'vat'
        ));
        
    } catch (Exception $e) {
        jsonResponse(array('error' => 'Błąd sprawdzania statusu: ' . $e->getMessage()), 500);
    }
}

/**
 * GET /api/invoices/job/{jobId}
 * Pobierz faktury dla zlecenia
 */
function handleGetJobInvoices($jobId) {
    $user = requireAuth();
    
    try {
        $pdo = getDB();
        
        $stmt = $pdo->prepare("
            SELECT * FROM invoices 
            WHERE job_id = ? 
            ORDER BY created_at DESC
        ");
        $stmt->execute(array($jobId));
        $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        jsonResponse(array('success' => true, 'invoices' => $invoices));
    } catch (Exception $e) {
        // Tabela może nie istnieć - zwróć pustą listę
        jsonResponse(array('success' => true, 'invoices' => array()));
    }
}

// =============================================================================
// GŁÓWNA FUNKCJA HANDLERA (wywoływana z index.php)
// =============================================================================

function handleInvoices($method, $id = null) {
    // Pobierz dodatkową część ścieżki (np. /invoices/proforma -> proforma)
    $requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    $path = parse_url($requestUri, PHP_URL_PATH);
    
    // Wyciągnij akcję z path (invoices/{action})
    $action = '';
    if (preg_match('#/invoices/([a-z\-]+)#i', $path, $matches)) {
        $action = $matches[1];
    }
    
    error_log("[invoices.php] handleInvoices - Method: $method, ID: $id, Action: $action");
    
    if ($method === 'POST') {
        switch ($action) {
            case 'proforma':
                handleCreateProforma();
                break;
            case 'invoice':
                handleCreateInvoice();
                break;
            case 'send':
                handleSendInvoice();
                break;
            case 'mark-paid':
                handleMarkAsPaid();
                break;
            default:
                // Domyślnie POST bez akcji = proforma
                handleCreateProforma();
                break;
        }
    } elseif ($method === 'GET') {
        if ($action === 'pdf' && $id) {
            handleGetPdf($id);
        } elseif ($action === 'job' && $id) {
            handleGetJobInvoices($id);
        } elseif ($action === 'check-status' && $id) {
            handleCheckStatus($id);
        } elseif ($id && is_numeric($id)) {
            handleGetInvoice($id);
        } else {
            // Lista faktur (opcjonalnie)
            jsonResponse(array('error' => 'Specify invoice ID or action'), 400);
        }
    } else {
        jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}

// =============================================================================
// STANDALONE ROUTER (gdy plik wywołany bezpośrednio)
// =============================================================================

// Sprawdź czy plik jest wywoływany bezpośrednio (nie przez index.php)
if (basename($_SERVER['SCRIPT_FILENAME']) === 'invoices.php') {
    $method = $_SERVER['REQUEST_METHOD'];
    $uri = isset($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : '';
    
    // Wyczyść URI
    $uri = trim($uri, '/');
    $parts = explode('/', $uri);
    
    // Debug
    error_log("[invoices.php] Standalone - Method: $method, URI: $uri");
    
    // Routing
    if ($method === 'POST') {
        if ($uri === 'proforma' || $uri === 'invoices/proforma') {
            handleCreateProforma();
        } elseif ($uri === 'invoice' || $uri === 'invoices/invoice') {
            handleCreateInvoice();
        } elseif ($uri === 'send' || $uri === 'invoices/send') {
            handleSendInvoice();
        } elseif ($uri === 'mark-paid' || $uri === 'invoices/mark-paid') {
            handleMarkAsPaid();
        } else {
            handleCreateProforma();
        }
    } elseif ($method === 'GET') {
        if (strpos($uri, 'pdf/') === 0 || strpos($uri, 'invoices/pdf/') === 0) {
            $id = end($parts);
            handleGetPdf($id);
        } elseif (strpos($uri, 'job/') === 0 || strpos($uri, 'invoices/job/') === 0) {
            $jobId = end($parts);
            handleGetJobInvoices($jobId);
        } elseif (strpos($uri, 'check-status/') === 0 || strpos($uri, 'invoices/check-status/') === 0) {
            $id = end($parts);
            handleCheckStatus($id);
        } elseif (!empty($parts[0]) && is_numeric(end($parts))) {
            $id = end($parts);
            handleGetInvoice($id);
        } else {
            jsonResponse(array('error' => 'Invalid endpoint'), 404);
        }
    } else {
        jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}