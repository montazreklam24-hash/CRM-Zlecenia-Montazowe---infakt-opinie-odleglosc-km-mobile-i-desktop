<?php
/**
 * Obsługa obrazów (wspólna dla jobs.php i jobs_simple.php)
 */
require_once __DIR__ . '/config.php';

// Folder na obrazy (w głównym folderze uploads/ - poza api/)
if (!defined('UPLOADS_DIR')) {
    define('UPLOADS_DIR', __DIR__ . '/../uploads');
}
if (!defined('UPLOADS_URL')) {
    define('UPLOADS_URL', '/uploads');
}

/**
 * Zapisuje base64 jako plik i zwraca ścieżkę
 */
function saveImageToFile($base64Data, $jobId, $type, $order) {
    // Jeśli to nie jest base64 tylko już istniejący URL - zwróć bez zmian
    if (strpos($base64Data, 'data:image') !== 0 && 
        (strpos($base64Data, '/uploads') !== false || strpos($base64Data, '/api/uploads') !== false)) {
        return $base64Data;
    }
    
    // Dla completion images używamy osobnego folderu po_montazu/
    $subfolder = ($type === 'completion') ? 'po_montazu' : '';
    $targetDir = $subfolder ? UPLOADS_DIR . '/' . $subfolder : UPLOADS_DIR;
    
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    
    if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $matches)) {
        $extension = $matches[1];
        if ($extension === 'jpeg') $extension = 'jpg';
        $base64Data = substr($base64Data, strpos($base64Data, ',') + 1);
    } else {
        $extension = 'jpg'; 
    }
    
    $imageData = base64_decode($base64Data);
    if ($imageData === false) return null;
    
    $filename = sprintf('job_%d_%s_%d_%d.%s', $jobId, $type, $order, time(), $extension);
    $filepath = $targetDir . '/' . $filename;
    
    if (file_put_contents($filepath, $imageData) === false) {
        error_log("Nie można zapisać obrazu: $filepath");
        return null;
    }
    
    // Zwróć ścieżkę z subfolderem jeśli jest
    return $subfolder ? UPLOADS_URL . '/' . $subfolder . '/' . $filename : UPLOADS_URL . '/' . $filename;
}

/**
 * Zapisuje obrazy do tabeli job_images
 * UWAGA: Jeśli $images jest pustą tablicą [], usuwa wszystkie istniejące obrazy
 */
function saveJobImages($jobId, $images, $type = 'project', $jobType = 'ai') {
    if (!is_array($images)) return; // Tylko sprawdź czy to tablica, nie czy jest pusta!
    
    $pdo = getDB();
    
    // Pobierz stare obrazy
    $stmt = $pdo->prepare('SELECT file_path FROM job_images WHERE job_id = ? AND type = ? AND job_type = ?');
    $stmt->execute(array($jobId, $type, $jobType));
    $oldImages = $stmt->fetchAll();
    
    // Usuń stare pliki
    foreach ($oldImages as $old) {
        if (!empty($old['file_path'])) {
            // Sprawdź czy to ścieżka z po_montazu/ czy główny folder
            $oldFile = strpos($old['file_path'], '/po_montazu/') !== false
                ? UPLOADS_DIR . '/po_montazu/' . basename($old['file_path'])
                : UPLOADS_DIR . '/' . basename($old['file_path']);
            if (file_exists($oldFile)) @unlink($oldFile);
        }
    }
    
    // Usuń stare rekordy
    $stmt = $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND type = ? AND job_type = ?');
    $stmt->execute(array($jobId, $type, $jobType));
    
    // Jeśli tablica jest pusta - tylko usuń stare obrazy (już zrobione powyżej)
    if (empty($images)) {
        return;
    }
    
    // Wstaw nowe
    $stmt = $pdo->prepare('
        INSERT INTO job_images (job_id, type, file_path, is_cover, sort_order, job_type)
        VALUES (?, ?, ?, ?, ?, ?)
    ');
    
    $order = 0;
    foreach ($images as $imageData) {
        if (!empty($imageData) && is_string($imageData)) {
            $filePath = saveImageToFile($imageData, $jobId, $type, $order);
            if ($filePath) {
                $isCover = ($order === 0) ? 1 : 0;
                $stmt->execute(array($jobId, $type, $filePath, $isCover, $order, $jobType));
                $order++;
            }
        }
    }
}

/**
 * Pobiera obrazy dla zlecenia
 */
function getJobImages($jobId, $type = 'project', $jobType = 'ai') {
    $pdo = getDB();
    
    try {
        $stmt = $pdo->prepare('
            SELECT file_path, file_data FROM job_images 
            WHERE job_id = ? AND type = ? AND job_type = ?
            ORDER BY sort_order ASC
        ');
        $stmt->execute(array($jobId, $type, $jobType));
        $rows = $stmt->fetchAll();
        
        $images = array();
        foreach ($rows as $row) {
            if (!empty($row['file_path'])) {
                $images[] = $row['file_path'];
            } elseif (!empty($row['file_data'])) {
                $images[] = $row['file_data'];
            }
        }
        return $images;
    } catch (PDOException $e) {
        return array();
    }
}
