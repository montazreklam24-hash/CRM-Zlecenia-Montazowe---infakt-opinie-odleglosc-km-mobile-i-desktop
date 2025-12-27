<?php
require_once __DIR__ . '/../config.php';

echo "Rozpoczynam migrację statusów płatności...\n";

try {
    // Używamy bezpośrednio parametrów połączenia z monciu_crm2
    $dsn = "mysql:host=127.0.0.1;dbname=monciu_crm2;charset=utf8mb4";
    $user = "monciu_crm";
    $pass = "Mr03984!";
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    // 1. Zmiana definicji kolumny ENUM, aby zawierała wszystkie wymagane statusy
    // Dodajemy: none, partial, cash
    // Zostawiamy: pending, proforma, invoiced, paid, overdue (dla kompatybilności wstecznej)
    
    $sql = "ALTER TABLE jobs_ai MODIFY COLUMN payment_status ENUM(
        'none', 'pending', 'proforma', 'partial', 'invoiced', 'paid', 'cash', 'overdue'
    ) DEFAULT 'none'";
    
    $pdo->exec($sql);
    echo "✅ Zaktualizowano definicję kolumny payment_status w jobs_ai\n";

    // 2. Migracja istniejących danych (opcjonalnie)
    // Mapowanie pending -> none
    $pdo->exec("UPDATE jobs_ai SET payment_status = 'none' WHERE payment_status = 'pending'");
    echo "✅ Zmapowano 'pending' na 'none'\n";

    // 3. To samo dla jobs_simple (jeśli istnieje)
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'jobs_simple'");
        if ($check->rowCount() > 0) {
            $pdo->exec("ALTER TABLE jobs_simple MODIFY COLUMN payment_status ENUM(
                'none', 'pending', 'proforma', 'partial', 'invoiced', 'paid', 'cash', 'overdue'
            ) DEFAULT 'none'");
            $pdo->exec("UPDATE jobs_simple SET payment_status = 'none' WHERE payment_status = 'pending'");
            echo "✅ Zaktualizowano jobs_simple\n";
        }
    } catch (Exception $e) {
        echo "ℹ️ Pomijam jobs_simple (brak tabeli).\n";
    }

    echo "Migracja zakończona pomyślnie!\n";

} catch (PDOException $e) {
    die("❌ Błąd migracji: " . $e->getMessage() . "\n");
}

