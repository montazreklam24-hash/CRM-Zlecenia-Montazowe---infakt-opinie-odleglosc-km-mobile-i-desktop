<?php
/**
 * PEŁNY Instalator CRM Zlecenia Montażowe
 * Wersja: 2.0 (2025-12-07)
 * 
 * Zawiera WSZYSTKIE tabele potrzebne do działania CRM:
 * - users (użytkownicy)
 * - sessions (sesje logowania)
 * - clients (klienci)
 * - jobs (zlecenia)
 * - job_images (obrazy base64 - miniatury)
 * - job_attachments (załączniki plikowe)
 * - job_checklist (checklista zadań)
 * - invoices (faktury i proformy)
 * - settings (ustawienia aplikacji)
 * 
 * USUŃ TEN PLIK PO INSTALACJI!
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

// Sprawdź czy już zainstalowane
$configFile = __DIR__ . '/config_db.php';
if (file_exists($configFile) && !isset($_GET['force'])) {
    $cfg = include $configFile;
    if (!empty($cfg['host']) && !empty($cfg['database'])) {
        die('<h2>CRM już zainstalowany!</h2><p><a href="install_full.php?force=1">Reinstaluj (uwaga: baza zostanie nadpisana!)</a></p>');
    }
}

$message = '';
$success = false;
$tables_created = array();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $host = trim($_POST['host']);
    $username = trim($_POST['username']);
    $password = $_POST['password'];
    $database = trim($_POST['database']);
    
    try {
        // Test połączenia
        $dsn = "mysql:host=$host;charset=utf8mb4";
        $pdo = new PDO($dsn, $username, $password, array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ));
        
        // Utwórz bazę jeśli trzeba
        if (isset($_POST['create_db'])) {
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }
        
        $pdo->exec("USE `$database`");
        
        // ===============================================
        // USUWANIE STARYCH TABEL (jeśli reinstalacja)
        // ===============================================
        if (isset($_POST['drop_tables'])) {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
            $pdo->exec("DROP TABLE IF EXISTS `job_history`");
            $pdo->exec("DROP TABLE IF EXISTS `settings`");
            $pdo->exec("DROP TABLE IF EXISTS `invoices`");
            $pdo->exec("DROP TABLE IF EXISTS `job_checklist`");
            $pdo->exec("DROP TABLE IF EXISTS `job_attachments`");
            $pdo->exec("DROP TABLE IF EXISTS `job_images`");
            $pdo->exec("DROP TABLE IF EXISTS `jobs_simple`");
            $pdo->exec("DROP TABLE IF EXISTS `jobs_ai`");
            $pdo->exec("DROP TABLE IF EXISTS `jobs`");
            $pdo->exec("DROP TABLE IF EXISTS `clients`");
            $pdo->exec("DROP TABLE IF EXISTS `sessions`");
            $pdo->exec("DROP TABLE IF EXISTS `users`");
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        }
        
        // ===============================================
        // TABELA 1: UŻYTKOWNICY
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `users` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `email` VARCHAR(100) NOT NULL UNIQUE,
                `password_hash` VARCHAR(255) NOT NULL,
                `name` VARCHAR(100) NOT NULL,
                `role` ENUM('admin', 'manager', 'worker') DEFAULT 'worker',
                `phone` VARCHAR(20) NULL,
                `avatar` MEDIUMTEXT NULL COMMENT 'Avatar base64 lub URL',
                `is_active` TINYINT(1) DEFAULT 1,
                `last_login` TIMESTAMP NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_email` (`email`),
                INDEX `idx_role` (`role`),
                INDEX `idx_active` (`is_active`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'users';
        
        // ===============================================
        // TABELA 2: SESJE LOGOWANIA
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `sessions` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NOT NULL,
                `token` VARCHAR(128) NOT NULL UNIQUE,
                `ip_address` VARCHAR(45) NULL,
                `user_agent` VARCHAR(255) NULL,
                `expires_at` TIMESTAMP NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_token` (`token`),
                INDEX `idx_user` (`user_id`),
                INDEX `idx_expires` (`expires_at`),
                FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'sessions';
        
        // ===============================================
        // TABELA 3: KLIENCI
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `clients` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(200) NOT NULL,
                `company_name` VARCHAR(200) NULL,
                `email` VARCHAR(100) NULL,
                `phone` VARCHAR(30) NULL,
                `phone_alt` VARCHAR(30) NULL COMMENT 'Alternatywny telefon',
                `nip` VARCHAR(15) NULL,
                `regon` VARCHAR(14) NULL,
                `address` TEXT NULL,
                `address_city` VARCHAR(100) NULL,
                `address_postcode` VARCHAR(10) NULL,
                `notes` TEXT NULL,
                `infakt_id` VARCHAR(50) NULL COMMENT 'ID klienta w inFakt',
                `source` VARCHAR(50) NULL COMMENT 'Skąd klient (email, telefon, polecenie)',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_name` (`name`),
                INDEX `idx_email` (`email`),
                INDEX `idx_nip` (`nip`),
                INDEX `idx_infakt` (`infakt_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'clients';
        
        // ===============================================
        // TABELA 4: ZLECENIA AI (Inteligentne z Gemini)
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `jobs_ai` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `friendly_id` VARCHAR(20) NOT NULL UNIQUE COMMENT 'Nr zlecenia np. #2025/001',
                `title` VARCHAR(255) NOT NULL,
                
                -- Dane klienta (mogą być bez client_id)
                `client_id` INT NULL,
                `client_name` VARCHAR(200) NULL,
                `phone` VARCHAR(30) NULL,
                `email` VARCHAR(100) NULL,
                `nip` VARCHAR(15) NULL,
                
                -- Lokalizacja
                `address` TEXT NULL,
                `address_city` VARCHAR(100) NULL,
                `address_postcode` VARCHAR(10) NULL,
                `coordinates_lat` DECIMAL(10,7) NULL,
                `coordinates_lng` DECIMAL(10,7) NULL,
                `distance_km` DECIMAL(6,1) NULL COMMENT 'Odległość od bazy',
                
                -- Opis zlecenia
                `description` TEXT NULL COMMENT 'Zakres prac',
                `notes` TEXT NULL COMMENT 'Notatki wewnętrzne',
                `email_thread` LONGTEXT NULL COMMENT 'Skopiowany wątek mailowy do analizy',
                
                -- Status i organizacja
                `status` VARCHAR(30) DEFAULT 'NEW',
                `priority` ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
                `column_id` VARCHAR(30) DEFAULT 'PREPARE' COMMENT 'Kolumna Kanban',
                `column_order` INT DEFAULT 0,
                
                -- Terminy
                `scheduled_date` DATE NULL COMMENT 'Planowana data realizacji',
                `scheduled_time` TIME NULL,
                `deadline` DATE NULL COMMENT 'Deadline',
                `completed_at` TIMESTAMP NULL,
                
                -- Finanse
                `value_net` DECIMAL(10,2) NULL,
                `value_gross` DECIMAL(10,2) NULL,
                `payment_status` ENUM('pending', 'proforma', 'invoiced', 'paid', 'overdue') DEFAULT 'pending',
                
                -- Notatki z realizacji
                `completion_notes` TEXT NULL,
                
                -- Relacje
                `assigned_to` INT NULL COMMENT 'Przypisany pracownik',
                `created_by` INT NULL,
                
                -- Timestamps
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                -- Indeksy
                INDEX `idx_friendly_id` (`friendly_id`),
                INDEX `idx_status` (`status`),
                INDEX `idx_column` (`column_id`),
                INDEX `idx_priority` (`priority`),
                INDEX `idx_scheduled` (`scheduled_date`),
                INDEX `idx_client` (`client_id`),
                INDEX `idx_assigned` (`assigned_to`),
                INDEX `idx_payment` (`payment_status`),
                
                -- Foreign keys
                FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL,
                FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL,
                FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'jobs_ai';
        
        // ===============================================
        // TABELA 5: ZLECENIA PROSTE (Ręczne wypełnianie)
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `jobs_simple` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `friendly_id` VARCHAR(20) NOT NULL UNIQUE COMMENT 'Nr zlecenia np. #S2025/001',
                `title` VARCHAR(255) NOT NULL,
                
                -- Dane klienta
                `client_name` VARCHAR(200) NULL COMMENT 'Imię i nazwisko',
                `company_name` VARCHAR(200) NULL COMMENT 'Nazwa firmy',
                `phone` VARCHAR(30) NULL,
                `email` VARCHAR(100) NULL,
                `nip` VARCHAR(15) NULL,
                
                -- Lokalizacja
                `address` TEXT NULL,
                `coordinates_lat` DECIMAL(10,7) NULL,
                `coordinates_lng` DECIMAL(10,7) NULL,
                `distance_km` DECIMAL(6,1) NULL,
                
                -- Opis
                `description` TEXT NULL COMMENT 'Opis zlecenia',
                `notes` TEXT NULL COMMENT 'Notatki wewnętrzne',
                
                -- Status i organizacja
                `status` VARCHAR(30) DEFAULT 'NEW',
                `column_id` VARCHAR(30) DEFAULT 'PREPARE',
                `column_order` INT DEFAULT 0,
                
                -- Terminy
                `scheduled_date` DATE NULL,
                `completed_at` TIMESTAMP NULL,
                
                -- Finanse
                `value_net` DECIMAL(10,2) NULL,
                `value_gross` DECIMAL(10,2) NULL,
                `payment_status` ENUM('pending', 'proforma', 'invoiced', 'paid', 'overdue') DEFAULT 'pending',
                
                -- Relacje
                `created_by` INT NULL,
                
                -- Timestamps
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                -- Indeksy
                INDEX `idx_friendly_id` (`friendly_id`),
                INDEX `idx_status` (`status`),
                INDEX `idx_column` (`column_id`),
                INDEX `idx_scheduled` (`scheduled_date`),
                INDEX `idx_payment` (`payment_status`),
                
                -- Foreign keys
                FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'jobs_simple';
        
        // ===============================================
        // TABELA 6: OBRAZY ZLECEŃ (base64)
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `job_images` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `job_id` INT NOT NULL,
                `job_type` ENUM('ai', 'simple') DEFAULT 'simple' COMMENT 'Typ zlecenia',
                `type` ENUM('project', 'completion', 'document') DEFAULT 'project' COMMENT 'Typ: projekt, realizacja, dokument',
                `file_data` LONGTEXT NOT NULL COMMENT 'Obraz base64',
                `filename` VARCHAR(255) NULL COMMENT 'Oryginalna nazwa pliku',
                `is_cover` TINYINT(1) DEFAULT 0 COMMENT 'Czy główne zdjęcie',
                `sort_order` INT DEFAULT 0,
                `uploaded_by` INT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX `idx_job` (`job_id`),
                INDEX `idx_job_type` (`job_type`),
                INDEX `idx_type` (`type`),
                INDEX `idx_cover` (`is_cover`),
                FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'job_images';
        
        // ===============================================
        // TABELA 7: ZAŁĄCZNIKI (pliki)
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `job_attachments` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `job_id` INT NOT NULL,
                `job_type` ENUM('ai', 'simple') DEFAULT 'simple' COMMENT 'Typ zlecenia',
                `file_data` LONGTEXT NOT NULL COMMENT 'Plik base64',
                `filename` VARCHAR(255) NOT NULL COMMENT 'Nazwa pliku',
                `original_name` VARCHAR(255) NOT NULL COMMENT 'Oryginalna nazwa',
                `mime_type` VARCHAR(100) NULL,
                `size_bytes` INT NULL,
                `category` VARCHAR(50) NULL COMMENT 'Kategoria: umowa, projekt, faktura',
                `uploaded_by` INT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX `idx_job` (`job_id`),
                INDEX `idx_job_type` (`job_type`),
                INDEX `idx_category` (`category`),
                FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'job_attachments';
        
        // ===============================================
        // TABELA 8: CHECKLISTA ZLECEŃ
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `job_checklist` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `job_id` INT NOT NULL,
                `job_type` ENUM('ai', 'simple') DEFAULT 'simple' COMMENT 'Typ zlecenia',
                `task` VARCHAR(255) NOT NULL COMMENT 'Treść zadania',
                `is_checked` TINYINT(1) DEFAULT 0,
                `sort_order` INT DEFAULT 0,
                `added_by` INT NULL,
                `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `completed_by` INT NULL,
                `completed_at` TIMESTAMP NULL,
                
                INDEX `idx_job` (`job_id`),
                INDEX `idx_job_type` (`job_type`),
                INDEX `idx_checked` (`is_checked`),
                FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
                FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'job_checklist';
        
        // ===============================================
        // TABELA 9: FAKTURY I PROFORMY
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `invoices` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `job_id` INT NULL,
                `client_id` INT NULL,
                `type` ENUM('proforma', 'invoice', 'correction') DEFAULT 'invoice',
                `number` VARCHAR(50) NULL COMMENT 'Numer faktury',
                `infakt_id` VARCHAR(50) NULL COMMENT 'ID w inFakt',
                `status` VARCHAR(30) DEFAULT 'draft',
                `amount_net` DECIMAL(10,2) NULL,
                `amount_gross` DECIMAL(10,2) NULL,
                `vat_rate` DECIMAL(4,2) DEFAULT 23.00,
                `currency` VARCHAR(3) DEFAULT 'PLN',
                `issue_date` DATE NULL,
                `sale_date` DATE NULL,
                `due_date` DATE NULL,
                `paid_date` DATE NULL,
                `payment_method` VARCHAR(50) NULL COMMENT 'przelew, gotówka, karta',
                `pdf_url` TEXT NULL,
                `notes` TEXT NULL,
                `items_json` MEDIUMTEXT NULL COMMENT 'Pozycje faktury jako JSON',
                `created_by` INT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX `idx_job` (`job_id`),
                INDEX `idx_client` (`client_id`),
                INDEX `idx_type` (`type`),
                INDEX `idx_status` (`status`),
                INDEX `idx_number` (`number`),
                INDEX `idx_infakt` (`infakt_id`),
                INDEX `idx_due_date` (`due_date`),
                FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL,
                FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'invoices';
        
        // ===============================================
        // TABELA 10: USTAWIENIA
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `settings` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `key_name` VARCHAR(100) NOT NULL UNIQUE,
                `value` LONGTEXT NULL,
                `type` VARCHAR(20) DEFAULT 'string' COMMENT 'string, json, number, boolean',
                `description` VARCHAR(255) NULL,
                `updated_by` INT NULL,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX `idx_key` (`key_name`),
                FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'settings';
        
        // ===============================================
        // TABELA 11: HISTORIA ZMIAN (audit log)
        // ===============================================
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `job_history` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `job_id` INT NOT NULL,
                `job_type` ENUM('ai', 'simple') DEFAULT 'simple' COMMENT 'Typ zlecenia',
                `user_id` INT NULL,
                `action` VARCHAR(50) NOT NULL COMMENT 'created, updated, status_changed, etc.',
                `field_name` VARCHAR(100) NULL COMMENT 'Zmienione pole',
                `old_value` LONGTEXT NULL,
                `new_value` LONGTEXT NULL,
                `description` TEXT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX `idx_job` (`job_id`),
                INDEX `idx_job_type` (`job_type`),
                INDEX `idx_user` (`user_id`),
                INDEX `idx_action` (`action`),
                INDEX `idx_date` (`created_at`),
                FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $tables_created[] = 'job_history';
        
        // ===============================================
        // DOMYŚLNY ADMIN
        // ===============================================
        $adminEmail = 'admin@montazreklam24.pl';
        $adminPass = password_hash('admin123', PASSWORD_DEFAULT);
        
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute(array($adminEmail));
        if (!$stmt->fetch()) {
            $pdo->exec("INSERT INTO users (email, password_hash, name, role) VALUES ('$adminEmail', '$adminPass', 'Administrator', 'admin')");
        }
        
        // ===============================================
        // DOMYŚLNE USTAWIENIA
        // ===============================================
        $defaultSettings = array(
            array('company_name', 'Montaż Reklam 24', 'string', 'Nazwa firmy'),
            array('company_address', 'Warszawa', 'string', 'Adres firmy (baza dla obliczeń odległości)'),
            array('company_nip', '', 'string', 'NIP firmy'),
            array('default_vat_rate', '23', 'number', 'Domyślna stawka VAT'),
            array('base_coordinates', '{"lat":52.2297,"lng":21.0122}', 'json', 'Współrzędne bazy (Warszawa)'),
            array('kanban_columns', '["PREPARE","MON","TUE","WED","THU","FRI","SAT","COMPLETED"]', 'json', 'Kolumny Kanban'),
            array('app_logo', '', 'string', 'Logo aplikacji (base64)'),
        );
        
        $stmt = $pdo->prepare("INSERT IGNORE INTO settings (key_name, value, type, description) VALUES (?, ?, ?, ?)");
        foreach ($defaultSettings as $setting) {
            $stmt->execute($setting);
        }
        
        // ===============================================
        // ZAPISZ KONFIGURACJĘ
        // ===============================================
        $configContent = "<?php
/**
 * Konfiguracja bazy danych CRM
 * Wygenerowano: " . date('Y-m-d H:i:s') . "
 */
