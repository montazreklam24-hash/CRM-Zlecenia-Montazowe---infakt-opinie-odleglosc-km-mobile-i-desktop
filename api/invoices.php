<?php
/**
 * CRM Zlecenia Montażowe - API Faktur (inFakt)
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/InfaktClient.php';

/**
 * Router dla /api/invoices
 */
function handleInvoices($method, $id = null) {
    switch ($method) {
        case 'GET':
            if ($id) {
                getInvoice($id);
            } else {
                getInvoices();
            }
            break;
        case 'POST':
            createInvoice();
            break;
        case 'PUT':
            if (!$id) {
                jsonResponse(array('error' => 'Invoice ID required'), 400);
            }
            updateInvoice($id);
            break;
        case 'DELETE':
            if (!$id) {
                jsonResponse(array('error' => 'Invoice ID required'), 400);
            }
            deleteInvoice($id);
            break;
        default:
            jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}

/**
 * GET /api/invoices
 */
function getInvoices() {
    $user = requireAuth();
    $pdo = getDB();
    
    $jobId = isset($_GET['job_id']) ? intval($_GET['job_id']) : null;
    $clientId = isset($_GET['client_id']) ? intval($_GET['client_id']) : null;
    $status = isset($_GET['status']) ? $_GET['status'] : null;
    $type = isset($_GET['type']) ? $_GET['type'] : null;
    
    $where = array('1=1');
    $params = array();
    
    if ($jobId) {
        $where[] = 'i.job_id = ?';
        $params[] = $jobId;
    }
    if ($clientId) {
        $where[] = 'i.client_id = ?';
        $params[] = $clientId;
    }
    if ($status) {
        $where[] = 'i.payment_status = ?';
        $params[] = $status;
    }
    if ($type) {
        $where[] = 'i.type = ?';
        $params[] = $type;
    }
    
    $whereClause = implode(' AND ', $where);
    
    $sql = "
        SELECT 
            i.*,
            c.company_name as client_company,
            c.first_name as client_first_name,
            c.last_name as client_last_name,
            j.friendly_id as job_friendly_id,
            j.job_title
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN jobs j ON i.job_id = j.id
        WHERE {$whereClause}
        ORDER BY i.created_at DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $invoices = $stmt->fetchAll();
    
    // Pobierz pozycje dla każdej faktury
    foreach ($invoices as &$inv) {
        $inv['items'] = getInvoiceItems($inv['id']);
        $inv = mapInvoiceToFrontend($inv);
    }
    
    jsonResponse(array('success' => true, 'invoices' => $invoices));
}

/**
 * GET /api/invoices/{id}
 */
function getInvoice($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('
        SELECT 
            i.*,
            c.company_name as client_company,
            c.first_name as client_first_name,
            c.last_name as client_last_name,
            c.email as client_email,
            j.friendly_id as job_friendly_id,
            j.job_title
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN jobs j ON i.job_id = j.id
        WHERE i.id = ?
    ');
    $stmt->execute(array($id));
    $invoice = $stmt->fetch();
    
    if (!$invoice) {
        jsonResponse(array('error' => 'Faktura nie istnieje'), 404);
    }
    
    $invoice['items'] = getInvoiceItems($id);
    
    jsonResponse(array('success' => true, 'invoice' => mapInvoiceToFrontend($invoice)));
}

/**
 * POST /api/invoices
 * Tworzy fakturę lokalnie i w inFakt
 */
function createInvoice() {
    $user = requireAdmin();
    $input = getJsonInput();
    $pdo = getDB();
    
    // Walidacja
    $jobId = isset($input['jobId']) ? intval($input['jobId']) : null;
    $clientId = isset($input['clientId']) ? intval($input['clientId']) : null;
    $type = isset($input['type']) ? $input['type'] : 'invoice';
    $items = isset($input['items']) ? $input['items'] : array();
    
    if (empty($items)) {
        jsonResponse(array('error' => 'Dodaj przynajmniej jedną pozycję'), 400);
    }
    
    // Oblicz sumy
    $totalNet = 0;
    $totalGross = 0;
    foreach ($items as $item) {
        $itemNet = floatval($item['unitPriceNet']) * floatval($item['quantity']);
        $vatRate = isset($item['vatRate']) ? intval($item['vatRate']) : 23;
        $itemGross = $itemNet * (1 + $vatRate / 100);
        $totalNet += $itemNet;
        $totalGross += $itemGross;
    }
    $totalVat = $totalGross - $totalNet;
    
    // Generuj numer
    $invoiceNumber = generateInvoiceNumber($type);
    
    // Wstaw do bazy lokalnej
    $stmt = $pdo->prepare('
        INSERT INTO invoices (
            job_id, client_id, type, number,
            total_net, total_vat, total_gross,
            payment_method, payment_status, due_date,
            issue_date, sell_date, description, notes,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    $dueDays = isset($input['dueDays']) ? intval($input['dueDays']) : 7;
    $dueDate = date('Y-m-d', strtotime('+' . $dueDays . ' days'));
    
    $stmt->execute(array(
        $jobId,
        $clientId,
        $type,
        $invoiceNumber,
        $totalNet,
        $totalVat,
        $totalGross,
        isset($input['paymentMethod']) ? $input['paymentMethod'] : 'transfer',
        'pending',
        $dueDate,
        date('Y-m-d'),
        date('Y-m-d'),
        isset($input['description']) ? $input['description'] : null,
        isset($input['notes']) ? $input['notes'] : null,
        $user['id']
    ));
    
    $invoiceId = $pdo->lastInsertId();
    
    // Dodaj pozycje
    saveInvoiceItems($invoiceId, $items);
    
    // Wyślij do inFakt jeśli skonfigurowane
    $infaktResult = null;
    if (defined('INFAKT_API_KEY') && !empty(INFAKT_API_KEY) && isset($input['sendToInfakt']) && $input['sendToInfakt']) {
        $infaktResult = sendToInfakt($invoiceId, $clientId, $items, $type, $input);
        
        if ($infaktResult) {
            // Zaktualizuj rekord z danymi inFakt
            $stmt = $pdo->prepare('UPDATE invoices SET infakt_id = ?, infakt_number = ?, infakt_link = ? WHERE id = ?');
            $stmt->execute(array(
                $infaktResult['id'],
                $infaktResult['number'],
                isset($infaktResult['link']) ? $infaktResult['link'] : null,
                $invoiceId
            ));
        }
    }
    
    // Zaktualizuj status płatności w zleceniu
    if ($jobId) {
        updateJobPaymentStatus($jobId);
    }
    
    // Pobierz i zwróć
    $stmt = $pdo->prepare('SELECT * FROM invoices WHERE id = ?');
    $stmt->execute(array($invoiceId));
    $invoice = $stmt->fetch();
    $invoice['items'] = getInvoiceItems($invoiceId);
    
    jsonResponse(array(
        'success' => true, 
        'invoice' => mapInvoiceToFrontend($invoice),
        'infakt' => $infaktResult
    ), 201);
}

/**
 * PUT /api/invoices/{id}
 */
function updateInvoice($id) {
    $user = requireAdmin();
    $input = getJsonInput();
    $pdo = getDB();
    
    // Sprawdź czy istnieje
    $stmt = $pdo->prepare('SELECT * FROM invoices WHERE id = ?');
    $stmt->execute(array($id));
    $invoice = $stmt->fetch();
    
    if (!$invoice) {
        jsonResponse(array('error' => 'Faktura nie istnieje'), 404);
    }
    
    $updates = array();
    $params = array();
    
    // Dozwolone pola
    $allowedFields = array(
        'payment_status' => 'paymentStatus',
        'paid_amount' => 'paidAmount',
        'paid_date' => 'paidDate',
        'notes' => 'notes',
        'description' => 'description'
    );
    
    foreach ($allowedFields as $dbField => $inputField) {
        if (isset($input[$inputField])) {
            $updates[] = "`{$dbField}` = ?";
            $params[] = $input[$inputField];
        }
    }
    
    // Oznacz jako opłacone
    if (isset($input['markAsPaid']) && $input['markAsPaid']) {
        $updates[] = 'payment_status = ?';
        $params[] = 'paid';
        $updates[] = 'paid_amount = total_gross';
        $updates[] = 'paid_date = ?';
        $params[] = date('Y-m-d');
        
        // Oznacz w inFakt
        if ($invoice['infakt_id']) {
            $infakt = getInfaktClient();
            if ($infakt) {
                $infakt->markAsPaid($invoice['infakt_id']);
            }
        }
    }
    
    if (count($updates) > 0) {
        $params[] = $id;
        $sql = 'UPDATE invoices SET ' . implode(', ', $updates) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    // Zaktualizuj status w zleceniu
    if ($invoice['job_id']) {
        updateJobPaymentStatus($invoice['job_id']);
    }
    
    // Pobierz i zwróć
    $stmt = $pdo->prepare('SELECT * FROM invoices WHERE id = ?');
    $stmt->execute(array($id));
    $inv = $stmt->fetch();
    $inv['items'] = getInvoiceItems($id);
    
    jsonResponse(array('success' => true, 'invoice' => mapInvoiceToFrontend($inv)));
}

/**
 * DELETE /api/invoices/{id}
 */
function deleteInvoice($id) {
    $user = requireAdmin();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT * FROM invoices WHERE id = ?');
    $stmt->execute(array($id));
    $invoice = $stmt->fetch();
    
    if (!$invoice) {
        jsonResponse(array('error' => 'Faktura nie istnieje'), 404);
    }
    
    $jobId = $invoice['job_id'];
    
    // Usuń (CASCADE usunie pozycje)
    $stmt = $pdo->prepare('DELETE FROM invoices WHERE id = ?');
    $stmt->execute(array($id));
    
    // Zaktualizuj status w zleceniu
    if ($jobId) {
        updateJobPaymentStatus($jobId);
    }
    
    jsonResponse(array('success' => true, 'message' => 'Faktura usunięta'));
}

// =========================================================================
// DODATKOWE ENDPOINTY
// =========================================================================

/**
 * POST /api/invoices/{id}/send
 * Wysyła fakturę emailem
 */
function sendInvoiceEmail($id) {
    $user = requireAdmin();
    $input = getJsonInput();
    $pdo = getDB();
    
    $email = isset($input['email']) ? $input['email'] : null;
    
    $stmt = $pdo->prepare('SELECT * FROM invoices WHERE id = ?');
    $stmt->execute(array($id));
    $invoice = $stmt->fetch();
    
    if (!$invoice) {
        jsonResponse(array('error' => 'Faktura nie istnieje'), 404);
    }
    
    // Wyślij przez inFakt jeśli mamy ID
    if ($invoice['infakt_id']) {
        $infakt = getInfaktClient();
        if ($infakt && $infakt->sendInvoiceByEmail($invoice['infakt_id'], $email)) {
            // Zapisz info o wysyłce
            $stmt = $pdo->prepare('UPDATE invoices SET sent_at = NOW(), sent_to = ? WHERE id = ?');
            $stmt->execute(array($email, $id));
            
            jsonResponse(array('success' => true, 'message' => 'Email wysłany'));
        }
    }
    
    jsonResponse(array('error' => 'Nie udało się wysłać emaila'), 500);
}

/**
 * GET /api/invoices/{id}/pdf
 * Pobierz PDF faktury
 */
function getInvoicePdf($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT * FROM invoices WHERE id = ?');
    $stmt->execute(array($id));
    $invoice = $stmt->fetch();
    
    if (!$invoice) {
        jsonResponse(array('error' => 'Faktura nie istnieje'), 404);
    }
    
    if ($invoice['infakt_id']) {
        $infakt = getInfaktClient();
        if ($infakt) {
            $pdf = $infakt->getInvoicePdf($invoice['infakt_id']);
            if ($pdf) {
                header('Content-Type: application/pdf');
                header('Content-Disposition: attachment; filename="' . $invoice['number'] . '.pdf"');
                echo $pdf;
                exit;
            }
        }
    }
    
    jsonResponse(array('error' => 'PDF niedostępny'), 404);
}

// =========================================================================
// HELPERS
// =========================================================================

function getInfaktClient() {
    if (!defined('INFAKT_API_KEY') || empty(INFAKT_API_KEY)) {
        return null;
    }
    
    $apiUrl = defined('INFAKT_API_URL') ? INFAKT_API_URL : 'https://api.infakt.pl/v3';
    $client = new InfaktClient(INFAKT_API_KEY, $apiUrl);
    $client->setDebug(DEV_MODE);
    return $client;
}

function sendToInfakt($invoiceId, $clientId, $items, $type, $options) {
    $infakt = getInfaktClient();
    if (!$infakt) return null;
    
    $pdo = getDB();
    
    // Pobierz dane klienta
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute(array($clientId));
    $client = $stmt->fetch();
    
    if (!$client) return null;
    
    // Znajdź lub utwórz klienta w inFakt
    $infaktClientId = $infakt->findOrCreateClient(array(
        'type' => $client['type'],
        'company_name' => $client['company_name'],
        'first_name' => $client['first_name'],
        'last_name' => $client['last_name'],
        'email' => $client['email'],
        'phone' => $client['phone'],
        'street' => $client['street'],
        'post_code' => $client['post_code'],
        'city' => $client['city'],
        'nip' => $client['nip'],
        'payment_method' => $client['payment_method']
    ));
    
    if (!$infaktClientId) return null;
    
    // Zapisz infakt_id klienta
    $stmt = $pdo->prepare('UPDATE clients SET infakt_id = ? WHERE id = ?');
    $stmt->execute(array($infaktClientId, $clientId));
    
    // Przygotuj pozycje
    $infaktItems = array();
    foreach ($items as $item) {
        $infaktItems[] = array(
            'name' => $item['name'],
            'quantity' => isset($item['quantity']) ? floatval($item['quantity']) : 1,
            'unit_price_net' => floatval($item['unitPriceNet']),
            'vat_rate' => isset($item['vatRate']) ? intval($item['vatRate']) : 23
        );
    }
    
    // Utwórz fakturę w inFakt
    $result = $infakt->createInvoice($infaktClientId, $infaktItems, array(
        'type' => $type === 'proforma' ? 'proforma' : 'vat',
        'description' => isset($options['description']) ? $options['description'] : '',
        'install_address' => isset($options['installAddress']) ? $options['installAddress'] : '',
        'phone' => isset($options['phone']) ? $options['phone'] : '',
        'due_days' => isset($options['dueDays']) ? intval($options['dueDays']) : 7,
        'mark_paid' => isset($options['markAsPaid']) && $options['markAsPaid']
    ));
    
    if ($result) {
        // Pobierz link do udostępniania
        $result['link'] = $infakt->createShareLink($result['id']);
    }
    
    return $result;
}

function generateInvoiceNumber($type) {
    $pdo = getDB();
    $year = date('Y');
    $month = date('m');
    
    $prefix = $type === 'proforma' ? 'PROF' : 'FV';
    
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count 
        FROM invoices 
        WHERE type = ? AND YEAR(created_at) = ? AND MONTH(created_at) = ?
    ");
    $stmt->execute(array($type, $year, $month));
    $result = $stmt->fetch();
    
    $number = intval($result['count']) + 1;
    
    return $prefix . '/' . $year . '/' . $month . '/' . str_pad($number, 3, '0', STR_PAD_LEFT);
}

function getInvoiceItems($invoiceId) {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC');
    $stmt->execute(array($invoiceId));
    $items = $stmt->fetchAll();
    
    $result = array();
    foreach ($items as $item) {
        $result[] = array(
            'id' => intval($item['id']),
            'name' => $item['name'],
            'description' => $item['description'],
            'quantity' => floatval($item['quantity']),
            'unit' => $item['unit'],
            'unitPriceNet' => floatval($item['unit_price_net']),
            'vatRate' => intval($item['vat_rate']),
            'totalNet' => floatval($item['total_net']),
            'totalGross' => floatval($item['total_gross'])
        );
    }
    return $result;
}

function saveInvoiceItems($invoiceId, $items) {
    $pdo = getDB();
    $stmt = $pdo->prepare('
        INSERT INTO invoice_items (invoice_id, name, description, quantity, unit, unit_price_net, vat_rate, total_net, total_gross, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    foreach ($items as $index => $item) {
        $quantity = isset($item['quantity']) ? floatval($item['quantity']) : 1;
        $unitPriceNet = floatval($item['unitPriceNet']);
        $vatRate = isset($item['vatRate']) ? intval($item['vatRate']) : 23;
        
        $totalNet = $quantity * $unitPriceNet;
        $totalGross = $totalNet * (1 + $vatRate / 100);
        
        $stmt->execute(array(
            $invoiceId,
            $item['name'],
            isset($item['description']) ? $item['description'] : null,
            $quantity,
            isset($item['unit']) ? $item['unit'] : 'szt.',
            $unitPriceNet,
            $vatRate,
            $totalNet,
            $totalGross,
            $index
        ));
    }
}

function updateJobPaymentStatus($jobId) {
    $pdo = getDB();
    
    // Pobierz faktury dla zlecenia
    $stmt = $pdo->prepare('SELECT type, payment_status, total_gross, paid_amount FROM invoices WHERE job_id = ? ORDER BY created_at DESC');
    $stmt->execute(array($jobId));
    $invoices = $stmt->fetchAll();
    
    $status = 'none';
    $totalGross = 0;
    $paidAmount = 0;
    
    foreach ($invoices as $inv) {
        $totalGross += floatval($inv['total_gross']);
        $paidAmount += floatval($inv['paid_amount']);
        
        if ($inv['payment_status'] === 'paid') {
            $status = 'paid';
        } elseif ($inv['payment_status'] === 'partial' && $status !== 'paid') {
            $status = 'partial';
        } elseif ($inv['type'] === 'invoice' && $status === 'none') {
            $status = 'invoice';
        } elseif ($inv['type'] === 'proforma' && $status === 'none') {
            $status = 'proforma';
        }
    }
    
    // Zaktualizuj zlecenie
    $stmt = $pdo->prepare('UPDATE jobs SET payment_status = ?, total_gross = ?, paid_amount = ? WHERE id = ?');
    $stmt->execute(array($status, $totalGross, $paidAmount, $jobId));
}

function mapInvoiceToFrontend($invoice) {
    return array(
        'id' => intval($invoice['id']),
        'jobId' => $invoice['job_id'] ? intval($invoice['job_id']) : null,
        'clientId' => $invoice['client_id'] ? intval($invoice['client_id']) : null,
        'type' => $invoice['type'],
        'number' => $invoice['number'],
        'infaktId' => $invoice['infakt_id'] ? intval($invoice['infakt_id']) : null,
        'infaktNumber' => $invoice['infakt_number'],
        'infaktLink' => $invoice['infakt_link'],
        'totalNet' => floatval($invoice['total_net']),
        'totalVat' => floatval($invoice['total_vat']),
        'totalGross' => floatval($invoice['total_gross']),
        'paymentMethod' => $invoice['payment_method'],
        'paymentStatus' => $invoice['payment_status'],
        'paidAmount' => floatval($invoice['paid_amount']),
        'paidDate' => $invoice['paid_date'],
        'dueDate' => $invoice['due_date'],
        'issueDate' => $invoice['issue_date'],
        'sellDate' => $invoice['sell_date'],
        'description' => $invoice['description'],
        'notes' => $invoice['notes'],
        'sentAt' => $invoice['sent_at'] ? strtotime($invoice['sent_at']) * 1000 : null,
        'sentTo' => $invoice['sent_to'],
        'createdAt' => strtotime($invoice['created_at']) * 1000,
        'items' => isset($invoice['items']) ? $invoice['items'] : array(),
        // Join data
        'clientName' => isset($invoice['client_company']) 
            ? ($invoice['client_company'] ?: trim($invoice['client_first_name'] . ' ' . $invoice['client_last_name']))
            : null,
        'jobFriendlyId' => isset($invoice['job_friendly_id']) ? $invoice['job_friendly_id'] : null,
        'jobTitle' => isset($invoice['job_title']) ? $invoice['job_title'] : null,
    );
}

