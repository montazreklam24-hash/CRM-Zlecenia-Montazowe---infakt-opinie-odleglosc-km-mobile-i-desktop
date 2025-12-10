<?php
/**
 * API GUS - Pobieranie danych firm po NIP
 * Używa oficjalnych API: CEIDG, KRS, MF (biała lista)
 * 
 * Endpoints:
 *   GET /api/gus/nip/{nip} - Pobierz dane firmy po NIP
 */

require_once __DIR__ . '/config.php';

handleCORS();

/**
 * Pobierz dane firmy z zewnętrznych API
 * Kolejność: 1. CEIDG (JDG), 2. KRS (spółki), 3. regon.io (fallback), 4. MF (biała lista)
 */
function lookupNipExternal($nip) {
    // Wyczyść NIP
    $nip = preg_replace('/[^0-9]/', '', $nip);
    
    if (strlen($nip) !== 10) {
        return array('error' => 'NIP musi mieć 10 cyfr');
    }
    
    // Walidacja sumy kontrolnej NIP
    if (!validateNipChecksum($nip)) {
        return array('error' => 'Nieprawidłowy NIP (błędna suma kontrolna)');
    }
    
    error_log("[GUS] Szukam NIP: $nip");
    
    // 1. Spróbuj CEIDG (jednoosobowe działalności gospodarcze)
    $result = fetchFromCEIDG($nip);
    if ($result && !isset($result['error']) && !empty($result['company']['name'])) {
        $result['source'] = 'CEIDG';
        error_log("[GUS] Znaleziono w CEIDG: " . $result['company']['name']);
        return $result;
    }
    
    // 2. Spróbuj KRS (spółki)
    $result = fetchFromKRS($nip);
    if ($result && !isset($result['error']) && !empty($result['company']['name'])) {
        $result['source'] = 'KRS';
        error_log("[GUS] Znaleziono w KRS: " . $result['company']['name']);
        return $result;
    }
    
    // 3. Fallback: regon.io (uniwersalne)
    $result = fetchFromRegonIO($nip);
    if ($result && !isset($result['error']) && !empty($result['company']['name'])) {
        $result['source'] = 'REGON';
        error_log("[GUS] Znaleziono w regon.io: " . $result['company']['name']);
        return $result;
    }
    
    // 4. Ostateczny fallback: API mf.gov.pl (Ministerstwo Finansów - biała lista VAT)
    $result = fetchFromMF($nip);
    if ($result && !isset($result['error']) && !empty($result['company']['name'])) {
        $result['source'] = 'MF';
        error_log("[GUS] Znaleziono w MF: " . $result['company']['name']);
        return $result;
    }
    
    return array('error' => 'Nie znaleziono firmy o podanym NIP w CEIDG, KRS ani białej liście VAT');
}

/**
 * Walidacja sumy kontrolnej NIP
 */
function validateNipChecksum($nip) {
    $weights = array(6, 5, 7, 2, 3, 4, 5, 6, 7);
    $sum = 0;
    
    for ($i = 0; $i < 9; $i++) {
        $sum += intval($nip[$i]) * $weights[$i];
    }
    
    $checksum = $sum % 11;
    if ($checksum === 10) $checksum = 0;
    
    return intval($nip[9]) === $checksum;
}

/**
 * Pobierz dane z CEIDG (Centralna Ewidencja Działalności Gospodarczej)
 * Dla: jednoosobowe działalności gospodarcze
 * API: https://dane.biznes.gov.pl/api/ceidg/v1/companies?nip={nip}
 */
