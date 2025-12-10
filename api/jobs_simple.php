<?php
/**
 * API dla prostych zleceń (jobs_simple)
 * CRUD + obsługa załączników i obrazów
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/images.php';

function handleJobsSimple($method, $id = null) {
    switch ($method) {
        case 'GET':
            if ($id) {
                getJobSimple($id);
            } else {
                getJobsSimple();
            }
            break;
        case 'POST':
            createJobSimple();
            break;
        case 'PUT':
            if (!$id) {
                jsonResponse(array('error' => 'Job ID required'), 400);
            }
            updateJobSimple($id);
            break;
        case 'DELETE':
            if (!$id) {
                jsonResponse(array('error' => 'Job ID required'), 400);
            }
            deleteJobSimple($id);
            break;
        default:
            jsonResponse(array('error' => 'Method not allowed'), 405);
    }
}

// ===========================================
// FUNKCJE OBSŁUGI ZAŁĄCZNIKÓW
// ===========================================

/**
 * Zapisuje załączniki do tabeli job_attachments
 */
function saveAttachments($jobId, $attachments, $jobType = 'simple') {
    if (empty($attachments) || !is_array($attachments)) {
        return;
    }
    
    $pdo = getDB();
    
    // Usuń stare załączniki
    $stmt = $pdo->prepare('DELETE FROM job_attachments WHERE job_id = ? AND job_type = ?');
    $stmt->execute(array($jobId, $jobType));
    
    // Wstaw nowe
    $stmt = $pdo->prepare('
        INSERT INTO job_attachments (job_id, job_type, file_data, filename, original_name, mime_type, size_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    
    foreach ($attachments as $attachment) {
        if (!empty($attachment['data']) && !empty($attachment['name'])) {
            $stmt->execute(array(
                $jobId,
                $jobType,
                $attachment['data'],
                $attachment['name'],
                $attachment['name'],
                isset($attachment['type']) ? $attachment['type'] : 'application/octet-stream',
                isset($attachment['size']) ? $attachment['size'] : 0
            ));
        }
    }
}

/**
 * Pobiera załączniki dla zlecenia
 */
function getAttachments($jobId, $jobType = 'simple') {
    $pdo = getDB();
    
    try {
        $stmt = $pdo->prepare('
            SELECT id, filename, original_name, mime_type, size_bytes, file_data, created_at 
            FROM job_attachments 
            WHERE job_id = ? AND job_type = ? 
            ORDER BY created_at ASC
        ');
        $stmt->execute(array($jobId, $jobType));
        $rows = $stmt->fetchAll();
        
        $attachments = array();
        foreach ($rows as $row) {
            $attachments[] = array(
                'id' => $row['id'],
                'name' => $row['original_name'],
                'type' => $row['mime_type'],
                'size' => intval($row['size_bytes']),
                'data' => $row['file_data'],
                'createdAt' => strtotime($row['created_at']) * 1000
            );
        }
        return $attachments;
    } catch (Exception $e) {
        return array();
    }
}

// Obrazy obsługiwane przez images.php (saveJobImages, getJobImages)

// ===========================================
// CRUD ZLECEŃ
// ===========================================

/**
 * GET /api/jobs-simple - Lista zleceń
 */
function getJobsSimple() {
    $user = requireAuth();
    $pdo = getDB();
    
    $sql = "SELECT * FROM jobs_simple ORDER BY column_order ASC, created_at DESC";
    $stmt = $pdo->query($sql);
    $jobs = $stmt->fetchAll();
    
    $result = array();
    foreach ($jobs as $job) {
        $result[] = mapJobSimpleToFrontend($job);
    }
    
    jsonResponse(array(
        'success' => true,
        'jobs' => $result,
        'total' => count($result)
    ));
}

/**
 * GET /api/jobs-simple/{id}
 */
function getJobSimple($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT * FROM jobs_simple WHERE id = ?');
    $stmt->execute(array($id));
    $job = $stmt->fetch();
    
    if (!$job) {
        jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
    }
    
    jsonResponse(array('success' => true, 'job' => mapJobSimpleToFrontend($job)));
}

/**
 * POST /api/jobs-simple - Tworzenie zlecenia
 */
function createJobSimple() {
    try {
        $user = requireAuth();
        $pdo = getDB();
        
        $input = getJsonInput();
        $data = isset($input['data']) ? $input['data'] : $input;
        
        // Tytuł
        $title = isset($data['jobTitle']) ? trim($data['jobTitle']) : 'Nowe zlecenie';
        if (empty($title)) {
            $title = 'Nowe zlecenie';
        }
        
        // Generuj friendly ID (używamy funkcji z config.php)
        $friendlyId = generateFriendlyId('simple');
        
        // INSERT
        $stmt = $pdo->prepare('
            INSERT INTO jobs_simple (
                friendly_id, title, client_name, company_name, phone, email, nip,
                address, coordinates_lat, coordinates_lng, distance_km,
                description, notes, status, column_id, column_order,
                scheduled_date, value_net, value_gross, payment_status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        
        $coordLat = null;
        $coordLng = null;
        if (isset($data['coordinates']) && is_array($data['coordinates'])) {
            $coordLat = isset($data['coordinates']['lat']) ? $data['coordinates']['lat'] : null;
            $coordLng = isset($data['coordinates']['lng']) ? $data['coordinates']['lng'] : null;
        }
        
        $params = array(
            $friendlyId,
            $title,
            isset($data['clientName']) ? $data['clientName'] : null,
            isset($data['companyName']) ? $data['companyName'] : null,
            isset($data['phoneNumber']) ? $data['phoneNumber'] : (isset($data['phone']) ? $data['phone'] : null),
            isset($data['email']) ? $data['email'] : null,
            isset($data['nip']) ? $data['nip'] : null,
            isset($data['address']) ? $data['address'] : null,
            $coordLat,
            $coordLng,
            isset($data['distanceKm']) ? $data['distanceKm'] : null,
            isset($data['description']) ? $data['description'] : (isset($data['scopeWorkText']) ? $data['scopeWorkText'] : null),
            isset($input['adminNotes']) ? $input['adminNotes'] : null,
            isset($data['status']) ? $data['status'] : 'NEW',
            isset($input['columnId']) ? $input['columnId'] : 'PREPARE',
            isset($input['columnOrder']) ? $input['columnOrder'] : 0,
            isset($data['scheduledDate']) ? $data['scheduledDate'] : null,
            isset($data['payment']['netAmount']) ? $data['payment']['netAmount'] : null,
            isset($data['payment']['grossAmount']) ? $data['payment']['grossAmount'] : null,
            isset($data['paymentStatus']) ? $data['paymentStatus'] : 'pending',
            $user['id']
        );

        $stmt->execute($params);
        
        $jobId = $pdo->lastInsertId();
        
        // Zapisz obrazy (używamy saveJobImages z images.php)
        if (isset($input['projectImages']) && is_array($input['projectImages'])) {
            saveJobImages($jobId, $input['projectImages'], 'project', 'simple');
        }
        if (isset($input['completionImages']) && is_array($input['completionImages'])) {
            saveJobImages($jobId, $input['completionImages'], 'completion', 'simple');
        }
        
        // Zapisz załączniki
        if (isset($input['attachments']) && is_array($input['attachments'])) {
            saveAttachments($jobId, $input['attachments'], 'simple');
        }
        
        // Zwróć utworzone zlecenie
        $stmt = $pdo->prepare('SELECT * FROM jobs_simple WHERE id = ?');
        $stmt->execute(array($jobId));
        $job = $stmt->fetch();
        
        jsonResponse(array('success' => true, 'job' => mapJobSimpleToFrontend($job)), 201);
    } catch (Exception $e) {
        error_log('Error creating simple job: ' . $e->getMessage());
        jsonResponse(array('error' => 'Database error: ' . $e->getMessage()), 500);
    }
}

/**
 * PUT /api/jobs-simple/{id} - Aktualizacja zlecenia
 */
function updateJobSimple($id) {
    try {
        $user = requireAuth();
        $pdo = getDB();
        
        // Sprawdź czy istnieje
        $stmt = $pdo->prepare('SELECT * FROM jobs_simple WHERE id = ?');
        $stmt->execute(array($id));
        $job = $stmt->fetch();
        
        if (!$job) {
            jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
        }
        
        $input = getJsonInput();
        $data = isset($input['data']) ? $input['data'] : $input;
        
        $updates = array();
        $params = array();
        
        // Mapowanie pól
        $fieldMap = array(
            'jobTitle' => 'title',
            'clientName' => 'client_name',
            'companyName' => 'company_name',
            'phoneNumber' => 'phone',
            'phone' => 'phone',
            'email' => 'email',
            'nip' => 'nip',
            'address' => 'address',
            'distanceKm' => 'distance_km',
            'description' => 'description',
            'scopeWorkText' => 'description'
        );
        
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
        if (isset($input['status']) || isset($data['status'])) {
            $updates[] = "status = ?";
            $params[] = isset($input['status']) ? $input['status'] : $data['status'];
        }
        if (isset($input['columnId'])) {
            $updates[] = "column_id = ?";
            $params[] = $input['columnId'];
        }
        if (isset($input['columnOrder'])) {
            $updates[] = "column_order = ?";
            $params[] = $input['columnOrder'];
        }
        if (isset($data['scheduledDate'])) {
            $updates[] = "scheduled_date = ?";
            $params[] = $data['scheduledDate'];
        }
        if (isset($data['paymentStatus'])) {
            $updates[] = "payment_status = ?";
            $params[] = $data['paymentStatus'];
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
        
        // Prośba o opinię
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
            $sql = 'UPDATE jobs_simple SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        
        // Aktualizuj obrazy (saveJobImages)
        if (isset($input['projectImages']) && is_array($input['projectImages'])) {
            saveJobImages($id, $input['projectImages'], 'project', 'simple');
        }
        if (isset($input['completionImages']) && is_array($input['completionImages'])) {
            saveJobImages($id, $input['completionImages'], 'completion', 'simple');
        }
        
        // Aktualizuj załączniki
        if (isset($input['attachments']) && is_array($input['attachments'])) {
            saveAttachments($id, $input['attachments'], 'simple');
        }
        
        // Zwróć zaktualizowane zlecenie
        $stmt = $pdo->prepare('SELECT * FROM jobs_simple WHERE id = ?');
        $stmt->execute(array($id));
        $job = $stmt->fetch();
        
        jsonResponse(array('success' => true, 'job' => mapJobSimpleToFrontend($job)));
    } catch (Exception $e) {
        error_log('Error updating simple job: ' . $e->getMessage());
        jsonResponse(array('error' => 'Database error: ' . $e->getMessage()), 500);
    }
}

/**
 * DELETE /api/jobs-simple/{id}
 */
function deleteJobSimple($id) {
    $user = requireAuth();
    $pdo = getDB();
    
    $stmt = $pdo->prepare('SELECT id FROM jobs_simple WHERE id = ?');
    $stmt->execute(array($id));
    if (!$stmt->fetch()) {
        jsonResponse(array('error' => 'Zlecenie nie istnieje'), 404);
    }
    
    // Usuń pliki obrazów z dysku
    $stmt = $pdo->prepare('SELECT file_path FROM job_images WHERE job_id = ? AND job_type = ?');
    $stmt->execute(array($id, 'simple'));
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
    
    // Usuń powiązane dane z bazy
    $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND job_type = ?')->execute(array($id, 'simple'));
    $pdo->prepare('DELETE FROM job_attachments WHERE job_id = ? AND job_type = ?')->execute(array($id, 'simple'));
    
    // Usuń zlecenie
    $stmt = $pdo->prepare('DELETE FROM jobs_simple WHERE id = ?');
    $stmt->execute(array($id));
    
    jsonResponse(array('success' => true, 'message' => 'Zlecenie usunięte'));
}

/**
 * Mapowanie z bazy na frontend
 */
function mapJobSimpleToFrontend($job) {
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
        'type' => 'simple',
        'createdAt' => strtotime($job['created_at']) * 1000,
        'status' => $job['status'] ? $job['status'] : 'NEW',
        'columnId' => $job['column_id'] ? $job['column_id'] : 'PREPARE',
        'columnOrder' => intval($job['column_order']),
        'data' => array(
            'jobTitle' => $job['title'],
            'clientName' => $job['client_name'],
            'companyName' => $job['company_name'],
            'phoneNumber' => $job['phone'],
            'email' => $job['email'],
            'nip' => $job['nip'],
            'address' => $job['address'],
            'coordinates' => $coords,
            'distanceKm' => $job['distance_km'] ? floatval($job['distance_km']) : null,
            'description' => $job['description'],
            'scheduledDate' => $job['scheduled_date'],
            'paymentStatus' => $job['payment_status'],
            'payment' => array(
                'netAmount' => $job['value_net'] ? floatval($job['value_net']) : null,
                'grossAmount' => $job['value_gross'] ? floatval($job['value_gross']) : null
            )
        ),
        'projectImages' => getJobImages($jobId, 'project', 'simple'),
        'completionImages' => getJobImages($jobId, 'completion', 'simple'),
        'attachments' => getAttachments($jobId, 'simple'),
        'adminNotes' => $job['notes'],
        'completedAt' => $job['completed_at'] ? strtotime($job['completed_at']) * 1000 : null,
        'completionNotes' => isset($job['completion_notes']) ? $job['completion_notes'] : null,
        'reviewRequestSentAt' => !empty($job['review_request_sent_at']) ? strtotime($job['review_request_sent_at']) * 1000 : null,
        'reviewRequestEmail' => isset($job['review_request_email']) ? $job['review_request_email'] : null
    );
}
