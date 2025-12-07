<?php
/**
 * CRM Zlecenia Montażowe - API Klientów
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';

/**
 * Router dla /api/clients
 */
function handleClients($method, $id = null) {
    switch ($method) {
        case 'GET':
            if ($id) {
                getClient($id);
            } else {
                getClients();
            }
            break;
        case 'POST':
            createClient();
            break;
        case 'PUT':
            if (!$id) {
                jsonResponse(array('error' => 'Client ID required'), 400);
            }
            updateClient($id);
            break;
        case 'DELETE':
            if (!$id) {
                jsonResponse(array('error' => 'Client ID required'), 400);
            }
            deleteClient($id);
            break;
        default:
            jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}

/**
 * GET /api/clients - Lista klientów
 */
function getClients() {
    $user = requireAuth();
    $pdo = getDB();
    
    // Parametry
    $search = isset($_GET['search']) ? $_GET['search'] : null;
    $type = isset($_GET['type']) ? $_GET['type'] : null;
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    
    $where = array('1=1');
    $params = array();
    
    if ($search) {
        $where[] = '(company_name LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR nip LIKE ? OR city LIKE ?)';
        $searchParam = '%' . $search . '%';
        for ($i = 0; $i < 7; $i++) {
            $params[] = $searchParam;
        }
    }
    
    if ($type && in_array($type, array('company', 'person'))) {
        $where[] = 'type = ?';
        $params[] = $type;
    }
    
    $whereClause = implode(' AND ', $where);
    
    // Pobierz klientów ze statystykami (z obu tabel zleceń)
    $sql = "
        SELECT 
            c.*,
            (SELECT COUNT(*) FROM jobs_ai WHERE client_id = c.id) + 
            (SELECT COUNT(*) FROM jobs_simple WHERE client_name = c.name OR client_name = c.company_name) as jobs_count,
            (SELECT COUNT(*) FROM invoices WHERE client_id = c.id) as invoices_count,
            (SELECT COALESCE(SUM(amount_gross), 0) FROM invoices WHERE client_id = c.id AND status = 'paid') as total_paid
        FROM clients c
        WHERE {$whereClause}
        ORDER BY c.company_name ASC, c.name ASC
        LIMIT ? OFFSET ?
    ";
    
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $clients = $stmt->fetchAll();
    
    // Policz wszystkich
    $countSql = "SELECT COUNT(*) as total FROM clients c WHERE {$whereClause}";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute(array_slice($params, 0, -2));
    $count = $stmt->fetch();
    
    // Mapuj na format frontend
    $mapped = array();
    foreach ($clients as $c) {
        $mapped[] = mapClientToFrontend($c);
    }
    
    jsonResponse(array(
        'success' => true,
        'clients' => $mapped,
        'total' => intval($count['total']),
        'limit' => $limit,
        'offset' => $offset
    ));
}

/**
 * GET /api/clients/{id}
 */
function getClient($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    // Pobierz klienta
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute(array($id));
    $client = $stmt->fetch();
    
    if (!$client) {
        jsonResponse(array('error' => 'Klient nie istnieje'), 404);
    }
    
    // Pobierz osoby kontaktowe
    $stmt = $pdo->prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, first_name ASC');
    $stmt->execute(array($id));
    $contacts = $stmt->fetchAll();
    
    // Pobierz ostatnie zlecenia (z obu tabel)
    $stmt = $pdo->prepare("
        (SELECT id, friendly_id, title, status, column_id, created_at, 'ai' as job_type 
        FROM jobs_ai WHERE client_id = ?)
        UNION ALL
        (SELECT id, friendly_id, title, status, column_id, created_at, 'simple' as job_type 
        FROM jobs_simple WHERE client_name = (SELECT name FROM clients WHERE id = ?))
        ORDER BY created_at DESC 
        LIMIT 10
    ");
    $stmt->execute(array($id, $id));
    $jobs = $stmt->fetchAll();
    
    // Pobierz ostatnie faktury
    $stmt = $pdo->prepare('
        SELECT id, number, type, total_gross, payment_status, created_at 
        FROM invoices 
        WHERE client_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
    ');
    $stmt->execute(array($id));
    $invoices = $stmt->fetchAll();
    
    $result = mapClientToFrontend($client);
    $result['contacts'] = $contacts;
    $result['recentJobs'] = $jobs;
    $result['recentInvoices'] = $invoices;
    
    jsonResponse(array('success' => true, 'client' => $result));
}

/**
 * POST /api/clients
 */
function createClient() {
    $user = requireAuth();
    $input = getJsonInput();
    $pdo = getDB();
    
    // Walidacja
    $type = isset($input['type']) ? $input['type'] : 'company';
    $companyName = isset($input['companyName']) ? trim($input['companyName']) : '';
    $firstName = isset($input['firstName']) ? trim($input['firstName']) : '';
    $lastName = isset($input['lastName']) ? trim($input['lastName']) : '';
    
    if ($type === 'company' && empty($companyName)) {
        jsonResponse(array('error' => 'Podaj nazwę firmy'), 400);
    }
    if ($type === 'person' && empty($firstName) && empty($lastName)) {
        jsonResponse(array('error' => 'Podaj imię lub nazwisko'), 400);
    }
    
    // Sprawdź unikalność NIP
    $nip = isset($input['nip']) ? preg_replace('/[^0-9]/', '', $input['nip']) : null;
    if ($nip) {
        $stmt = $pdo->prepare('SELECT id FROM clients WHERE nip = ?');
        $stmt->execute(array($nip));
        if ($stmt->fetch()) {
            jsonResponse(array('error' => 'Klient z tym NIP już istnieje'), 400);
        }
    }
    
    // Wstaw klienta
    $stmt = $pdo->prepare('
        INSERT INTO clients (
            type, company_name, first_name, last_name, nip, regon,
            email, phone, phone2, website,
            street, building_no, apartment_no, city, post_code, country,
            payment_method, payment_days, notes, tags, source,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    $stmt->execute(array(
        $type,
        $companyName,
        $firstName,
        $lastName,
        $nip,
        isset($input['regon']) ? $input['regon'] : null,
        isset($input['email']) ? $input['email'] : null,
        isset($input['phone']) ? $input['phone'] : null,
        isset($input['phone2']) ? $input['phone2'] : null,
        isset($input['website']) ? $input['website'] : null,
        isset($input['street']) ? $input['street'] : null,
        isset($input['buildingNo']) ? $input['buildingNo'] : null,
        isset($input['apartmentNo']) ? $input['apartmentNo'] : null,
        isset($input['city']) ? $input['city'] : null,
        isset($input['postCode']) ? $input['postCode'] : null,
        isset($input['country']) ? $input['country'] : 'Polska',
        isset($input['paymentMethod']) ? $input['paymentMethod'] : 'transfer',
        isset($input['paymentDays']) ? intval($input['paymentDays']) : 7,
        isset($input['notes']) ? $input['notes'] : null,
        isset($input['tags']) ? $input['tags'] : null,
        isset($input['source']) ? $input['source'] : null,
        $user['id']
    ));
    
    $clientId = $pdo->lastInsertId();
    
    // Dodaj osoby kontaktowe
    if (isset($input['contacts']) && is_array($input['contacts'])) {
        saveClientContacts($clientId, $input['contacts']);
    }
    
    // Pobierz i zwróć
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute(array($clientId));
    $client = $stmt->fetch();
    
    jsonResponse(array('success' => true, 'client' => mapClientToFrontend($client)), 201);
}

/**
 * PUT /api/clients/{id}
 */
function updateClient($id) {
    $user = requireAuth();
    $input = getJsonInput();
    $pdo = getDB();
    
    // Sprawdź czy istnieje
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute(array($id));
    $client = $stmt->fetch();
    
    if (!$client) {
        jsonResponse(array('error' => 'Klient nie istnieje'), 404);
    }
    
    $updates = array();
    $params = array();
    
    $allowedFields = array(
        'type' => 'type',
        'company_name' => 'companyName',
        'first_name' => 'firstName',
        'last_name' => 'lastName',
        'nip' => 'nip',
        'regon' => 'regon',
        'email' => 'email',
        'phone' => 'phone',
        'phone2' => 'phone2',
        'website' => 'website',
        'street' => 'street',
        'building_no' => 'buildingNo',
        'apartment_no' => 'apartmentNo',
        'city' => 'city',
        'post_code' => 'postCode',
        'country' => 'country',
        'payment_method' => 'paymentMethod',
        'payment_days' => 'paymentDays',
        'notes' => 'notes',
        'tags' => 'tags',
        'source' => 'source',
        'rating' => 'rating',
        'is_active' => 'isActive'
    );
    
    foreach ($allowedFields as $dbField => $inputField) {
        if (isset($input[$inputField])) {
            $value = $input[$inputField];
            
            // Czyść NIP
            if ($dbField === 'nip' && $value) {
                $value = preg_replace('/[^0-9]/', '', $value);
                
                // Sprawdź unikalność
                $stmt = $pdo->prepare('SELECT id FROM clients WHERE nip = ? AND id != ?');
                $stmt->execute(array($value, $id));
                if ($stmt->fetch()) {
                    jsonResponse(array('error' => 'Klient z tym NIP już istnieje'), 400);
                }
            }
            
            $updates[] = "`{$dbField}` = ?";
            $params[] = $value;
        }
    }
    
    if (count($updates) > 0) {
        $params[] = $id;
        $sql = 'UPDATE clients SET ' . implode(', ', $updates) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    // Aktualizuj osoby kontaktowe
    if (isset($input['contacts']) && is_array($input['contacts'])) {
        $stmt = $pdo->prepare('DELETE FROM client_contacts WHERE client_id = ?');
        $stmt->execute(array($id));
        saveClientContacts($id, $input['contacts']);
    }
    
    // Pobierz i zwróć
    $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute(array($id));
    $client = $stmt->fetch();
    
    jsonResponse(array('success' => true, 'client' => mapClientToFrontend($client)));
}

/**
 * DELETE /api/clients/{id}
 */
function deleteClient($id) {
    $user = requireAdmin();
    $pdo = getDB();
    
    // Sprawdź czy istnieje
    $stmt = $pdo->prepare('SELECT id FROM clients WHERE id = ?');
    $stmt->execute(array($id));
    if (!$stmt->fetch()) {
        jsonResponse(array('error' => 'Klient nie istnieje'), 404);
    }
    
    // Usuń (CASCADE usunie kontakty)
    $stmt = $pdo->prepare('DELETE FROM clients WHERE id = ?');
    $stmt->execute(array($id));
    
    jsonResponse(array('success' => true, 'message' => 'Klient usunięty'));
}

// =========================================================================
// HELPERS
// =========================================================================

function saveClientContacts($clientId, $contacts) {
    $pdo = getDB();
    $stmt = $pdo->prepare('
        INSERT INTO client_contacts (client_id, first_name, last_name, position, email, phone, is_primary, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    foreach ($contacts as $contact) {
        $stmt->execute(array(
            $clientId,
            isset($contact['firstName']) ? $contact['firstName'] : '',
            isset($contact['lastName']) ? $contact['lastName'] : '',
            isset($contact['position']) ? $contact['position'] : null,
            isset($contact['email']) ? $contact['email'] : null,
            isset($contact['phone']) ? $contact['phone'] : null,
            isset($contact['isPrimary']) && $contact['isPrimary'] ? 1 : 0,
            isset($contact['notes']) ? $contact['notes'] : null
        ));
    }
}

function mapClientToFrontend($client) {
    return array(
        'id' => intval($client['id']),
        'type' => $client['type'],
        'companyName' => $client['company_name'],
        'firstName' => $client['first_name'],
        'lastName' => $client['last_name'],
        'displayName' => $client['type'] === 'company' 
            ? $client['company_name'] 
            : trim($client['first_name'] . ' ' . $client['last_name']),
        'nip' => $client['nip'],
        'regon' => $client['regon'],
        'email' => $client['email'],
        'phone' => $client['phone'],
        'phone2' => $client['phone2'],
        'website' => $client['website'],
        'street' => $client['street'],
        'buildingNo' => $client['building_no'],
        'apartmentNo' => $client['apartment_no'],
        'city' => $client['city'],
        'postCode' => $client['post_code'],
        'country' => $client['country'],
        'fullAddress' => buildFullAddress($client),
        'paymentMethod' => $client['payment_method'],
        'paymentDays' => intval($client['payment_days']),
        'notes' => $client['notes'],
        'tags' => $client['tags'],
        'source' => $client['source'],
        'rating' => $client['rating'] ? intval($client['rating']) : null,
        'isActive' => (bool)$client['is_active'],
        'infaktId' => $client['infakt_id'] ? intval($client['infakt_id']) : null,
        'createdAt' => strtotime($client['created_at']) * 1000,
        // Stats (jeśli pobrane)
        'jobsCount' => isset($client['jobs_count']) ? intval($client['jobs_count']) : 0,
        'invoicesCount' => isset($client['invoices_count']) ? intval($client['invoices_count']) : 0,
        'totalPaid' => isset($client['total_paid']) ? floatval($client['total_paid']) : 0,
    );
}

function buildFullAddress($client) {
    $parts = array();
    
    if (!empty($client['street'])) {
        $addr = $client['street'];
        if (!empty($client['building_no'])) {
            $addr .= ' ' . $client['building_no'];
            if (!empty($client['apartment_no'])) {
                $addr .= '/' . $client['apartment_no'];
            }
        }
        $parts[] = $addr;
    }
    
    if (!empty($client['post_code']) || !empty($client['city'])) {
        $cityPart = '';
        if (!empty($client['post_code'])) {
            $cityPart = $client['post_code'] . ' ';
        }
        if (!empty($client['city'])) {
            $cityPart .= $client['city'];
        }
        $parts[] = trim($cityPart);
    }
    
    return implode(', ', $parts);
}

// =========================================================================
// GUS API - Pobieranie danych firmy po NIP
// =========================================================================

function handleGusLookup() {
    $user = requireAuth();
    $input = getJsonInput();
    
    $nip = isset($input['nip']) ? preg_replace('/[^0-9]/', '', $input['nip']) : '';
    
    if (strlen($nip) !== 10) {
        jsonResponse(array('error' => 'Nieprawidłowy NIP'), 400);
    }
    
    // Użyj darmowego API REGON lub własnej implementacji
    // Tu przykład z API rejestr.io
    $url = 'https://rejestr.io/api/v1/krs?nip=' . $nip;
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if ($data && isset($data['items'][0])) {
        $company = $data['items'][0];
        jsonResponse(array(
            'success' => true,
            'data' => array(
                'companyName' => isset($company['nazwa']) ? $company['nazwa'] : '',
                'nip' => $nip,
                'regon' => isset($company['regon']) ? $company['regon'] : '',
                'street' => isset($company['adres']['ulica']) ? $company['adres']['ulica'] : '',
                'buildingNo' => isset($company['adres']['numer']) ? $company['adres']['numer'] : '',
                'city' => isset($company['adres']['miejscowosc']) ? $company['adres']['miejscowosc'] : '',
                'postCode' => isset($company['adres']['kod']) ? $company['adres']['kod'] : '',
            )
        ));
    } else {
        jsonResponse(array('error' => 'Nie znaleziono firmy'), 404);
    }
}




