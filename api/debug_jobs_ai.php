<?php
/**
 * Diagnostyka tabeli jobs_ai
 */
require_once __DIR__ . '/config.php';
header('Content-Type: text/plain; charset=utf-8');

echo "Sprawdzanie tabeli jobs_ai...\n\n";

try {
    $pdo = getDB();
    
    // 1. Sprawdź czy tabela istnieje i pokaż kolumny
    $stmt = $pdo->query("DESCRIBE jobs_ai");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Kolumny w jobs_ai:\n";
    foreach ($columns as $col) {
        echo str_pad($col['Field'], 20) . " | " . $col['Type'] . "\n";
    }
    echo "\n";
    
    // 2. Sprawdź tabelę users (czy jest user ID=1)
    echo "Sprawdzanie użytkownika ID=1...\n";
    $stmt = $pdo->query("SELECT id, email FROM users WHERE id=1");
    $user = $stmt->fetch();
    if ($user) {
        echo "User ID=1 istnieje: " . $user['email'] . "\n";
    } else {
        echo "BŁĄD: Brak użytkownika ID=1! Foreign key fail gwarantowany.\n";
        // Pobierz jakiegokolwiek usera
        $u = $pdo->query("SELECT * FROM users LIMIT 1")->fetch();
        if ($u) {
            echo "Dostępny user: ID=" . $u['id'] . " (" . $u['email'] . ")\n";
        } else {
            echo "BŁĄD KRYTYCZNY: Tabela users jest pusta!\n";
        }
    }
    echo "\n";

    // 3. Testowy INSERT
    echo "Próba INSERT do jobs_ai...\n";
    $stmt = $pdo->prepare("
        INSERT INTO jobs_ai (friendly_id, title, status, created_by) 
        VALUES ('#TEST', 'Test Insert', 'NEW', 1)
    ");
    $stmt->execute();
    $id = $pdo->lastInsertId();
    echo "SUKCES! Dodano rekord ID=$id\n";
    
    // Sprzątanie
    $pdo->exec("DELETE FROM jobs_ai WHERE id=$id");
    echo "Usunięto rekord testowy.\n";

} catch (Throwable $e) {
    echo "BŁĄD: " . $e->getMessage() . "\n";
}








