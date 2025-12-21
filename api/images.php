<?php
/**
 * Obsługa obrazów (ujednolicone - tylko jobs_ai)
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
 * Obsługuje obrazy (base64) oraz istniejące ścieżki do plików (obrazy, PDF-y, dokumenty)
 */
function saveImageToFile($base64Data, $jobId, $type, $order) {
    // Jeśli to nie jest base64 tylko już istniejący URL/ścieżka - zwróć bez zmian
    // To obsługuje obrazy, PDF-y i wszystkie inne pliki które już są zapisane
    if (strpos($base64Data, 'data:image') !== 0 && 
        strpos($base64Data, 'data:application') !== 0 &&
        (strpos($base64Data, '/uploads') !== false || strpos($base64Data, '/api/uploads') !== false)) {
        // To jest już istniejący plik (obraz, PDF, dokument) - zwróć ścieżkę bez zmian
        return $base64Data;
    }
    
    if (!is_dir(UPLOADS_DIR)) {
        mkdir(UPLOADS_DIR, 0755, true);
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
    $filepath = UPLOADS_DIR . '/' . $filename;
    
    if (file_put_contents($filepath, $imageData) === false) {
        error_log("Nie można zapisać obrazu: $filepath");
        return null;
    }
    
    return UPLOADS_URL . '/' . $filename;
}

/**
 * Zapisuje obrazy i załączniki (obrazy, PDF-y, dokumenty) do tabeli job_images
 * jobType parametr jest deprecated - zachowany dla kompatybilności
 * 
 * Akceptuje:
 * - Ścieżki do plików: /uploads/file.pdf, /uploads/image.jpg
 * - Base64 obrazów: data:image/jpeg;base64,...
 * - Base64 PDF-ów: data:application/pdf;base64,... (rzadko używane)
 */
function saveJobImages($jobId, $images, $type = 'project', $jobType = 'ai') {
    if (empty($images) || !is_array($images)) return;
    
    $pdo = getDB();
    
    // Pobierz stare pliki (obrazy i załączniki) - bez filtrowania po job_type
    $stmt = $pdo->prepare('SELECT file_path FROM job_images WHERE job_id = ? AND type = ?');
    $stmt->execute(array($jobId, $type));
    $oldImages = $stmt->fetchAll();
    
    // Zbieramy nazwy plików, które są przesyłane w inpucie i mają pozostać
    // Obsługujemy zarówno obrazy jak i PDF-y oraz inne pliki
    $filesToKeep = array();
    foreach ($images as $imgData) {
        // Sprawdzamy czy to URL (ścieżka), a nie base64
        if (is_string($imgData) && 
            strpos($imgData, 'data:image') !== 0 && 
            strpos($imgData, 'data:application') !== 0 &&
            (strpos($imgData, '/uploads') !== false || strpos($imgData, '/api/uploads') !== false)) {
            $filesToKeep[] = basename($imgData);
        }
    }
    
    // Usuń stare pliki, ale tylko te, których nie ma w nowym zestawie
    foreach ($oldImages as $old) {
        if (!empty($old['file_path'])) {
            $filename = basename($old['file_path']);
            // Jeśli pliku nie ma na liście do zachowania -> usuń go fizycznie
            if (!in_array($filename, $filesToKeep)) {
                // Sprawdź czy plik jest w podfolderze (np. gmail/)
                if (strpos($old['file_path'], '/gmail/') !== false) {
                    $oldFile = UPLOADS_DIR . '/gmail/' . $filename;
                } else {
                    $oldFile = UPLOADS_DIR . '/' . $filename;
                }
                
                if (file_exists($oldFile)) @unlink($oldFile);
            }
        }
    }
    
    // Usuń stare rekordy
    $stmt = $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND type = ?');
    $stmt->execute(array($jobId, $type));
    
    // Wstaw nowe - job_type zawsze 'ai' (dla kompatybilności z bazą)
    $stmt = $pdo->prepare('
        INSERT INTO job_images (job_id, type, file_path, file_data, is_cover, sort_order, job_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    
    $order = 0;
    foreach ($images as $imageData) {
        if (!empty($imageData) && is_string($imageData)) {
            $filePath = saveImageToFile($imageData, $jobId, $type, $order);
            if ($filePath) {
                $isCover = ($order === 0) ? 1 : 0;
                // Przekazujemy pusty string do file_data (bo baza nie pozwala na NULL)
                // job_type zawsze 'ai' po konsolidacji
                $stmt->execute(array($jobId, $type, $filePath, '', $isCover, $order, 'ai'));
                $order++;
            }
        }
    }
}

/**
 * Pobiera obrazy dla zlecenia
 * jobType parametr jest deprecated - zachowany dla kompatybilności
 */
function getJobImages($jobId, $type = 'project', $jobType = 'ai') {
    $pdo = getDB();
    
    try {
        // Bez filtrowania po job_type - wszystko w jednej tabeli
        $stmt = $pdo->prepare('
            SELECT file_path, file_data FROM job_images 
            WHERE job_id = ? AND type = ?
            ORDER BY sort_order ASC
        ');
        $stmt->execute(array($jobId, $type));
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
