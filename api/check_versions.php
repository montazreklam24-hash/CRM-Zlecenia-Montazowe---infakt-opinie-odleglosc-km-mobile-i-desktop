<?php
/**
 * Weryfikacja wersji plików API
 */
header('Content-Type: text/plain; charset=utf-8');

echo "Sprawdzanie wersji plików API...\n\n";

$files = array(
    'config.php',
    'auth.php',
    'jobs.php',
    'jobs_simple.php',
    'index.php'
);

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        $time = filemtime($path);
        $size = filesize($path);
        echo str_pad($file, 20) . " | " . date('Y-m-d H:i:s', $time) . " | " . number_format($size) . " bajtów\n";
    } else {
        echo str_pad($file, 20) . " | BRAK\n";
    }
}

echo "\n";
echo "Aktualny czas serwera: " . date('Y-m-d H:i:s') . "\n";
echo "\n";
echo "Jeśli data modyfikacji jobs.php jest stara (np. sprzed 10 minut), to znaczy że nie wgrałeś nowego pliku.\n";








