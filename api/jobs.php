<?php
/**
 * CRM Zlecenia Montażowe - CRUD Zleceń
 * Z obsługą obrazów (tabela job_images)
 */

// DEBUG - pokaż błędy
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/images.php';

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
        
        // Generuj friendly ID (używamy funkcji z config.php)
        $friendlyId = generateFriendlyId('ai');
        
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
        if (isset($data['coordinates'])) {
            $coords = $data['coordinates'];
            if (is_array($coords)) {
                $coordLat = isset($coords['lat']) ? $coords['lat'] : null;
                $coordLng = isset($coords['lng']) ? $coords['lng'] : null;
            }
        }

        try {
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
        } catch (PDOException $e) {
            logError("SQL Error in createJob: " . $e->getMessage());
            throw $e;
        }
        
        $jobId = $pdo->lastInsertId();
        
        // Zapisz obrazy
        if (isset($input['projectImages']) && is_array($input['projectImages'])) {
            saveJobImages($jobId, $input['projectImages'], 'project', 'ai');
        }
        if (isset($input['completionImages']) && is_array($input['completionImages'])) {
            saveJobImages($jobId, $input['completionImages'], 'completion', 'ai');
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
        if (isset($data['paymentStatus'])) {
            $updates[] = "payment_status = ?";
            $params[] = $data['paymentStatus'];
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
        if (array_key_exists('coordinates', $data)) {
            $coords = $data['coordinates'];
            
            if (empty($coords)) {
                $updates[] = "coordinates_lat = NULL";
                $updates[] = "coordinates_lng = NULL";
            } elseif (is_array($coords)) {
                if (isset($coords['lat'])) {
                    $updates[] = "coordinates_lat = ?";
                    $params[] = $coords['lat'];
                }
                if (isset($coords['lng'])) {
                    $updates[] = "coordinates_lng = ?";
                    $params[] = $coords['lng'];
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
        
        // Data zakończenia
        if (isset($input['completedAt'])) {
            $updates[] = "completed_at = ?";
            $params[] = date('Y-m-d H:i:s', $input['completedAt'] / 1000);
        }
        
        // Notatki z zakończenia
        if (isset($input['completionNotes'])) {
            $updates[] = "completion_notes = ?";
            $params[] = $input['completionNotes'];
        }
        
        // Prośba o opinię - obsługuje też NULL (gdy chcemy wyczyścić)
        if (array_key_exists('reviewRequestSentAt', $input)) {
            $updates[] = "review_request_sent_at = ?";
            if ($input['reviewRequestSentAt'] === null || $input['reviewRequestSentAt'] === '') {
                $params[] = null;
            } else {
                $params[] = date('Y-m-d H:i:s', $input['reviewRequestSentAt'] / 1000);
            }
        }
        if (array_key_exists('reviewRequestEmail', $input)) {
            $updates[] = "review_request_email = ?";
            $params[] = $input['reviewRequestEmail'];
        }
        
        if (count($updates) > 0) {
            $params[] = $id;
            $sql = 'UPDATE jobs_ai SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        
        // Aktualizuj obrazy (jeśli przesłane)
        if (isset($input['projectImages']) && is_array($input['projectImages'])) {
            saveJobImages($id, $input['projectImages'], 'project', 'ai');
        }
        if (isset($input['completionImages']) && is_array($input['completionImages'])) {
            saveJobImages($id, $input['completionImages'], 'completion', 'ai');
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
    
    // Usuń pliki obrazów z dysku
    $stmt = $pdo->prepare('SELECT file_path FROM job_images WHERE job_id = ? AND job_type = ?');
    $stmt->execute(array($id, 'ai'));
    $images = $stmt->fetchAll();
    foreach ($images as $img) {
        if (!empty($img['file_path'])) {
            // UPLOADS_DIR z images.php
            $file = UPLOADS_DIR . '/' . basename($img['file_path']);
            if (file_exists($file)) {
                @unlink($file);
            }
        }
    }
    
    // Usuń obrazy z bazy
    $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND job_type = ?')->execute(array($id, 'ai'));
    
    // Usuń zlecenie
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
        'paymentStatus' => isset($job['payment_status']) ? $job['payment_status'] : 'none',
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
        'projectImages' => getJobImages($jobId, 'project', 'ai'),
        'completionImages' => getJobImages($jobId, 'completion', 'ai'),
        'adminNotes' => $job['notes'],
        'checklist' => array(),
        'completedAt' => !empty($job['completed_at']) ? strtotime($job['completed_at']) * 1000 : null,
        'completionNotes' => isset($job['completion_notes']) ? $job['completion_notes'] : null,
        'reviewRequestSentAt' => !empty($job['review_request_sent_at']) ? strtotime($job['review_request_sent_at']) * 1000 : null,
        'reviewRequestEmail' => isset($job['review_request_email']) ? $job['review_request_email'] : null
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
