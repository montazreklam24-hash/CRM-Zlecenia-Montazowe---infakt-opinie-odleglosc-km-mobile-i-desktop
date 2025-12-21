<?php
// Skrypt diagnostyczny do sprawdzania zlecenia "Wołoska"
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/api/config.php';

echo "🔍 Sprawdzanie zlecenia 'Wołoska' w bazie danych...\n";

try {
    $pdo = getDB();
    
    // 1. Znajdź zlecenie w jobs_ai
    echo "Szukam w jobs_ai...\n";
    $stmt = $pdo->prepare("SELECT * FROM jobs_ai WHERE title LIKE ? OR description LIKE ?");
    $stmt->execute(['%Wołoska%', '%Wołoska%']);
    $jobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($jobs)) {
        echo "❌ Nie znaleziono zlecenia 'Wołoska'.\n";
        exit;
    }

    foreach ($jobs as $job) {
        echo "✅ Znaleziono zlecenie:\n";
        echo "ID: " . $job['id'] . "\n";
        echo "Title: " . $job['title'] . "\n";
        echo "Description: " . $job['description'] . "\n";
        
        // 2. Pobierz zdjęcia z job_images
        echo "   📸 Pobieram zdjęcia z job_images dla ID=" . $job['id'] . "...\n";
        $stmtImg = $pdo->prepare("SELECT * FROM job_images WHERE job_id = ?");
        $stmtImg->execute([$job['id']]);
        $images = $stmtImg->fetchAll(PDO::FETCH_ASSOC);
        
        echo "   Liczba zdjęć: " . count($images) . "\n";
        foreach ($images as $img) {
            echo "      - Image ID: " . $img['id'] . "\n";
            echo "        Type: " . $img['type'] . "\n"; // project/completion
            echo "        Path: " . $img['file_path'] . "\n";
            echo "        Is Main: " . ($img['is_main'] ?? 'N/A') . "\n"; // Sprawdźmy czy jest kolumna is_main
            // Sprawdź inne kolumny
            print_r($img);
        }
        echo "--------------------------------------------------\n";
    }
    
} catch (Exception $e) {
    echo "❌ Błąd bazy danych: " . $e->getMessage() . "\n";
}
