<?php
/**
 * CRM Zlecenia Montażowe - Proxy do Gemini API
 * PHP 5.6 Compatible
 * 
 * Ukrywa klucz API przed frontendem
 */

require_once __DIR__ . '/config.php';

/**
 * POST /api/gemini
 * Body: { "text": "treść maila", "images": ["base64...", ...] }
 */
function handleGemini() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(array('error' => 'Method not allowed'), 405);
    }
    
    $user = requireAuth();
    
    // Tylko admin może używać AI
    if ($user['role'] !== 'admin') {
        jsonResponse(array('error' => 'Brak uprawnień'), 403);
    }
    
    $input = getJsonInput();
    
    $text = isset($input['text']) ? $input['text'] : '';
    $images = isset($input['images']) ? $input['images'] : array();
    
    if (empty($text) && empty($images)) {
        jsonResponse(array('error' => 'Podaj tekst lub obrazy do analizy'), 400);
    }
    
    // Sprawdź czy mamy klucz API
    if (empty(GEMINI_API_KEY) || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        jsonResponse(array('error' => 'Gemini API key not configured'), 500);
    }
    
    try {
        $result = callGeminiAPI($text, $images);
        jsonResponse(array('success' => true, 'data' => $result));
    } catch (Exception $e) {
        logError('Gemini API error: ' . $e->getMessage());
        jsonResponse(array('error' => 'AI processing failed', 'message' => $e->getMessage()), 500);
    }
}

/**
 * Wywołanie Gemini API
 */
function callGeminiAPI($text, $images = array()) {
    $apiKey = GEMINI_API_KEY;
    $model = GEMINI_MODEL;
    
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
    
    // Buduj prompt
    $prompt = "
Zadanie: Jesteś ekspertem od analizy zleceń montażowych.
Przeanalizuj dostarczony tekst oraz załączone obrazy/pliki PDF.

Twoim celem jest stworzenie precyzyjnej karty zlecenia w formacie JSON.

WYTYCZNE DLA PDF I OBRAZÓW:
- Dokładnie czytaj treść załączonych plików PDF. Często zawierają one specyfikację techniczną, której nie ma w mailu.
- Jeśli widzisz rysunek techniczny, opisz wymiary i materiały w polu 'scopeWorkImages'.

WYTYCZNE DANYCH:
- Telefon: Szukaj dokładnie w całym tekście, również w stopkach i podpisach. OBOWIĄZKOWE!
- Email: Znajdź adres email klienta jeśli jest dostępny.
- NIP: Znajdź numer NIP firmy jeśli jest dostępny (10 cyfr).
- Adres: Główny adres montażu. Baza to ul. Poprawna 39R, Warszawa - licz dystans od bazy.
- Tytuł zlecenia (suggestedTitle): Generuj TYLKO gdy użytkownik NIE podał tytułu. Format: \"[Ulica] [Numer] [Miasto] [Telefon] [Klient]\" (np. \"Zajęcza 9 Warszawa 123456789 Jan Kowalski\")

WYMAGANY FORMAT ODPOWIEDZI (JSON):
{
    \"suggestedTitle\": \"Ulica Numer Miasto Telefon Nazwa_Klienta (TYLKO gdy brak tytułu od użytkownika!)\",
    \"clientName\": \"Imię i nazwisko lub nazwa firmy\",
    \"email\": \"email@klienta.pl\",
    \"nip\": \"1234567890\",
    \"companyName\": \"Nazwa firmy (opcjonalnie)\",
    \"contactPerson\": \"Osoba kontaktowa\",
    \"phoneNumber\": \"Numer telefonu\",
    \"address\": \"Główny adres montażu\",
    \"locations\": [
        {
            \"fullAddress\": \"Pełny adres do nawigacji\",
            \"shortLabel\": \"Ulica Numer, Miasto\",
            \"distance\": \"15 km\"
        }
    ],
    \"scopeWorkText\": \"Szczegółowy opis zlecenia\",
    \"scopeWorkImages\": \"Opis techniczny z analizy obrazów\",
    \"payment\": {
        \"type\": \"CASH|TRANSFER|UNKNOWN\",
        \"netAmount\": null,
        \"grossAmount\": null
    }
}

DANE WEJŚCIOWE:
{$text}
";

    // Buduj części requestu
    $parts = array();
    $parts[] = array('text' => $prompt);
    
    // Dodaj obrazy
    foreach ($images as $imageData) {
        $mimeType = 'image/jpeg';
        $base64Data = $imageData;
        
        // Wykryj typ MIME z data URI
        if (strpos($imageData, 'data:') === 0) {
            if (preg_match('/^data:([^;]+);base64,(.+)$/', $imageData, $matches)) {
                $mimeType = $matches[1];
                $base64Data = $matches[2];
            }
        }
        
        $parts[] = array(
            'inline_data' => array(
                'mime_type' => $mimeType,
                'data' => $base64Data
            )
        );
    }
    
    $requestBody = array(
        'contents' => array(
            array('parts' => $parts)
        ),
        'generationConfig' => array(
            'temperature' => 0.2,
            'topP' => 0.8,
            'maxOutputTokens' => 4096,
            'responseMimeType' => 'application/json'
        )
    );
    
    // Wywołaj API
    $ch = curl_init($url);
    curl_setopt_array($ch, array(
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($requestBody),
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
        throw new Exception('cURL error: ' . $error);
    }
    
    if ($httpCode !== 200) {
        $errorData = json_decode($response, true);
        $errorMessage = isset($errorData['error']['message']) ? $errorData['error']['message'] : 'Unknown API error';
        throw new Exception('Gemini API error (' . $httpCode . '): ' . $errorMessage);
    }
    
    $data = json_decode($response, true);
    
    if (!$data) {
        throw new Exception('Invalid JSON response from Gemini');
    }
    
    // Wyciągnij tekst odpowiedzi
    $responseText = '';
    if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
        $responseText = $data['candidates'][0]['content']['parts'][0]['text'];
    }
    
    if (empty($responseText)) {
        throw new Exception('Empty response from Gemini');
    }
    
    // Usuń znaczniki markdown jeśli są
    $responseText = preg_replace('/^```json\s*/i', '', $responseText);
    $responseText = preg_replace('/\s*```$/i', '', $responseText);
    $responseText = trim($responseText);
    
    // Parsuj JSON
    $result = json_decode($responseText, true);
    
    if (!$result) {
        // Spróbuj naprawić typowe błędy JSON
        $responseText = preg_replace('/,\s*}/', '}', $responseText);
        $responseText = preg_replace('/,\s*]/', ']', $responseText);
        $result = json_decode($responseText, true);
    }
    
    if (!$result) {
        throw new Exception('Failed to parse Gemini response as JSON');
    }
    
    return $result;
}



