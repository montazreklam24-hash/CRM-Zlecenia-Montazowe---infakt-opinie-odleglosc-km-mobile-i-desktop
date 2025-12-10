<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = getDB();
    echo "Updating payment_status column definition...\n";
    
    // Zaktualizuj definicję kolumny, upewniając się, że zawiera wszystkie wartości
    $sql = "ALTER TABLE jobs_ai MODIFY COLUMN payment_status ENUM('none', 'proforma', 'invoice', 'partial', 'paid', 'cash', 'overdue') DEFAULT 'none'";
    
    $pdo->exec($sql);
    echo "Success! Column payment_status updated.\n";
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
}
?>









