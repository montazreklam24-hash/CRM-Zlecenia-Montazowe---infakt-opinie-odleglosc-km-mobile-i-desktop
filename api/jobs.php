<?php
/**
 * CRM Zlecenia Montażowe - CRUD Zleceń
 * Jednolita tabela: jobs_ai (jako 'jobs')
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
 * GET /api/jobs (dawniej jobs-all) - Lista wszystkich zleceń
 */
function getJobs() {
    $user = requireAuth();
    $pdo = getDB();
    
    // Pobieramy wszystko z jobs_ai (teraz jedyne źródło)
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
        
        // DEBUG LOGGING
        $logDir = __DIR__ . '/logs';
        if (!is_dir($logDir)) mkdir($logDir, 0777, true);
        file_put_contents($logDir . '/debug_jobs.log', date('Y-m-d H:i:s') . " CREATE JOB INPUT: " . print_r($input, true) . "\n", FILE_APPEND);
        
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
        $friendlyId = generateFriendlyId();

        // ZNAJDŹ LUB UTWÓRZ KLIENTA
        $clientId = null;
        $nip = isset($data['nip']) ? preg_replace('/[^0-9]/', '', $data['nip']) : null;
        $email = isset($data['email']) ? trim($data['email']) : null;
        
        if ($nip && strlen($nip) === 10) {
            $stmt = $pdo->prepare('SELECT id FROM clients WHERE nip = ?');
            $stmt->execute([$nip]);
            $client = $stmt->fetch();
            if ($client) $clientId = $client['id'];
        }
        
        if (!$clientId && $email) {
            $stmt = $pdo->prepare('SELECT id FROM clients WHERE email = ?');
            $stmt->execute([$email]);
            $client = $stmt->fetch();
            if ($client) $clientId = $client['id'];
        }

        // Jeśli nadal brak clientId, a mamy dane - utwórz klienta
        if (!$clientId && (isset($data['clientName']) || isset($data['companyName']))) {
            try {
                $cName = isset($data['clientName']) ? $data['clientName'] : $data['companyName'];
                $stmt = $pdo->prepare('INSERT INTO clients (company_name, email, phone, nip, created_by) VALUES (?, ?, ?, ?, ?)');
                $stmt->execute([
                    $cName,
                    $email,
                    isset($data['phoneNumber']) ? $data['phoneNumber'] : (isset($data['phone']) ? $data['phone'] : null),
                    $nip,
                    $user['id']
                ]);
                $clientId = $pdo->lastInsertId();
            } catch (Exception $e) {
                // Ignoruj błąd tworzenia klienta, nie przerywaj tworzenia zlecenia
                error_log("Failed to auto-create client: " . $e->getMessage());
            }
        }

        // SPRAWDZANIE DUPLIKATÓW
        $gmailMessageId = isset($data['gmailMessageId']) ? $data['gmailMessageId'] : null;
        $gmailThreadId = isset($data['gmailThreadId']) ? $data['gmailThreadId'] : null;

        if ($gmailMessageId) {
            $stmt = $pdo->prepare('SELECT id, friendly_id FROM jobs_ai WHERE gmail_message_id = ?');
            $stmt->execute([$gmailMessageId]);
            $existingJob = $stmt->fetch();
            
            if ($existingJob) {
                // Zwracamy istniejące zlecenie
                $stmt = $pdo->prepare('SELECT * FROM jobs_ai WHERE id = ?');
                $stmt->execute([$existingJob['id']]);
                $job = $stmt->fetch();
                
                jsonResponse(array(
                    'success' => true, 
                    'job' => mapJobToFrontend($job),
                    'isDuplicate' => true,
                    'message' => 'Zlecenie z tego maila już istnieje.'
                ), 200);
                return;
            }
        }

        // INSERT
        $stmt = $pdo->prepare('
            INSERT INTO jobs_ai (
                friendly_id, title, client_id, client_name, phone, email, nip,
                billing_name, billing_nip, billing_street, billing_building_no, 
                billing_apartment_no, billing_post_code, billing_city, billing_email,
                address, coordinates_lat, coordinates_lng,
                description, notes, status, column_id, column_order, created_by,
                gmail_message_id, gmail_thread_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

        // Helper dla pól billing (obsługa obu struktur)
        $getBilling = function($key, $nestedKey) use ($data) {
            if (isset($data[$key])) return $data[$key];
            if (isset($data['billing']) && is_array($data['billing']) && isset($data['billing'][$nestedKey])) {
                return $data['billing'][$nestedKey];
            }
            return null;
        };

        $stmt->execute(array(
            $friendlyId,
            $title,
            $clientId,
            isset($data['clientName']) ? $data['clientName'] : null,
            $phone,
            isset($data['email']) ? $data['email'] : null,
            isset($data['nip']) ? $data['nip'] : null,
            
            // Dane do faktury (używamy helpera)
            $getBilling('billingName', 'name'),
            $getBilling('billingNip', 'nip'),
            $getBilling('billingStreet', 'street'),
            $getBilling('billingBuilding', 'buildingNo'),
            $getBilling('billingApartment', 'apartmentNo'),
            $getBilling('billingPostcode', 'postCode'),
            $getBilling('billingCity', 'city'),
            $getBilling('billingEmail', 'email'),
            
            isset($data['address']) ? $data['address'] : null,
            $coordLat,
            $coordLng,
            $description,
            isset($input['adminNotes']) ? $input['adminNotes'] : null,
            'NEW',
            isset($input['columnId']) ? $input['columnId'] : 'PREPARE',
            0,
            $user['id'],
            $gmailMessageId,
            $gmailThreadId
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
        error_log('Error creating job: ' . $e->getMessage());
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
            'description' => 'description',
        );
        
        foreach ($fieldMap as $frontendField => $dbField) {
            if (isset($data[$frontendField])) {
                $updates[] = "$dbField = ?";
                $params[] = $data[$frontendField];
            }
        }

        // Mapowanie pól bilingowych (obsługa płaskiej struktury i zagnieżdżonej)
        $billingMap = array(
            'billingName' => array('db' => 'billing_name', 'nested' => 'name'),
            'billingNip' => array('db' => 'billing_nip', 'nested' => 'nip'),
            'billingStreet' => array('db' => 'billing_street', 'nested' => 'street'),
            'billingBuilding' => array('db' => 'billing_building_no', 'nested' => 'buildingNo'),
            'billingApartment' => array('db' => 'billing_apartment_no', 'nested' => 'apartmentNo'),
            'billingPostcode' => array('db' => 'billing_post_code', 'nested' => 'postCode'),
            'billingCity' => array('db' => 'billing_city', 'nested' => 'city'),
            'billingEmail' => array('db' => 'billing_email', 'nested' => 'email'),
        );

        foreach ($billingMap as $flatKey => $cfg) {
            $dbField = $cfg['db'];
            $nestedKey = $cfg['nested'];
            
            if (isset($data[$flatKey])) {
                $updates[] = "$dbField = ?";
                $params[] = $data[$flatKey];
            } elseif (isset($data['billing']) && is_array($data['billing']) && isset($data['billing'][$nestedKey])) {
                $updates[] = "$dbField = ?";
                $params[] = $data['billing'][$nestedKey];
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
            $sql = 'UPDATE jobs_ai SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        
        // Aktualizuj obrazy
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
        error_log('Error updating job: ' . $e->getMessage());
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
    $stmt = $pdo->prepare('SELECT file_path FROM job_images WHERE job_id = ?');
    $stmt->execute(array($id));
    $images = $stmt->fetchAll();
    foreach ($images as $img) {
        if (!empty($img['file_path'])) {
            $file = UPLOADS_DIR . '/' . basename($img['file_path']);
            if (file_exists($file)) {
                @unlink($file);
            }
        }
    }
    
    // Usuń obrazy z bazy
    $pdo->prepare('DELETE FROM job_images WHERE job_id = ?')->execute(array($id));
    
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
        'id' => strval($jobId), // Czyste ID
        'original_id' => strval($jobId),
        'friendlyId' => $job['friendly_id'],
        'type' => 'ai', // Domyślny typ dla kompatybilności (deprecated)
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
            'billing' => array(
                'name' => $job['billing_name'],
                'nip' => $job['billing_nip'],
                'street' => $job['billing_street'],
                'buildingNo' => $job['billing_building_no'],
                'apartmentNo' => $job['billing_apartment_no'],
                'postCode' => $job['billing_post_code'],
                'city' => $job['billing_city'],
                'email' => $job['billing_email'],
            ),
            'coordinates' => $coords,
            'scopeWorkText' => $job['description'],
            'payment' => array(
                'type' => 'UNKNOWN',
                'netAmount' => $job['value_net'] ? floatval($job['value_net']) : null,
                'grossAmount' => $job['value_gross'] ? floatval($job['value_gross']) : null
            )
        ),
        // Pobieramy obrazy
        'projectImages' => getJobImages($jobId, 'project'),
        'completionImages' => getJobImages($jobId, 'completion'),
        'adminNotes' => $job['notes'],
        'checklist' => array(),
        'completedAt' => !empty($job['completed_at']) ? strtotime($job['completed_at']) * 1000 : null,
        'completionNotes' => isset($job['completion_notes']) ? $job['completion_notes'] : null,
        'reviewRequestSentAt' => !empty($job['review_request_sent_at']) ? strtotime($job['review_request_sent_at']) * 1000 : null,
        'reviewRequestEmail' => isset($job['review_request_email']) ? $job['review_request_email'] : null
    );
}

// Zastąpienie starego handleJobsAll (teraz alias dla getJobs)
function handleJobsAll() {
    getJobs();
}
