<?php
/**
 * CRM Zlecenia Montażowe - CRUD Zleceń
 * PHP 5.6 Compatible
 */

require_once __DIR__ . '/config.php';

/**
 * Router dla /api/jobs
 */
function handleJobs($method, $id = null) {
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
            if (!$id) {
                jsonResponse(array('error' => 'Job ID required'), 400);
            }
            updateJob($id);
            break;
        case 'DELETE':
            if (!$id) {
                jsonResponse(array('error' => 'Job ID required'), 400);
            }
            deleteJob($id);
            break;
        default:
            jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}

/**
 * GET /api/jobs
 * Lista zleceń z filtrowaniem
 */
function getJobs() {
    $user = requireAuth();
    $pdo = getDB();
    
    // Parametry filtrowania
    $status = isset($_GET['status']) ? $_GET['status'] : null;
    $column = isset($_GET['column']) ? $_GET['column'] : null;
    $search = isset($_GET['search']) ? $_GET['search'] : null;
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    
    $where = array('1=1');
    $params = array();
    
    if ($status) {
        $where[] = 'j.status = ?';
        $params[] = $status;
    }
    
    if ($column) {
        $where[] = 'j.column_id = ?';
        $params[] = $column;
    }
    
    if ($search) {
        $where[] = '(j.job_title LIKE ? OR j.client_name LIKE ? OR j.address LIKE ?)';
        $searchParam = '%' . $search . '%';
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
    }
    
    $whereClause = implode(' AND ', $where);
    
    $sql = "
        SELECT 
            j.*,
            u.name as creator_name,
            (SELECT COUNT(*) FROM job_checklist c WHERE c.job_id = j.id) as total_tasks,
            (SELECT COUNT(*) FROM job_checklist c WHERE c.job_id = j.id AND c.is_checked = 1) as completed_tasks
        FROM jobs j
        LEFT JOIN users u ON j.created_by = u.id
        WHERE {$whereClause}
        ORDER BY j.created_at DESC
        LIMIT ? OFFSET ?
    ";
    
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $jobs = $stmt->fetchAll();
    
    // Pobierz obrazy dla każdego zlecenia
    foreach ($jobs as &$job) {
        $job['projectImages'] = getJobImages($job['id'], 'project');
        $job['completionImages'] = getJobImages($job['id'], 'completion');
        $job['checklist'] = getJobChecklist($job['id']);
        $job['locations'] = getJobLocations($job['id']);
        
        // Mapowanie pól na format frontend
        $job = mapJobToFrontend($job);
    }
    
    // Policz wszystkie
    $countSql = "SELECT COUNT(*) as total FROM jobs j WHERE {$whereClause}";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute(array_slice($params, 0, -2)); // Bez limit/offset
    $count = $stmt->fetch();
    
    jsonResponse(array(
        'success' => true,
        'jobs' => $jobs,
        'total' => intval($count['total']),
        'limit' => $limit,
        'offset' => $offset
    ));
}

/**
 * GET /api/jobs/{id}
 */
