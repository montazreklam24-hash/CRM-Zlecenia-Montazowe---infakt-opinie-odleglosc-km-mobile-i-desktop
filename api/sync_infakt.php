<?php
/**
 * Skrypt synchronizacji inFakt dla CRON
 * Uruchamiaj np. raz na godzinę
 */

// Sprawdź czy uruchamiane z CLI lub czy podano tajny token
if (php_sapi_name() !== 'cli') {
    require_once __DIR__ . '/config.php';
    $token = isset($_GET['token']) ? $_GET['token'] : null;
    if (!$token || $token !== CRM_API_SECRET) {
        die('Brak uprawnień. Użyj CLI lub podaj prawidłowy token.');
    }
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/invoices.php';

echo "Rozpoczynam pełną synchronizację inFakt...\n";

try {
    $results = runFullSync(); // UserId null dla CRON
    
    echo "ZAKOŃCZONO:\n";
    echo "- Faktury: zaktualizowano {$results['invoices']['updated']} z {$results['invoices']['total']}\n";
    echo "- Klienci: utworzono {$results['clients']['created']}, zaktualizowano {$results['clients']['updated']} z {$results['clients']['total']}\n";
    echo "Wiadomość: {$results['message']}\n";
    
} catch (Exception $e) {
    echo "BŁĄD: " . $e->getMessage() . "\n";
    exit(1);
}

