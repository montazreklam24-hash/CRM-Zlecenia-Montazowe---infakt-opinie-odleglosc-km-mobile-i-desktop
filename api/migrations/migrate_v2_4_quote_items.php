<?php
require_once __DIR__ . '/../config.php';

echo "Rozpoczynam migrację bazy do wersji v2.4 (quote_items)...\n";

try {
    $pdo = getDB();

    $column = 'quote_items';
    $definition = "LONGTEXT NULL COMMENT 'Lista pozycji wyceny (JSON)' AFTER gmail_thread_id";

    try {
        // Sprawdź czy kolumna istnieje
        $check = $pdo->query("SHOW COLUMNS FROM jobs_ai LIKE '$column'");
        if ($check->rowCount() == 0) {
            $sql = "ALTER TABLE jobs_ai ADD COLUMN $column $definition";
            $pdo->exec($sql);
            echo "✅ Dodano kolumnę: $column\n";
        } else {
            echo "ℹ️ Kolumna $column już istnieje - pomijam.\n";
        }
    } catch (PDOException $e) {
        echo "❌ Błąd przy dodawaniu $column: " . $e->getMessage() . "\n";
    }

    echo "Migracja zakończona pomyślnie!\n";

} catch (PDOException $e) {
    die("Błąd połączenia z bazą: " . $e->getMessage() . "\n");
}

