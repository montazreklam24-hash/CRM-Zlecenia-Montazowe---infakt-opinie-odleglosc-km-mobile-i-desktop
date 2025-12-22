<?php
/**
 * Prosty endpoint do logowania z rozszerzenia Chrome
 */
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
handleCORS();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$input = json_decode(file_get_contents('php://input'), true);

$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) mkdir($logDir, 0777, true);

$logEntry = date('Y-m-d H:i:s') . " | " . json_encode($input, JSON_UNESCAPED_UNICODE) . "\n";
file_put_contents($logDir . '/extension_debug.log', $logEntry, FILE_APPEND);

echo json_encode(['success' => true]);

