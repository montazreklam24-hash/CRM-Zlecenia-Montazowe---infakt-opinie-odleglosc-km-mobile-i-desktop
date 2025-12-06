<?php
/**
 * CRM Zlecenia Montażowe - API Ofert
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';

/**
 * Router dla /api/offers
 */
function handleOffers($method, $id = null) {
    switch ($method) {
        case 'GET':
            if ($id) {
                getOffer($id);
            } else {
                getOffers();
            }
            break;
        case 'POST':
            createOffer();
            break;
        case 'PUT':
            if (!$id) {
                jsonResponse(array('error' => 'Offer ID required'), 400);
            }
            updateOffer($id);
            break;
        case 'DELETE':
            if (!$id) {
                jsonResponse(array('error' => 'Offer ID required'), 400);
            }
            deleteOffer($id);
            break;
        default:
            jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}

/**
 * GET /api/offers
 */
function getOffers() {
    $user = requireAuth();
    $pdo = getDB();
    
    $clientId = isset($_GET['client_id']) ? intval($_GET['client_id']) : null;
    $status = isset($_GET['status']) ? $_GET['status'] : null;
    
    $where = array('1=1');
    $params = array();
    
    if ($clientId) {
        $where[] = 'o.client_id = ?';
        $params[] = $clientId;
    }
    if ($status) {
        $where[] = 'o.status = ?';
        $params[] = $status;
    }
    
    $whereClause = implode(' AND ', $where);
    
    $sql = "
        SELECT 
            o.*,
            c.company_name as client_company,
            c.first_name as client_first_name,
            c.last_name as client_last_name
        FROM offers o
        LEFT JOIN clients c ON o.client_id = c.id
        WHERE {$whereClause}
        ORDER BY o.created_at DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $offers = $stmt->fetchAll();
    
    // Pobierz pozycje dla każdej oferty
    foreach ($offers as &$offer) {
        $offer['items'] = getOfferItems($offer['id']);
        $offer = mapOfferToFrontend($offer);
    }
    
    jsonResponse(array('success' => true, 'offers' => $offers));
}

/**
 * GET /api/offers/{id}
 */
function getOffer($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('
        SELECT 
            o.*,
            c.company_name as client_company,
            c.first_name as client_first_name,
            c.last_name as client_last_name,
            c.email as client_email,
            c.phone as client_phone
        FROM offers o
        LEFT JOIN clients c ON o.client_id = c.id
        WHERE o.id = ?
    ');
    $stmt->execute(array($id));
    $offer = $stmt->fetch();
    
    if (!$offer) {
        jsonResponse(array('error' => 'Oferta nie istnieje'), 404);
    }
    
    $offer['items'] = getOfferItems($id);
    
    jsonResponse(array('success' => true, 'offer' => mapOfferToFrontend($offer)));
}

/**
 * POST /api/offers
 */
function createOffer() {
    $user = requireAuth();
    $input = getJsonInput();
    $pdo = getDB();
    
    $clientId = isset($input['clientId']) ? intval($input['clientId']) : null;
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
    
    // Generuj numer oferty
    $offerNumber = generateOfferNumber();
    
    // Termin ważności - 14 dni
    $validUntil = date('Y-m-d', strtotime('+14 days'));
    
    $stmt = $pdo->prepare('
        INSERT INTO offers (
            client_id, offer_number, status, valid_until,
            total_net, total_vat, total_gross,
            title, introduction, conclusion, notes,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    $stmt->execute(array(
        $clientId,
        $offerNumber,
        'draft',
        $validUntil,
        $totalNet,
        $totalVat,
        $totalGross,
        isset($input['title']) ? $input['title'] : null,
        isset($input['introduction']) ? $input['introduction'] : null,
        isset($input['conclusion']) ? $input['conclusion'] : null,
        isset($input['notes']) ? $input['notes'] : null,
        $user['id']
    ));
    
    $offerId = $pdo->lastInsertId();
    
    // Dodaj pozycje
    saveOfferItems($offerId, $items);
    
    // Pobierz i zwróć
    $stmt = $pdo->prepare('SELECT * FROM offers WHERE id = ?');
    $stmt->execute(array($offerId));
    $offer = $stmt->fetch();
    $offer['items'] = getOfferItems($offerId);
    
    jsonResponse(array('success' => true, 'offer' => mapOfferToFrontend($offer)), 201);
}

/**
 * PUT /api/offers/{id}
 */
function updateOffer($id) {
    $user = requireAuth();
    $input = getJsonInput();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT * FROM offers WHERE id = ?');
    $stmt->execute(array($id));
    $offer = $stmt->fetch();
    
    if (!$offer) {
        jsonResponse(array('error' => 'Oferta nie istnieje'), 404);
    }
    
    $updates = array();
    $params = array();
    
    // Aktualizuj pola
    $allowedFields = array(
        'status' => 'status',
        'valid_until' => 'validUntil',
        'title' => 'title',
        'introduction' => 'introduction',
        'conclusion' => 'conclusion',
        'notes' => 'notes',
        'discount_percent' => 'discountPercent'
    );
    
    foreach ($allowedFields as $dbField => $inputField) {
        if (isset($input[$inputField])) {
            $updates[] = "`{$dbField}` = ?";
            $params[] = $input[$inputField];
        }
    }
    
    // Specjalne akcje statusu
    if (isset($input['action'])) {
        switch ($input['action']) {
            case 'send':
                $updates[] = 'status = ?';
                $params[] = 'sent';
                $updates[] = 'sent_at = NOW()';
                if (isset($input['sentTo'])) {
                    $updates[] = 'sent_to = ?';
                    $params[] = $input['sentTo'];
                }
                break;
            case 'accept':
                $updates[] = 'status = ?';
                $params[] = 'accepted';
                $updates[] = 'accepted_at = NOW()';
                break;
            case 'reject':
                $updates[] = 'status = ?';
                $params[] = 'rejected';
                $updates[] = 'rejected_at = NOW()';
                if (isset($input['rejectionReason'])) {
                    $updates[] = 'rejection_reason = ?';
                    $params[] = $input['rejectionReason'];
                }
                break;
        }
    }
    
    // Aktualizuj pozycje jeśli podane
    if (isset($input['items']) && is_array($input['items'])) {
        // Usuń stare pozycje
        $stmt = $pdo->prepare('DELETE FROM offer_items WHERE offer_id = ?');
        $stmt->execute(array($id));
        
        // Dodaj nowe
        saveOfferItems($id, $input['items']);
        
        // Przelicz sumy
        $totalNet = 0;
        $totalGross = 0;
        foreach ($input['items'] as $item) {
            $itemNet = floatval($item['unitPriceNet']) * floatval($item['quantity']);
            $vatRate = isset($item['vatRate']) ? intval($item['vatRate']) : 23;
            $itemGross = $itemNet * (1 + $vatRate / 100);
            $totalNet += $itemNet;
            $totalGross += $itemGross;
        }
        
        $updates[] = 'total_net = ?';
        $params[] = $totalNet;
        $updates[] = 'total_vat = ?';
        $params[] = $totalGross - $totalNet;
        $updates[] = 'total_gross = ?';
        $params[] = $totalGross;
    }
    
    if (count($updates) > 0) {
        $params[] = $id;
        $sql = 'UPDATE offers SET ' . implode(', ', $updates) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    // Pobierz i zwróć
    $stmt = $pdo->prepare('SELECT * FROM offers WHERE id = ?');
    $stmt->execute(array($id));
    $offer = $stmt->fetch();
    $offer['items'] = getOfferItems($id);
    
    jsonResponse(array('success' => true, 'offer' => mapOfferToFrontend($offer)));
}

/**
 * DELETE /api/offers/{id}
 */
function deleteOffer($id) {
    $user = requireAdmin();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT id FROM offers WHERE id = ?');
    $stmt->execute(array($id));
    if (!$stmt->fetch()) {
        jsonResponse(array('error' => 'Oferta nie istnieje'), 404);
    }
    
    $stmt = $pdo->prepare('DELETE FROM offers WHERE id = ?');
    $stmt->execute(array($id));
    
    jsonResponse(array('success' => true, 'message' => 'Oferta usunięta'));
}

/**
 * POST /api/offers/{id}/convert
 * Konwertuj ofertę na zlecenie
 */
function convertOfferToJob($offerId) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT * FROM offers WHERE id = ?');
    $stmt->execute(array($offerId));
    $offer = $stmt->fetch();
    
    if (!$offer) {
        jsonResponse(array('error' => 'Oferta nie istnieje'), 404);
    }
    
    // Pobierz dane klienta
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute(array($offer['client_id']));
    $client = $stmt->fetch();
    
    // Utwórz zlecenie
    $friendlyId = generateFriendlyId();
    
    $stmt = $pdo->prepare('
        INSERT INTO jobs (
            friendly_id, client_id, offer_id, user_id,
            job_title, client_name, company_name, contact_person, phone_number,
            scope_work_text, column_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    $stmt->execute(array(
        $friendlyId,
        $offer['client_id'],
        $offerId,
        $user['id'],
        $offer['title'] ?: 'Zlecenie z oferty ' . $offer['offer_number'],
        $client ? ($client['type'] === 'company' ? $client['company_name'] : trim($client['first_name'] . ' ' . $client['last_name'])) : null,
        $client ? $client['company_name'] : null,
        $client ? trim($client['first_name'] . ' ' . $client['last_name']) : null,
        $client ? $client['phone'] : null,
        $offer['introduction'],
        'PREPARE',
        'NEW'
    ));
    
    $jobId = $pdo->lastInsertId();
    
    // Oznacz ofertę jako zaakceptowaną i powiązaną
    $stmt = $pdo->prepare('UPDATE offers SET status = ?, accepted_at = NOW(), job_id = ? WHERE id = ?');
    $stmt->execute(array('accepted', $jobId, $offerId));
    
    jsonResponse(array('success' => true, 'jobId' => $jobId, 'friendlyId' => $friendlyId));
}

// =========================================================================
// HELPERS
// =========================================================================

function generateOfferNumber() {
    $pdo = getDB();
    $year = date('Y');
    $month = date('m');
    
    $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM offers WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?");
    $stmt->execute(array($year, $month));
    $result = $stmt->fetch();
    
    $number = intval($result['count']) + 1;
    
    return 'OF/' . $year . '/' . $month . '/' . str_pad($number, 3, '0', STR_PAD_LEFT);
}

function getOfferItems($offerId) {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT * FROM offer_items WHERE offer_id = ? ORDER BY sort_order ASC');
    $stmt->execute(array($offerId));
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
            'totalGross' => floatval($item['total_gross']),
            'isOptional' => (bool)$item['is_optional']
        );
    }
    return $result;
}

function saveOfferItems($offerId, $items) {
    $pdo = getDB();
    $stmt = $pdo->prepare('
        INSERT INTO offer_items (offer_id, name, description, quantity, unit, unit_price_net, vat_rate, total_net, total_gross, is_optional, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    foreach ($items as $index => $item) {
        $quantity = isset($item['quantity']) ? floatval($item['quantity']) : 1;
        $unitPriceNet = floatval($item['unitPriceNet']);
        $vatRate = isset($item['vatRate']) ? intval($item['vatRate']) : 23;
        
        $totalNet = $quantity * $unitPriceNet;
        $totalGross = $totalNet * (1 + $vatRate / 100);
        
        $stmt->execute(array(
            $offerId,
            $item['name'],
            isset($item['description']) ? $item['description'] : null,
            $quantity,
            isset($item['unit']) ? $item['unit'] : 'szt.',
            $unitPriceNet,
            $vatRate,
            $totalNet,
            $totalGross,
            isset($item['isOptional']) && $item['isOptional'] ? 1 : 0,
            $index
        ));
    }
}

function mapOfferToFrontend($offer) {
    return array(
        'id' => intval($offer['id']),
        'clientId' => $offer['client_id'] ? intval($offer['client_id']) : null,
        'jobId' => $offer['job_id'] ? intval($offer['job_id']) : null,
        'offerNumber' => $offer['offer_number'],
        'status' => $offer['status'],
        'validUntil' => $offer['valid_until'],
        'totalNet' => floatval($offer['total_net']),
        'totalVat' => floatval($offer['total_vat']),
        'totalGross' => floatval($offer['total_gross']),
        'discountPercent' => floatval($offer['discount_percent']),
        'title' => $offer['title'],
        'introduction' => $offer['introduction'],
        'conclusion' => $offer['conclusion'],
        'notes' => $offer['notes'],
        'pdfPath' => $offer['pdf_path'],
        'sentAt' => $offer['sent_at'] ? strtotime($offer['sent_at']) * 1000 : null,
        'sentTo' => $offer['sent_to'],
        'viewedAt' => $offer['viewed_at'] ? strtotime($offer['viewed_at']) * 1000 : null,
        'acceptedAt' => $offer['accepted_at'] ? strtotime($offer['accepted_at']) * 1000 : null,
        'rejectedAt' => $offer['rejected_at'] ? strtotime($offer['rejected_at']) * 1000 : null,
        'rejectionReason' => $offer['rejection_reason'],
        'createdAt' => strtotime($offer['created_at']) * 1000,
        'items' => isset($offer['items']) ? $offer['items'] : array(),
        // Join data
        'clientName' => isset($offer['client_company']) 
            ? ($offer['client_company'] ?: trim($offer['client_first_name'] . ' ' . $offer['client_last_name']))
            : null,
        'clientEmail' => isset($offer['client_email']) ? $offer['client_email'] : null,
        'clientPhone' => isset($offer['client_phone']) ? $offer['client_phone'] : null,
    );
}



