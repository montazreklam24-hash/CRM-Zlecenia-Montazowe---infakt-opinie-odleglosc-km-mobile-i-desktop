<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "1. Laduje pliki...<br>";
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/jobs.php';
require_once __DIR__ . '/jobs_simple.php';
echo "   OK<br><br>";

// Symuluj zalogowanego użytkownika
$_SESSION['user_id'] = 1;
$_SESSION['user_email'] = 'test@test.pl';

echo "2. Wywoluje handleJobsAll()...<br>";

// Przechwytuj output
ob_start();
try {
    handleJobsAll();
} catch (Exception $e) {
    echo "BLAD: " . $e->getMessage() . "<br>";
    echo "Trace: " . $e->getTraceAsString();
}
$output = ob_get_clean();

echo "<br>3. Wynik:<br>";
echo "<pre>" . htmlspecialchars(substr($output, 0, 2000)) . "</pre>";

if (strlen($output) > 2000) {
    echo "<br>... (obciete, lacznie " . strlen($output) . " znakow)";
}

