<?php
/**
 * API Importu z Gmaila
 * Obsługuje:
 * 1. Pobieranie załączników z Gmaila dla Rozszerzenia Chrome
 * 2. Bezpośrednie tworzenie zleceń z Gmaila (np. przez Google Apps Script)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/images.php';
require_once __DIR__ . '/jobs.php';
require_once __DIR__ . '/gemini.php';

header('Content-Type: application/json');
handleCORS();

// DEBUG LOGGING
function debugImport($msg) {
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) mkdir($logDir, 0777, true);
    file_put_contents($logDir . '/debug_import.log', date('Y-m-d H:i:s') . " | " . $msg . "\n", FILE_APPEND);
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// Autoryzacja
$providedSecret = isset($_SERVER['HTTP_X_CRM_SECRET']) ? $_SERVER['HTTP_X_CRM_SECRET'] : (isset($_GET['secret']) ? $_GET['secret'] : '');
$authToken = getAuthToken();

// Pozwól jeśli to CRM_API_SECRET lub jeśli użytkownik jest zalogowany
$isAuthorized = false;
if ($providedSecret === CRM_API_SECRET || $authToken === CRM_API_SECRET) {
    $isAuthorized = true;
} else {
    try {
        requireAuth();
        $isAuthorized = true;
    } catch (Exception $e) {}
}

if (!$isAuthorized) {
    jsonResponse(['success' => false, 'error' => 'Unauthorized'], 401);
}

$input = getJsonInput();

// --- SCENARIUSZ 1: Pobieranie załączników (Rozszerzenie Chrome) ---
// Rozszerzenie wysyła messageId/id oraz token OAuth2 Gmaila
if ((isset($input['messageId']) || isset($input['id'])) && isset($input['token'])) {
    $id = isset($input['messageId']) ? $input['messageId'] : $input['id'];
    $token = $input['token'];

    debugImport("=== NEW ATTACHMENT REQUEST ===");
    debugImport("INPUT params: ID=$id (pobieramy WSZYSTKIE załączniki)");

    function base64url_decode_safe($data) {
        $data = strtr($data, '-_', '+/');
        $pad = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        $decoded = base64_decode($data);
        return $decoded === false ? '' : $decoded;
    }

    function googleApiGetRaw($url, $token) {
        debugImport("API Request: $url");
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$token}",
                "Accept: application/json"
            ],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 30
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            debugImport("Curl error: $err");
            return ['ok' => false, 'code' => 0, 'error' => $err ?: 'Curl error', 'json' => null];
        }
        $json = json_decode($response, true);
        debugImport("API Response: HTTP $httpCode");
        return ['ok' => ($httpCode >= 200 && $httpCode < 300), 'code' => $httpCode, 'error' => null, 'json' => $json];
    }

    function collectAttachmentsFromPart($part, $messageId, &$out, &$seenFiles) {
        $mimeType = isset($part['mimeType']) ? $part['mimeType'] : '';
        $filename = isset($part['filename']) ? $part['filename'] : '';
        $body = isset($part['body']) ? $part['body'] : [];
        $attachmentId = isset($body['attachmentId']) ? $body['attachmentId'] : null;
        $fileSize = isset($body['size']) ? $body['size'] : 0;
        $inlineData = isset($body['data']) ? $body['data'] : null;

        if ($attachmentId) {
            $isInlineImage = (strpos($mimeType, 'image/') === 0);
            if ($filename || $isInlineImage) {
                $fileKey = strtolower($filename ?: 'inline_' . substr($attachmentId, 0, 16)) . '_' . $fileSize;
                if (isset($seenFiles[$fileKey])) {
                    debugImport("SKIPPING DUPLICATE: $filename ({$fileSize} bytes)");
                } else {
                    debugImport("Collecting: $filename (mime: $mimeType, size: {$fileSize} bytes)");
                    $seenFiles[$fileKey] = true;
                    $out[] = [
                        'messageId' => $messageId,
                        'attachmentId' => (string)$attachmentId,
                        'filename' => $filename,
                        'mimeType' => $mimeType,
                        'isInline' => $isInlineImage,
                        'size' => $fileSize
                    ];
                }
            }
        }

        if (!empty($part['parts']) && is_array($part['parts'])) {
            foreach ($part['parts'] as $sub) {
                collectAttachmentsFromPart($sub, $messageId, $out, $seenFiles);
            }
        }
    }

    try {
        debugImport("=== START IMPORT (ID: $id) - POBIERAMY CAŁY WĄTEK ===");
        $attachmentsMeta = [];

        // Pobierz threadId
        $msgUrl = "https://www.googleapis.com/gmail/v1/users/me/messages/{$id}?format=minimal";
        $msgRes = googleApiGetRaw($msgUrl, $token);
        
        $threadId = null;
        if ($msgRes['ok'] && !empty($msgRes['json']['threadId'])) {
            $threadId = $msgRes['json']['threadId'];
            debugImport("Got threadId: $threadId");
        } else {
            $threadId = $id;
            debugImport("Using $id as threadId directly");
        }
        
        // Pobierz CAŁY WĄTEK
        $threadUrl = "https://www.googleapis.com/gmail/v1/users/me/threads/{$threadId}?format=full";
        $threadRes = googleApiGetRaw($threadUrl, $token);
        
        if (!$threadRes['ok']) {
            throw new Exception("Nie udało się pobrać wątku $threadId. HTTP: " . $threadRes['code']);
        }
        
        $messages = isset($threadRes['json']['messages']) ? $threadRes['json']['messages'] : [];
        debugImport("Thread fetched. Messages count: " . count($messages));
        
        // Sortuj najnowsze najpierw
        usort($messages, function($a, $b) {
            $dateA = isset($a['internalDate']) ? floatval($a['internalDate']) : 0;
            $dateB = isset($b['internalDate']) ? floatval($b['internalDate']) : 0;
            return $dateB - $dateA;
        });

        $seenFiles = [];
        foreach ($messages as $msg) {
            if (isset($msg['payload'])) {
                collectAttachmentsFromPart($msg['payload'], $msg['id'], $attachmentsMeta, $seenFiles);
            }
        }

        debugImport("Found " . count($attachmentsMeta) . " matching attachment(s)");

        $saved = [];
        foreach ($attachmentsMeta as $a) {
            $filename = $a['filename'] ?: ('image_' . $a['messageId'] . '_' . ($a['attachmentId'] ?: 'inline') . '.png');
            $safeFilename = preg_replace('/[^a-zA-Z0-9\._-]/', '_', $filename);
            
            $msgId = $a['messageId'];
            $attId = $a['attachmentId'];
            $attUrl = "https://www.googleapis.com/gmail/v1/users/me/messages/{$msgId}/attachments/{$attId}";
            $attRes = googleApiGetRaw($attUrl, $token);
            
            if (!$attRes['ok'] || empty($attRes['json']['data'])) continue;
            $dataBinary = base64url_decode_safe($attRes['json']['data']);

            if ($dataBinary === '') continue;

            $finalFilename = time() . '_' . $safeFilename;
            $filePath = UPLOAD_DIR . $finalFilename;
            
            if (file_put_contents($filePath, $dataBinary)) {
                debugImport("Saved file: $filePath (" . strlen($dataBinary) . " bytes)");
                
                // Miniaturka dla PDF/EPS/AI/PSD
                $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                if (in_array($ext, ['pdf', 'eps', 'ai', 'psd'])) {
                    generateThumbnail($filePath);
                }

                $saved[] = [
                    'filename' => $finalFilename,
                    'originalName' => $filename,
                    'path' => rtrim(UPLOADS_URL, '/') . '/' . $finalFilename,
                    'mimeType' => $a['mimeType'] ?: 'application/octet-stream'
                ];
            }
        }

        debugImport("=== IMPORT COMPLETE (Saved: " . count($saved) . ") ===");
        jsonResponse([
            'success' => true, 
            'attachments' => $saved,
            'threadId' => $threadId
        ]);

    } catch (Exception $e) {
        debugImport("ERROR: " . $e->getMessage());
        jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// --- SCENARIUSZ 2: Bezpośrednie tworzenie zlecenia (GAS / Direct POST) ---
if (empty($input['text']) && empty($input['data'])) {
    jsonResponse(['error' => 'No data provided'], 400);
}

try {
    $pdo = getDB();
    
    $text = isset($input['text']) ? $input['text'] : '';
    $images = isset($input['images']) ? $input['images'] : [];
    $gmailMessageId = isset($input['gmailMessageId']) ? $input['gmailMessageId'] : null;
    $gmailThreadId = isset($input['gmailThreadId']) ? $input['gmailThreadId'] : null;
    $title = isset($input['title']) ? $input['title'] : 'Zlecenie z Gmail';

    if (!empty($text) && empty($input['data'])) {
        // Poprawione wywołanie: analyzeEmailContent zamiast nieistniejącego analyzeWithGemini
        $geminiResult = analyzeEmailContent($text);
        if ($geminiResult && isset($geminiResult['data'])) {
            $jobData = $geminiResult['data'];
            if (isset($jobData['suggestedTitle']) && ($title === 'Zlecenie z Gmail' || strlen($title) < 5)) {
                $title = $jobData['suggestedTitle'];
            }
        } else {
            $jobData = [
                'jobTitle' => $title,
                'scopeWorkText' => $text,
                'address' => 'Do ustalenia'
            ];
        }
    } else {
        $jobData = isset($input['data']) ? $input['data'] : [];
    }

    // Sprawdź duplikaty
    if ($gmailMessageId) {
        $stmt = $pdo->prepare('SELECT id FROM jobs_ai WHERE gmail_message_id = ?');
        $stmt->execute([$gmailMessageId]);
        if ($stmt->fetch()) {
            jsonResponse(['success' => true, 'message' => 'Zlecenie już istnieje', 'isDuplicate' => true]);
        }
    }

    $friendlyId = generateFriendlyId();
    
    $stmt = $pdo->prepare('
        INSERT INTO jobs_ai (
            friendly_id, title, address, description, status, column_id, created_by,
            gmail_message_id, gmail_thread_id, value_net, value_gross
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $stmt->execute([
        $friendlyId,
        $title,
        isset($jobData['address']) ? $jobData['address'] : null,
        isset($jobData['scopeWorkText']) ? $jobData['scopeWorkText'] : (isset($jobData['description']) ? $jobData['description'] : $text),
        'NEW',
        'PREPARE',
        1, // System
        $gmailMessageId,
        $gmailThreadId,
        isset($jobData['payment']['netAmount']) ? $jobData['payment']['netAmount'] : null,
        isset($jobData['payment']['grossAmount']) ? $jobData['payment']['grossAmount'] : null
    ]);

    $jobId = $pdo->lastInsertId();

    if (!empty($images)) {
        saveJobImages($jobId, $images, 'project');
    }

    jsonResponse([
        'success' => true,
        'jobId' => $jobId,
        'friendlyId' => $friendlyId,
        'message' => 'Zlecenie utworzone pomyślnie'
    ]);

} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
