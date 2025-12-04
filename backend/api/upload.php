<?php
/**
 * CRM Zlecenia Montażowe - Upload plików
 * PHP 5.6 Compatible
 */

if (!defined('CRM_LOADED')) {
    die('Brak dostępu');
}

require_once __DIR__ . '/auth.php';

/**
 * Handler uploadu
 */
function handleUpload($method) {
    if ($method !== 'POST') {
        jsonError('Metoda niedozwolona', 405);
    }
    
    $user = verifyAuth();
    
    if (!isset($_FILES['file'])) {
        jsonError('Brak pliku', 400);
    }
    
    $file = $_FILES['file'];
    $jobId = isset($_POST['job_id']) ? (int)$_POST['job_id'] : 0;
    $imageType = isset($_POST['type']) ? $_POST['type'] : 'project';
    
    // Walidacja pliku
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errors = array(
            UPLOAD_ERR_INI_SIZE => 'Plik zbyt duży (limit serwera)',
            UPLOAD_ERR_FORM_SIZE => 'Plik zbyt duży',
            UPLOAD_ERR_PARTIAL => 'Plik przesłany częściowo',
            UPLOAD_ERR_NO_FILE => 'Nie przesłano pliku',
            UPLOAD_ERR_NO_TMP_DIR => 'Brak folderu tymczasowego',
            UPLOAD_ERR_CANT_WRITE => 'Błąd zapisu na dysku',
            UPLOAD_ERR_EXTENSION => 'Upload zatrzymany przez rozszerzenie'
        );
        $errorMsg = isset($errors[$file['error']]) ? $errors[$file['error']] : 'Nieznany błąd';
        jsonError($errorMsg, 400);
    }
    
    // Sprawdź rozmiar
    if ($file['size'] > MAX_FILE_SIZE) {
        jsonError('Plik zbyt duży. Maksymalny rozmiar: ' . (MAX_FILE_SIZE / 1024 / 1024) . ' MB', 400);
    }
    
    // Sprawdź typ MIME
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    
    if (!in_array($mimeType, ALLOWED_TYPES)) {
        jsonError('Niedozwolony typ pliku: ' . $mimeType, 400);
    }
    
    // Określ rozszerzenie
    $extensions = array(
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf'
    );
    
    $ext = isset($extensions[$mimeType]) ? $extensions[$mimeType] : 'bin';
    
    // Utwórz folder
    $uploadDir = UPLOAD_DIR;
    if ($jobId) {
        $uploadDir .= $jobId . '/';
    } else {
        $uploadDir .= 'temp/';
    }
    
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Generuj nazwę pliku
    $fileName = uniqid() . '_' . time() . '.' . $ext;
    $filePath = $uploadDir . $fileName;
    
    // Przenieś plik
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        jsonError('Błąd zapisu pliku', 500);
    }
    
    // Kompresuj obrazy
    if (in_array($mimeType, array('image/jpeg', 'image/png'))) {
        compressImage($filePath, $mimeType);
    }
    
    // Zapisz w bazie jeśli podano job_id
    $relativePath = ($jobId ? $jobId . '/' : 'temp/') . $fileName;
    
    if ($jobId) {
        $db = getDB();
        $stmt = $db->prepare("
            INSERT INTO job_images (job_id, image_type, file_path, file_name, mime_type, file_size)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute(array(
            $jobId,
            $imageType,
            $relativePath,
            $file['name'],
            $mimeType,
            filesize($filePath)
        ));
        
        $imageId = $db->lastInsertId();
    }
    
    jsonResponse(array(
        'success' => true,
        'id' => isset($imageId) ? (int)$imageId : null,
        'path' => $relativePath,
        'name' => $fileName,
        'originalName' => $file['name'],
        'mimeType' => $mimeType,
        'size' => filesize($filePath)
    ));
}

/**
 * Kompresuje obraz
 */
function compressImage($filePath, $mimeType, $quality = 80, $maxWidth = 1600) {
    // Pobierz wymiary
    $imageInfo = getimagesize($filePath);
    if (!$imageInfo) {
        return false;
    }
    
    $width = $imageInfo[0];
    $height = $imageInfo[1];
    
    // Sprawdź czy potrzebna jest zmiana rozmiaru
    if ($width <= $maxWidth) {
        // Tylko rekompresuj bez zmiany rozmiaru
        $newWidth = $width;
        $newHeight = $height;
    } else {
        // Oblicz nowe wymiary
        $ratio = $maxWidth / $width;
        $newWidth = $maxWidth;
        $newHeight = (int)($height * $ratio);
    }
    
    // Wczytaj obraz
    if ($mimeType === 'image/jpeg') {
        $source = imagecreatefromjpeg($filePath);
    } elseif ($mimeType === 'image/png') {
        $source = imagecreatefrompng($filePath);
    } else {
        return false;
    }
    
    if (!$source) {
        return false;
    }
    
    // Utwórz nowy obraz
    $destination = imagecreatetruecolor($newWidth, $newHeight);
    
    // Zachowaj przezroczystość dla PNG
    if ($mimeType === 'image/png') {
        imagealphablending($destination, false);
        imagesavealpha($destination, true);
    }
    
    // Skaluj
    imagecopyresampled($destination, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
    
    // Zapisz jako JPEG (mniejszy rozmiar)
    $newPath = preg_replace('/\.(png|jpg|jpeg)$/i', '.jpg', $filePath);
    imagejpeg($destination, $newPath, $quality);
    
    // Zwolnij pamięć
    imagedestroy($source);
    imagedestroy($destination);
    
    // Usuń oryginał jeśli zmieniono format
    if ($newPath !== $filePath && file_exists($filePath)) {
        unlink($filePath);
    }
    
    return true;
}

/**
 * Serwuje plik statyczny z folderu uploads
 */
function serveFile($path) {
    $fullPath = UPLOAD_DIR . $path;
    
    if (!file_exists($fullPath)) {
        jsonError('Plik nie znaleziony', 404);
    }
    
    // Sprawdź MIME type
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($fullPath);
    
    // Nagłówki
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($fullPath));
    header('Cache-Control: public, max-age=31536000');
    
    // Wyślij plik
    readfile($fullPath);
    exit();
}

