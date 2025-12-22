<?php
/**
 * API Endpoint: Upload plików (multipart/form-data)
 * Pozwala na wgrywanie plików pojedynczo, zwraca ścieżkę.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/images.php'; // For generateThumbnail

// DEBUG: Loguj każdy request
function debugUpload($msg) {
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) mkdir($logDir, 0777, true);
    file_put_contents($logDir . '/upload_debug.log', date('Y-m-d H:i:s') . " | " . $msg . "\n", FILE_APPEND);
}

debugUpload("=== NEW UPLOAD REQUEST ===");
debugUpload("Method: " . $_SERVER['REQUEST_METHOD']);
debugUpload("Content-Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'NONE'));
debugUpload("Content-Length: " . ($_SERVER['CONTENT_LENGTH'] ?? 'NONE'));
debugUpload("FILES keys: " . json_encode(array_keys($_FILES)));
debugUpload("POST keys: " . json_encode(array_keys($_POST)));

// Obsługa CORS
handleCORS();

// Wymagana autoryzacja
$user = requireAuth();
debugUpload("Auth OK, user: " . ($user['email'] ?? 'unknown'));

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(array('error' => 'Method not allowed'), 405);
}

// Sprawdź czy przesłano plik
if (!isset($_FILES['file'])) {
    debugUpload("ERROR: No file in FILES array. Full FILES: " . json_encode($_FILES));
    debugUpload("Full POST: " . json_encode($_POST));
    jsonResponse(array('error' => 'No file uploaded'), 400);
}

debugUpload("File received: " . $_FILES['file']['name'] . " (size: " . $_FILES['file']['size'] . ", error: " . $_FILES['file']['error'] . ")");

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(array('error' => 'Upload error: ' . $file['error']), 500);
}

// Sprawdź rozmiar (max 10MB zdefiniowane w config.php)
if ($file['size'] > MAX_UPLOAD_SIZE) {
    jsonResponse(array('error' => 'File too large'), 400);
}

// Sprawdź typ MIME
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/postscript'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    jsonResponse(array('error' => 'Invalid file type: ' . $mimeType), 400);
}

// Przygotuj katalog
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

// Generuj unikalną nazwę
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
if (empty($extension)) {
    // Zgadnij po MIME
    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
        'application/postscript' => 'eps'
    ];
    $extension = isset($extensions[$mimeType]) ? $extensions[$mimeType] : 'bin';
}

// Nazwa pliku: extension_upload_{TIMESTAMP}_{RANDOM}.ext
$filename = sprintf(
    'extension_upload_%s_%s.%s',
    time(),
    bin2hex(random_bytes(8)),
    $extension
);

$targetPath = UPLOAD_DIR . $filename;
$publicUrl = UPLOADS_URL . $filename;

// Przenieś plik
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Generuj miniaturkę dla PDF/EPS
    if (in_array(strtolower($extension), ['pdf', 'eps', 'ai', 'psd'])) {
        generateThumbnail($targetPath);
    }

    jsonResponse(array(
        'success' => true,
        'url' => $publicUrl,
        'path' => $targetPath, // Opcjonalnie, jeśli backend potrzebuje ścieżki absolutnej
        'filename' => $filename
    ));
} else {
    jsonResponse(array('error' => 'Failed to move uploaded file'), 500);
}