function fetchFromCEIDG($nip) {
    $url = "https://dane.biznes.gov.pl/api/ceidg/v1/companies?nip=" . $nip;
    
    error_log("[CEIDG] Wywołuję: $url");
    
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
    $curlError = curl_error($ch);
    curl_close($ch);
    
    error_log("[CEIDG] HTTP $httpCode, response length: " . strlen($response));
    
    if ($curlError) {
        error_log("[CEIDG] Curl error: $curlError");
        return null;
    }
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (empty($data) || !is_array($data) || !isset($data[0])) {
        error_log("[CEIDG] Pusta odpowiedź lub brak danych");
        return null;
    }
    
    $company = $data[0];
    
    error_log("[CEIDG] Klucze odpowiedzi: " . implode(', ', array_keys($company)));
    
    // Nazwa firmy z CEIDG - pole 'nazwa'
    $name = isset($company['nazwa']) ? trim($company['nazwa']) : '';
    
    // Adres - bezpośrednio z pól głównych
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
    
    $city = isset($company['miejscowosc']) ? $company['miejscowosc'] : '';
    $postCode = isset($company['kodPocztowy']) ? $company['kodPocztowy'] : '';
    
    error_log("[CEIDG] Pobrano: nazwa='$name', ulica='$street', miasto='$city', kod='$postCode'");
    
    if (empty($name)) {
        return null;
    }
    
    return array(
        'success' => true,
        'company' => array(
            'name' => $name,
            'nip' => $nip,
            'regon' => isset($company['regon']) ? $company['regon'] : '',
            'street' => trim($street),
            'city' => $city,
            'postCode' => $postCode,
            'country' => 'Polska'
        )
    );
}

/**
 * Pobierz dane z KRS (Krajowy Rejestr Sądowy)
 * Dla: spółki (Sp. z o.o., S.A., itp.)
 * API: https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/{nip}?rejestr=P&format=json
 */
function fetchFromKRS($nip) {
    $url = "https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/" . $nip . "?rejestr=P&format=json";
    
    error_log("[KRS] Wywołuję: $url");
    
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
    $curlError = curl_error($ch);
    curl_close($ch);
    
    error_log("[KRS] HTTP $httpCode, response length: " . strlen($response));
    
    if ($curlError) {
        error_log("[KRS] Curl error: $curlError");
        return null;
    }
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    
    // KRS ma specyficzną strukturę odpowiedzi
    if (!isset($data['odpis']['dane']['dzial1'])) {
        error_log("[KRS] Brak struktury odpis/dane/dzial1");
        return null;
    }
    
    $dzial1 = $data['odpis']['dane']['dzial1'];
    
    // Nazwa spółki
    $name = '';
    if (isset($dzial1['danePodmiotu']['nazwa'])) {
        $name = $dzial1['danePodmiotu']['nazwa'];
    }
    
    // Adres siedziby
    $street = '';
    $city = '';
    $postCode = '';
    
    if (isset($dzial1['siedzibaIAdres'])) {
        $addr = $dzial1['siedzibaIAdres'];
        
        if (isset($addr['ulica'])) {
            $street = $addr['ulica'];
            if (isset($addr['nrDomu'])) {
                $street .= ' ' . $addr['nrDomu'];
            }
            if (isset($addr['nrLokalu']) && !empty($addr['nrLokalu'])) {
                $street .= '/' . $addr['nrLokalu'];
            }
        }
        
        $city = isset($addr['miejscowosc']) ? $addr['miejscowosc'] : '';
        $postCode = isset($addr['kodPocztowy']) ? $addr['kodPocztowy'] : '';
    }
    
    // REGON i KRS
    $regon = isset($dzial1['danePodmiotu']['regon']) ? $dzial1['danePodmiotu']['regon'] : '';
    $krs = isset($dzial1['danePodmiotu']['krs']) ? $dzial1['danePodmiotu']['krs'] : '';
    
    error_log("[KRS] Pobrano: nazwa='$name', ulica='$street', miasto='$city'");
    
    if (empty($name)) {
        return null;
    }
    
    return array(
        'success' => true,
        'company' => array(
            'name' => $name,
            'nip' => $nip,
            'regon' => $regon,
            'krs' => $krs,
            'street' => trim($street),
            'city' => $city,
            'postCode' => $postCode,
            'country' => 'Polska'
        )
    );
}

/**
 * Pobierz dane z regon.io (darmowe API - fallback)
 * Dla: wszystkie typy firm
 * API: https://api.regon.io/nip/{nip}
 */
