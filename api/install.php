<?php
/**
 * Instalator CRM Zlecenia Montażowe
 * 
 * USUŃ TEN PLIK PO INSTALACJI!
 */

// Sprawdź czy już zainstalowane
$configFile = __DIR__ . '/config_db.php';
if (file_exists($configFile) && !isset($_GET['force'])) {
    $cfg = include $configFile;
    if (!empty($cfg['host']) && !empty($cfg['database'])) {
        die('<h2>CRM już zainstalowany!</h2><p><a href="install.php?force=1">Reinstaluj</a></p>');
    }
}

$message = '';
$success = false;

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
        
        // =============== TABELE CRM ===============
        
        // Użytkownicy
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `users` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `email` VARCHAR(100) NOT NULL UNIQUE,
                `password_hash` VARCHAR(255) NOT NULL,
                `name` VARCHAR(100) NOT NULL,
                `role` ENUM('admin', 'worker') DEFAULT 'worker',
                `phone` VARCHAR(20) NULL,
                `is_active` TINYINT(1) DEFAULT 1,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Sesje
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `sessions` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NOT NULL,
                `token` VARCHAR(128) NOT NULL UNIQUE,
                `expires_at` TIMESTAMP NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Klienci
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `clients` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(200) NOT NULL,
                `email` VARCHAR(100) NULL,
                `phone` VARCHAR(30) NULL,
                `nip` VARCHAR(15) NULL,
                `address` TEXT NULL,
                `notes` TEXT NULL,
                `infakt_id` VARCHAR(50) NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Zlecenia
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `jobs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `friendly_id` VARCHAR(20) NOT NULL UNIQUE,
                `title` VARCHAR(255) NOT NULL,
                `client_id` INT NULL,
                `client_name` VARCHAR(200) NULL,
                `phone` VARCHAR(30) NULL,
                `email` VARCHAR(100) NULL,
                `nip` VARCHAR(15) NULL,
                `address` TEXT NULL,
                `coordinates_lat` DECIMAL(10,7) NULL,
                `coordinates_lng` DECIMAL(10,7) NULL,
                `distance_km` DECIMAL(6,1) NULL,
                `description` TEXT NULL,
                `notes` TEXT NULL,
                `status` VARCHAR(30) DEFAULT 'NEW',
                `priority` VARCHAR(20) DEFAULT 'normal',
                `scheduled_date` DATE NULL,
                `column_id` VARCHAR(30) DEFAULT 'NEW',
                `column_order` INT DEFAULT 0,
                `value_net` DECIMAL(10,2) NULL,
                `value_gross` DECIMAL(10,2) NULL,
                `assigned_to` INT NULL,
                `created_by` INT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL,
                FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL,
                FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Załączniki do zleceń
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `job_attachments` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `job_id` INT NOT NULL,
                `filename` VARCHAR(255) NOT NULL,
                `original_name` VARCHAR(255) NOT NULL,
                `mime_type` VARCHAR(100) NULL,
                `size_bytes` INT NULL,
                `uploaded_by` INT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Faktury
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `invoices` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `job_id` INT NULL,
                `client_id` INT NULL,
                `type` ENUM('proforma', 'invoice') DEFAULT 'invoice',
                `number` VARCHAR(50) NULL,
                `infakt_id` VARCHAR(50) NULL,
                `status` VARCHAR(30) DEFAULT 'draft',
                `amount_net` DECIMAL(10,2) NULL,
                `amount_gross` DECIMAL(10,2) NULL,
                `issue_date` DATE NULL,
                `due_date` DATE NULL,
                `paid_date` DATE NULL,
                `pdf_url` TEXT NULL,
                `notes` TEXT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE SET NULL,
                FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // Ustawienia
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `settings` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `key_name` VARCHAR(100) NOT NULL UNIQUE,
                `value` TEXT NULL,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        
        // =============== DOMYŚLNY ADMIN ===============
        $adminEmail = 'admin@montazreklam24.pl';
        $adminPass = password_hash('admin123', PASSWORD_DEFAULT);
        
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute(array($adminEmail));
        if (!$stmt->fetch()) {
            $pdo->exec("INSERT INTO users (email, password_hash, name, role) VALUES ('$adminEmail', '$adminPass', 'Administrator', 'admin')");
        }
        
        // =============== ZAPISZ KONFIGURACJĘ ===============
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
    <title>Instalacja CRM - Montaż Reklam 24</title>
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
            max-width: 480px;
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
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(249,115,22,0.3); }
        .message { padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: 500; }
        .message.success { background: #d1fae5; color: #065f46; }
        .message.error { background: #fee2e2; color: #991b1b; }
        .success-box { text-align: center; padding: 20px; }
        .success-box .icon { font-size: 64px; }
        .warning { background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; padding: 15px; border-radius: 8px; margin-top: 20px; }
        a { color: #f97316; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>🛠️ Instalacja CRM</h1>
        <p>Montaż Reklam 24</p>
    </div>
    <div class="content">
        <?php if ($success): ?>
            <div class="success-box">
                <div class="icon">✅</div>
                <h2 style="color:#065f46; margin:15px 0;">Sukces!</h2>
                <p>Baza danych utworzona.</p>
                <p style="margin-top:15px;"><strong>Logowanie:</strong></p>
                <p>Email: <code>admin@montazreklam24.pl</code></p>
                <p>Hasło: <code>admin123</code></p>
                <div class="warning">
                    <strong>⚠️ WAŻNE!</strong><br>
                    1. Usuń plik <code>install.php</code>!<br>
                    2. Zmień hasło admina po zalogowaniu!
                </div>
                <p style="margin-top:20px;"><a href="../">← Przejdź do CRM</a></p>
            </div>
        <?php else: ?>
            <?php if ($message): ?>
                <div class="message error"><?php echo $message; ?></div>
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
                
                <button type="submit">🚀 Zainstaluj CRM</button>
            </form>
            
            <div class="warning" style="margin-top:25px;">
                <strong>💡 Gdzie znaleźć dane?</strong>
                <ol style="margin-top:10px; padding-left:20px; font-size:14px;">
                    <li>Zaloguj się do cPanel</li>
                    <li>Przejdź do "Bazy danych MySQL"</li>
                    <li>Utwórz bazę i użytkownika</li>
                    <li>Przypisz użytkownika z wszystkimi uprawnieniami</li>
                </ol>
            </div>
        <?php endif; ?>
    </div>
</div>
</body>
</html>






