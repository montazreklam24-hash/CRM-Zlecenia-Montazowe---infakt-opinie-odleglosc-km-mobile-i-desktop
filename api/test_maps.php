<?php
/**
 * Test Google Maps API
 */
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$apiKey = 'AIzaSyApo2EdL3zan9j5aCv_4rKcQvjBcyljJkY';
$testAddress = 'Wróblewskiego, Łódź';

echo json_encode([
    'status' => 'start',
    'api_key_configured' => !empty($apiKey),
    'api_key_length' => strlen($apiKey),
    'api_key_prefix' => substr($apiKey, 0, 5) . '...'
]);

$url = 'https://maps.googleapis.com/maps/api/geocode/json?' . http_build_query([
    'address' => $testAddress,
    'key' => $apiKey,
    'language' => 'pl',
    'region' => 'pl'
]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

$data = json_decode($response, true);

echo "\n\n=== WYNIK ZAPYTANIA ===\n";
echo json_encode([
    'http_code' => $httpCode,
    'curl_error' => $curlError,
    'maps_status' => isset($data['status']) ? $data['status'] : 'UNKNOWN',
    'error_message' => isset($data['error_message']) ? $data['error_message'] : null,
    'results_count' => isset($data['results']) ? count($data['results']) : 0,
    'first_result' => isset($data['results'][0]) ? $data['results'][0]['formatted_address'] : null,
    'coordinates' => isset($data['results'][0]) ? $data['results'][0]['geometry']['location'] : null
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

