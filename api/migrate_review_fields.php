<?php
/**
 * Migracja: Dodanie pól do śledzenia prośby o opinię
 * 
 * Uruchom raz na serwerze: https://crm.montazreklam24.pl/api/migrate_review_fields.php
 * Po uruchomieniu USUŃ ten plik z serwera!
 */

require_once __DIR__ . '/config.php';

header('Content-Type: text/html; charset=utf-8');

echo "<h1>Migracja: Pola prośby o opinię</h1>";
echo "<pre>";

try {
    $pdo = getDB();
    
    // Lista kolumn do dodania
    $columns = array(
        array('name' => 'completed_at', 'type' => 'DATETIME DEFAULT NULL'),
        array('name' => 'completion_notes', 'type' => 'TEXT'),
        array('name' => 'review_request_sent_at', 'type' => 'DATETIME DEFAULT NULL'),
        array('name' => 'review_request_email', 'type' => 'VARCHAR(255) DEFAULT NULL')
    );
    
    // Funkcja pomocnicza do sprawdzenia czy kolumna istnieje
    function columnExists($pdo, $table, $column) {
        $sql = "SHOW COLUMNS FROM `$table` LIKE '$column'";
        $stmt = $pdo->query($sql);
        return $stmt->fetch() !== false;
    }
    
    echo "--- Tabela jobs_ai ---\n";
    foreach ($columns as $col) {
        $columnName = $col['name'];
        $columnType = $col['type'];
        
        if (columnExists($pdo, 'jobs_ai', $columnName)) {
            echo "✓ Kolumna '{$columnName}' już istnieje - pomijam\n";
        } else {
            $sql = "ALTER TABLE `jobs_ai` ADD COLUMN `{$columnName}` {$columnType}";
            $pdo->exec($sql);
            echo "✅ Dodano kolumnę '{$columnName}'\n";
        }
    }
    
    echo "\n--- Tabela jobs_simple ---\n";
    foreach ($columns as $col) {
        $columnName = $col['name'];
        $columnType = $col['type'];
        
        if (columnExists($pdo, 'jobs_simple', $columnName)) {
            echo "✓ Kolumna '{$columnName}' już istnieje - pomijam\n";
        } else {
            $sql = "ALTER TABLE `jobs_simple` ADD COLUMN `{$columnName}` {$columnType}";
            $pdo->exec($sql);
            echo "✅ Dodano kolumnę '{$columnName}'\n";
        }
    }
    
    echo "\n</pre>";
    echo "<h2 style='color:green'>✅ Migracja zakończona!</h2>";
    echo "<p style='color:red;font-weight:bold'>⚠️ USUŃ TEN PLIK Z SERWERA po zakończeniu!</p>";
    
} catch (Exception $e) {
    echo "</pre>";
    echo "<h2 style='color:red'>❌ Błąd migracji:</h2>";
    echo "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
}
?>