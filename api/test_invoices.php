<?php
/**
 * Skrypt testowy do wystawiania faktur
 * Użycie: docker-compose exec app php /var/www/html/api/test_invoices.php
 */

// Załaduj zmienne środowiskowe bezpośrednio
function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

loadEnv(__DIR__ . '/.env');

function env($key, $default = null) {
    $val = getenv($key);
    return $val !== false ? $val : $default;
}

// Definiuj stałe bezpośrednio
define('INFAKT_API_KEY', env('INFAKT_API_KEY', ''));

require_once __DIR__ . '/InfaktClient.php';

// Wczytaj funkcje GUS bezpośrednio (bez handleCORS)
require_once __DIR__ . '/gus.php';

// Funkcja pomocnicza do logowania
function logTest($message) {
    echo "[TEST] " . date('Y-m-d H:i:s') . " - $message\n";
}

// Funkcja do wystawienia faktury testowej
function createTestInvoice($nip, $email, $invoiceNumber) {
    logTest("=== TEST $invoiceNumber ===");
    logTest("NIP: $nip");
    logTest("Email: $email");
    
    try {
        // 1. Pobierz dane firmy z GUS
        logTest("Pobieranie danych z GUS...");
        $gusData = lookupNipExternal($nip);
        
        if (isset($gusData['error'])) {
            throw new Exception("Błąd GUS: " . $gusData['error']);
        }
        
        if (!isset($gusData['company'])) {
            throw new Exception("Nie znaleziono firmy w GUS");
        }
        
        $company = $gusData['company'];
        logTest("Znaleziono firmę: " . $company['name']);
        
        // 2. Przygotuj dane klienta
        $clientData = array(
            'type' => 'company',
            'company_name' => $company['name'],
            'nip' => $nip,
            'email' => $email,
            'phone' => '',
            'street' => isset($company['street']) ? $company['street'] : '',
            'city' => isset($company['city']) ? $company['city'] : '',
            'post_code' => isset($company['postCode']) ? $company['postCode'] : '',
            'payment_method' => 'transfer'
        );
        
        logTest("Dane klienta przygotowane:");
        logTest("  Nazwa: " . $clientData['company_name']);
        logTest("  Adres: " . $clientData['street'] . ", " . $clientData['city'] . " " . $clientData['post_code']);
        
        // 3. Połącz z inFakt
        $infakt = new InfaktClient(INFAKT_API_KEY);
        $infakt->setDebug(true);
        
        // 4. Znajdź lub utwórz klienta
        logTest("Szukanie/tworzenie klienta w inFakt...");
        $clientId = $infakt->findOrCreateClient($clientData);
        
        if (!$clientId) {
            throw new Exception("Nie udało się utworzyć klienta w inFakt");
        }
        
        logTest("Client ID w inFakt: $clientId");
        
        // 5. Przygotuj pozycje faktury (testowa pozycja)
        $items = array(
            array(
                'name' => 'Test usługi montażowej',
                'quantity' => 1,
                'unit_price_net' => 100.00,
                'vat_rate' => 23
            )
        );
        
        // 6. Opcje faktury
        $options = array(
            'type' => 'vat',
            'due_days' => 14,
            'description' => 'Faktura testowa - proszę zignorować',
            'install_address' => '',
            'phone' => ''
        );
        
        // 7. Utwórz fakturę
        logTest("Tworzenie faktury w inFakt...");
        $invoice = $infakt->createInvoice($clientId, $items, $options);
        
        if (!$invoice) {
            throw new Exception("Nie udało się utworzyć faktury");
        }
        
        logTest("Faktura utworzona:");
        logTest("  ID: " . $invoice['id']);
        logTest("  Numer: " . (isset($invoice['number']) ? $invoice['number'] : 'N/A'));
        
        // 8. Utwórz link udostępniania
        logTest("Tworzenie linku udostępniania...");
        $shareLink = $infakt->createShareLink($invoice['id']);
        if ($shareLink) {
            logTest("  Link: $shareLink");
        }
        
        // 9. Wyślij email
        logTest("Wysyłanie emaila na: $email");
        $emailSent = $infakt->sendInvoiceByEmail($invoice['id'], $email);
        
        if ($emailSent) {
            logTest("✅ Email wysłany pomyślnie!");
        } else {
            logTest("⚠️ Nie udało się wysłać emaila");
        }
        
        // 10. Podsumowanie
        logTest("=== SUKCES ===");
        logTest("Faktura ID: " . $invoice['id']);
        logTest("Numer faktury: " . (isset($invoice['number']) ? $invoice['number'] : 'N/A'));
        logTest("Email wysłany: " . ($emailSent ? 'TAK' : 'NIE'));
        logTest("Link: " . ($shareLink ? $shareLink : 'N/A'));
        logTest("");
        
        return array(
            'success' => true,
            'invoiceId' => $invoice['id'],
            'invoiceNumber' => isset($invoice['number']) ? $invoice['number'] : null,
            'shareLink' => $shareLink,
            'emailSent' => $emailSent
        );
        
    } catch (Exception $e) {
        logTest("❌ BŁĄD: " . $e->getMessage());
        logTest("");
        return array(
            'success' => false,
            'error' => $e->getMessage()
        );
    }
}

// =============================================================================
// GŁÓWNY KOD
// =============================================================================

logTest("========================================");
logTest("TEST WYSTAWIANIA FAKTUR");
logTest("========================================");
logTest("");

// Test 1: NIP 9522223413 → kontakt@newoffice.pl
$result1 = createTestInvoice('9522223413', 'kontakt@newoffice.pl', '1');

// Test 2: NIP 5240106195 → a.korpalski@gmail.com
$result2 = createTestInvoice('5240106195', 'a.korpalski@gmail.com', '2');

// Podsumowanie
logTest("========================================");
logTest("PODSUMOWANIE");
logTest("========================================");
logTest("Test 1 (9522223413 → kontakt@newoffice.pl):");
logTest("  Status: " . ($result1['success'] ? 'SUKCES' : 'BŁĄD'));
if ($result1['success']) {
    logTest("  Faktura ID: " . $result1['invoiceId']);
    logTest("  Numer: " . ($result1['invoiceNumber'] ?: 'N/A'));
    logTest("  Email: " . ($result1['emailSent'] ? 'Wysłany' : 'Nie wysłany'));
} else {
    logTest("  Błąd: " . $result1['error']);
}

logTest("");
logTest("Test 2 (5240106195 → a.korpalski@gmail.com):");
logTest("  Status: " . ($result2['success'] ? 'SUKCES' : 'BŁĄD'));
if ($result2['success']) {
    logTest("  Faktura ID: " . $result2['invoiceId']);
    logTest("  Numer: " . ($result2['invoiceNumber'] ?: 'N/A'));
    logTest("  Email: " . ($result2['emailSent'] ? 'Wysłany' : 'Nie wysłany'));
} else {
    logTest("  Błąd: " . $result2['error']);
}

logTest("");
logTest("========================================");
logTest("KONIEC TESTU");
logTest("========================================");

