<?php
/**
 * Gmail Webhook - Automatyczny import zleceń z etykietą "crm"
 * 
 * Ten skrypt odbiera dane z Google Apps Script, który nasłuchuje nowych maili.
 * Konfiguracja po stronie Apps Script musi wysyłać POST z JSONem zawierającym:
 * - subject
 * - body
 * - from
 * - date
 * - attachments (tablica z base64 i metadanymi)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/gemini.php'; // Do analizy treści

handleCORS();

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    jsonResponse(array('error' => 'Method not allowed'), 405);
}

// Odbierz dane
$input = getJsonInput();

if (empty($input['subject']) || empty($input['body'])) {
    jsonResponse(array('error' => 'Brak wymaganych danych (subject/body)'), 400);
}

error_log("[GMAIL WEBHOOK] Otrzymano maila: " . $input['subject'] . " od " . $input['from']);

try {
    // 1. Wywołaj analizę Gemini na treści maila
    $fullContent = "Temat: " . $input['subject'] . "\n\nTreść:\n" . $input['body'];
    
    // Używamy istniejącej logiki analizy z gemini.php
    // Zakładamy że gemini.php ma funkcję analyzeEmailContent($content)
    $analysisResult = analyzeEmailContent($fullContent);
    
    if (!$analysisResult || !isset($analysisResult['data'])) {
        throw new Exception("Błąd analizy treści przez AI");
    }
    
    $jobData = $analysisResult['data'];
    
    // 2. Dodaj metadane z maila
    $jobData['gmail_thread_id'] = isset($input['threadId']) ? $input['threadId'] : null;
    $jobData['email_source'] = $input['from'];
    
    // 3. Utwórz zlecenie w bazie
    $pdo = getDB();
    
    // Sprawdź czy to zlecenie już istnieje (po threadId)
    if ($jobData['gmail_thread_id']) {
        $stmt = $pdo->prepare("SELECT id FROM jobs_ai WHERE gmail_thread_id = ?");
        $stmt->execute(array($jobData['gmail_thread_id']));
        if ($stmt->fetch()) {
            jsonResponse(array('success' => true, 'message' => 'Zlecenie z tego wątku już istnieje'), 200);
        }
    }
    
    // Generuj przyjazne ID
    $friendlyId = 'G-' . date('ymd') . '-' . substr(md5(uniqid()), 0, 4);
    
    $stmt = $pdo->prepare("
        INSERT INTO jobs_ai (
            friendly_id, status, column_id, data, created_at, gmail_thread_id
        ) VALUES (?, 'NEW', 'PREPARE', ?, NOW(), ?)
    ");
    
    $stmt->execute(array(
        $friendlyId,
        json_encode($jobData),
        $jobData['gmail_thread_id']
    ));
    
    $jobId = $pdo->lastInsertId();
    
    // 4. Obsłuż załączniki (jeśli są zdjęcia)
    if (!empty($input['attachments']) && is_array($input['attachments'])) {
        foreach ($input['attachments'] as $att) {
            // Logika zapisu załączników jako project_images
            // ...
        }
    }
    
    // 5. Powiadom frontend (przez broadcast change w localStorage - to dzieje się po stronie klienta, 
    // więc tutaj po prostu zwracamy sukces, a live refresh na dashboardzie to wyłapie przy kolejnym pollingu)
    
    jsonResponse(array(
        'success' => true, 
        'jobId' => $jobId, 
        'friendlyId' => $friendlyId,
        'message' => 'Zlecenie utworzone automatycznie z maila'
    ));

} catch (Exception $e) {
    error_log("[GMAIL WEBHOOK] Błąd: " . $e->getMessage());
    jsonResponse(array('error' => $e->getMessage()), 500);
}

