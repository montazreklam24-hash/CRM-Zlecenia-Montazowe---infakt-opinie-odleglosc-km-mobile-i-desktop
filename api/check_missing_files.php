<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = getDB();
    $stmt = $pdo->query("SELECT id, job_id, job_type, file_path FROM job_images");
    $images = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "=== RAPORT BRAKUJĄCYCH PLIKÓW ===\n";
    // UPLOAD_DIR w kontenerze to /var/www/html/uploads/
    echo "Katalog sprawdzeń (w kontenerze): " . realpath(UPLOAD_DIR) . "\n";
    echo "Liczba obrazów w bazie: " . count($images) . "\n\n";

    $missingCount = 0;
    $foundCount = 0;
    $missingExamples = [];

    foreach ($images as $img) {
        $filename = basename($img['file_path']);
        // Czasami w bazie są ścieżki z URL encoded znakami, np. spacje jako %20
        $decodedFilename = urldecode($filename);
        
        $fullPath = UPLOAD_DIR . '/' . $decodedFilename;
        $fullPathRaw = UPLOAD_DIR . '/' . $filename;

        if (file_exists($fullPath) || file_exists($fullPathRaw)) {
            $foundCount++;
        } else {
            $missingCount++;
            if (count($missingExamples) < 20) {
                $missingExamples[] = "[BRAK] Zlecenie ID: {$img['job_id']} -> Plik: $filename";
            }
        }
    }

    foreach ($missingExamples as $ex) {
        echo $ex . "\n";
    }
    
    if ($missingCount > 20) {
        echo "... i " . ($missingCount - 20) . " więcej.\n";
    }

    echo "\n=== PODSUMOWANIE ===\n";
    echo "Znaleziono: $foundCount\n";
    echo "Brakuje: $missingCount\n";

} catch (Exception $e) {
    echo "Błąd: " . $e->getMessage();
}





