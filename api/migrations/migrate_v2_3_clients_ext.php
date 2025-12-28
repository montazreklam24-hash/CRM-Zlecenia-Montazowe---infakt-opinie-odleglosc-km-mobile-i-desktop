<?php
require_once __DIR__ . '/../config.php';
$pdo = getDB();

try {
    // Ensure columns exist in clients table
    $pdo->exec("ALTER TABLE clients MODIFY COLUMN infakt_id VARCHAR(100) NULL");
    
    // Check if other columns exist, if not add them (though they seem to be there)
    $columns = $pdo->query("DESCRIBE clients")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('gmail_thread_id', $columns)) {
        $pdo->exec("ALTER TABLE clients ADD COLUMN gmail_thread_id VARCHAR(255) NULL AFTER infakt_id");
    }
    if (!in_array('logo_url', $columns)) {
        $pdo->exec("ALTER TABLE clients ADD COLUMN logo_url VARCHAR(255) NULL AFTER gmail_thread_id");
    }
    
    // Ensure gmail_thread_id exists in jobs_ai
    $jobColumns = $pdo->query("DESCRIBE jobs_ai")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('gmail_thread_id', $jobColumns)) {
        $pdo->exec("ALTER TABLE jobs_ai ADD COLUMN gmail_thread_id VARCHAR(255) NULL AFTER gmail_message_id");
    }

    echo "Migration completed successfully.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}

