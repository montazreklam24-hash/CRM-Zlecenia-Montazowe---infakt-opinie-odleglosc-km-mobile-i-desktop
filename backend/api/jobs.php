<?php
/**
 * CRM Zlecenia Montażowe - CRUD Zleceń
 * PHP 5.6 Compatible
 */

if (!defined('CRM_LOADED')) {
    die('Brak dostępu');
}

require_once __DIR__ . '/auth.php';

/**
 * Handler zleceń
 */
function handleJobs($method, $id) {
    switch ($method) {
        case 'GET':
            if ($id) {
                getJob($id);
            } else {
                getJobs();
            }
            break;
            
        case 'POST':
            createJob();
            break;
            
        case 'PUT':
            if ($id) {
                updateJob($id);
            } else {
                jsonError('ID zlecenia wymagane', 400);
            }
            break;
            
        case 'DELETE':
            if ($id) {
                deleteJob($id);
            } else {
                jsonError('ID zlecenia wymagane', 400);
            }
            break;
            
        default:
            jsonError('Metoda niedozwolona', 405);
    }
}

/**
 * Pobiera listę zleceń
 */
function getJobs() {
    $user = verifyAuth();
    $db = getDB();
    
    // Parametry filtrowania
    $status = isset($_GET['status']) ? $_GET['status'] : null;
    $columnId = isset($_GET['column_id']) ? $_GET['column_id'] : null;
    $search = isset($_GET['search']) ? $_GET['search'] : null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    $where = array("1=1");
    $params = array();
    
    if ($status) {
        $where[] = "j.status = ?";
        $params[] = $status;
    }
    
    if ($columnId) {
        $where[] = "j.column_id = ?";
        $params[] = $columnId;
    }
    
    if ($search) {
        $where[] = "(j.job_title LIKE ? OR j.client_name LIKE ? OR j.address LIKE ?)";
        $searchTerm = '%' . $search . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }
    
    $whereClause = implode(' AND ', $where);
    
    $sql = "
        SELECT 
            j.*,
            u.name as created_by_name,
            (SELECT COUNT(*) FROM checklist_items WHERE job_id = j.id) as checklist_total,
            (SELECT COUNT(*) FROM checklist_items WHERE job_id = j.id AND is_checked = 1) as checklist_done,
            (SELECT file_path FROM job_images WHERE job_id = j.id AND is_cover = 1 LIMIT 1) as cover_image
        FROM jobs j
        LEFT JOIN users u ON j.created_by = u.id
        WHERE {$whereClause}
        ORDER BY j.created_at DESC
        LIMIT ? OFFSET ?
    ";
    
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $jobs = $stmt->fetchAll();
    
    // Formatuj dane
    $result = array();
    foreach ($jobs as $job) {
        $result[] = formatJobForResponse($job);
    }
    
    // Pobierz łączną liczbę
    $countSql = "SELECT COUNT(*) as total FROM jobs j WHERE {$whereClause}";
    $countParams = array_slice($params, 0, -2); // Usuń limit i offset
    $countStmt = $db->prepare($countSql);
    $countStmt->execute($countParams);
    $total = $countStmt->fetch();
    
    jsonResponse(array(
        'jobs' => $result,
        'total' => (int)$total['total'],
        'limit' => $limit,
        'offset' => $offset
    ));
}

/**
 * Pobiera szczegóły zlecenia
 */
