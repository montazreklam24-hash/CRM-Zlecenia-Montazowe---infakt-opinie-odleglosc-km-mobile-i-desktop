<?php
/**
 * API Importu z Gmaila - WERSJA POPRAWIONA I BEZPIECZNA
 */

// Zapobieganie wyciekowi jakichkolwiek znaków przed JSONem
if (ob_get_level() == 0) ob_start();

// Wyłącz wyświetlanie błędów do outputu (zapobieganie "Unexpected token <")
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Własny log błędów
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) @mkdir($logDir, 0777, true);
@ini_set('error_log', $logDir . '/php_error.log');

if (!function_exists('debugImport')) {
    function debugImport($msg) {
        $logFile = __DIR__ . '/logs/debug_import.log';
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " | " . $msg . "\n", FILE_APPEND);
    }
}

// BARDZO WCZESNY DEBUG
debugImport("--- SCRIPT START ---");
debugImport("METHOD: " . $_SERVER['REQUEST_METHOD']);

// Przechwytywanie błędów do loga
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    debugImport("PHP ERROR [$errno]: $errstr in $errfile on line $errline");
    return false;
});

// Loguj załadowanie każdego pliku
debugImport("Loading config...");
require_once __DIR__ . '/config.php';
debugImport("Loading auth...");
require_once __DIR__ . '/auth.php';
debugImport("Loading images...");
require_once __DIR__ . '/images.php';
debugImport("Loading jobs...");
require_once __DIR__ . '/jobs.php';
debugImport("Loading gemini...");
require_once __DIR__ . '/gemini.php';
debugImport("All core files loaded.");

// Funkcje pomocnicze na górze
// debugImport została przeniesiona wyżej dla wczesnego debugowania

if (!function_exists('base64url_decode_safe')) {
    function base64url_decode_safe($data) {
        $data = strtr($data, '-_', '+/');
        $pad = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        $decoded = base64_decode($data);
        return $decoded === false ? '' : $decoded;
    }
}

if (!function_exists('googleApiGetRaw')) {
    function googleApiGetRaw($url, $token) {
        debugImport("API Request: $url");
        $ch = curl_init();
        curl_setopt_array($ch, array(
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => array(
                "Authorization: Bearer {$token}",
                "Accept: application/json"
            ),
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 30
        ));
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            debugImport("Curl error: $err");
            return array('ok' => false, 'code' => 0, 'error' => $err ?: 'Curl error', 'json' => null);
        }
        $json = json_decode($response, true);
        debugImport("API Response: HTTP $httpCode");
        return array('ok' => ($httpCode >= 200 && $httpCode < 300), 'code' => $httpCode, 'error' => null, 'json' => $json);
    }
}

if (!function_exists('collectAttachmentsFromPart')) {
    function collectAttachmentsFromPart($part, $messageId, &$out, &$seenFiles) {
        $mimeType = isset($part['mimeType']) ? $part['mimeType'] : '';
        $filename = isset($part['filename']) ? $part['filename'] : '';
        $body = isset($part['body']) ? $part['body'] : array();
        $attachmentId = isset($body['attachmentId']) ? $body['attachmentId'] : null;
        $fileSize = isset($body['size']) ? $body['size'] : 0;

        if ($attachmentId) {
            $isInlineImage = (strpos($mimeType, 'image/') === 0);
            if ($filename || $isInlineImage) {
                $fileKey = strtolower($filename ?: 'inline_' . substr($attachmentId, 0, 16)) . '_' . $fileSize;
                if (!isset($seenFiles[$fileKey])) {
                    debugImport("Collecting: $filename (mime: $mimeType, size: {$fileSize} bytes)");
                    $seenFiles[$fileKey] = true;
                    $out[] = array(
                        'messageId' => $messageId,
                        'attachmentId' => (string)$attachmentId,
                        'filename' => $filename,
                        'mimeType' => $mimeType,
                        'isInline' => $isInlineImage,
                        'size' => $fileSize
                    );
                }
            }
        }

        if (!empty($part['parts']) && is_array($part['parts'])) {
            foreach ($part['parts'] as $sub) {
                collectAttachmentsFromPart($sub, $messageId, $out, $seenFiles);
            }
        }
    }
}

