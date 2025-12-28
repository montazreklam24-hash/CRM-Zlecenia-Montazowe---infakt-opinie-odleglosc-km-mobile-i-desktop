<?php
require_once __DIR__ . '/config.php';
$pdo = getDB();
$stmt = $pdo->query("DESCRIBE jobs_ai");
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
header('Content-Type: application/json');
echo json_encode($columns, JSON_PRETTY_PRINT);

