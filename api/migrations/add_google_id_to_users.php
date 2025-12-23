<?php
/**
 * Migracja: Dodaj kolumnę google_id do tabeli users
 */

require_once __DIR__ . '/../config.php';

try {
    $pdo = getDB();
    
    // Sprawdź czy kolumna już istnieje
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'google_id'");
    $exists = $stmt->fetch();
    
    if (!$exists) {
        // Dodaj kolumnę google_id
        $pdo->exec("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL");
        $pdo->exec("CREATE INDEX idx_google_id ON users(google_id)");
        echo "✓ Dodano kolumnę google_id do tabeli users\n";
    } else {
        echo "✓ Kolumna google_id już istnieje\n";
    }
    
    echo "Migracja zakończona pomyślnie!\n";
    
} catch (Exception $e) {
    echo "Błąd migracji: " . $e->getMessage() . "\n";
    exit(1);
}

