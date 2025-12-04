<?php
/**
 * CRM Zlecenia Montażowe - Proxy do Gemini AI
 * PHP 5.6 Compatible
 */

if (!defined('CRM_LOADED')) {
    die('Brak dostępu');
}

require_once __DIR__ . '/auth.php';

/**
 * Handler Gemini API
 */
function handleGemini($method) {
    if ($method !== 'POST') {
        jsonError('Metoda niedozwolona', 405);
    }
    
    $user = verifyAuth();
    
    // Tylko admin może używać AI
    if ($user['role'] !== 'admin') {
        jsonError('Brak uprawnień do używania AI', 403);
    }
    
    $data = getJsonInput();
    
    $text = isset($data['text']) ? $data['text'] : '';
    $images = isset($data['images']) ? $data['images'] : array();
    
    if (empty($text) && empty($images)) {
        jsonError('Brak danych do analizy', 400);
    }
    
    try {
        $result = callGeminiAPI($text, $images);
        jsonResponse($result);
    } catch (Exception $e) {
        jsonError('Błąd AI: ' . $e->getMessage(), 500);
    }
}

/**
 * Wywołuje Gemini API
 */
function callGeminiAPI($text, $images = array()) {
    $apiKey = GEMINI_API_KEY;
    
    if (empty($apiKey) || $apiKey === 'TWOJ_KLUCZ_GEMINI_API') {
        throw new Exception('Klucz API Gemini nie jest skonfigurowany');
    }
    
    // Endpoint API
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' . $apiKey;
    
    // Buduj prompt
    $systemPrompt = '
Zadanie: Jesteś ekspertem od analizy zleceń montażowych.
Przeanalizuj dostarczony tekst oraz załączone obrazy/pliki PDF.

Twoim celem jest stworzenie precyzyjnej karty zlecenia w formacie JSON.

WYTYCZNE DLA PDF I OBRAZÓW:
- Dokładnie czytaj treść załączonych plików PDF. Często zawierają one specyfikację techniczną, której nie ma w mailu.
- Jeśli widzisz rysunek techniczny, opisz wymiary i materiały w polu "scopeWorkImages".

WYTYCZNE DANYCH:
- Tytuł (suggestedTitle): "[Klient] - [Ulica] - [Dystans] - [Czynność]"
- Telefon: Szukaj wszędzie, również w stopkach.
- Adres: Baza to ul. Poprawna 39R, Warszawa. Licz dystans od bazy.
- Dzielnica: Określ dzielnicę na podstawie adresu (np. Mokotów, Wola, Praga).

Zwróć TYLKO poprawny JSON bez znaczników markdown, z następującymi polami:
{
  "suggestedTitle": "string",
  "clientName": "string",
  "companyName": "string|null",
  "contactPerson": "string",
  "phoneNumber": "string",
  "address": "string",
  "district": "string",
  "locations": [{"fullAddress": "string", "shortLabel": "string", "distance": "string"}],
  "scopeWorkText": "string",
  "scopeWorkImages": "string",
  "payment": {"type": "CASH|TRANSFER|UNKNOWN", "netAmount": number|null, "grossAmount": number|null}
}
';

    // Przygotuj części zawartości
    $parts = array();
    
    // Dodaj tekst
    $parts[] = array(
        'text' => $systemPrompt . "\n\nDANE WEJŚCIOWE:\n" . $text
    );
    
    // Dodaj obrazy (jako base64)
    foreach ($images as $image) {
        if (strpos($image, 'data:') === 0) {
            // Wyciągnij mime type i dane
            if (preg_match('/^data:([^;]+);base64,(.+)$/', $image, $matches)) {
                $mimeType = $matches[1];
                $base64Data = $matches[2];
                
                $parts[] = array(
                    'inlineData' => array(
                        'mimeType' => $mimeType,
                        'data' => $base64Data
                    )
                );
            }
        }
    }
    
    // Przygotuj request
    $requestData = array(
        'contents' => array(
            array('parts' => $parts)
        ),
        'generationConfig' => array(
            'temperature' => 0.2,
            'topK' => 40,
            'topP' => 0.95,
            'maxOutputTokens' => 8192
        )
    );
    
    // Wykonaj request cURL
    $ch = curl_init();
    curl_setopt_array($ch, array(
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($requestData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json'
        ),
        CURLOPT_TIMEOUT => 60,
        CURLOPT_SSL_VERIFYPEER => true
    ));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        throw new Exception('Błąd połączenia: ' . $error);
    }
    
    if ($httpCode !== 200) {
        $errorData = json_decode($response, true);
        $message = isset($errorData['error']['message']) ? $errorData['error']['message'] : 'Błąd API';
        throw new Exception($message);
    }
    
    $responseData = json_decode($response, true);
    
    if (!$responseData) {
        throw new Exception('Nieprawidłowa odpowiedź API');
    }
    
    // Wyciągnij tekst odpowiedzi
    $resultText = '';
    if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
        $resultText = $responseData['candidates'][0]['content']['parts'][0]['text'];
    }
    
    if (empty($resultText)) {
        throw new Exception('Pusta odpowiedź od AI');
    }
    
    // Wyczyść odpowiedź z markdown
    $resultText = preg_replace('/```json\s*/i', '', $resultText);
    $resultText = preg_replace('/```\s*/i', '', $resultText);
    $resultText = trim($resultText);
    
    // Sparsuj JSON
    $parsedData = json_decode($resultText, true);
    
    if (!$parsedData) {
        throw new Exception('AI zwróciło nieprawidłowy JSON: ' . substr($resultText, 0, 200));
    }
    
    return $parsedData;
}

