<?php
/**
 * Migracja: Pola tabeli invoices (infakt_number, etc.)
 * + Brakujące pola w jobs_ai / jobs_simple
 */
require_once __DIR__ . '/config.php';

echo "Rozpoczynam migrację bazy...\n";
$pdo = getDB();

function columnExists($pdo, $table, $column) {
    try {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM {$table} LIKE ?");
        $stmt->execute([$column]);
        return $stmt->fetch() !== false;
    } catch (Exception $e) {
        return false;
    }
}

try {
    // 1. Tabela invoices - dodaj brakujące kolumny
    $columns = [
        'infakt_number' => "VARCHAR(50) DEFAULT NULL AFTER infakt_id",
        'infakt_link' => "VARCHAR(255) DEFAULT NULL AFTER infakt_number",
        'job_friendly_id' => "VARCHAR(20) DEFAULT NULL AFTER job_id",
        'client_infakt_id' => "INT DEFAULT NULL AFTER client_id"
    ];

    foreach ($columns as $col => $def) {
        if (!columnExists($pdo, 'invoices', $col)) {
            echo "Dodaję kolumnę $col do invoices...\n";
            // FIX: Dodano nazwę kolumny `$col`
            $pdo->exec("ALTER TABLE invoices ADD COLUMN `$col` $def");
        }
    }
    
    // 2. Tabela jobs_ai - review request
    $jobsColumns = [
        'review_request_sent_at' => "DATETIME DEFAULT NULL",
        'review_request_email' => "VARCHAR(255) DEFAULT NULL"
    ];
    
    foreach ($jobsColumns as $col => $def) {
        if (!columnExists($pdo, 'jobs_ai', $col)) {
             echo "Dodaję kolumnę $col do jobs_ai...\n";
             $pdo->exec("ALTER TABLE jobs_ai ADD COLUMN `$col` $def");
        }
    }
    
    // 3. Tabela jobs_simple - review request
    foreach ($jobsColumns as $col => $def) {
        if (!columnExists($pdo, 'jobs_simple', $col)) {
             echo "Dodaję kolumnę $col do jobs_simple...\n";
             $pdo->exec("ALTER TABLE jobs_simple ADD COLUMN `$col` $def");
        }
    }

    echo "✅ Migracja zakończona sukcesem!\n";

} catch (PDOException $e) {
    echo "❌ Błąd SQL: " . $e->getMessage() . "\n";
    http_response_code(500);
}
