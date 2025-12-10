<?php
require_once __DIR__ . '/config.php';

// Włącz raportowanie błędów
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = getDB();
    echo "Połączono z bazą danych.\n";

    // Sprawdź czy kolumna payment_status istnieje w jobs_ai
    $stmt = $pdo->query("SHOW COLUMNS FROM jobs_ai LIKE 'payment_status'");
    $exists = $stmt->fetch();

    if (!$exists) {
        echo "Kolumna 'payment_status' nie istnieje. Dodaję...\n";
        $sql = "ALTER TABLE jobs_ai ADD COLUMN payment_status ENUM('none', 'proforma', 'invoice', 'partial', 'paid', 'cash', 'overdue') DEFAULT 'none' AFTER status";
        $pdo->exec($sql);
        echo "Dodano kolumnę 'payment_status'.\n";
    } else {
        echo "Kolumna 'payment_status' już istnieje.\n";
    }

    echo "Aktualizacja bazy danych zakończona sukcesem.\n";

} catch (PDOException $e) {
    echo "Błąd bazy danych: " . $e->getMessage() . "\n";
} catch (Exception $e) {
    echo "Błąd: " . $e->getMessage() . "\n";
}









