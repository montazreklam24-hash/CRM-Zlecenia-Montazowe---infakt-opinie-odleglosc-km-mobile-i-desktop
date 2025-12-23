<?php
/**
 * Prosty skrypt testowy do wystawiania faktur
 * Użycie: docker-compose exec app php /var/www/html/api/test_invoices_simple.php
 */

// Załaduj zmienne środowiskowe
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

define('INFAKT_API_KEY', env('INFAKT_API_KEY', ''));

if (empty(INFAKT_API_KEY)) {
    die("BŁĄD: Brak klucza INFAKT_API_KEY w .env\n");
}

require_once __DIR__ . '/InfaktClient.php';

// Funkcja pomocnicza do logowania
function logTest($message) {
    echo "[TEST] " . date('Y-m-d H:i:s') . " - $message\n";
}

// Funkcja do pobrania danych firmy z GUS (z fallbackami)
function lookupNipSimple($nip) {
    $nip = preg_replace('/[^0-9]/', '', $nip);
    
    if (strlen($nip) !== 10) {
        return array('error' => 'NIP musi mieć 10 cyfr');
    }
    
    // Spróbuj CEIDG
    $url = "https://dane.biznes.gov.pl/api/ceidg/v1/companies?nip=" . $nip;
    logTest("Pobieranie danych z CEIDG...");
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Accept: application/json',
        'User-Agent: CRM-MontazReklam24/1.0'
    ));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        if (!empty($data) && is_array($data) && isset($data[0])) {
            $company = $data[0];
            $name = isset($company['nazwa']) ? trim($company['nazwa']) : '';
            if (!empty($name)) {
                $street = '';
                if (isset($company['ulica'])) {
                    $street = $company['ulica'];
                    if (isset($company['nrNieruchomosci'])) {
                        $street .= ' ' . $company['nrNieruchomosci'];
                    }
                    if (isset($company['nrLokalu']) && !empty($company['nrLokalu'])) {
                        $street .= '/' . $company['nrLokalu'];
                    }
                }
                return array(
                    'success' => true,
                    'company' => array(
                        'name' => $name,
                        'nip' => $nip,
                        'street' => trim($street),
                        'city' => isset($company['miejscowosc']) ? $company['miejscowosc'] : '',
                        'postCode' => isset($company['kodPocztowy']) ? $company['kodPocztowy'] : ''
                    )
                );
            }
        }
    }
    
    // Fallback: Biała lista VAT (MF)
    logTest("CEIDG nie znalazło - próba białej listy VAT...");
    $date = date('Y-m-d');
    $url = "https://wl-api.mf.gov.pl/api/search/nip/{$nip}?date={$date}";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Accept: application/json'));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        if (isset($data['result']['subject']['name'])) {
            $subject = $data['result']['subject'];
            $name = $subject['name'];
            
            // Parsuj adres
            $address = '';
            if (!empty($subject['workingAddress'])) {
                $address = $subject['workingAddress'];
            } elseif (!empty($subject['residenceAddress'])) {
                $address = $subject['residenceAddress'];
            }
            
            // Proste parsowanie adresu
            $street = $address;
            $city = '';
            $postCode = '';
            
            if (preg_match('/(\d{2}-\d{3})\s*(.*)/', $address, $matches)) {
                $postCode = $matches[1];
                $city = trim($matches[2]);
                $street = preg_replace('/,?\s*\d{2}-\d{3}\s*.*$/', '', $address);
                $street = trim($street, ', ');
            }
            
            return array(
                'success' => true,
                'company' => array(
                    'name' => $name,
                    'nip' => $nip,
                    'street' => $street,
                    'city' => $city,
                    'postCode' => $postCode
                )
            );
        }
    }
    
    // Jeśli nie znaleziono - zwróć pusty wynik (będziemy używać tylko NIP i email)
    logTest("⚠️ Nie znaleziono danych w GUS - utworzymy fakturę bez pełnych danych adresowych");
    return array(
        'success' => true,
        'company' => array(
            'name' => 'Firma NIP ' . $nip,
            'nip' => $nip,
            'street' => '',
            'city' => '',
            'postCode' => ''
        )
    );
}

// Funkcja do wystawienia faktury testowej
function createTestInvoice($nip, $email, $invoiceNumber) {
    logTest("=== TEST $invoiceNumber ===");
    logTest("NIP: $nip");
    logTest("Email: $email");
    
    try {
        // 1. Pobierz dane firmy z GUS
        logTest("Pobieranie danych z GUS...");
        $gusData = lookupNipSimple($nip);
        
        if (isset($gusData['error'])) {
            throw new Exception("Błąd GUS: " . $gusData['error']);
        }
        
        if (!isset($gusData['company'])) {
            throw new Exception("Nie znaleziono firmy w GUS");
        }
        
        $company = $gusData['company'];
        logTest("Dane firmy:");
        logTest("  Nazwa: " . $company['name']);
        if (!empty($company['street']) || !empty($company['city'])) {
            logTest("  Adres: " . $company['street'] . ", " . $company['city'] . " " . $company['postCode']);
        } else {
            logTest("  Adres: (brak danych z GUS)");
        }
        
        // 2. Przygotuj dane klienta
        $clientData = array(
            'type' => 'company',
            'company_name' => $company['name'],
            'nip' => $nip,
            'email' => $email,
            'phone' => '',
            'street' => $company['street'],
            'city' => $company['city'],
            'post_code' => $company['postCode'],
            'payment_method' => 'transfer'
        );
        
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
    logTest("  Link: " . ($result1['shareLink'] ?: 'N/A'));
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
    logTest("  Link: " . ($result2['shareLink'] ?: 'N/A'));
} else {
    logTest("  Błąd: " . $result2['error']);
}

logTest("");
logTest("========================================");
logTest("KONIEC TESTU");
logTest("========================================");

