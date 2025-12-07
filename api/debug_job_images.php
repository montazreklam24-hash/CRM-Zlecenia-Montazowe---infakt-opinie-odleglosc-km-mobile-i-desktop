<?php
/**
 * Diagnostyka tabeli job_images
 */
require_once __DIR__ . '/config.php';
header('Content-Type: text/plain; charset=utf-8');

echo "Sprawdzanie tabeli job_images...\n\n";

try {
    $pdo = getDB();
    
    // Sprawdź czy tabela istnieje
    $stmt = $pdo->query("DESCRIBE job_images");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Kolumny w job_images:\n";
    foreach ($columns as $col) {
        echo str_pad($col['Field'], 20) . " | " . $col['Type'] . "\n";
    }
    echo "\n";
    
    // Sprawdź czy jest kolumna job_type
    $hasJobType = false;
    foreach ($columns as $col) {
        if ($col['Field'] === 'job_type') {
            $hasJobType = true;
            break;
        }
    }
    
    if ($hasJobType) {
        echo "✓ Kolumna 'job_type' istnieje.\n";
    } else {
        echo "✗ BRAK kolumny 'job_type'! To jest problem.\n";
        echo "  Aby naprawić, uruchom:\n";
        echo "  ALTER TABLE job_images ADD COLUMN job_type ENUM('ai', 'simple') DEFAULT 'simple' AFTER job_id;\n";
    }

} catch (Throwable $e) {
    echo "BŁĄD: " . $e->getMessage() . "\n";
}






