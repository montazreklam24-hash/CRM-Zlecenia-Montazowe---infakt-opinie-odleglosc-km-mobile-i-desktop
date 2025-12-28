<?php
/**
 * CRM Zlecenia Montażowe - API Kontrahentów
 */

require_once __DIR__ . '/config.php';

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
            if (!$id) jsonResponse(['error' => 'Client ID required'], 400);
            updateClient($id);
            break;
        case 'DELETE':
            if (!$id) jsonResponse(['error' => 'Client ID required'], 400);
            deleteClient($id);
            break;
        default:
            jsonResponse(['error' => 'Method not allowed'], 405);
    }
}

function getClients() {
    $user = requireAuth();
    $pdo = getDB();
    
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    
    if ($search) {
        $stmt = $pdo->prepare("
            SELECT c.*, 
            (SELECT COUNT(*) FROM jobs_ai WHERE client_id = c.id) as jobs_count
            FROM clients c 
            WHERE company_name LIKE ? OR name LIKE ? OR nip LIKE ? OR email LIKE ?
            ORDER BY company_name ASC
        ");
        $s = "%$search%";
        $stmt->execute([$s, $s, $s, $s]);
    } else {
        $stmt = $pdo->query("
            SELECT c.*, 
            (SELECT COUNT(*) FROM jobs_ai WHERE client_id = c.id) as jobs_count
            FROM clients c 
            ORDER BY company_name ASC
        ");
    }
    
    $clients = $stmt->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse(['success' => true, 'clients' => $clients]);
}

function getClient($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    // Podstawowe dane
    $stmt = $pdo->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([$id]);
    $client = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$client) jsonResponse(['error' => 'Klient nie istnieje'], 404);
    
    // Kontakty
    $stmt = $pdo->prepare("SELECT * FROM client_contacts WHERE client_id = ?");
    $stmt->execute([$id]);
    $client['contacts'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Adresy
    $stmt = $pdo->prepare("SELECT * FROM client_addresses WHERE client_id = ?");
    $stmt->execute([$id]);
    $client['addresses'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Notatki
    $stmt = $pdo->prepare("SELECT * FROM client_notes WHERE client_id = ? ORDER BY created_at DESC");
    $stmt->execute([$id]);
    $client['notes'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Historia zleceń
    $stmt = $pdo->prepare("SELECT id, friendly_id, title, status, created_at FROM jobs_ai WHERE client_id = ? ORDER BY created_at DESC");
    $stmt->execute([$id]);
    $client['jobs'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    jsonResponse(['success' => true, 'client' => $client]);
}

function createClient() {
    $user = requireAuth();
    $pdo = getDB();
    $input = getJsonInput();
    
    $stmt = $pdo->prepare("
        INSERT INTO clients (company_name, name, email, phone, nip, address, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $input['company_name'] ?? null,
        $input['name'] ?? null,
        $input['email'] ?? null,
        $input['phone'] ?? null,
        $input['nip'] ?? null,
        $input['address'] ?? null,
        $input['notes'] ?? null,
        $user['id']
    ]);
    
    $clientId = $pdo->lastInsertId();
    jsonResponse(['success' => true, 'id' => $clientId], 201);
}

function updateClient($id) {
    $user = requireAuth();
    $pdo = getDB();
    $input = getJsonInput();
    
    $fields = ['company_name', 'name', 'email', 'phone', 'nip', 'address', 'notes'];
    $updates = [];
    $params = [];
    
    foreach ($fields as $f) {
        if (isset($input[$f])) {
            $updates[] = "$f = ?";
            $params[] = $input[$f];
        }
    }
    
    if (empty($updates)) jsonResponse(['error' => 'No fields to update'], 400);
    
    $params[] = $id;
    $stmt = $pdo->prepare("UPDATE clients SET " . implode(', ', $updates) . " WHERE id = ?");
    $stmt->execute($params);
    
    jsonResponse(['success' => true]);
}

function deleteClient($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare("DELETE FROM clients WHERE id = ?");
    $stmt->execute([$id]);
    
    jsonResponse(['success' => true]);
}