// Główna logika
try {
    handleCORS();

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    // Autoryzacja
    $providedSecret = isset($_SERVER['HTTP_X_CRM_SECRET']) ? $_SERVER['HTTP_X_CRM_SECRET'] : (isset($_GET['secret']) ? $_GET['secret'] : '');
    $authToken = getAuthToken();

    $isAuthorized = false;
    if ((defined('CRM_API_SECRET') && $providedSecret === CRM_API_SECRET) || (defined('CRM_API_SECRET') && $authToken === CRM_API_SECRET)) {
        $isAuthorized = true;
    } else {
        try {
            requireAuth();
            $isAuthorized = true;
        } catch (Exception $e) {
            // requireAuth już wysłało odpowiedź
            exit;
        }
    }

    if (!$isAuthorized) {
        jsonResponse(array('success' => false, 'error' => 'Unauthorized'), 401);
    }

    $input = getJsonInput();

    // --- SCENARIUSZ 1: Pobieranie załączników (Rozszerzenie Chrome) ---
    if ((isset($input['messageId']) || isset($input['id'])) && isset($input['token'])) {
        $id = isset($input['messageId']) ? $input['messageId'] : $input['id'];
        $gmailToken = $input['token'];

        debugImport("=== NEW ATTACHMENT REQUEST ===");
        debugImport("ID: $id");

        $attachmentsMeta = array();

        // 1. Pobierz threadId
        $msgUrl = "https://www.googleapis.com/gmail/v1/users/me/messages/{$id}?format=minimal";
        $msgRes = googleApiGetRaw($msgUrl, $gmailToken);
        
        $threadId = null;
        if ($msgRes['ok'] && !empty($msgRes['json']['threadId'])) {
            $threadId = $msgRes['json']['threadId'];
            debugImport("Got threadId: $threadId");
        } else {
            $threadId = $id;
            debugImport("Using $id as threadId directly");
        }
        
        // 2. Pobierz CAŁY WĄTEK
        $threadUrl = "https://www.googleapis.com/gmail/v1/users/me/threads/{$threadId}?format=full";
        $threadRes = googleApiGetRaw($threadUrl, $gmailToken);
        
        if (!$threadRes['ok']) {
            throw new Exception("Nie udało się pobrać wątku $threadId. HTTP: " . $threadRes['code']);
        }
        
        $messages = isset($threadRes['json']['messages']) ? $threadRes['json']['messages'] : array();
        debugImport("Thread fetched. Messages count: " . count($messages));
        
        // Sortuj najnowsze najpierw
        usort($messages, function($a, $b) {
            $dateA = isset($a['internalDate']) ? floatval($a['internalDate']) : 0;
            $dateB = isset($b['internalDate']) ? floatval($b['internalDate']) : 0;
            return $dateB - $dateA;
        });

        $seenFiles = array();
        foreach ($messages as $msg) {
            if (isset($msg['payload'])) {
                collectAttachmentsFromPart($msg['payload'], $msg['id'], $attachmentsMeta, $seenFiles);
            }
        }

        debugImport("Found " . count($attachmentsMeta) . " matching attachment(s)");

        $saved = array();
        foreach ($attachmentsMeta as $a) {
            $filename = !empty($a['filename']) ? $a['filename'] : ('image_' . $a['messageId'] . '_' . substr(md5(uniqid()), 0, 8) . '.png');
            $safeFilename = preg_replace('/[^a-zA-Z0-9\._-]/', '_', $filename);
            
            $msgId = $a['messageId'];
            $attId = $a['attachmentId'];
            $attUrl = "https://www.googleapis.com/gmail/v1/users/me/messages/{$msgId}/attachments/{$attId}";
            $attRes = googleApiGetRaw($attUrl, $gmailToken);
            
            if (!$attRes['ok'] || empty($attRes['json']['data'])) continue;
            $dataBinary = base64url_decode_safe($attRes['json']['data']);

            if ($dataBinary === '') continue;

            $finalFilename = time() . '_' . substr(md5(uniqid()), 0, 4) . '_' . $safeFilename;
            
            // Ścieżka do zapisu (plural/singular fallback)
            $targetDir = defined('UPLOAD_DIR') ? UPLOAD_DIR : (defined('UPLOADS_DIR') ? UPLOADS_DIR : (__DIR__ . '/../uploads/'));
            $filePath = rtrim($targetDir, '/') . '/' . $finalFilename;
            
            // Upewnij się, że katalog istnieje
            if (!is_dir($targetDir)) {
                @mkdir($targetDir, 0777, true);
            }
            
            if (@file_put_contents($filePath, $dataBinary)) {
                debugImport("Saved file: $filePath (" . strlen($dataBinary) . " bytes)");
                
                $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                if (in_array($ext, array('pdf', 'eps', 'ai', 'psd'))) {
                    generateThumbnail($filePath);
                }

                $saved[] = array(
                    'originalName' => $filename,
                    'path' => rtrim(UPLOADS_URL, '/') . '/' . $finalFilename,
                    'size' => strlen($dataBinary)
                );
            }
        }

        debugImport("=== IMPORT COMPLETE (Saved: " . count($saved) . ") ===");
        jsonResponse(array(
            'success' => true, 
            'attachments' => $saved,
            'threadId' => $threadId
        ));
    }

    // --- SCENARIUSZ 2: Bezpośrednie tworzenie zlecenia (GAS / Direct POST) ---
    if (empty($input['text']) && empty($input['data'])) {
        jsonResponse(array('error' => 'No data provided'), 400);
    }

    $text = isset($input['text']) ? $input['text'] : '';
    $images = isset($input['images']) ? $input['images'] : array();
    $gmailMessageId = isset($input['gmailMessageId']) ? $input['gmailMessageId'] : null;
    $gmailThreadId = isset($input['gmailThreadId']) ? $input['gmailThreadId'] : null;
    $title = isset($input['title']) ? $input['title'] : 'Zlecenie z Gmail';

    if (!empty($text) && empty($input['data'])) {
        $geminiResult = analyzeEmailContent($text);
        if ($geminiResult && isset($geminiResult['data'])) {
            $jobData = $geminiResult['data'];
            if (isset($jobData['suggestedTitle']) && ($title === 'Zlecenie z Gmail' || strlen($title) < 5)) {
                $title = $jobData['suggestedTitle'];
            }
        } else {
            $jobData = array('scopeWorkText' => $text);
        }
    } else {
        $jobData = isset($input['data']) ? $input['data'] : array();
    }

    // Sprawdź duplikaty
    if ($gmailMessageId) {
        $pdo = getDB();
        $stmt = $pdo->prepare('SELECT id FROM jobs_ai WHERE gmail_message_id = ?');
        $stmt->execute(array($gmailMessageId));
        if ($stmt->fetch()) {
            jsonResponse(array('success' => true, 'message' => 'Zlecenie już istnieje', 'isDuplicate' => true));
        }
    }

    $friendlyId = generateFriendlyId();
    $pdo = getDB();
    $stmt = $pdo->prepare('
        INSERT INTO jobs_ai (
            friendly_id, title, address, description, status, column_id, created_by,
            gmail_message_id, gmail_thread_id, value_net, value_gross
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $stmt->execute(array(
        $friendlyId,
        $title,
        isset($jobData['address']) ? $jobData['address'] : null,
        isset($jobData['scopeWorkText']) ? $jobData['scopeWorkText'] : (isset($jobData['description']) ? $jobData['description'] : $text),
        'NEW',
        'PREPARE',
        1,
        $gmailMessageId,
        $gmailThreadId,
        isset($jobData['payment']['netAmount']) ? $jobData['payment']['netAmount'] : null,
        isset($jobData['payment']['grossAmount']) ? $jobData['payment']['grossAmount'] : null
    ));

    $jobId = $pdo->lastInsertId();

    if (!empty($images)) {
        saveJobImages($jobId, $images, 'project');
    }

    jsonResponse(array(
        'success' => true,
        'jobId' => $jobId,
        'friendlyId' => $friendlyId,
        'message' => 'Zlecenie utworzone pomyślnie'
    ));

} catch (Exception $e) {
    error_log("Import Gmail Exception: " . $e->getMessage());
    debugImport("FATAL ERROR: " . $e->getMessage());
    jsonResponse(array('success' => false, 'error' => $e->getMessage()), 500);
}
