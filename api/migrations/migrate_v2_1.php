<?php
require_once __DIR__ . '/../config.php';

echo "Rozpoczynam migrację bazy do wersji v2.1...\n";

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET,
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // 1. Kolumny dla Gmail Integration
    $columns = [
        'gmail_message_id' => "VARCHAR(255) NULL AFTER completion_notes",
        'gmail_thread_id' => "VARCHAR(255) NULL AFTER gmail_message_id",
        'gmail_label_id' => "VARCHAR(255) NULL AFTER gmail_thread_id",
        
        // 2. Kolumny dla Infakt Integration
        'infakt_invoice_id' => "VARCHAR(100) NULL AFTER gmail_label_id",
        'infakt_proforma_id' => "VARCHAR(100) NULL AFTER infakt_invoice_id",
        'infakt_payment_status' => "ENUM('paid', 'unpaid', 'overdue', 'none') DEFAULT 'none' AFTER infakt_proforma_id",
        
        // 3. Kolumny dla File Storage
        'drive_folder_id' => "VARCHAR(255) NULL AFTER infakt_payment_status"
    ];

    foreach ($columns as $column => $definition) {
        try {
            // Sprawdź czy kolumna istnieje
            $check = $pdo->query("SHOW COLUMNS FROM jobs_ai LIKE '$column'");
            if ($check->rowCount() == 0) {
                $sql = "ALTER TABLE jobs_ai ADD COLUMN $column $definition";
                $pdo->exec($sql);
                echo "✅ Dodano kolumnę: $column\n";
            } else {
                echo "ℹ️ Kolumna $column już istnieje - pomijam.\n";
            }
        } catch (PDOException $e) {
            echo "❌ Błąd przy dodawaniu $column: " . $e->getMessage() . "\n";
        }
    }

    // 4. Reset tabeli jobs_ai (TYLKO DLA DEV MODE!)
    // Odkomentuj poniższe linie, jeśli chcesz wyczyścić bazę przy migracji
    /*
    if (defined('DEV_MODE') && DEV_MODE === true) {
        $pdo->exec("TRUNCATE TABLE jobs_ai");
        $pdo->exec("TRUNCATE TABLE job_images");
        echo "🧹 Wyczyszczono tabele jobs_ai i job_images (DEV_MODE)\n";
    }
    */

    echo "Migracja zakończona pomyślnie!\n";

} catch (PDOException $e) {
    die("Błąd połączenia z bazą: " . $e->getMessage() . "\n");
}









