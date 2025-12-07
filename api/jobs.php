<?php
/**
 * CRM Zlecenia Montażowe - CRUD Zleceń
 * Z obsługą obrazów (tabela job_images)
 */

require_once __DIR__ . '/config.php';

// ===========================================
// FUNKCJE OBSŁUGI OBRAZÓW
// ===========================================

/**
 * Zapisuje obrazy do tabeli job_images
 * @param int $jobId ID zlecenia
 * @param array $images Tablica obrazów base64
 * @param string $type 'project' lub 'completion'
 */
function saveJobImages($jobId, $images, $type = 'project') {
    if (empty($images) || !is_array($images)) {
        return;
    }
    
    $pdo = getDB();
    
    // Usuń stare obrazy tego typu dla zlecenia
    $stmt = $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND type = ?');
    $stmt->execute(array($jobId, $type));
    
    // Wstaw nowe obrazy
    $stmt = $pdo->prepare('
        INSERT INTO job_images (job_id, type, file_data, is_cover, sort_order, job_type)
        VALUES (?, ?, ?, ?, ?, ?)
    ');
    
    $order = 0;
    foreach ($images as $imageData) {
        if (!empty($imageData) && is_string($imageData)) {
            $isCover = ($order === 0) ? 1 : 0;
            $stmt->execute(array($jobId, $type, $imageData, $isCover, $order, 'ai'));
            $order++;
        }
    }
}

/**
 * Pobiera obrazy dla zlecenia
 * @param int $jobId ID zlecenia
 * @param string $type 'project' lub 'completion'
 * @return array Tablica obrazów base64
 */
function getJobImages($jobId, $type = 'project') {
    $pdo = getDB();
    
    // Sprawdź czy tabela istnieje
    try {
        $stmt = $pdo->prepare('
            SELECT file_data FROM job_images 
            WHERE job_id = ? AND type = ? AND job_type = ?
            ORDER BY sort_order ASC
        ');
        $stmt->execute(array($jobId, $type, 'ai'));
        $rows = $stmt->fetchAll();
        
        $images = array();
        foreach ($rows as $row) {
            $images[] = $row['file_data'];
        }
        return $images;
    } catch (Exception $e) {
        // Tabela nie istnieje lub inna kolumna
        return array();
    }
}

// ===========================================
// CRUD ZLECEŃ
// ===========================================

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
 * GET /api/jobs - Lista zleceń
 */
function getJobs() {
    $user = requireAuth();
    $pdo = getDB();
    
    $sql = "SELECT * FROM jobs_ai ORDER BY column_order ASC, created_at DESC";
    $stmt = $pdo->query($sql);
    $jobs = $stmt->fetchAll();
    
    $result = array();
    foreach ($jobs as $job) {
        $result[] = mapJobToFrontend($job);
    }
    
    jsonResponse(array(
        'success' => true,
        'jobs' => $result,
        'total' => count($result)
    ));
}

/**
 * GET /api/jobs/{id}
 */
function getJob($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT * FROM jobs_ai WHERE id = ?');
    $stmt->execute(array($id));
    $job = $stmt->fetch();
    
    if (!$job) {
        jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
    }
    
    jsonResponse(array('success' => true, 'job' => mapJobToFrontend($job)));
}

/**
 * POST /api/jobs - Tworzenie zlecenia
 */
function createJob() {
    try {
        $user = requireAuth();
        $pdo = getDB();
        
        $input = getJsonInput();
        $data = isset($input['data']) ? $input['data'] : $input;
        
        // Tytuł
        $title = '';
        if (isset($input['jobTitle'])) {
            $title = trim($input['jobTitle']);
        } elseif (isset($data['jobTitle'])) {
            $title = trim($data['jobTitle']);
        }
        if (empty($title)) {
            $title = 'Nowe zlecenie';
        }
        
        // Generuj friendly ID
        $year = date('Y');
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM jobs_ai WHERE YEAR(created_at) = ?");
        $stmt->execute(array($year));
        $result = $stmt->fetch();
        $count = $result['count'] + 1;
        $friendlyId = '#' . $year . '/' . str_pad($count, 3, '0', STR_PAD_LEFT);
        
        // INSERT
        $stmt = $pdo->prepare('
            INSERT INTO jobs_ai (
                friendly_id, title, client_name, phone, email, nip,
                address, coordinates_lat, coordinates_lng,
                description, notes, status, column_id, column_order, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        
        $phone = null;
        if (isset($data['phoneNumber'])) $phone = $data['phoneNumber'];
        elseif (isset($data['phone'])) $phone = $data['phone'];
        
        $description = null;
        if (isset($data['scopeWorkText'])) $description = $data['scopeWorkText'];
        elseif (isset($data['description'])) $description = $data['description'];
        
        $coordLat = null;
        $coordLng = null;
        if (isset($data['coordinates']) && is_array($data['coordinates'])) {
            $coordLat = isset($data['coordinates']['lat']) ? $data['coordinates']['lat'] : null;
            $coordLng = isset($data['coordinates']['lng']) ? $data['coordinates']['lng'] : null;
        }
        
        $stmt->execute(array(
            $friendlyId,
            $title,
            isset($data['clientName']) ? $data['clientName'] : null,
            $phone,
            isset($data['email']) ? $data['email'] : null,
            isset($data['nip']) ? $data['nip'] : null,
            isset($data['address']) ? $data['address'] : null,
            $coordLat,
            $coordLng,
            $description,
            isset($input['adminNotes']) ? $input['adminNotes'] : null,
            'NEW',
            isset($input['columnId']) ? $input['columnId'] : 'PREPARE',
            0,
            $user['id']
        ));
        
        $jobId = $pdo->lastInsertId();
        
        // Zapisz obrazy
        if (isset($input['projectImages']) && is_array($input['projectImages'])) {
            saveJobImages($jobId, $input['projectImages'], 'project');
        }
        if (isset($input['completionImages']) && is_array($input['completionImages'])) {
            saveJobImages($jobId, $input['completionImages'], 'completion');
        }
        
        // Zwróć utworzone zlecenie
        $stmt = $pdo->prepare('SELECT * FROM jobs_ai WHERE id = ?');
        $stmt->execute(array($jobId));
        $job = $stmt->fetch();
        
        jsonResponse(array('success' => true, 'job' => mapJobToFrontend($job)), 201);
    } catch (Exception $e) {
        error_log('Error creating AI job: ' . $e->getMessage());
        jsonResponse(array('error' => 'Database error: ' . $e->getMessage()), 500);
    }
}

/**
 * PUT /api/jobs/{id} - Aktualizacja zlecenia
 */
function updateJob($id) {
    try {
        $user = requireAuth();
        $pdo = getDB();
        
        // Sprawdź czy istnieje
        $stmt = $pdo->prepare('SELECT * FROM jobs_ai WHERE id = ?');
        $stmt->execute(array($id));
        $job = $stmt->fetch();
        
        if (!$job) {
            jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
        }
        
        $input = getJsonInput();
        $data = isset($input['data']) ? $input['data'] : $input;
        
        $updates = array();
        $params = array();
        
        // Mapowanie pól frontend -> baza
        $fieldMap = array(
            'jobTitle' => 'title',
            'clientName' => 'client_name',
            'phoneNumber' => 'phone',
            'phone' => 'phone',
            'email' => 'email',
            'nip' => 'nip',
            'address' => 'address',
            'scopeWorkText' => 'description',
            'description' => 'description'
        );
        
        // Pola z data
        foreach ($fieldMap as $frontendField => $dbField) {
            if (isset($data[$frontendField])) {
                $updates[] = "$dbField = ?";
                $params[] = $data[$frontendField];
            }
        }
        
        // Pola bezpośrednie
        if (isset($input['adminNotes'])) {
            $updates[] = "notes = ?";
            $params[] = $input['adminNotes'];
        }
        if (isset($input['status'])) {
            $updates[] = "status = ?";
            $params[] = $input['status'];
        }
        if (isset($input['columnId'])) {
            $updates[] = "column_id = ?";
            $params[] = $input['columnId'];
        }
        if (isset($input['columnOrder'])) {
            $updates[] = "column_order = ?";
            $params[] = $input['columnOrder'];
        }
        
        // Współrzędne
        if (isset($data['coordinates'])) {
            if ($data['coordinates'] === null || empty($data['coordinates'])) {
                $updates[] = "coordinates_lat = NULL";
                $updates[] = "coordinates_lng = NULL";
            } else {
                if (isset($data['coordinates']['lat'])) {
                    $updates[] = "coordinates_lat = ?";
                    $params[] = $data['coordinates']['lat'];
                }
                if (isset($data['coordinates']['lng'])) {
                    $updates[] = "coordinates_lng = ?";
                    $params[] = $data['coordinates']['lng'];
                }
            }
        }
        
        // Płatność
        if (isset($data['payment'])) {
            if (isset($data['payment']['netAmount'])) {
                $updates[] = "value_net = ?";
                $params[] = $data['payment']['netAmount'];
            }
            if (isset($data['payment']['grossAmount'])) {
                $updates[] = "value_gross = ?";
                $params[] = $data['payment']['grossAmount'];
            }
        }
        
        if (count($updates) > 0) {
            $params[] = $id;
            $sql = 'UPDATE jobs_ai SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        
        // Aktualizuj obrazy (jeśli przesłane)
        if (isset($input['projectImages']) && is_array($input['projectImages'])) {
            saveJobImages($id, $input['projectImages'], 'project');
        }
        if (isset($input['completionImages']) && is_array($input['completionImages'])) {
            saveJobImages($id, $input['completionImages'], 'completion');
        }
        
        // Zwróć zaktualizowane zlecenie
        $stmt = $pdo->prepare('SELECT * FROM jobs_ai WHERE id = ?');
        $stmt->execute(array($id));
        $job = $stmt->fetch();
        
        jsonResponse(array('success' => true, 'job' => mapJobToFrontend($job)));
    } catch (Exception $e) {
        error_log('Error updating AI job: ' . $e->getMessage());
        jsonResponse(array('error' => 'Database error: ' . $e->getMessage()), 500);
    }
}

/**
 * DELETE /api/jobs/{id}
 */
function deleteJob($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT id FROM jobs_ai WHERE id = ?');
    $stmt->execute(array($id));
    if (!$stmt->fetch()) {
        jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
    }
    
    $stmt = $pdo->prepare('DELETE FROM jobs_ai WHERE id = ?');
    $stmt->execute(array($id));
    
    jsonResponse(array('success' => true, 'message' => 'Zlecenie usunięte'));
}

/**
 * Mapowanie z bazy na frontend
 */
function mapJobToFrontend($job) {
    $coords = null;
    if (!empty($job['coordinates_lat']) && !empty($job['coordinates_lng'])) {
        $coords = array(
            'lat' => floatval($job['coordinates_lat']),
            'lng' => floatval($job['coordinates_lng'])
        );
    }
    
    $jobId = $job['id'];
    
    return array(
        'id' => strval($jobId),
        'friendlyId' => $job['friendly_id'],
        'type' => 'ai',
        'createdAt' => strtotime($job['created_at']) * 1000,
        'status' => $job['status'] ? $job['status'] : 'NEW',
        'columnId' => $job['column_id'] ? $job['column_id'] : 'PREPARE',
        'columnOrder' => intval($job['column_order']),
        'data' => array(
            'jobTitle' => $job['title'],
            'clientName' => $job['client_name'],
            'phoneNumber' => $job['phone'],
            'email' => $job['email'],
            'nip' => $job['nip'],
            'address' => $job['address'],
            'coordinates' => $coords,
            'scopeWorkText' => $job['description'],
            'payment' => array(
                'type' => 'UNKNOWN',
                'netAmount' => $job['value_net'] ? floatval($job['value_net']) : null,
                'grossAmount' => $job['value_gross'] ? floatval($job['value_gross']) : null
            )
        ),
        'projectImages' => getJobImages($jobId, 'project'),
        'completionImages' => getJobImages($jobId, 'completion'),
        'adminNotes' => $job['notes'],
        'checklist' => array(),
        'completedAt' => null,
        'completionNotes' => null
    );
}

/**
 * GET /api/jobs-all - Połączona lista zleceń AI + Simple
 */
function handleJobsAll() {
    $user = requireAuth();
    $pdo = getDB();
    
    $result = array();
    
    // Pobierz zlecenia AI
    try {
        $stmt = $pdo->query("SELECT * FROM jobs_ai ORDER BY column_order ASC, created_at DESC");
        $jobsAI = $stmt->fetchAll();
        foreach ($jobsAI as $job) {
            $mapped = mapJobToFrontend($job);
            $mapped['type'] = 'ai';
            $result[] = $mapped;
        }
    } catch (Exception $e) {
        // Tabela nie istnieje
    }
    
    // Pobierz zlecenia proste
    try {
        require_once __DIR__ . '/jobs_simple.php';
        $stmt = $pdo->query("SELECT * FROM jobs_simple ORDER BY column_order ASC, created_at DESC");
        $jobsSimple = $stmt->fetchAll();
        foreach ($jobsSimple as $job) {
            $mapped = mapJobSimpleToFrontend($job);
            $result[] = $mapped;
        }
    } catch (Exception $e) {
        // Tabela nie istnieje
    }
    
    jsonResponse(array(
        'success' => true,
        'jobs' => $result,
        'total' => count($result)
    ));
}


