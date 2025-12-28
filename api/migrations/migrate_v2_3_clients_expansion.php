<?php
/**
 * MIGRACJA v2.3: Rozbudowa Modułu Kontrahentów
 * Dodanie kolumn gmail_thread_id oraz logo_url do tabeli clients
 */

require_once __DIR__ . '/../config.php';

echo "<h1>Migracja v2.3: Rozbudowa Modułu Kontrahentów</h1>";
echo "<pre>";

try {
    $pdo = getDB();

    // 1. Dodaj kolumny do tabeli clients
    echo "Aktualizuję tabelę clients...\n";
    
    $columnsToAdd = [
        'gmail_thread_id' => "VARCHAR(255) NULL AFTER infakt_id",
        'logo_url' => "VARCHAR(255) NULL AFTER gmail_thread_id"
    ];

    foreach ($columnsToAdd as $col => $definition) {
        try {
            $stmt = $pdo->query("SHOW COLUMNS FROM clients LIKE '$col'");
            if ($stmt->rowCount() === 0) {
                $pdo->exec("ALTER TABLE clients ADD COLUMN $col $definition");
                echo "✅ Dodano kolumnę $col do clients\n";
            } else {
                echo "ℹ️ Kolumna $col już istnieje w clients\n";
            }
        } catch (Exception $e) { 
            echo "❌ Błąd przy dodawaniu $col: " . $e->getMessage() . "\n"; 
        }
    }

    echo "\n✅ Migracja zakończona pomyślnie!\n";

} catch (Exception $e) {
    echo "\n❌ BŁĄD: " . $e->getMessage() . "\n";
}

echo "</pre>";