function getJob($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('
        SELECT j.*, u.name as creator_name
        FROM jobs j
        LEFT JOIN users u ON j.created_by = u.id
        WHERE j.id = ?
    ');
    $stmt->execute(array($id));
    $job = $stmt->fetch();
    
    if (!$job) {
        jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
    }
    
    $job['projectImages'] = getJobImages($id, 'project');
    $job['completionImages'] = getJobImages($id, 'completion');
    $job['checklist'] = getJobChecklist($id);
    $job['locations'] = getJobLocations($id);
    
    $job = mapJobToFrontend($job);
    
    jsonResponse(array('success' => true, 'job' => $job));
}

/**
 * POST /api/jobs
 */
function createJob() {
    $user = requireAuth();
    
    // Tylko admin może tworzyć zlecenia
    if ($user['role'] !== 'admin') {
        jsonResponse(array('error' => 'Brak uprawnień'), 403);
    }
    
    $input = getJsonInput();
    $pdo = getDB();
    
    // Walidacja wymaganych pól
    $jobTitle = isset($input['jobTitle']) ? trim($input['jobTitle']) : '';
    if (empty($jobTitle)) {
        $jobTitle = 'Nowe zlecenie';
    }
    
    // Generuj friendly ID
    $friendlyId = generateFriendlyId();
    
    // Wstaw zlecenie
    $stmt = $pdo->prepare('
        INSERT INTO jobs (
            friendly_id, job_title, client_name, company_name, contact_person,
            phone_number, address, coordinates_lat, coordinates_lng,
            scope_work_text, scope_work_images, payment_type, 
            payment_net_amount, payment_gross_amount, admin_notes,
            status, column_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    $data = isset($input['data']) ? $input['data'] : $input;
    
    $stmt->execute(array(
        $friendlyId,
        $jobTitle,
        isset($data['clientName']) ? $data['clientName'] : null,
        isset($data['companyName']) ? $data['companyName'] : null,
        isset($data['contactPerson']) ? $data['contactPerson'] : null,
        isset($data['phoneNumber']) ? $data['phoneNumber'] : null,
        isset($data['address']) ? $data['address'] : null,
        isset($data['coordinates']['lat']) ? $data['coordinates']['lat'] : null,
        isset($data['coordinates']['lng']) ? $data['coordinates']['lng'] : null,
        isset($data['scopeWorkText']) ? $data['scopeWorkText'] : null,
        isset($data['scopeWorkImages']) ? $data['scopeWorkImages'] : null,
        isset($data['payment']['type']) ? $data['payment']['type'] : 'UNKNOWN',
        isset($data['payment']['netAmount']) ? $data['payment']['netAmount'] : null,
        isset($data['payment']['grossAmount']) ? $data['payment']['grossAmount'] : null,
        isset($input['adminNotes']) ? $input['adminNotes'] : null,
        'NEW',
        isset($input['columnId']) ? $input['columnId'] : 'PREPARE',
        $user['id']
    ));
    
    $jobId = $pdo->lastInsertId();
    
    // Dodaj lokalizacje
    if (isset($data['locations']) && is_array($data['locations'])) {
        saveJobLocations($jobId, $data['locations']);
    }
    
    // Dodaj obrazy
    if (isset($input['projectImages']) && is_array($input['projectImages'])) {
        saveJobImages($jobId, $input['projectImages'], 'project');
    }
    
    // Dodaj checklistę
    if (isset($input['checklist']) && is_array($input['checklist'])) {
        saveJobChecklist($jobId, $input['checklist'], $user['name']);
    }
    
    // Zwróć utworzone zlecenie
    $stmt = $pdo->prepare('SELECT * FROM jobs WHERE id = ?');
    $stmt->execute(array($jobId));
    $job = $stmt->fetch();
    
    $job['projectImages'] = getJobImages($jobId, 'project');
    $job['checklist'] = getJobChecklist($jobId);
    $job['locations'] = getJobLocations($jobId);
    $job = mapJobToFrontend($job);
    
    jsonResponse(array('success' => true, 'job' => $job), 201);
}

/**
 * PUT /api/jobs/{id}
 */
function updateJob($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    // Sprawdź czy zlecenie istnieje
    $stmt = $pdo->prepare('SELECT * FROM jobs WHERE id = ?');
    $stmt->execute(array($id));
    $job = $stmt->fetch();
    
    if (!$job) {
        jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
    }
    
    $input = getJsonInput();
    $updates = array();
    $params = array();
    
    // Lista dozwolonych pól do aktualizacji
    $allowedFields = array(
        'job_title' => 'jobTitle',
        'client_name' => 'clientName',
        'company_name' => 'companyName',
        'contact_person' => 'contactPerson',
        'phone_number' => 'phoneNumber',
        'address' => 'address',
        'scope_work_text' => 'scopeWorkText',
        'scope_work_images' => 'scopeWorkImages',
        'admin_notes' => 'adminNotes',
        'completion_notes' => 'completionNotes',
        'status' => 'status',
        'column_id' => 'columnId'
    );
    
    // Obsługa zagnieżdżonych danych (data object)
    $data = isset($input['data']) ? $input['data'] : $input;
    
    foreach ($allowedFields as $dbField => $inputField) {
        if (isset($data[$inputField])) {
            $updates[] = "`{$dbField}` = ?";
            $params[] = $data[$inputField];
        } elseif (isset($input[$inputField])) {
            $updates[] = "`{$dbField}` = ?";
            $params[] = $input[$inputField];
        }
    }
    
    // Obsługa współrzędnych
    if (isset($data['coordinates'])) {
        if (isset($data['coordinates']['lat'])) {
            $updates[] = 'coordinates_lat = ?';
            $params[] = $data['coordinates']['lat'];
        }
        if (isset($data['coordinates']['lng'])) {
            $updates[] = 'coordinates_lng = ?';
            $params[] = $data['coordinates']['lng'];
        }
    }
    
    // Obsługa płatności
    if (isset($data['payment'])) {
        if (isset($data['payment']['type'])) {
            $updates[] = 'payment_type = ?';
            $params[] = $data['payment']['type'];
        }
        if (isset($data['payment']['netAmount'])) {
            $updates[] = 'payment_net_amount = ?';
            $params[] = $data['payment']['netAmount'];
        }
        if (isset($data['payment']['grossAmount'])) {
            $updates[] = 'payment_gross_amount = ?';
            $params[] = $data['payment']['grossAmount'];
        }
    }
    
    // Zakończenie zlecenia
    if (isset($input['complete']) && $input['complete']) {
        $updates[] = 'status = ?';
        $params[] = 'COMPLETED';
        $updates[] = 'column_id = ?';
        $params[] = 'COMPLETED';
        $updates[] = 'completed_at = NOW()';
        $updates[] = 'completed_by = ?';
        $params[] = $user['id'];
    }
    
    if (count($updates) > 0) {
        $params[] = $id;
        $sql = 'UPDATE jobs SET ' . implode(', ', $updates) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    // Aktualizuj lokalizacje
    if (isset($data['locations']) && is_array($data['locations'])) {
        // Usuń stare
        $stmt = $pdo->prepare('DELETE FROM job_locations WHERE job_id = ?');
        $stmt->execute(array($id));
        // Dodaj nowe
        saveJobLocations($id, $data['locations']);
    }
    
    // Aktualizuj obrazy
    if (isset($input['projectImages']) && is_array($input['projectImages'])) {
        // Usuń stare
        $stmt = $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND type = ?');
        $stmt->execute(array($id, 'project'));
        // Dodaj nowe
        saveJobImages($id, $input['projectImages'], 'project');
    }
    
    // Aktualizuj obrazy wykonania
    if (isset($input['completionImages']) && is_array($input['completionImages'])) {
        $stmt = $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND type = ?');
        $stmt->execute(array($id, 'completion'));
        saveJobImages($id, $input['completionImages'], 'completion');
    }
    
    // Aktualizuj checklistę
    if (isset($input['checklist']) && is_array($input['checklist'])) {
        $stmt = $pdo->prepare('DELETE FROM job_checklist WHERE job_id = ?');
        $stmt->execute(array($id));
        saveJobChecklist($id, $input['checklist'], $user['name']);
    }
    
    // Zwróć zaktualizowane zlecenie
    $stmt = $pdo->prepare('SELECT * FROM jobs WHERE id = ?');
    $stmt->execute(array($id));
    $job = $stmt->fetch();
    
    $job['projectImages'] = getJobImages($id, 'project');
    $job['completionImages'] = getJobImages($id, 'completion');
    $job['checklist'] = getJobChecklist($id);
    $job['locations'] = getJobLocations($id);
    $job = mapJobToFrontend($job);
    
    jsonResponse(array('success' => true, 'job' => $job));
}

/**
 * DELETE /api/jobs/{id}
 */
function deleteJob($id) {
    $user = requireAuth();
    
    // Tylko admin może usuwać
    if ($user['role'] !== 'admin') {
        jsonResponse(array('error' => 'Brak uprawnień'), 403);
    }
    
    $pdo = getDB();
    
    // Sprawdź czy istnieje
    $stmt = $pdo->prepare('SELECT id FROM jobs WHERE id = ?');
    $stmt->execute(array($id));
    if (!$stmt->fetch()) {
        jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
    }
    
    // Usuń (CASCADE usunie powiązane rekordy)
    $stmt = $pdo->prepare('DELETE FROM jobs WHERE id = ?');
    $stmt->execute(array($id));
    
    jsonResponse(array('success' => true, 'message' => 'Zlecenie usunięte'));
}

// =====================================================
// FUNKCJE POMOCNICZE
// =====================================================

function getJobImages($jobId, $type = 'project') {
    $pdo = getDB();
    $stmt = $pdo->prepare('
        SELECT file_data 
        FROM job_images 
        WHERE job_id = ? AND type = ? 
        ORDER BY is_cover DESC, sort_order ASC
    ');
    $stmt->execute(array($jobId, $type));
    $rows = $stmt->fetchAll();
    
    $images = array();
    foreach ($rows as $row) {
        if ($row['file_data']) {
            $images[] = $row['file_data'];
        }
    }
    return $images;
}

function saveJobImages($jobId, $images, $type = 'project') {
    if (empty($images)) return;
    
    $pdo = getDB();
    $stmt = $pdo->prepare('
        INSERT INTO job_images (job_id, type, file_data, is_cover, sort_order)
        VALUES (?, ?, ?, ?, ?)
    ');
    
    foreach ($images as $index => $imageData) {
        $stmt->execute(array(
            $jobId,
            $type,
            $imageData,
            $index === 0 ? 1 : 0,
            $index
        ));
    }
}

function getJobChecklist($jobId) {
    $pdo = getDB();
    $stmt = $pdo->prepare('
        SELECT id, task, is_checked, added_by, added_at, completed_by, completed_at
        FROM job_checklist 
        WHERE job_id = ? 
        ORDER BY sort_order ASC
    ');
    $stmt->execute(array($jobId));
    $rows = $stmt->fetchAll();
    
    $checklist = array();
    foreach ($rows as $row) {
        $checklist[] = array(
            'id' => strval($row['id']),
            'task' => $row['task'],
            'isChecked' => (bool)$row['is_checked'],
            'addedBy' => $row['added_by'],
            'addedAt' => strtotime($row['added_at']) * 1000,
            'completedBy' => $row['completed_by'],
            'completedAt' => $row['completed_at'] ? strtotime($row['completed_at']) * 1000 : null
        );
    }
    return $checklist;
}

function saveJobChecklist($jobId, $checklist, $addedBy) {
    if (empty($checklist)) return;
    
    $pdo = getDB();
    $stmt = $pdo->prepare('
        INSERT INTO job_checklist (job_id, task, is_checked, added_by, completed_by, completed_at, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    
    foreach ($checklist as $index => $item) {
        $task = is_array($item) ? (isset($item['task']) ? $item['task'] : '') : $item;
        $isChecked = is_array($item) && isset($item['isChecked']) ? $item['isChecked'] : false;
        $itemAddedBy = is_array($item) && isset($item['addedBy']) ? $item['addedBy'] : $addedBy;
        
        $stmt->execute(array(
            $jobId,
            $task,
            $isChecked ? 1 : 0,
            $itemAddedBy,
            $isChecked ? $addedBy : null,
            $isChecked ? date('Y-m-d H:i:s') : null,
            $index
        ));
    }
}

function getJobLocations($jobId) {
    $pdo = getDB();
    $stmt = $pdo->prepare('
        SELECT full_address, short_label, distance
        FROM job_locations 
        WHERE job_id = ? 
        ORDER BY sort_order ASC
    ');
    $stmt->execute(array($jobId));
    $rows = $stmt->fetchAll();
    
    $locations = array();
    foreach ($rows as $row) {
        $locations[] = array(
            'fullAddress' => $row['full_address'],
            'shortLabel' => $row['short_label'],
            'distance' => $row['distance']
        );
    }
    return $locations;
}

function saveJobLocations($jobId, $locations) {
    if (empty($locations)) return;
    
    $pdo = getDB();
    $stmt = $pdo->prepare('
        INSERT INTO job_locations (job_id, full_address, short_label, distance, sort_order)
        VALUES (?, ?, ?, ?, ?)
    ');
    
    foreach ($locations as $index => $loc) {
        $stmt->execute(array(
            $jobId,
            isset($loc['fullAddress']) ? $loc['fullAddress'] : '',
            isset($loc['shortLabel']) ? $loc['shortLabel'] : null,
            isset($loc['distance']) ? $loc['distance'] : null,
            $index
        ));
    }
}

/**
 * Mapowanie pól z bazy na format oczekiwany przez frontend
 */
function mapJobToFrontend($job) {
    return array(
        'id' => strval($job['id']),
        'friendlyId' => $job['friendly_id'],
        'createdAt' => strtotime($job['created_at']) * 1000,
        'status' => $job['status'],
        'columnId' => $job['column_id'],
        'data' => array(
            'jobTitle' => $job['job_title'],
            'clientName' => $job['client_name'],
            'companyName' => $job['company_name'],
            'contactPerson' => $job['contact_person'],
            'phoneNumber' => $job['phone_number'],
            'address' => $job['address'],
            'coordinates' => ($job['coordinates_lat'] && $job['coordinates_lng']) ? array(
                'lat' => floatval($job['coordinates_lat']),
                'lng' => floatval($job['coordinates_lng'])
            ) : null,
            'locations' => isset($job['locations']) ? $job['locations'] : array(),
            'scopeWorkText' => $job['scope_work_text'],
            'scopeWorkImages' => $job['scope_work_images'],
            'payment' => array(
                'type' => $job['payment_type'],
                'netAmount' => $job['payment_net_amount'] ? floatval($job['payment_net_amount']) : null,
                'grossAmount' => $job['payment_gross_amount'] ? floatval($job['payment_gross_amount']) : null
            )
        ),
        'projectImages' => isset($job['projectImages']) ? $job['projectImages'] : array(),
        'completionImages' => isset($job['completionImages']) ? $job['completionImages'] : array(),
        'adminNotes' => $job['admin_notes'],
        'checklist' => isset($job['checklist']) ? $job['checklist'] : array(),
        'completedAt' => $job['completed_at'] ? strtotime($job['completed_at']) * 1000 : null,
        'completionNotes' => $job['completion_notes']
    );
}

