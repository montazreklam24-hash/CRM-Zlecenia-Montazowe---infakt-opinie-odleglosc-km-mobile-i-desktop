<?php
/**
 * Skrypt diagnostyczny bazy danych
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = getDB();
    echo "Połączenie z bazą danych: OK\n\n";

    // 1. Sprawdź strukturę tabeli jobs_simple
    echo "--- Struktura tabeli jobs_simple ---\n";
    $stmt = $pdo->query("DESCRIBE jobs_simple");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo $col['Field'] . " | " . $col['Type'] . " | " . $col['Null'] . "\n";
    }
    echo "\n";

    // 2. Test INSERT (próba dodania prostego rekordu)
    echo "--- Test INSERT ---\n";
    $friendlyId = '#TEST-' . time();
    $sql = "INSERT INTO jobs_simple (friendly_id, title, status, created_by) VALUES (?, ?, ?, ?)";
    
    // Pobierz ID admina (zakładamy ID 1 lub pierwsze z brzegu)
    $stmtUser = $pdo->query("SELECT id FROM users LIMIT 1");
    $user = $stmtUser->fetch();
    $userId = $user ? $user['id'] : 1;

    $stmt = $pdo->prepare($sql);
    try {
        $stmt->execute(array($friendlyId, 'Testowe zlecenie debug', 'NEW', $userId));
        $newId = $pdo->lastInsertId();
        echo "INSERT OK! Utworzono ID: $newId\n";
        
        // Sprzątanie
        $pdo->exec("DELETE FROM jobs_simple WHERE id = $newId");
        echo "Usunięto rekord testowy.\n";
    } catch (PDOException $e) {
        echo "BŁĄD INSERT: " . $e->getMessage() . "\n";
    }
    echo "\n";
    
    // 3. Sprawdź ostatnie błędy w jobs_simple (jeśli tabela logów istnieje, ale tutaj jej nie mamy)
    // Zamiast tego, sprawdźmy error_log PHP
    echo "--- Ostatnie błędy z error_log (jeśli dostępne) ---\n";
    if (file_exists('error_log')) {
        echo file_get_contents('error_log');
    } else {
        echo "Brak pliku error_log w katalogu api/\n";
    }

} catch (Exception $e) {
    echo "BŁĄD KRYTYCZNY: " . $e->getMessage();
}






