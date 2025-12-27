<?php
/**
 * Endpoint do uruchomienia migracji payment_status ENUM
 * Odpalasz przez: http://localhost:3000/api/run_migration.php
 */

header('Content-Type: text/plain; charset=utf-8');

// Zabezpieczenie: tylko dla lokalnego środowiska
// Wyłączamy na potrzeby debugowania - w produkcji należy to włączyć
// if (!in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1', 'localhost'])) {
//     http_response_code(403);
//     die("❌ Forbidden: Migracje można uruchamiać tylko lokalnie. Twój IP: " . $_SERVER['REMOTE_ADDR']);
// }

require_once __DIR__ . '/config.php';

// Tworzenie połączenia PDO
try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', 
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    die("❌ Nie można połączyć z bazą danych: " . $e->getMessage() . "\nHost: " . DB_HOST);
}

echo "=== MIGRACJA PAYMENT_STATUS ENUM ===\n\n";
echo "Rozpoczynam migrację statusów płatności...\n\n";

try {
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
    $result = $pdo->exec("UPDATE jobs_ai SET payment_status = 'none' WHERE payment_status = 'pending'");
    echo "✅ Zmapowano 'pending' na 'none' ($result rekordów)\n";

    // 3. To samo dla jobs_simple (jeśli istnieje)
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'jobs_simple'");
        if ($check->rowCount() > 0) {
            $pdo->exec("ALTER TABLE jobs_simple MODIFY COLUMN payment_status ENUM(
                'none', 'pending', 'proforma', 'partial', 'invoiced', 'paid', 'cash', 'overdue'
            ) DEFAULT 'none'");
            $result2 = $pdo->exec("UPDATE jobs_simple SET payment_status = 'none' WHERE payment_status = 'pending'");
            echo "✅ Zaktualizowano jobs_simple ($result2 rekordów)\n";
        }
    } catch (Exception $e) {
        echo "ℹ️ Pomijam jobs_simple (brak tabeli).\n";
    }

    echo "\n=== MIGRACJA ZAKOŃCZONA POMYŚLNIE! ===\n";
    echo "\n✅ Możesz teraz używać statusu 'Zaliczka' (partial) w aplikacji.\n";

} catch (PDOException $e) {
    http_response_code(500);
    echo "❌ Błąd migracji: " . $e->getMessage() . "\n";
    echo "\nStack trace:\n" . $e->getTraceAsString();
}

