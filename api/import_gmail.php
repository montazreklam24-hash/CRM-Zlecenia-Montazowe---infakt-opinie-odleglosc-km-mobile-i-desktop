<?php
/**
 * Import wiadomości z Gmaila (wraz z załącznikami) - Poprawiona wersja z obsługą threadId i inline images
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/images.php';

header('Content-Type: application/json');
handleCORS();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'error' => 'Method not allowed']);
  exit;
}

// DEBUG LOGGING
function debugImport($msg) {
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) mkdir($logDir, 0777, true);
    file_put_contents($logDir . '/debug_import.log', date('Y-m-d H:i:s') . " | " . $msg . "\n", FILE_APPEND);
}

$input = json_decode(file_get_contents('php://input'), true);
$id = $input['messageId'] ?? $input['id'] ?? null;
$token = $input['token'] ?? null;
$selectedIds = $input['selectedIds'] ?? null; // Lista ID załączników do pobrania

// Log input parameters (without token)
debugImport("INPUT params: ID=$id, SelectedIds count=" . ($selectedIds ? count($selectedIds) : 'NULL'));
if ($selectedIds) {
    debugImport("Selected IDs sample: " . substr(json_encode(array_slice($selectedIds, 0, 3)), 0, 200));
}

if (!$id || !$token) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Missing messageId/id or token']);
  exit;
}

function base64url_decode_safe(string $data): string {
  $data = strtr($data, '-_', '+/');
  $pad = strlen($data) % 4;
  if ($pad) $data .= str_repeat('=', 4 - $pad);
  $decoded = base64_decode($data, true);
  return $decoded === false ? '' : $decoded;
}

function googleApiGetRaw(string $url, string $token): array {
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

function collectAttachmentsFromPart(array $part, string $messageId, array &$out, $selectedIds = null): void {
  $mimeType = $part['mimeType'] ?? '';
  $filename = $part['filename'] ?? '';
  $body = $part['body'] ?? [];
  $attachmentId = $body['attachmentId'] ?? null;
  $inlineData = $body['data'] ?? null;
  
  // DEBUG: Log structure only if interesting
  if ($attachmentId || $inlineData) {
      debugImport("Part: Mime=$mimeType, File=$filename, AttId=" . ($attachmentId ? 'YES' : 'NO') . ", Data=" . ($inlineData ? 'YES' : 'NO'));
  }

  if ($attachmentId) {
    // Jeśli podano wybrane ID, sprawdź czy ten załącznik jest na liście
    if ($selectedIds !== null && !in_array($attachmentId, $selectedIds)) {
        debugImport("Skipping attachment $attachmentId (not selected)");
    } else {
        $isInlineImage = (strpos($mimeType, 'image/') === 0);
        if ($filename || $isInlineImage) {
          debugImport("Collecting attachment: $filename ($attachmentId)");
          $out[] = [
            'messageId' => $messageId,
            'attachmentId' => $attachmentId,
            'filename' => $filename,
            'mimeType' => $mimeType,
            'isInline' => $isInlineImage
          ];
        }
    }
  }

  if (!$attachmentId && $inlineData && strpos($mimeType, 'image/') === 0) {
    // Dla inline data (bez ID), na razie pozwalamy jeśli nie ma wyboru lub jeśli to logo? 
    // W sumie user chce wybierać WSZYSTKO co jest załącznikiem.
    // Jeśli selectedIds jest podane, a ten inline nie ma ID, to go pomijamy?
    // Zwykle inline mają attachmentId w Gmail API.
    if ($selectedIds === null) {
        $out[] = [
          'messageId' => $messageId,
          'attachmentId' => null,
          'filename' => $filename ?: ('inline_' . substr(md5($inlineData), 0, 8) . '.png'),
          'mimeType' => $mimeType,
          'isInline' => true,
          'inlineData' => $inlineData
        ];
    }
  }

  if (!empty($part['parts']) && is_array($part['parts'])) {
    foreach ($part['parts'] as $sub) {
      if (is_array($sub)) collectAttachmentsFromPart($sub, $messageId, $out, $selectedIds);
    }
  }
}

function collectAttachmentsFromMessage(array $message, array &$out, $selectedIds = null): void {
  $messageId = $message['id'] ?? '';
  if (!$messageId) return;
  $payload = $message['payload'] ?? null;
  if (!$payload || !is_array($payload)) return;
  collectAttachmentsFromPart($payload, $messageId, $out, $selectedIds);
}

try {
  debugImport("=== START IMPORT (ID: $id) ===");
  $attachmentsMeta = [];

  // 1) Pobierz WIADOMOŚĆ, aby uzyskać threadId
  $msgUrl = "https://www.googleapis.com/gmail/v1/users/me/messages/{$id}?format=full";
  $msgRes = googleApiGetRaw($msgUrl, $token);
  
  if (!$msgRes['ok']) {
      // Spróbuj jako wątek (fallback)
      $threadUrl = "https://www.googleapis.com/gmail/v1/users/me/threads/{$id}?format=full";
      $threadRes = googleApiGetRaw($threadUrl, $token);
      
      if (!$threadRes['ok']) {
          throw new Exception("Nie udało się pobrać wiadomości ani wątku. msgHTTP={$msgRes['code']}");
      }
      
      debugImport("Resolved directly as Thread");
      foreach ($threadRes['json']['messages'] as $msg) {
          if (is_array($msg)) collectAttachmentsFromMessage($msg, $attachmentsMeta, $selectedIds);
      }
  } else {
      // Mamy wiadomość, pobieramy threadId
      $threadId = $msgRes['json']['threadId'] ?? null;
      debugImport("Resolved as Message, Thread ID: " . ($threadId ?? 'NULL'));
      
      if ($threadId) {
          // Pobierz CAŁY wątek
          $threadUrl = "https://www.googleapis.com/gmail/v1/users/me/threads/{$threadId}?format=full";
          $threadRes = googleApiGetRaw($threadUrl, $token);
          
          if ($threadRes['ok'] && !empty($threadRes['json']['messages'])) {
              debugImport("Fetched full thread with " . count($threadRes['json']['messages']) . " messages");
              foreach ($threadRes['json']['messages'] as $msg) {
                  if (is_array($msg)) collectAttachmentsFromMessage($msg, $attachmentsMeta, $selectedIds);
              }
          } else {
              // Fallback: tylko ta wiadomość
              debugImport("Failed to fetch thread, using single message");
              collectAttachmentsFromMessage($msgRes['json'], $attachmentsMeta, $selectedIds);
          }
      } else {
          // Brak threadId, tylko ta wiadomość
          collectAttachmentsFromMessage($msgRes['json'], $attachmentsMeta, $selectedIds);
      }
  }

  debugImport("Found " . count($attachmentsMeta) . " attachment(s) in meta");

  if (count($attachmentsMeta) === 0) {
      debugImport("WARNING: No attachments found. Dumping message structure (SAMPLE):");
      // Dump only part of json to avoid huge logs
      $jsonStr = json_encode($msgRes['json'], JSON_PRETTY_PRINT);
      debugImport(substr($jsonStr, 0, 2000) . "...");
  }

  // 3) Pobierz pliki
  $saved = [];
  foreach ($attachmentsMeta as $a) {
    $filename = $a['filename'] ?: ('image_' . $a['messageId'] . '_' . ($a['attachmentId'] ?? 'inline') . '.png');
    $safeFilename = preg_replace('/[^a-zA-Z0-9\._-]/', '_', $filename);
    $dataBinary = '';

    if (!empty($a['inlineData'])) {
      $dataBinary = base64url_decode_safe($a['inlineData']);
    } else {
      $attId = $a['attachmentId'];
      $msgId = $a['messageId'];
      $attUrl = "https://www.googleapis.com/gmail/v1/users/me/messages/{$msgId}/attachments/{$attId}";
      $attRes = googleApiGetRaw($attUrl, $token);
      if (!$attRes['ok'] || empty($attRes['json']['data'])) continue;
      $dataBinary = base64url_decode_safe($attRes['json']['data']);
    }

    if ($dataBinary === '') continue;

    // Używamy standardowego UPLOAD_DIR z config.php
    $finalFilename = time() . '_' . $safeFilename;
    $filePath = UPLOAD_DIR . '/' . $finalFilename;
    
    if (file_put_contents($filePath, $dataBinary)) {
        debugImport("Saved file: $filePath (" . strlen($dataBinary) . " bytes)");
        
        // Generuj miniaturkę dla PDF/EPS
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (in_array($ext, ['pdf', 'eps', 'ai', 'psd'])) {
            generateThumbnail($filePath);
        }

        $saved[] = [
          'filename' => $finalFilename,
          'originalName' => $filename,
          'path' => rtrim(UPLOADS_URL, '/') . '/' . $finalFilename,
          'mimeType' => $a['mimeType'] ?? 'application/octet-stream'
        ];
    } else {
        debugImport("Failed to save file: $filePath");
    }
  }

  debugImport("=== IMPORT COMPLETE (Saved: " . count($saved) . ") ===");
  echo json_encode(['success' => true, 'attachments' => $saved]);

} catch (Exception $e) {
  debugImport("ERROR: " . $e->getMessage());
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