return array(
    'host' => '$host',
    'database' => '$database',
    'username' => '$username',
    'password' => '$password',
    'charset' => 'utf8mb4'
);
";
        file_put_contents($configFile, $configContent);
        
        $success = true;
        $message = 'Instalacja zakończona pomyślnie!';
        
    } catch (PDOException $e) {
        $message = 'Błąd: ' . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instalacja CRM v2.0 - Montaż Reklam 24</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.3);
            max-width: 560px;
            width: 100%;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header .version { opacity: 0.9; font-size: 14px; }
        .content { padding: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; font-weight: 600; margin-bottom: 6px; color: #374151; }
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 16px;
        }
        input:focus { outline: none; border-color: #f97316; }
        .hint { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 20px 0;
            padding: 15px;
            background: #f3f4f6;
            border-radius: 8px;
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(249,115,22,0.3); }
        .message { padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: 500; }
        .message.success { background: #d1fae5; color: #065f46; }
        .message.error { background: #fee2e2; color: #991b1b; }
        .success-box { text-align: center; padding: 20px; }
        .success-box .icon { font-size: 64px; }
        .warning { background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 14px; }
        a { color: #f97316; }
        .tables-list { 
            background: #f0fdf4; 
            border: 1px solid #86efac; 
            border-radius: 8px; 
            padding: 15px; 
            margin: 15px 0;
        }
        .tables-list h4 { color: #166534; margin-bottom: 10px; }
        .tables-list ul { 
            list-style: none; 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 5px;
        }
        .tables-list li { 
            padding: 4px 8px; 
            background: white; 
            border-radius: 4px;
            font-family: monospace;
            font-size: 13px;
        }
        .tables-list li:before { content: '✓ '; color: #22c55e; }
        code { 
            background: #f3f4f6; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: monospace;
        }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>🛠️ Instalacja CRM</h1>
        <p>Montaż Reklam 24</p>
        <p class="version">Wersja 2.0 - Pełna instalacja</p>
    </div>
    <div class="content">
        <?php if ($success): ?>
            <div class="success-box">
                <div class="icon">✅</div>
                <h2 style="color:#065f46; margin:15px 0;">Sukces!</h2>
                <p>Baza danych utworzona pomyślnie.</p>
                
                <div class="tables-list">
                    <h4>Utworzone tabele (<?php echo count($tables_created); ?>):</h4>
                    <ul>
                        <?php foreach ($tables_created as $table): ?>
                            <li><?php echo $table; ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
                
                <p style="margin-top:15px;"><strong>Dane logowania:</strong></p>
                <p>Email: <code>admin@montazreklam24.pl</code></p>
                <p>Hasło: <code>admin123</code></p>
                
                <div class="warning">
                    <strong>⚠️ WAŻNE - Zrób to teraz!</strong><br><br>
                    1. <strong>Usuń plik</strong> <code>install_full.php</code> z serwera!<br>
                    2. <strong>Zmień hasło</strong> admina po zalogowaniu!<br>
                    3. Skonfiguruj klucze API w <code>config.php</code><br>
                    4. <strong>2 typy zleceń:</strong> AI (jobs_ai) i Proste (jobs_simple)
                </div>
                
                <p style="margin-top:20px;"><a href="../">← Przejdź do CRM</a></p>
            </div>
        <?php else: ?>
            <?php if ($message): ?>
                <div class="message error"><?php echo htmlspecialchars($message); ?></div>
            <?php endif; ?>
            
            <form method="POST">
                <div class="form-group">
                    <label>Host MySQL</label>
                    <input type="text" name="host" value="localhost" required>
                    <div class="hint">Zazwyczaj "localhost" lub z panelu cPanel</div>
                </div>
                
                <div class="form-group">
                    <label>Użytkownik MySQL</label>
                    <input type="text" name="username" required placeholder="np. monciu_crm">
                </div>
                
                <div class="form-group">
                    <label>Hasło MySQL</label>
                    <input type="password" name="password">
                </div>
                
                <div class="form-group">
                    <label>Nazwa bazy danych</label>
                    <input type="text" name="database" required placeholder="np. monciu_crm">
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" name="create_db" id="create_db" checked>
                    <label for="create_db" style="margin:0;">Utwórz bazę jeśli nie istnieje</label>
                </div>
                
                <div class="checkbox-group" style="background:#fee2e2; border:1px solid #fca5a5;">
                    <input type="checkbox" name="drop_tables" id="drop_tables">
                    <label for="drop_tables" style="margin:0; color:#991b1b;">⚠️ USUŃ stare tabele (reinstalacja)</label>
                </div>
                
                <button type="submit">🚀 Zainstaluj CRM (11 tabel)</button>
            </form>
            
            <div class="tables-list" style="background:#eff6ff; border-color:#93c5fd; margin-top:25px;">
                <h4 style="color:#1e40af;">Tabele do utworzenia (11):</h4>
                <ul>
                    <li>users</li>
                    <li>sessions</li>
                    <li>clients</li>
                    <li>jobs_ai 🤖</li>
                    <li>jobs_simple 📋</li>
                    <li>job_images</li>
                    <li>job_attachments</li>
                    <li>job_checklist</li>
                    <li>invoices</li>
                    <li>settings</li>
                    <li>job_history</li>
                </ul>
            </div>
            
            <div class="warning">
                <strong>💡 Gdzie znaleźć dane MySQL?</strong>
                <ol style="margin-top:10px; padding-left:20px; font-size:13px;">
                    <li>Zaloguj się do cPanel</li>
                    <li>Przejdź do "Bazy danych MySQL"</li>
                    <li>Utwórz bazę i użytkownika</li>
                    <li>Przypisz użytkownika z <strong>wszystkimi uprawnieniami</strong></li>
                </ol>
            </div>
        <?php endif; ?>
    </div>
</div>
</body>
</html>