function getJob($id) {
    $user = verifyAuth();
    $db = getDB();
    
    $stmt = $db->prepare("
        SELECT 
            j.*,
            u.name as created_by_name
        FROM jobs j
        LEFT JOIN users u ON j.created_by = u.id
        WHERE j.id = ? OR j.friendly_id = ?
    ");
    $stmt->execute(array($id, $id));
    $job = $stmt->fetch();
    
    if (!$job) {
        jsonError('Zlecenie nie znalezione', 404);
    }
    
    // Pobierz lokalizacje
    $stmt = $db->prepare("SELECT * FROM job_locations WHERE job_id = ? ORDER BY sort_order");
    $stmt->execute(array($job['id']));
    $locations = $stmt->fetchAll();
    
    // Pobierz obrazy
    $stmt = $db->prepare("SELECT * FROM job_images WHERE job_id = ? ORDER BY is_cover DESC, sort_order");
    $stmt->execute(array($job['id']));
    $images = $stmt->fetchAll();
    
    // Pobierz checklistę
    $stmt = $db->prepare("SELECT * FROM checklist_items WHERE job_id = ? ORDER BY sort_order");
    $stmt->execute(array($job['id']));
    $checklist = $stmt->fetchAll();
    
    $result = formatJobForResponse($job, true);
    $result['locations'] = $locations;
    $result['checklist'] = array_map(function($item) {
        return array(
            'id' => (string)$item['id'],
            'task' => $item['task'],
            'isChecked' => (bool)$item['is_checked'],
            'addedBy' => $item['added_by'],
            'addedAt' => strtotime($item['added_at']) * 1000,
            'completedBy' => $item['completed_by'],
            'completedAt' => $item['completed_at'] ? strtotime($item['completed_at']) * 1000 : null
        );
    }, $checklist);
    
    // Formatuj obrazy
    $projectImages = array();
    $completionImages = array();
    foreach ($images as $img) {
        $imgData = array(
            'id' => (int)$img['id'],
            'path' => $img['file_path'],
            'isCover' => (bool)$img['is_cover']
        );
        if ($img['image_type'] === 'project') {
            $projectImages[] = $imgData;
        } else {
            $completionImages[] = $imgData;
        }
    }
    $result['projectImages'] = $projectImages;
    $result['completionImages'] = $completionImages;
    
    jsonResponse($result);
}

/**
 * Tworzy nowe zlecenie
 */
function createJob() {
    $user = verifyAuth();
    
    // Tylko admin może tworzyć zlecenia
    if ($user['role'] !== 'admin') {
        jsonError('Brak uprawnień do tworzenia zleceń', 403);
    }
    
    $data = getJsonInput();
    $db = getDB();
    
    // Walidacja
    $jobTitle = isset($data['jobTitle']) ? trim($data['jobTitle']) : '';
    if (empty($jobTitle)) {
        $jobTitle = 'Zlecenie bez nazwy';
    }
    
    $friendlyId = generateFriendlyId();
    
    $stmt = $db->prepare("
        INSERT INTO jobs (
            friendly_id, created_by, job_title, client_name, company_name,
            contact_person, phone_number, address, district,
            latitude, longitude, scope_work_text, scope_work_images,
            payment_type, payment_net, payment_gross, admin_notes, column_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute(array(
        $friendlyId,
        $user['id'],
        $jobTitle,
        isset($data['clientName']) ? $data['clientName'] : null,
        isset($data['companyName']) ? $data['companyName'] : null,
        isset($data['contactPerson']) ? $data['contactPerson'] : null,
        isset($data['phoneNumber']) ? $data['phoneNumber'] : null,
        isset($data['address']) ? $data['address'] : null,
        isset($data['district']) ? $data['district'] : null,
        isset($data['coordinates']['lat']) ? $data['coordinates']['lat'] : null,
        isset($data['coordinates']['lng']) ? $data['coordinates']['lng'] : null,
        isset($data['scopeWorkText']) ? $data['scopeWorkText'] : null,
        isset($data['scopeWorkImages']) ? $data['scopeWorkImages'] : null,
        isset($data['payment']['type']) ? $data['payment']['type'] : 'UNKNOWN',
        isset($data['payment']['netAmount']) ? $data['payment']['netAmount'] : null,
        isset($data['payment']['grossAmount']) ? $data['payment']['grossAmount'] : null,
        isset($data['adminNotes']) ? $data['adminNotes'] : null,
        isset($data['columnId']) ? $data['columnId'] : 'PREPARE'
    ));
    
    $jobId = $db->lastInsertId();
    
    // Dodaj lokalizacje
    if (isset($data['locations']) && is_array($data['locations'])) {
        $locStmt = $db->prepare("
            INSERT INTO job_locations (job_id, full_address, short_label, distance, sort_order)
            VALUES (?, ?, ?, ?, ?)
        ");
        foreach ($data['locations'] as $i => $loc) {
            $locStmt->execute(array(
                $jobId,
                isset($loc['fullAddress']) ? $loc['fullAddress'] : '',
                isset($loc['shortLabel']) ? $loc['shortLabel'] : null,
                isset($loc['distance']) ? $loc['distance'] : null,
                $i
            ));
        }
    }
    
    // Dodaj checklistę
    if (isset($data['checklist']) && is_array($data['checklist'])) {
        $checkStmt = $db->prepare("
            INSERT INTO checklist_items (job_id, task, is_checked, added_by, sort_order)
            VALUES (?, ?, ?, ?, ?)
        ");
        foreach ($data['checklist'] as $i => $item) {
            $checkStmt->execute(array(
                $jobId,
                isset($item['task']) ? $item['task'] : '',
                isset($item['isChecked']) && $item['isChecked'] ? 1 : 0,
                isset($item['addedBy']) ? $item['addedBy'] : $user['name'],
                $i
            ));
        }
    }
    
    // Obsługa obrazów (base64 lub ścieżki)
    if (isset($data['projectImages']) && is_array($data['projectImages'])) {
        saveJobImages($jobId, $data['projectImages'], 'project');
    }
    
    logActivity($user['id'], $jobId, 'job_created', 'Utworzono zlecenie: ' . $jobTitle);
    
    jsonResponse(array(
        'success' => true,
        'id' => (int)$jobId,
        'friendlyId' => $friendlyId,
        'message' => 'Zlecenie utworzone'
    ), 201);
}

/**
 * Aktualizuje zlecenie
 */
function updateJob($id) {
    $user = verifyAuth();
    $data = getJsonInput();
    $db = getDB();
    
    // Sprawdź czy zlecenie istnieje
    $stmt = $db->prepare("SELECT * FROM jobs WHERE id = ?");
    $stmt->execute(array($id));
    $job = $stmt->fetch();
    
    if (!$job) {
        jsonError('Zlecenie nie znalezione', 404);
    }
    
    $updates = array();
    $params = array();
    
    // Pola które można aktualizować
    $allowedFields = array(
        'job_title' => 'jobTitle',
        'client_name' => 'clientName',
        'company_name' => 'companyName',
        'contact_person' => 'contactPerson',
        'phone_number' => 'phoneNumber',
        'address' => 'address',
        'district' => 'district',
        'scope_work_text' => 'scopeWorkText',
        'scope_work_images' => 'scopeWorkImages',
        'admin_notes' => 'adminNotes',
        'completion_notes' => 'completionNotes',
        'status' => 'status',
        'column_id' => 'columnId'
    );
    
    foreach ($allowedFields as $dbField => $jsonField) {
        if (isset($data[$jsonField])) {
            $updates[] = "{$dbField} = ?";
            $params[] = $data[$jsonField];
        }
    }
    
    // Współrzędne
    if (isset($data['coordinates'])) {
        if (isset($data['coordinates']['lat'])) {
            $updates[] = "latitude = ?";
            $params[] = $data['coordinates']['lat'];
        }
        if (isset($data['coordinates']['lng'])) {
            $updates[] = "longitude = ?";
            $params[] = $data['coordinates']['lng'];
        }
    }
    
    // Płatność
    if (isset($data['payment'])) {
        if (isset($data['payment']['type'])) {
            $updates[] = "payment_type = ?";
            $params[] = $data['payment']['type'];
        }
        if (isset($data['payment']['netAmount'])) {
            $updates[] = "payment_net = ?";
            $params[] = $data['payment']['netAmount'];
        }
        if (isset($data['payment']['grossAmount'])) {
            $updates[] = "payment_gross = ?";
            $params[] = $data['payment']['grossAmount'];
        }
    }
    
    // Oznaczenie jako wykonane
    if (isset($data['status']) && $data['status'] === 'COMPLETED' && $job['status'] !== 'COMPLETED') {
        $updates[] = "completed_at = NOW()";
    }
    
    if (!empty($updates)) {
        $updates[] = "updated_at = NOW()";
        $params[] = $id;
        
        $sql = "UPDATE jobs SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    }
    
    // Aktualizuj lokalizacje (jeśli podane)
    if (isset($data['locations']) && is_array($data['locations'])) {
        // Usuń stare
        $db->prepare("DELETE FROM job_locations WHERE job_id = ?")->execute(array($id));
        
        // Dodaj nowe
        $locStmt = $db->prepare("
            INSERT INTO job_locations (job_id, full_address, short_label, distance, sort_order)
            VALUES (?, ?, ?, ?, ?)
        ");
        foreach ($data['locations'] as $i => $loc) {
            $locStmt->execute(array(
                $id,
                isset($loc['fullAddress']) ? $loc['fullAddress'] : '',
                isset($loc['shortLabel']) ? $loc['shortLabel'] : null,
                isset($loc['distance']) ? $loc['distance'] : null,
                $i
            ));
        }
    }
    
    // Aktualizuj checklistę (jeśli podana)
    if (isset($data['checklist']) && is_array($data['checklist'])) {
        // Usuń stare
        $db->prepare("DELETE FROM checklist_items WHERE job_id = ?")->execute(array($id));
        
        // Dodaj nowe
        $checkStmt = $db->prepare("
            INSERT INTO checklist_items (job_id, task, is_checked, added_by, completed_by, completed_at, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        foreach ($data['checklist'] as $i => $item) {
            $checkStmt->execute(array(
                $id,
                isset($item['task']) ? $item['task'] : '',
                isset($item['isChecked']) && $item['isChecked'] ? 1 : 0,
                isset($item['addedBy']) ? $item['addedBy'] : null,
                isset($item['completedBy']) ? $item['completedBy'] : null,
                isset($item['completedAt']) ? date('Y-m-d H:i:s', $item['completedAt'] / 1000) : null,
                $i
            ));
        }
    }
    
    // Aktualizuj obrazy projektowe
    if (isset($data['projectImages']) && is_array($data['projectImages'])) {
        // Usuń stare obrazy projektowe
        $db->prepare("DELETE FROM job_images WHERE job_id = ? AND image_type = 'project'")->execute(array($id));
        saveJobImages($id, $data['projectImages'], 'project');
    }
    
    // Dodaj obrazy z wykonania (nie usuwaj starych)
    if (isset($data['completionImages']) && is_array($data['completionImages'])) {
        saveJobImages($id, $data['completionImages'], 'completion');
    }
    
    logActivity($user['id'], $id, 'job_updated', 'Zaktualizowano zlecenie');
    
    jsonResponse(array('success' => true, 'message' => 'Zlecenie zaktualizowane'));
}

/**
 * Usuwa zlecenie
 */
function deleteJob($id) {
    $user = requireAdmin();
    $db = getDB();
    
    // Sprawdź czy zlecenie istnieje
    $stmt = $db->prepare("SELECT id, job_title FROM jobs WHERE id = ?");
    $stmt->execute(array($id));
    $job = $stmt->fetch();
    
    if (!$job) {
        jsonError('Zlecenie nie znalezione', 404);
    }
    
    // Usuń pliki obrazów
    $stmt = $db->prepare("SELECT file_path FROM job_images WHERE job_id = ?");
    $stmt->execute(array($id));
    $images = $stmt->fetchAll();
    
    foreach ($images as $img) {
        if ($img['file_path'] && file_exists(UPLOAD_DIR . $img['file_path'])) {
            unlink(UPLOAD_DIR . $img['file_path']);
        }
    }
    
    // Usuń zlecenie (kaskadowo usuwa lokalizacje, obrazy, checklistę)
    $stmt = $db->prepare("DELETE FROM jobs WHERE id = ?");
    $stmt->execute(array($id));
    
    logActivity($user['id'], $id, 'job_deleted', 'Usunięto zlecenie: ' . $job['job_title']);
    
    jsonResponse(array('success' => true, 'message' => 'Zlecenie usunięte'));
}

/**
 * Formatuje zlecenie dla odpowiedzi JSON
 */
function formatJobForResponse($job, $full = false) {
    $result = array(
        'id' => (string)$job['id'],
        'friendlyId' => $job['friendly_id'],
        'createdAt' => strtotime($job['created_at']) * 1000,
        'updatedAt' => $job['updated_at'] ? strtotime($job['updated_at']) * 1000 : null,
        'status' => $job['status'],
        'columnId' => $job['column_id'],
        'data' => array(
            'jobTitle' => $job['job_title'],
            'clientName' => $job['client_name'],
            'companyName' => $job['company_name'],
            'contactPerson' => $job['contact_person'],
            'phoneNumber' => $job['phone_number'],
            'address' => $job['address'],
            'district' => $job['district'],
            'coordinates' => ($job['latitude'] && $job['longitude']) ? array(
                'lat' => (float)$job['latitude'],
                'lng' => (float)$job['longitude']
            ) : null,
            'scopeWorkText' => $job['scope_work_text'],
            'scopeWorkImages' => $job['scope_work_images'],
            'payment' => array(
                'type' => $job['payment_type'],
                'netAmount' => $job['payment_net'] ? (float)$job['payment_net'] : null,
                'grossAmount' => $job['payment_gross'] ? (float)$job['payment_gross'] : null
            )
        ),
        'adminNotes' => $job['admin_notes'],
        'completionNotes' => $job['completion_notes'],
        'completedAt' => $job['completed_at'] ? strtotime($job['completed_at']) * 1000 : null
    );
    
    // Dodatkowe pola z JOINów
    if (isset($job['created_by_name'])) {
        $result['createdByName'] = $job['created_by_name'];
    }
    
    if (isset($job['checklist_total'])) {
        $result['checklistProgress'] = array(
            'total' => (int)$job['checklist_total'],
            'done' => (int)$job['checklist_done']
        );
    }
    
    if (isset($job['cover_image'])) {
        $result['coverImage'] = $job['cover_image'];
    }
    
    return $result;
}

/**
 * Zapisuje obrazy zlecenia
 */
function saveJobImages($jobId, $images, $type = 'project') {
    $db = getDB();
    
    $stmt = $db->prepare("
        INSERT INTO job_images (job_id, image_type, file_path, file_name, mime_type, is_cover, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    
    foreach ($images as $i => $image) {
        $filePath = null;
        $fileName = null;
        $mimeType = null;
        $isCover = ($i === 0 && $type === 'project') ? 1 : 0;
        
        // Jeśli to base64, zapisz jako plik
        if (is_string($image) && strpos($image, 'data:') === 0) {
            $saved = saveBase64Image($image, $jobId);
            if ($saved) {
                $filePath = $saved['path'];
                $fileName = $saved['name'];
                $mimeType = $saved['mime'];
            }
        } elseif (is_array($image) && isset($image['path'])) {
            // Już zapisany plik
            $filePath = $image['path'];
            $isCover = isset($image['isCover']) && $image['isCover'] ? 1 : 0;
        } elseif (is_string($image)) {
            // Ścieżka do pliku
            $filePath = $image;
        }
        
        if ($filePath) {
            $stmt->execute(array($jobId, $type, $filePath, $fileName, $mimeType, $isCover, $i));
        }
    }
}

/**
 * Zapisuje obraz base64 jako plik
 */
function saveBase64Image($base64, $jobId) {
    if (!preg_match('/^data:([^;]+);base64,(.+)$/', $base64, $matches)) {
        return null;
    }
    
    $mimeType = $matches[1];
    $data = base64_decode($matches[2]);
    
    if (!$data) {
        return null;
    }
    
    // Określ rozszerzenie
    $extensions = array(
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf'
    );
    
    $ext = isset($extensions[$mimeType]) ? $extensions[$mimeType] : 'bin';
    
    // Utwórz folder dla zlecenia
    $jobDir = UPLOAD_DIR . $jobId . '/';
    if (!is_dir($jobDir)) {
        mkdir($jobDir, 0755, true);
    }
    
    // Generuj nazwę pliku
    $fileName = uniqid() . '_' . time() . '.' . $ext;
    $filePath = $jobDir . $fileName;
    
    if (file_put_contents($filePath, $data)) {
        return array(
            'path' => $jobId . '/' . $fileName,
            'name' => $fileName,
            'mime' => $mimeType
        );
    }
    
    return null;
}

