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
    
    // DEBUG: Loguj co przychodzi z frontendu
    $logFile = __DIR__ . '/logs/invoice_debug.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] [PROFORMA] Input data: " . json_encode($input) . "\n", FILE_APPEND);
    
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
    
    // DEBUG: Loguj przygotowane dane klienta
    file_put_contents($logFile, "[$timestamp] [PROFORMA] Client data prepared: " . json_encode($clientData) . "\n", FILE_APPEND);
    
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
        
        // WAŻNE: Pobierz szczegóły faktury z API, żeby mieć poprawne kwoty
        $invoiceDetails = $infakt->getInvoice($invoice['id']);
        if (!$invoiceDetails) {
            throw new Exception('Nie udało się pobrać szczegółów proformy');
        }
        
        // Wyciągnij kwoty z odpowiedzi API (są w groszach)
        $netPrice = isset($invoiceDetails['net_price']) ? floatval($invoiceDetails['net_price']) : 0;
        $grossPrice = isset($invoiceDetails['gross_price']) ? floatval($invoiceDetails['gross_price']) : 0;
        
        // Utwórz link do udostępniania
        $shareLink = $infakt->createShareLink($invoice['id']);
        
        // Wyślij email jeśli żądano
        $emailSent = false;
        if (!empty($input['sendEmail']) && !empty($input['email'])) {
            $emailSent = $infakt->sendInvoiceByEmail($invoice['id'], $input['email']);
        }
        
        // Zapisz w bazie (opcjonalnie) - użyj kwot z getInvoice
        $jobId = isset($input['jobId']) ? $input['jobId'] : null;
        if ($jobId) {
            $pdo = getDB();
            createInvoicesTable($pdo);
            saveInvoiceToDb($jobId, array(
                'id' => $invoice['id'],
                'number' => isset($invoiceDetails['number']) ? $invoiceDetails['number'] : $invoice['number'],
                'total_net' => $netPrice / 100, // Konwersja z groszy na złote
                'total_gross' => $grossPrice / 100, // Konwersja z groszy na złote
                'share_link' => $shareLink
            ), 'proforma', $clientId);

            // Aktualizuj status zlecenia
            try {
                $stmt = $pdo->prepare("UPDATE jobs_ai SET payment_status = 'proforma' WHERE id = ?");
                $stmt->execute([$jobId]);
            } catch (Exception $e) {
                error_log("Failed to update job status after proforma: " . $e->getMessage());
            }
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
    
    // DEBUG: Loguj co przychodzi z frontendu
    $logFile = __DIR__ . '/logs/invoice_debug.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] [INVOICE] Input data: " . json_encode($input) . "\n", FILE_APPEND);
    
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
    
    // DEBUG: Loguj przygotowane dane klienta
    file_put_contents($logFile, "[$timestamp] [INVOICE] Client data prepared: " . json_encode($clientData) . "\n", FILE_APPEND);
    
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
        
        // WAŻNE: Pobierz szczegóły faktury z API, żeby mieć poprawne kwoty
        $invoiceDetails = $infakt->getInvoice($invoice['id']);
        if (!$invoiceDetails) {
            throw new Exception('Nie udało się pobrać szczegółów faktury');
        }
        
        // Wyciągnij kwoty z odpowiedzi API (są w groszach)
        $netPrice = isset($invoiceDetails['net_price']) ? floatval($invoiceDetails['net_price']) : 0;
        $grossPrice = isset($invoiceDetails['gross_price']) ? floatval($invoiceDetails['gross_price']) : 0;
        
        // Link do udostępniania
        $shareLink = $infakt->createShareLink($invoice['id']);
        
        // Wyślij email
        $emailSent = false;
        if (!empty($input['sendEmail']) && !empty($input['email'])) {
            $emailSent = $infakt->sendInvoiceByEmail($invoice['id'], $input['email']);
        }
        
        // Zapisz w bazie - użyj kwot z getInvoice
        $jobId = isset($input['jobId']) ? $input['jobId'] : null;
        if ($jobId) {
            $pdo = getDB();
            createInvoicesTable($pdo);
            saveInvoiceToDb($jobId, array(
                'id' => $invoice['id'],
                'number' => isset($invoiceDetails['number']) ? $invoiceDetails['number'] : $invoice['number'],
                'total_net' => $netPrice / 100, // Konwersja z groszy na złote
                'total_gross' => $grossPrice / 100, // Konwersja z groszy na złote
                'share_link' => $shareLink,
                'status' => $markPaid ? 'paid' : 'pending'
            ), 'vat', $clientId);

            // Aktualizuj status zlecenia
            try {
                $newStatus = $markPaid ? 'paid' : 'invoiced';
                $stmt = $pdo->prepare("UPDATE jobs_ai SET payment_status = ? WHERE id = ?");
                $stmt->execute([$newStatus, $jobId]);
            } catch (Exception $e) {
                error_log("Failed to update job status after invoice: " . $e->getMessage());
            }
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
    $logFile = __DIR__ . '/logs/invoice_debug.log';
    $msg = date('Y-m-d H:i:s') . " Attempting to save invoice: job=$jobId, infakt_id=" . $invoiceData['id'] . "\n";
    file_put_contents($logFile, $msg, FILE_APPEND);

    try {
        $pdo = getDB();
        
        $stmt = $pdo->prepare("
            INSERT INTO invoices (
                job_id, infakt_id, infakt_number, type, client_id, 
                total_net, total_gross, status, share_link, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        
        $res = $stmt->execute(array(
            (string)$jobId,
            (int)$invoiceData['id'],
            isset($invoiceData['number']) ? $invoiceData['number'] : null,
            $type,
            (int)$clientId,
            isset($invoiceData['total_net']) ? (float)$invoiceData['total_net'] : 0,
            isset($invoiceData['total_gross']) ? (float)$invoiceData['total_gross'] : 0,
            isset($invoiceData['status']) ? $invoiceData['status'] : 'pending',
            isset($invoiceData['share_link']) ? $invoiceData['share_link'] : null
        ));
        
        if (!$res) {
            $err = $stmt->errorInfo();
            file_put_contents($logFile, "DB ERROR: " . json_encode($err) . "\n", FILE_APPEND);
        } else {
            file_put_contents($logFile, "SUCCESS: ID=" . $pdo->lastInsertId() . "\n", FILE_APPEND);
        }
        
        return $pdo->lastInsertId();
    } catch (Exception $e) {
        file_put_contents($logFile, "EXCEPTION: " . $e->getMessage() . "\n", FILE_APPEND);
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
 * POST /api/invoices/attach
 * Podepnij istniejącą fakturę z inFakt do zlecenia
 */
function handleAttachInvoice() {
    $user = requireAuth();
    $input = getJsonInput();
    
    if (empty($input['infaktId'])) {
        jsonResponse(array('error' => 'Brak ID faktury z inFakt'), 400);
    }
    
    if (empty($input['jobId'])) {
        jsonResponse(array('error' => 'Brak ID zlecenia'), 400);
    }
    
    $infakt = getInfaktClient();
    
    try {
        // Pobierz fakturę z inFakt
        $invoice = $infakt->getInvoice($input['infaktId']);
        
        if (!$invoice) {
            jsonResponse(array('error' => 'Nie znaleziono faktury w inFakt'), 404);
        }
        
        // Sprawdź czy faktura już nie jest podpięta
        $pdo = getDB();
        createInvoicesTable($pdo);
        
        $checkStmt = $pdo->prepare("SELECT id FROM invoices WHERE infakt_id = ?");
        $checkStmt->execute(array($input['infaktId']));
        if ($checkStmt->fetch()) {
            jsonResponse(array('error' => 'Ta faktura jest już podpięta do innego zlecenia'), 400);
        }
        
        // Określ typ faktury
        $invoiceType = 'vat';
        if (isset($invoice['kind'])) {
            if ($invoice['kind'] === 'proforma') $invoiceType = 'proforma';
            elseif ($invoice['kind'] === 'advance_invoice') $invoiceType = 'advance';
            elseif ($invoice['kind'] === 'final_invoice') $invoiceType = 'final';
        }
        
        // Określ status płatności
        $paymentStatus = isset($invoice['payment_status']) ? $invoice['payment_status'] : 'unpaid';
        $localStatus = 'pending';
        if ($paymentStatus === 'paid') {
            $localStatus = 'paid';
        } elseif ($paymentStatus === 'partially_paid') {
            $localStatus = 'pending';
        }
        
        // Utwórz link do udostępniania
        $shareLink = $infakt->createShareLink($input['infaktId']);
        
        // Zapisz w bazie
        $clientId = isset($input['clientId']) ? intval($input['clientId']) : null;
        
        $stmt = $pdo->prepare("
            INSERT INTO invoices (
                job_id, infakt_id, infakt_number, type, client_id, 
                total_net, total_gross, status, share_link, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        
        $totalNet = isset($invoice['net_price']) ? floatval($invoice['net_price']) / 100 : 0;
        $totalGross = isset($invoice['gross_price']) ? floatval($invoice['gross_price']) / 100 : 0;
        
        $stmt->execute(array(
            $input['jobId'],
            intval($input['infaktId']),
            isset($invoice['number']) ? $invoice['number'] : null,
            $invoiceType,
            $clientId,
            $totalNet,
            $totalGross,
            $localStatus,
            $shareLink
        ));
        
        $invoiceDbId = $pdo->lastInsertId();
        
        // Aktualizuj status zlecenia jeśli faktura jest opłacona
        if ($localStatus === 'paid') {
            try {
                $updateJobStmt = $pdo->prepare("UPDATE jobs_ai SET payment_status = 'paid' WHERE id = ?");
                $updateJobStmt->execute(array($input['jobId']));
            } catch (Exception $e) {
                error_log("Failed to update job payment status: " . $e->getMessage());
            }
        } elseif ($invoiceType === 'proforma') {
            try {
                $updateJobStmt = $pdo->prepare("UPDATE jobs_ai SET payment_status = 'proforma' WHERE id = ?");
                $updateJobStmt->execute(array($input['jobId']));
            } catch (Exception $e) {
                error_log("Failed to update job payment status: " . $e->getMessage());
            }
        }
        
        jsonResponse(array(
            'success' => true,
            'invoice' => array(
                'id' => $invoiceDbId,
                'infaktId' => intval($input['infaktId']),
                'number' => isset($invoice['number']) ? $invoice['number'] : null,
                'type' => $invoiceType,
                'status' => $localStatus,
                'totalGross' => $totalGross,
                'shareLink' => $shareLink
            ),
            'message' => 'Faktura została podpięta do zlecenia'
        ));
        
    } catch (Exception $e) {
        error_log('Attach invoice error: ' . $e->getMessage());
        jsonResponse(array('error' => 'Błąd podpinania faktury: ' . $e->getMessage()), 500);
    }
}

/**
 * POST /api/invoices/sync-status
 * Synchronizuj status wszystkich faktur z inFakt
 * Sprawdza status płatności w inFakt i aktualizuje lokalną bazę danych
 */
function handleSyncStatus() {
    $user = requireAuth();
    
    try {
        $pdo = getDB();
        createInvoicesTable($pdo);
        
        // Pobierz wszystkie faktury z infakt_id
        $stmt = $pdo->prepare("
            SELECT id, infakt_id, status 
            FROM invoices 
            WHERE infakt_id IS NOT NULL AND infakt_id > 0
            ORDER BY created_at DESC
        ");
        $stmt->execute();
        $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $infakt = getInfaktClient();
        $updated = 0;
        $errors = 0;
        
        foreach ($invoices as $inv) {
            try {
                $infaktInvoice = $infakt->getInvoice($inv['infakt_id']);
                
                if (!$infaktInvoice) {
                    $errors++;
                    continue;
                }
                
                // Mapuj status z inFakt na lokalny status
                $paymentStatus = isset($infaktInvoice['payment_status']) ? $infaktInvoice['payment_status'] : 'unpaid';
                $localStatus = 'pending';
                
                if ($paymentStatus === 'paid') {
                    $localStatus = 'paid';
                } elseif ($paymentStatus === 'partially_paid') {
                    $localStatus = 'pending'; // Częściowo opłacone = nadal oczekuje
                }
                
                // Aktualizuj tylko jeśli status się zmienił
                if ($inv['status'] !== $localStatus) {
                    $updateStmt = $pdo->prepare("UPDATE invoices SET status = ? WHERE id = ?");
                    $updateStmt->execute(array($localStatus, $inv['id']));
                    $updated++;
                }
                
            } catch (Exception $e) {
                error_log("Sync status error for invoice {$inv['id']}: " . $e->getMessage());
                $errors++;
            }
        }
        
        jsonResponse(array(
            'success' => true,
            'total' => count($invoices),
            'updated' => $updated,
            'errors' => $errors,
            'message' => "Zsynchronizowano {$updated} faktur"
        ));
        
    } catch (Exception $e) {
        error_log('Sync status error: ' . $e->getMessage());
        jsonResponse(array('error' => 'Błąd synchronizacji: ' . $e->getMessage()), 500);
    }
}

/**
 * POST /api/invoices/full-sync
 * Pełna synchronizacja: statusy faktur + baza klientów
 */
function handleFullSync() {
    $user = requireAuth();
    $results = runFullSync($user['id']);
    jsonResponse(array('success' => true, 'results' => $results));
}

/**
 * Core function for full sync (can be called by API or CRON)
 */
function runFullSync($userId = null) {
    $pdo = getDB();
    
    $results = array(
        'invoices' => array('total' => 0, 'updated' => 0, 'errors' => 0),
        'clients' => array('total' => 0, 'created' => 0, 'updated' => 0, 'errors' => 0),
        'message' => ''
    );
    
    $infakt = getInfaktClient();
    
    // 1. SYNCHRONIZACJA STATUSÓW FAKTUR
    $stmt = $pdo->prepare("SELECT id, infakt_id, status FROM invoices WHERE status NOT IN ('paid', 'cancelled') AND infakt_id IS NOT NULL AND infakt_id > 0");
    $stmt->execute();
    $pendingInvoices = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $results['invoices']['total'] = count($pendingInvoices);
    
    foreach ($pendingInvoices as $inv) {
        try {
            $infaktInvoice = $infakt->getInvoice($inv['infakt_id']);
            if ($infaktInvoice) {
                $paymentStatus = isset($infaktInvoice['payment_status']) ? $infaktInvoice['payment_status'] : 'unpaid';
                $localStatus = ($paymentStatus === 'paid') ? 'paid' : 'pending';
                
                if ($inv['status'] !== $localStatus) {
                    $upd = $pdo->prepare("UPDATE invoices SET status = ? WHERE id = ?");
                    $upd->execute(array($localStatus, $inv['id']));
                    $results['invoices']['updated']++;
                    
                    if ($localStatus === 'paid') {
                        $jobUpd = $pdo->prepare("UPDATE jobs_ai SET payment_status = 'paid' WHERE id = (SELECT job_id FROM invoices WHERE id = ?)");
                        $jobUpd->execute(array($inv['id']));
                    }
                }
            }
        } catch (Exception $e) {
            $results['invoices']['errors']++;
        }
    }
    
    // 2. SYNCHRONIZACJA BAZY KLIENTÓW
    $infaktClientsRes = $infakt->getClients(array('limit' => 100));
    $infaktClients = isset($infaktClientsRes['entities']) ? $infaktClientsRes['entities'] : array();
    
    $results['clients']['total'] = count($infaktClients);
    
    foreach ($infaktClients as $ic) {
        try {
            $nip = !empty($ic['nip']) ? preg_replace('/[^0-9]/', '', $ic['nip']) : null;
            $email = !empty($ic['email']) ? trim($ic['email']) : null;
            
            $clientId = null;
            if ($nip && strlen($nip) === 10) {
                $stmt = $pdo->prepare("SELECT id FROM clients WHERE nip = ?");
                $stmt->execute(array($nip));
                $found = $stmt->fetch();
                if ($found) $clientId = $found['id'];
            }
            if (!$clientId && $email) {
                $stmt = $pdo->prepare("SELECT id FROM clients WHERE email = ?");
                $stmt->execute(array($email));
                $found = $stmt->fetch();
                if ($found) $clientId = $found['id'];
            }
            
            $companyName = !empty($ic['company_name']) ? $ic['company_name'] : trim($ic['first_name'] . ' ' . $ic['last_name']);
            if (empty($companyName)) $companyName = $ic['email'];
            
            $address = trim($ic['street'] . ' ' . $ic['house_no'] . ' ' . $ic['flat_no']);
            $infaktId = $ic['id'];
            $phone = isset($ic['phone']) ? $ic['phone'] : null;
            
            if ($clientId) {
                $upd = $pdo->prepare("
                    UPDATE clients SET 
                    company_name = COALESCE(company_name, ?),
                    nip = COALESCE(nip, ?),
                    email = COALESCE(email, ?),
                    phone = COALESCE(phone, ?),
                    address = COALESCE(address, ?),
                    infakt_id = ?
                    WHERE id = ?
                ");
                $upd->execute(array($companyName, $nip, $email, $phone, $address, $infaktId, $clientId));
                $results['clients']['updated']++;
            } else {
                $ins = $pdo->prepare("
                    INSERT INTO clients (company_name, nip, email, phone, address, infakt_id, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $ins->execute(array($companyName, $nip, $email, $phone, $address, $infaktId, $userId));
                $results['clients']['created']++;
            }
        } catch (Exception $e) {
            $results['clients']['errors']++;
        }
    }
    
    $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES ('last_infakt_sync', NOW()) ON DUPLICATE KEY UPDATE `value` = NOW()")->execute();
    
    $results['message'] = "Zsynchronizowano statusy {$results['invoices']['updated']} faktur. " .
                         "Zaktualizowano {$results['clients']['updated']} i utworzono {$results['clients']['created']} klientów.";
                         
    return $results;
}

/**
 * Pobierz faktury dla zlecenia
 */
function handleGetJobInvoices($jobId) {
    $user = requireAuth();
    
    try {
        $pdo = getDB();
        
        // Upewnij się że tabela istnieje
        createInvoicesTable($pdo);
        
        $stmt = $pdo->prepare("
            SELECT * FROM invoices 
            WHERE job_id = ? 
            ORDER BY created_at DESC
        ");
        $stmt->execute(array($jobId));
        $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $mapped = array();
        foreach ($invoices as $inv) {
            // Mapuj typ dla zgodności z typem frontendowym Invoice
            $invoiceType = $inv['type'];
            if ($inv['type'] === 'vat') $invoiceType = 'invoice';
            
            $mapped[] = array(
                'id' => intval($inv['id']),
                'jobId' => $inv['job_id'],
                'infaktId' => intval($inv['infakt_id']),
                'infaktNumber' => $inv['infakt_number'],
                'infakt_number' => $inv['infakt_number'], // snake_case dla kompatybilności z InvoiceModule
                'type' => $invoiceType,
                'clientId' => intval($inv['client_id']),
                'totalNet' => floatval($inv['total_net']),
                'totalGross' => floatval($inv['total_gross']),
                'status' => $inv['status'],
                'shareLink' => $inv['share_link'],
                'share_link' => $inv['share_link'], // snake_case dla kompatybilności
                'createdAt' => $inv['created_at'],
                'created_at' => $inv['created_at'] // snake_case dla kompatybilności z InvoiceModule
            );
        }
        
        jsonResponse(array('success' => true, 'invoices' => $mapped));
    } catch (Exception $e) {
        error_log('Get job invoices error: ' . $e->getMessage());
        jsonResponse(array('success' => true, 'invoices' => array()));
    }
}

/**
 * Helper do tworzenia tabeli invoices
 */
function createInvoicesTable($pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            job_id VARCHAR(50),
            infakt_id INT,
            infakt_number VARCHAR(50),
            type ENUM('proforma', 'vat', 'advance', 'final') DEFAULT 'proforma',
            client_id INT,
            total_net DECIMAL(10,2),
            total_gross DECIMAL(10,2),
            status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
            share_link VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

// =============================================================================
// GŁÓWNA FUNKCJA HANDLERA (wywoływana z index.php)
// =============================================================================

/**
 * GET /api/invoices
 * Pobierz listę wszystkich faktur
 */
function handleGetAllInvoices() {
    $user = requireAuth();
    
    try {
        $pdo = getDB();
        
        // Upewnij się że tabela istnieje
        createInvoicesTable($pdo);
        
        // Pobierz parametry filtrowania (opcjonalnie)
        $type = isset($_GET['type']) ? $_GET['type'] : null;
        $status = isset($_GET['status']) ? $_GET['status'] : null;
        
        $query = "
            SELECT i.*, j.title as job_title, j.friendly_id as job_friendly_id 
            FROM invoices i
            LEFT JOIN jobs_ai j ON i.job_id = j.id
            WHERE 1=1
        ";
        $params = array();
        
        if ($type && $type !== 'all') {
            $query .= " AND i.type = ?";
            $params[] = $type;
        }
        
        if ($status) {
            $query .= " AND i.status = ?";
            $params[] = $status;
        }
        
        $query .= " ORDER BY i.created_at DESC LIMIT 100";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        error_log("[invoices] Found " . count($invoices) . " invoices in DB");
        
        $mapped = array();
        foreach ($invoices as $inv) {
            $mapped[] = array(
                'id' => intval($inv['id']),
                'jobId' => $inv['job_id'],
                'jobTitle' => $inv['job_title'] ? $inv['job_title'] : 'Zlecenie #' . $inv['job_id'],
                'jobFriendlyId' => $inv['job_friendly_id'],
                'infaktId' => intval($inv['infakt_id']),
                'infaktNumber' => $inv['infakt_number'],
                'type' => $inv['type'],
                'clientId' => intval($inv['client_id']),
                'totalNet' => floatval($inv['total_net']),
                'totalGross' => floatval($inv['total_gross']),
                'status' => $inv['status'],
                'shareLink' => $inv['share_link'],
                'createdAt' => $inv['created_at']
            );
        }
        
        jsonResponse(array('success' => true, 'invoices' => $mapped));
    } catch (Exception $e) {
        error_log('[invoices] Error in handleGetAllInvoices: ' . $e->getMessage());
        jsonResponse(array('success' => true, 'invoices' => array(), 'error' => $e->getMessage()));
    }
}

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
            case 'sync-status':
                handleSyncStatus();
                break;
            case 'attach':
                handleAttachInvoice();
                break;
            case 'full-sync':
                handleFullSync();
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
            // Lista wszystkich faktur
            handleGetAllInvoices();
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
        } elseif ($uri === 'sync-status' || $uri === 'invoices/sync-status') {
            handleSyncStatus();
        } elseif ($uri === 'attach' || $uri === 'invoices/attach') {
            handleAttachInvoice();
        } elseif ($uri === 'full-sync' || $uri === 'invoices/full-sync') {
            handleFullSync();
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