<?php
/**
 * ZBIORCZA MIGRACJA BAZY DANYCH - CRM 5.0
 * 
 * Uruchom raz na serwerze:
 *   https://crm.montazreklam24.pl/api/migrate_all.php
 * 
 * Ten skrypt dodaje wszystkie brakujące kolumny do tabel:
 * - jobs_ai
 * - jobs_simple  
 * - invoices
 * - job_images
 * 
 * ⚠️ Po uruchomieniu USUŃ ten plik z serwera!
 */

require_once __DIR__ . '/config.php';

header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Migracja CRM 5.0</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h1 { color: #28a745; }
        pre { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
        .success { color: #28a745; }
        .skip { color: #6c757d; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
<div class='box'>
    <h1>🚀 Migracja CRM 5.0</h1>
    <pre>";

// Funkcja pomocnicza: sprawdź czy kolumna istnieje
function columnExists($pdo, $table, $column) {
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE '{$column}'");
        return $stmt->fetch() !== false;
    } catch (PDOException $e) {
        return false;
    }
}

// Funkcja pomocnicza: sprawdź czy tabela istnieje
function tableExists($pdo, $table) {
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE '{$table}'");
        return $stmt->fetch() !== false;
    } catch (PDOException $e) {
        return false;
    }
}

// Funkcja do dodawania kolumny
function addColumn($pdo, $table, $column, $definition) {
    if (columnExists($pdo, $table, $column)) {
        echo "<span class='skip'>✓ Kolumna `{$table}`.`{$column}` już istnieje - pomijam</span>\n";
        return true;
    }
    
    try {
        $sql = "ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}";
        $pdo->exec($sql);
        echo "<span class='success'>✅ Dodano kolumnę `{$table}`.`{$column}`</span>\n";
        return true;
    } catch (PDOException $e) {
        echo "<span class='error'>❌ Błąd przy `{$table}`.`{$column}`: " . htmlspecialchars($e->getMessage()) . "</span>\n";
        return false;
    }
}

try {
    $pdo = getDB();
    echo "✅ Połączono z bazą danych\n\n";
    
    $errors = 0;
    
    // =================================================================
    // 1. TABELA jobs_ai
    // =================================================================
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "📋 TABELA: jobs_ai\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if (!tableExists($pdo, 'jobs_ai')) {
        echo "<span class='error'>❌ Tabela jobs_ai nie istnieje!</span>\n";
        $errors++;
    } else {
        // Kolumny dla zakończenia zlecenia i opinii
        if (!addColumn($pdo, 'jobs_ai', 'completed_at', 'DATETIME DEFAULT NULL')) $errors++;
        if (!addColumn($pdo, 'jobs_ai', 'completion_notes', 'TEXT')) $errors++;
        if (!addColumn($pdo, 'jobs_ai', 'review_request_sent_at', 'DATETIME DEFAULT NULL')) $errors++;
        if (!addColumn($pdo, 'jobs_ai', 'review_request_email', 'VARCHAR(255) DEFAULT NULL')) $errors++;
    }
    
    // =================================================================
    // 2. TABELA jobs_simple
    // =================================================================
    echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "📋 TABELA: jobs_simple\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if (!tableExists($pdo, 'jobs_simple')) {
        echo "<span class='error'>❌ Tabela jobs_simple nie istnieje!</span>\n";
        $errors++;
    } else {
        // Kolumny dla zakończenia zlecenia i opinii
        if (!addColumn($pdo, 'jobs_simple', 'completed_at', 'DATETIME DEFAULT NULL')) $errors++;
        if (!addColumn($pdo, 'jobs_simple', 'completion_notes', 'TEXT')) $errors++;
        if (!addColumn($pdo, 'jobs_simple', 'review_request_sent_at', 'DATETIME DEFAULT NULL')) $errors++;
        if (!addColumn($pdo, 'jobs_simple', 'review_request_email', 'VARCHAR(255) DEFAULT NULL')) $errors++;
    }
    
    // =================================================================
    // 3. TABELA invoices
    // =================================================================
    echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "📋 TABELA: invoices\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if (!tableExists($pdo, 'invoices')) {
        echo "<span class='warning'>⚠️ Tabela invoices nie istnieje - tworzę...</span>\n";
        
        $sql = "CREATE TABLE `invoices` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `job_id` INT DEFAULT NULL,
            `job_type` ENUM('ai', 'simple') DEFAULT 'ai',
            `job_friendly_id` VARCHAR(20) DEFAULT NULL,
            `client_id` INT DEFAULT NULL,
            `client_infakt_id` INT DEFAULT NULL,
            `infakt_id` INT DEFAULT NULL,
            `infakt_number` VARCHAR(50) DEFAULT NULL,
            `infakt_link` VARCHAR(255) DEFAULT NULL,
            `type` ENUM('proforma', 'invoice') DEFAULT 'proforma',
            `status` ENUM('draft', 'sent', 'paid', 'cancelled') DEFAULT 'draft',
            `total_net` DECIMAL(10,2) DEFAULT 0,
            `total_gross` DECIMAL(10,2) DEFAULT 0,
            `issued_at` DATETIME DEFAULT NULL,
            `due_at` DATETIME DEFAULT NULL,
            `paid_at` DATETIME DEFAULT NULL,
            `sent_at` DATETIME DEFAULT NULL,
            `notes` TEXT,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_job` (`job_id`, `job_type`),
            INDEX `idx_infakt` (`infakt_id`),
            INDEX `idx_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        try {
            $pdo->exec($sql);
            echo "<span class='success'>✅ Utworzono tabelę invoices</span>\n";
        } catch (PDOException $e) {
            echo "<span class='error'>❌ Błąd tworzenia tabeli: " . htmlspecialchars($e->getMessage()) . "</span>\n";
            $errors++;
        }
    } else {
        // Dodaj brakujące kolumny
        if (!addColumn($pdo, 'invoices', 'infakt_number', 'VARCHAR(50) DEFAULT NULL')) $errors++;
        if (!addColumn($pdo, 'invoices', 'infakt_link', 'VARCHAR(255) DEFAULT NULL')) $errors++;
        if (!addColumn($pdo, 'invoices', 'job_friendly_id', 'VARCHAR(20) DEFAULT NULL')) $errors++;
        if (!addColumn($pdo, 'invoices', 'client_infakt_id', 'INT DEFAULT NULL')) $errors++;
    }
    
    // =================================================================
    // 4. TABELA job_images
    // =================================================================
    echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "📋 TABELA: job_images\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if (!tableExists($pdo, 'job_images')) {
        echo "<span class='warning'>⚠️ Tabela job_images nie istnieje - tworzę...</span>\n";
        
        $sql = "CREATE TABLE `job_images` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `job_id` INT NOT NULL,
            `job_type` ENUM('ai', 'simple') DEFAULT 'ai',
            `type` ENUM('project', 'completion', 'reference') DEFAULT 'project',
            `file_path` VARCHAR(500) DEFAULT NULL,
            `file_data` LONGTEXT DEFAULT NULL,
            `is_cover` TINYINT(1) DEFAULT 0,
            `sort_order` INT DEFAULT 0,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_job` (`job_id`, `job_type`),
            INDEX `idx_type` (`type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        try {
            $pdo->exec($sql);
            echo "<span class='success'>✅ Utworzono tabelę job_images</span>\n";
        } catch (PDOException $e) {
            echo "<span class='error'>❌ Błąd tworzenia tabeli: " . htmlspecialchars($e->getMessage()) . "</span>\n";
            $errors++;
        }
    } else {
        echo "<span class='skip'>✓ Tabela job_images już istnieje</span>\n";
        // Upewnij się że kolumna job_type istnieje
        if (!addColumn($pdo, 'job_images', 'job_type', "ENUM('ai', 'simple') DEFAULT 'ai'")) $errors++;
    }
    
    // =================================================================
    // 5. FOLDER UPLOADS
    // =================================================================
    echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "📁 FOLDER: uploads\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    $uploadsDir = __DIR__ . '/../uploads';
    if (!is_dir($uploadsDir)) {
        if (mkdir($uploadsDir, 0755, true)) {
            echo "<span class='success'>✅ Utworzono folder uploads</span>\n";
            // Dodaj .htaccess
            file_put_contents($uploadsDir . '/.htaccess', "Options -Indexes\n");
            // Dodaj index.php
            file_put_contents($uploadsDir . '/index.php', "<?php http_response_code(403); echo 'Forbidden'; ?>");
        } else {
            echo "<span class='error'>❌ Nie udało się utworzyć folderu uploads</span>\n";
            $errors++;
        }
    } else {
        echo "<span class='skip'>✓ Folder uploads już istnieje</span>\n";
    }
    
    // =================================================================
    // PODSUMOWANIE
    // =================================================================
    echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    if ($errors === 0) {
        echo "\n<span class='success' style='font-size: 18px; font-weight: bold;'>
✅ MIGRACJA ZAKOŃCZONA POMYŚLNIE!
</span>\n";
    } else {
        echo "\n<span class='error' style='font-size: 18px; font-weight: bold;'>
⚠️ Migracja zakończona z {$errors} błędami
</span>\n";
    }
    
} catch (Exception $e) {
    echo "<span class='error'>❌ KRYTYCZNY BŁĄD: " . htmlspecialchars($e->getMessage()) . "</span>\n";
}

echo "</pre>
</div>

<div class='box warning'>
    <strong>⚠️ WAŻNE:</strong> Po zakończeniu migracji <strong>USUŃ ten plik z serwera</strong> ze względów bezpieczeństwa!
    <br><br>
    <code>rm api/migrate_all.php</code>
</div>

<div class='box'>
    <a href='/'>← Powrót do CRM</a>
</div>

</body>
</html>";
?>






