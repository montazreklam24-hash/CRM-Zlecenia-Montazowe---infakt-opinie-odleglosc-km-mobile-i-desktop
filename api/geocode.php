<?php
/**
 * Google Maps Geocoding API
 * Konwersja adresu na współrzędne
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

// Obsługa GET dla testów
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $address = isset($_GET['address']) ? $_GET['address'] : '';
} else {
    $input = getJsonInput();
    $address = isset($input['address']) ? trim($input['address']) : '';
}

if (empty($address)) {
    jsonResponse(array('error' => 'Address is required'), 400);
}

// Inteligentne podpowiadanie Warszawy
if (stripos($address, 'warszawa') === false && stripos($address, 'polska') === false) {
    // Jeśli nie ma Warszawy ani Polski, dodaj Warszawę jako domyślne miasto
    $address .= ', Warszawa';
}

// Google Maps Geocoding API
$apiKey = GOOGLE_MAPS_API_KEY;

// Parametry z nastawieniem na Warszawę (Poprawna 39r, ~52.22, 21.11)
$params = array(
    'address' => $address,
    'key' => $apiKey,
    'language' => 'pl',
    'region' => 'pl',
    'components' => 'country:PL'
);

// Dodajemy bias na Warszawę jeśli adres nie zawiera innego miasta
// Ale Google API 'bounds' lub 'location' działa jako preferencja, nie filtr twardy.
// Ustawiamy okrąg 30km wokół Warszawy jako preferencję
if (stripos($address, 'Gdańsk') === false && stripos($address, 'Kraków') === false && stripos($address, 'Poznań') === false && stripos($address, 'Wrocław') === false && stripos($address, 'Łódź') === false) {
    // Współrzędne Warszawy (centrum/poprawna)
    // location=52.2297,21.0122 (Centrum)
    // radius=30000 (30km)
    // Google Geocoding API nie używa 'location'/'radius' tak silnie jak Places API, 
    // ale 'bounds' działa dobrze.
    
    // Bounds dla Warszawy i okolic
    $params['bounds'] = '52.09,20.85|52.36,21.27'; 
}

$url = 'https://maps.googleapis.com/maps/api/geocode/json?' . http_build_query($params);

// Wywołanie API
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    jsonResponse(array('error' => 'Google Maps API error', 'details' => $response), 500);
}

$data = json_decode($response, true);

if ($data['status'] !== 'OK') {
    // Zwróć dokładny błąd od Google
    jsonResponse(array(
        'success' => false,
        'message' => 'Google API Error: ' . $data['status'],
        'error_message' => isset($data['error_message']) ? $data['error_message'] : '',
        'query' => $address,
        'results' => array()
    ));
}

// Przetwórz wyniki
$results = array();
foreach ($data['results'] as $result) {
    $results[] = array(
        'formattedAddress' => $result['formatted_address'],
        'coordinates' => array(
            'lat' => $result['geometry']['location']['lat'],
            'lng' => $result['geometry']['location']['lng']
        ),
        'placeId' => $result['place_id']
    );
}

jsonResponse(array(
    'success' => true,
    'results' => $results,
    'query' => $address
));
