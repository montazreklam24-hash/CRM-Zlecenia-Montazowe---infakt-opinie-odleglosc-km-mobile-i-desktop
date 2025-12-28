<?php
require_once __DIR__ . '/config.php';
$pdo = getDB();
foreach(['jobs_ai', 'clients'] as $t) {
    echo "--- $t ---\n";
    $stmt = $pdo->query("DESCRIBE $t");
    while($c = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo $c['Field'] . " (" . $c['Type'] . ")\n";
    }
}

