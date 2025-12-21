<?php
/**
 * MIGRACJA: Scalanie jobs_simple do jobs_ai
 * Cel: Jedna tabela zleceń w systemie
 */

require_once __DIR__ . '/../config.php';

// Zwiększ limit czasu, jeśli dużo danych
set_time_limit(300);

echo "<h1>Migracja: Simple -> AI</h1>";
echo "<pre>";

try {
    $pdo = getDB();
    $pdo->beginTransaction();

    // 1. Sprawdź czy tabela jobs_simple istnieje
    $stmt = $pdo->query("SHOW TABLES LIKE 'jobs_simple'");
    if ($stmt->rowCount() === 0) {
        throw new Exception("Tabela jobs_simple nie istnieje. Migracja nie jest potrzebna.");
    }

    // 2. Pobierz wszystkie zlecenia simple
    $stmt = $pdo->query("SELECT * FROM jobs_simple");
    $simpleJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Znaleziono " . count($simpleJobs) . " zleceń simple do przeniesienia.\n";

    $count = 0;
    foreach ($simpleJobs as $job) {
        $oldId = $job['id'];
        
        // Generuj nowe friendly_id (lub użyj starego, ale może być kolizja, więc lepiej wygenerować nowe AI)
        // Ale jobs_simple mają friendly_id np. '#2024/005'. jobs_ai też. Może być konflikt UNIQUE.
        // Sprawdźmy czy friendly_id już istnieje w jobs_ai
        $friendlyId = $job['friendly_id'];
        $check = $pdo->prepare("SELECT id FROM jobs_ai WHERE friendly_id = ?");
        $check->execute([$friendlyId]);
        if ($check->fetch()) {
            // Konflikt ID! Dodaj sufiks '-S'
            $friendlyId .= '-S';
            echo "Konflikt friendly_id dla simple ID $oldId. Zmieniono na: $friendlyId\n";
        }

        // 3. Insert do jobs_ai
        // Mapowanie kolumn
        $insert = $pdo->prepare("
            INSERT INTO jobs_ai (
                friendly_id, title, client_name, phone, email, nip, 
                address, description, notes, status, 
                column_id, column_order, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, 
                ?, ?, ?, ?
            )
        ");

        $insert->execute([
            $friendlyId,
            $job['title'],
            $job['client_name'],
            $job['phone'],
            $job['email'],
            $job['nip'],
            $job['address'],
            $job['description'], // scopeWorkText
            $job['notes'],       // adminNotes
            $job['status'],
            $job['column_id'],
            $job['column_order'],
            $job['created_at'],
            $job['updated_at']
        ]);

        $newId = $pdo->lastInsertId();
        echo "Przeniesiono simple ID $oldId -> ai ID $newId ($friendlyId)\n";

        // 4. Aktualizuj obrazki (job_images)
        // Szukamy zdjęć, które miały job_type='simple' i job_id=$oldId
        // Zmieniamy na job_type='ai' i job_id=$newId
        $imgUpdate = $pdo->prepare("
            UPDATE job_images 
            SET job_id = ?, job_type = 'ai' 
            WHERE job_id = ? AND job_type = 'simple'
        ");
        $imgUpdate->execute([$newId, $oldId]);
        
        $imgCount = $imgUpdate->rowCount();
        if ($imgCount > 0) {
            echo "  - Zaktualizowano $imgCount zdjęć.\n";
        }

        $count++;
    }

    // 5. Zmień nazwę starej tabeli (backup)
    $pdo->exec("RENAME TABLE jobs_simple TO jobs_simple_backup_" . time());
    echo "Zmieniono nazwę tabeli jobs_simple na backup.\n";

    $pdo->commit();
    echo "\nSUKCES! Przeniesiono $count zleceń.\n";

} catch (Exception $e) {
    $pdo->rollBack();
    echo "BŁĄD: " . $e->getMessage() . "\n";
}

echo "</pre>";

