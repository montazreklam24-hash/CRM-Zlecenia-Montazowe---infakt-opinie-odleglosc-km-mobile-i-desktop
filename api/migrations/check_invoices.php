<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = getDB();
    $sql = "CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_id VARCHAR(50),
        infakt_id INT,
        infakt_number VARCHAR(50),
        type ENUM('proforma', 'vat') DEFAULT 'proforma',
        client_id INT,
        total_net DECIMAL(10,2),
        total_gross DECIMAL(10,2),
        status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
        share_link VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "Tabela invoices utworzona lub już istnieje.\n";
    
    // Sprawdź czy są jakieś faktury
    $stmt = $pdo->query("SELECT COUNT(*) FROM invoices");
    $count = $stmt->fetchColumn();
    echo "Liczba faktur w bazie: $count\n";
    
} catch (Exception $e) {
    echo "BŁĄD: " . $e->getMessage() . "\n";
}

