<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "Rozpoczynam migrację: Dodanie pól do fakturowania (billing)...\n";

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET,
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $table = 'jobs_ai';
    $columns = [
        'billing_name' => "VARCHAR(255) NULL AFTER nip",
        'billing_nip' => "VARCHAR(15) NULL AFTER billing_name",
        'billing_street' => "VARCHAR(150) NULL AFTER billing_nip",
        'billing_building_no' => "VARCHAR(20) NULL AFTER billing_street",
        'billing_apartment_no' => "VARCHAR(20) NULL AFTER billing_building_no",
        'billing_post_code' => "VARCHAR(10) NULL AFTER billing_apartment_no",
        'billing_city' => "VARCHAR(100) NULL AFTER billing_post_code",
        'billing_email' => "VARCHAR(100) NULL AFTER billing_city"
    ];

    foreach ($columns as $column => $definition) {
        try {
            $check = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
            if ($check->rowCount() == 0) {
                $sql = "ALTER TABLE `$table` ADD COLUMN `$column` $definition";
                $pdo->exec($sql);
                echo "✅ Dodano kolumnę: $column w tabeli $table\n";
            } else {
                echo "ℹ️ Kolumna $column już istnieje w $table - pomijam.\n";
            }
        } catch (PDOException $e) {
            echo "❌ Błąd przy dodawaniu $column: " . $e->getMessage() . "\n";
        }
    }

    echo "Migracja zakończona!\n";

} catch (PDOException $e) {
    die("Błąd połączenia z bazą: " . $e->getMessage() . "\n");
}

