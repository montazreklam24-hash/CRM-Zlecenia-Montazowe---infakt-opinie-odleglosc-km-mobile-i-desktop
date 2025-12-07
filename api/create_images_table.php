<?php
/**
 * Skrypt do utworzenia tabeli job_images
 * Uruchom raz na serwerze, potem usuń!
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

try {
    $pdo = getDB();
    
    // Sprawdź czy tabela już istnieje
    $stmt = $pdo->query("SHOW TABLES LIKE 'job_images'");
    if ($stmt->fetch()) {
        echo json_encode(array(
            'status' => 'exists',
            'message' => 'Tabela job_images już istnieje'
        ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Utwórz tabelę job_images
    $pdo->exec("
        CREATE TABLE job_images (
            id INT AUTO_INCREMENT PRIMARY KEY,
            job_id INT NOT NULL,
            type ENUM('project', 'completion') DEFAULT 'project',
            file_data LONGTEXT NOT NULL,
            is_cover TINYINT(1) DEFAULT 0,
            sort_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_job_id (job_id),
            INDEX idx_type (type),
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    
    echo json_encode(array(
        'status' => 'ok',
        'message' => 'Tabela job_images utworzona pomyślnie!',
        'info' => 'Możesz teraz usunąć ten plik z serwera.'
    ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(array(
        'status' => 'error',
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}

