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
// USUNIĘTO selectedIds - teraz zawsze pobieramy WSZYSTKO, filtrowanie po nazwie robi rozszerzenie

// Log input parameters (without token)
debugImport("=== NEW REQUEST ===");
debugImport("INPUT params: ID=$id (pobieramy WSZYSTKIE załączniki)");

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

// UPROSZCZONA WERSJA - Zawsze zbiera WSZYSTKIE załączniki
function collectAttachmentsFromPart(array $part, string $messageId, array &$out): void {
  $mimeType = $part['mimeType'] ?? '';
  $filename = $part['filename'] ?? '';
  $body = $part['body'] ?? [];
  $attachmentId = $body['attachmentId'] ?? null;
  $inlineData = $body['data'] ?? null;

  // Załącznik z ID (typowy przypadek)
  if ($attachmentId) {
    $isInlineImage = (strpos($mimeType, 'image/') === 0);
    if ($filename || $isInlineImage) {
      debugImport("Collecting: $filename (mime: $mimeType)");
      $out[] = [
        'messageId' => $messageId,
        'attachmentId' => (string)$attachmentId,
        'filename' => $filename,
        'mimeType' => $mimeType,
        'isInline' => $isInlineImage
      ];
    }
  }

  // Inline obraz bez ID (rzadko)
  if (!$attachmentId && $inlineData && strpos($mimeType, 'image/') === 0) {
    $out[] = [
      'messageId' => $messageId,
      'attachmentId' => null,
      'filename' => $filename ?: ('inline_' . substr(md5($inlineData), 0, 8) . '.png'),
      'mimeType' => $mimeType,
      'isInline' => true,
      'inlineData' => $inlineData
    ];
  }

  // Rekurencja do pod-części
  if (!empty($part['parts']) && is_array($part['parts'])) {
    foreach ($part['parts'] as $sub) {
      if (is_array($sub)) collectAttachmentsFromPart($sub, $messageId, $out);
    }
  }
}

function collectAttachmentsFromMessage(array $message, array &$out): void {
  $messageId = $message['id'] ?? '';
  if (!$messageId) return;
  $payload = $message['payload'] ?? null;
  if (!$payload || !is_array($payload)) return;
  collectAttachmentsFromPart($payload, $messageId, $out);
}

try {
  debugImport("=== START IMPORT (ID: $id) - POBIERAMY CAŁY WĄTEK ===");
  $attachmentsMeta = [];

  // KROK 1: Pobierz pojedynczą wiadomość żeby uzyskać threadId
  $msgUrl = "https://www.googleapis.com/gmail/v1/users/me/messages/{$id}?format=minimal";
  $msgRes = googleApiGetRaw($msgUrl, $token);
  
  $threadId = null;
  if ($msgRes['ok'] && !empty($msgRes['json']['threadId'])) {
      $threadId = $msgRes['json']['threadId'];
      debugImport("Got threadId: $threadId from message $id");
  } else {
      // Może $id to już threadId?
      $threadId = $id;
      debugImport("Using $id as threadId directly");
  }
  
  // KROK 2: Pobierz CAŁY WĄTEK ze wszystkimi wiadomościami
  $threadUrl = "https://www.googleapis.com/gmail/v1/users/me/threads/{$threadId}?format=full";
  $threadRes = googleApiGetRaw($threadUrl, $token);
  
  if (!$threadRes['ok']) {
      throw new Exception("Nie udało się pobrać wątku $threadId. HTTP: " . $threadRes['code']);
  }
  
  debugImport("Thread fetched. Messages count: " . count($threadRes['json']['messages'] ?? []));
  
  // KROK 3: Zbierz załączniki ze WSZYSTKICH wiadomości w wątku
  foreach ($threadRes['json']['messages'] as $msg) {
      if (is_array($msg)) {
          debugImport("Scanning message: " . ($msg['id'] ?? 'unknown'));
          collectAttachmentsFromMessage($msg, $attachmentsMeta);
      }
  }

  debugImport("Found " . count($attachmentsMeta) . " matching attachment(s)");

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
