<?php
/**
 * MIGRACJA v2.2: Moduł Kontrahentów
 * 1. Tworzy tabele: client_contacts, client_addresses, client_notes
 * 2. Aktualizuje tabelę clients (jeśli trzeba)
 * 3. Migruje dane klientów ze zleceń do bazy kontrahentów
 */

require_once __DIR__ . '/../config.php';

echo "<h1>Migracja v2.2: Moduł Kontrahentów</h1>";
echo "<pre>";

try {
    $pdo = getDB();

    // 1. Upewnij się, że tabela clients ma poprawne kolumny
    echo "Sprawdzam tabelę clients...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `clients` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `company_name` VARCHAR(255) NULL,
            `name` VARCHAR(255) NULL,
            `email` VARCHAR(100) NULL,
            `phone` VARCHAR(30) NULL,
            `nip` VARCHAR(15) NULL,
            `address` TEXT NULL,
            `notes` TEXT NULL,
            `infakt_id` VARCHAR(50) NULL,
            `created_by` INT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX (`nip`),
            INDEX (`email`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Dodaj kolumnę company_name jeśli nie istnieje (stara wersja miała tylko name)
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM clients LIKE 'company_name'");
        if ($stmt->rowCount() === 0) {
            $pdo->exec("ALTER TABLE clients ADD COLUMN company_name VARCHAR(255) NULL AFTER id");
            echo "✅ Dodano kolumnę company_name do clients\n";
        }
    } catch (Exception $e) { echo "ℹ️ " . $e->getMessage() . "\n"; }

    // 2. Tworzy nowe tabele
    echo "Tworzę nowe tabele...\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `client_contacts` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `client_id` INT NOT NULL,
            `name` VARCHAR(200) NOT NULL,
            `email` VARCHAR(100) NULL,
            `phone` VARCHAR(30) NULL,
            `role` VARCHAR(100) NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Tabela client_contacts gotowa\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `client_addresses` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `client_id` INT NOT NULL,
            `type` ENUM('billing', 'install', 'other') DEFAULT 'install',
            `address_text` TEXT NOT NULL,
            `lat` DECIMAL(10,7) NULL,
            `lng` DECIMAL(10,7) NULL,
            `note` TEXT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Tabela client_addresses gotowa\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `client_notes` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `client_id` INT NOT NULL,
            `note` TEXT NOT NULL,
            `created_by` INT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✅ Tabela client_notes gotowa\n";

    // 3. Migracja danych
    echo "\nRozpoczynam migrację danych klientów ze zleceń...\n";
    
    // Pobierz unikalnych klientów ze zleceń (na podstawie NIP lub Email)
    // Jeśli brak NIP i Email, użyj Nazwy (ale to mniej pewne)
    
    $stmt = $pdo->query("SELECT DISTINCT client_name, nip, email, phone, address FROM jobs_ai WHERE client_id IS NULL");
    $potentialClients = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Znaleziono " . count($potentialClients) . " zleceń bez przypisanego client_id.\n";
    
    $clientsCreated = 0;
    $jobsLinked = 0;
    
    foreach ($potentialClients as $pc) {
        $name = trim($pc['client_name']);
        $nip = !empty($pc['nip']) ? preg_replace('/[^0-9]/', '', $pc['nip']) : null;
        $email = !empty($pc['email']) ? trim($pc['email']) : null;
        $phone = $pc['phone'];
        $address = $pc['address'];
        
        if (empty($name) && empty($nip) && empty($email)) continue;
        
        // Szukaj czy taki klient już istnieje w tabeli clients
        $clientId = null;
        
        if ($nip && strlen($nip) === 10) {
            $check = $pdo->prepare("SELECT id FROM clients WHERE nip = ?");
            $check->execute([$nip]);
            $found = $check->fetch();
            if ($found) $clientId = $found['id'];
        }
        
        if (!$clientId && $email) {
            $check = $pdo->prepare("SELECT id FROM clients WHERE email = ?");
            $check->execute([$email]);
            $found = $check->fetch();
            if ($found) $clientId = $found['id'];
        }
        
        // Jeśli nie znaleziono - utwórz
        if (!$clientId) {
            $insert = $pdo->prepare("INSERT INTO clients (company_name, name, nip, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)");
            $insert->execute([$name, $name, $nip, $email, $phone, $address]);
            $clientId = $pdo->lastInsertId();
            $clientsCreated++;
            
            // Dodaj adres montażowy jeśli jest
            if (!empty($address)) {
                $pdo->prepare("INSERT INTO client_addresses (client_id, type, address_text) VALUES (?, 'install', ?)")
                    ->execute([$clientId, $address]);
            }
        }
        
        // Zaktualizuj zlecenia
        if ($clientId) {
            $update = $pdo->prepare("UPDATE jobs_ai SET client_id = ? WHERE (nip = ? AND nip IS NOT NULL) OR (email = ? AND email IS NOT NULL) OR (client_name = ? AND nip IS NULL AND email IS NULL)");
            $update->execute([$clientId, $nip, $email, $name]);
            $jobsLinked += $update->rowCount();
        }
    }
    
    echo "Utworzono $clientsCreated nowych kontrahentów.\n";
    echo "Powiązano $jobsLinked zleceń z kontrahentami.\n";
    
    echo "\n✅ Migracja zakończona pomyślnie!\n";

} catch (Exception $e) {
    echo "\n❌ BŁĄD: " . $e->getMessage() . "\n";
}

echo "</pre>";

