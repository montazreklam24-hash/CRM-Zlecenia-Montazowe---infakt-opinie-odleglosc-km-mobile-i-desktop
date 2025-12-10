<?php
/**
 * API GUS - Pobieranie danych firm po NIP
 * Używa zewnętrznego API (rejestr.io) jako prostszej alternatywy dla REGON
 * 
 * Endpoints:
 *   GET /api/gus/nip/{nip} - Pobierz dane firmy po NIP
 */

require_once __DIR__ . '/config.php';

/**
 * Pobierz dane firmy z zewnętrznego API
 * Używamy rejestr.io (darmowy, bez klucza do 100 zapytań/dzień)
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
    
    // Spróbuj API rejestr.io
    $result = fetchFromRejestrIo($nip);
    if ($result && !isset($result['error'])) {
        return $result;
    }
    
    // Fallback: API mf.gov.pl (Ministerstwo Finansów - biała lista VAT)
    $result = fetchFromMF($nip);
    if ($result && !isset($result['error'])) {
        return $result;
    }
    
    return array('error' => 'Nie znaleziono firmy o podanym NIP');
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
 * Pobierz dane z rejestr.io (darmowy, bez klucza)
 */
function fetchFromRejestrIo($nip) {
    $url = "https://rejestr.io/api/v1/krs?nip=" . $nip;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Accept: application/json',
        'User-Agent: CRM-MontazReklam24'
    ));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (empty($data) || !isset($data[0])) {
        return null;
    }
    
    $company = $data[0];
    
    return array(
        'success' => true,
        'company' => array(
            'name' => isset($company['nazwa']) ? $company['nazwa'] : '',
            'nip' => $nip,
            'regon' => isset($company['regon']) ? $company['regon'] : '',
            'krs' => isset($company['krs']) ? $company['krs'] : '',
            'street' => isset($company['adres']['ulica']) ? $company['adres']['ulica'] : '',
            'city' => isset($company['adres']['miejscowosc']) ? $company['adres']['miejscowosc'] : '',
            'postCode' => isset($company['adres']['kodPocztowy']) ? $company['adres']['kodPocztowy'] : '',
            'country' => 'Polska'
        )
    );
}

/**
 * Pobierz dane z API Ministerstwa Finansów (biała lista VAT)
 */
function fetchFromMF($nip) {
    $date = date('Y-m-d');
    $url = "https://wl-api.mf.gov.pl/api/search/nip/{$nip}?date={$date}";
    
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
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (!isset($data['result']['subject'])) {
        return null;
    }
    
    $subject = $data['result']['subject'];
    
    // Parsuj adres (format: "ul. Nazwa 1, 00-000 Miasto")
    $addressParts = parseAddress(isset($subject['workingAddress']) ? $subject['workingAddress'] : '');
    
    return array(
        'success' => true,
        'company' => array(
            'name' => isset($subject['name']) ? $subject['name'] : '',
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