function fetchFromRegonIO($nip) {
    $url = "https://api.regon.io/nip/" . $nip;
    
    error_log("[REGON.IO] Wywołuję: $url");
    
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
    $curlError = curl_error($ch);
    curl_close($ch);
    
    error_log("[REGON.IO] HTTP $httpCode");
    
    if ($curlError) {
        error_log("[REGON.IO] Curl error: $curlError");
        return null;
    }
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    $company = json_decode($response, true);
    
    if (empty($company) || !isset($company['nazwa'])) {
        return null;
    }
    
    // Adres
    $street = '';
    if (isset($company['ulica'])) {
        $street = $company['ulica'];
        if (isset($company['nrNieruchomosci'])) {
            $street .= ' ' . $company['nrNieruchomosci'];
        }
    }
    
    $city = isset($company['miejscowosc']) ? $company['miejscowosc'] : '';
    $postCode = isset($company['kodPocztowy']) ? $company['kodPocztowy'] : '';
    
    error_log("[REGON.IO] Pobrano: nazwa='" . $company['nazwa'] . "'");
    
    return array(
        'success' => true,
        'company' => array(
            'name' => $company['nazwa'],
            'nip' => $nip,
            'regon' => isset($company['regon']) ? $company['regon'] : '',
            'street' => trim($street),
            'city' => $city,
            'postCode' => $postCode,
            'country' => 'Polska'
        )
    );
}

/**
 * Pobierz dane z API Ministerstwa Finansów (biała lista VAT)
 * Ostateczny fallback - zawiera podstawowe dane
 */
function fetchFromMF($nip) {
    $date = date('Y-m-d');
    $url = "https://wl-api.mf.gov.pl/api/search/nip/{$nip}?date={$date}";
    
    error_log("[MF] Wywołuję: $url");
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Accept: application/json'
    ));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("[MF] HTTP $httpCode");
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (!isset($data['result']['subject'])) {
        return null;
    }
    
    $subject = $data['result']['subject'];
    
    // Pobierz nazwę firmy
    $name = isset($subject['name']) ? $subject['name'] : '';
    
    // Parsuj adres (format: "ul. Nazwa 1, 00-000 Miasto")
    $addressParts = parseAddress(isset($subject['workingAddress']) ? $subject['workingAddress'] : '');
    
    error_log("[MF] Pobrano: nazwa='$name'");
    
    return array(
        'success' => true,
        'company' => array(
            'name' => $name,
            'nip' => $nip,
            'regon' => isset($subject['regon']) ? $subject['regon'] : '',
            'krs' => isset($subject['krs']) ? $subject['krs'] : '',
            'street' => $addressParts['street'],
            'city' => $addressParts['city'],
            'postCode' => $addressParts['postCode'],
            'country' => 'Polska',
            'accountNumbers' => isset($subject['accountNumbers']) ? $subject['accountNumbers'] : array()
        )
    );
}

/**
 * Parsuj adres z formatu "ul. Nazwa 1, 00-000 Miasto"
 */
function parseAddress($address) {
    $result = array(
        'street' => '',
        'city' => '',
        'postCode' => ''
    );
    
    if (empty($address)) {
        return $result;
    }
    
    // Szukaj kodu pocztowego (XX-XXX)
    if (preg_match('/(\d{2}-\d{3})\s*(.*)/', $address, $matches)) {
        $result['postCode'] = $matches[1];
        $result['city'] = trim($matches[2]);
        
        // Wytnij kod i miasto z adresu żeby uzyskać ulicę
        $street = preg_replace('/,?\s*\d{2}-\d{3}\s*.*$/', '', $address);
        $result['street'] = trim($street, ', ');
    } else {
        // Jeśli nie ma kodu, całość to ulica
        $result['street'] = $address;
    }
    
    return $result;
}

// =============================================================================
// POBIERZ NIP Z REQUEST
// =============================================================================

function getNipFromRequest() {
    $requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    $path = parse_url($requestUri, PHP_URL_PATH);
    
    // Wyciągnij NIP z path: /gus/nip/1234567890
    if (preg_match('#/nip/(\d+)#', $path, $matches)) {
        return $matches[1];
    }
    
    // Fallback: query string
    if (isset($_GET['nip'])) {
        return $_GET['nip'];
    }
    
    return null;
}

// =============================================================================
// STANDALONE ROUTER (gdy plik wywołany bezpośrednio lub przez index.php)
// =============================================================================

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $nip = getNipFromRequest();
    
    if (empty($nip)) {
        jsonResponse(array('error' => 'Brak NIP. Użyj: /gus/nip/1234567890'), 400);
    }
    
    $result = lookupNipExternal($nip);
    jsonResponse($result);
    
} else {
    jsonResponse(array('error' => 'Method not allowed'), 405);
}
