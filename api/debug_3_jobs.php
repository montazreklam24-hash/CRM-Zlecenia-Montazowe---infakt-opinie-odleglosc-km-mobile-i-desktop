<?php
require_once __DIR__ . '/config.php';
$pdo = getDB();

echo "Listing clients with 3 or more jobs:\n";
$stmt = $pdo->query("
    SELECT c.id, c.company_name, c.name, COUNT(j.id) as jobs_count
    FROM clients c
    JOIN jobs_ai j ON j.client_id = c.id
    GROUP BY c.id
    HAVING jobs_count >= 3
");
$clients = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($clients as $client) {
    echo "Client ID: {$client['id']} | Name: {$client['company_name']} / {$client['name']} | Jobs: {$client['jobs_count']}\n";
    
    $stmtJobs = $pdo->prepare("SELECT id, friendly_id, title, created_at, status FROM jobs_ai WHERE client_id = ?");
    $stmtJobs->execute([$client['id']]);
    $jobs = $stmtJobs->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($jobs as $job) {
        echo "  - Job ID: {$job['id']} | Friendly: {$job['friendly_id']} | Title: {$job['title']} | Created: {$job['created_at']} | Status: {$job['status']}\n";
    }
    echo "--------------------------------------------------\n";
}

