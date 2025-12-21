<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'error' => 'Method not allowed']);
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$id = $input['messageId'] ?? $input['id'] ?? null; // wspieramy oba pola
$token = $input['token'] ?? null;

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
    return ['ok' => false, 'code' => 0, 'error' => $err ?: 'Curl error', 'json' => null];
  }
  $json = json_decode($response, true);
  return ['ok' => ($httpCode >= 200 && $httpCode < 300), 'code' => $httpCode, 'error' => null, 'json' => $json];
}

function collectAttachmentsFromPart(array $part, string $messageId, array &$out): void {
  $mimeType = $part['mimeType'] ?? '';
  $filename = $part['filename'] ?? '';
  $body = $part['body'] ?? [];
  $attachmentId = $body['attachmentId'] ?? null;
  $inlineData = $body['data'] ?? null;

  // 1) Załącznik po attachmentId (klasyczny)
  // - bierzemy też obrazki inline nawet gdy filename jest puste
  if ($attachmentId) {
    $isInlineImage = (strpos($mimeType, 'image/') === 0);
    if ($filename || $isInlineImage) {
      $out[] = [
        'messageId' => $messageId,
        'attachmentId' => $attachmentId,
        'filename' => $filename,
        'mimeType' => $mimeType,
        'isInline' => $isInlineImage
      ];
    }
  }

  // 2) Inline data bez attachmentId (rzadziej, ale bywa)
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

  // Rekurencja po częściach
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

  // payload może być "single" albo mieć parts
  collectAttachmentsFromPart($payload, $messageId, $out);
}

try {
  $uploadDir = __DIR__ . '/../uploads/gmail';
  if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

  $attachmentsMeta = [];

  // 1) Najpierw próbujemy jako THREAD
  $threadUrl = "https://www.googleapis.com/gmail/v1/users/me/threads/{$id}?format=full";
  $threadRes = googleApiGetRaw($threadUrl, $token);

  if ($threadRes['ok'] && !empty($threadRes['json']['messages'])) {
    foreach ($threadRes['json']['messages'] as $msg) {
      if (is_array($msg)) collectAttachmentsFromMessage($msg, $attachmentsMeta);
    }
  } else {
    // 2) Fallback jako MESSAGE
    $msgUrl = "https://www.googleapis.com/gmail/v1/users/me/messages/{$id}?format=full";
    $msgRes = googleApiGetRaw($msgUrl, $token);
    if (!$msgRes['ok']) {
      throw new Exception("Nie udało się pobrać ani wątku ani wiadomości. threadHTTP={$threadRes['code']} msgHTTP={$msgRes['code']}");
    }
    collectAttachmentsFromMessage($msgRes['json'], $attachmentsMeta);
  }

  // 3) Pobierz pliki
  $saved = [];
  foreach ($attachmentsMeta as $a) {
    $filename = $a['filename'] ?: ('image_' . $a['messageId'] . '_' . $a['attachmentId'] . '.png');
    $safeFilename = preg_replace('/[^a-zA-Z0-9\._-]/', '_', $filename);

    $dataBinary = '';

    // inlineData bez attachmentId
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

    $filePath = $uploadDir . '/' . time() . '_' . $safeFilename;
    file_put_contents($filePath, $dataBinary);

    $saved[] = [
      'filename' => basename($filePath),
      'originalName' => $filename,
      'path' => '/uploads/gmail/' . basename($filePath),
      'mimeType' => $a['mimeType'] ?? 'application/octet-stream'
    ];
  }

  echo json_encode(['success' => true, 'attachments' => $saved]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
