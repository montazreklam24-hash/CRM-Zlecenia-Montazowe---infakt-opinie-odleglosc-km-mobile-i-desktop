<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "Test składni PHP...<br>";

echo "Sprawdzam config.php... ";
try {
    require_once __DIR__ . '/config.php';
    echo "OK<br>";
} catch (Throwable $e) {
    echo "BŁĄD: " . $e->getMessage() . "<br>";
}

echo "Sprawdzam auth.php... ";
try {
    require_once __DIR__ . '/auth.php';
    echo "OK<br>";
} catch (Throwable $e) {
    echo "BŁĄD: " . $e->getMessage() . "<br>";
}

echo "Sprawdzam jobs_simple.php... ";
try {
    require_once __DIR__ . '/jobs_simple.php';
    echo "OK<br>";
} catch (Throwable $e) {
    echo "BŁĄD: " . $e->getMessage() . "<br>";
}

echo "Sprawdzam jobs.php... ";
try {
    require_once __DIR__ . '/jobs.php';
    echo "OK<br>";
} catch (Throwable $e) {
    echo "BŁĄD: " . $e->getMessage() . "<br>";
}

echo "Wszystko wygląda poprawnie.";








