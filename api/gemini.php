<?php
/**
 * CRM Zlecenia Montażowe - Proxy do Gemini API
 * PHP 5.6 Compatible
 * 
 * Ukrywa klucz API przed frontendem
 */

require_once __DIR__ . '/config.php';

// Obsługa CORS
handleCORS();

// Sprawdź czy plik jest wywoływany bezpośrednio (nie includowany)
if (basename($_SERVER['PHP_SELF']) === 'gemini.php') {
    // TEST endpoint - GET /api/gemini zwraca status
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = isset($_GET['action']) ? $_GET['action'] : 'status';
        
        if ($action === 'models') {
            // Lista dostępnych modeli
            $apiKey = GEMINI_API_KEY;
            $url = "https://generativelanguage.googleapis.com/v1beta/models?key={$apiKey}";
            
            $ch = curl_init($url);
            curl_setopt_array($ch, array(
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_SSL_VERIFYPEER => false
            ));
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            $data = json_decode($response, true);
            $models = array();
            if (isset($data['models'])) {
                foreach ($data['models'] as $m) {
                    $models[] = array(
                        'name' => $m['name'],
                        'displayName' => isset($m['displayName']) ? $m['displayName'] : '',
                        'supportedMethods' => isset($m['supportedGenerationMethods']) ? $m['supportedGenerationMethods'] : array()
                    );
                }
            }
            
            jsonResponse(array(
                'http_code' => $httpCode,
                'models_count' => count($models),
                'models' => $models,
                'raw_error' => $httpCode !== 200 ? $response : null
            ));
        }
        
        if ($action === 'test') {
            // Test połączenia z Gemini API
            $apiKey = GEMINI_API_KEY;
            $model = GEMINI_MODEL;
            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
            
            $testBody = json_encode(array(
                'contents' => array(
                    array('parts' => array(array('text' => 'Odpowiedz jednym slowem: OK')))
                )
            ));
            
            $ch = curl_init($url);
            curl_setopt_array($ch, array(
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $testBody,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => array('Content-Type: application/json'),
                CURLOPT_TIMEOUT => 30,
                CURLOPT_SSL_VERIFYPEER => false
            ));
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);
            
            jsonResponse(array(
                'test' => 'gemini_connection',
                'http_code' => $httpCode,
                'curl_error' => $error ?: null,
                'response_preview' => substr($response, 0, 300),
                'success' => $httpCode === 200
            ));
        }
        
        // Default: status
        jsonResponse(array(
            'status' => 'ok',
            'model' => GEMINI_MODEL,
            'key_prefix' => substr(GEMINI_API_KEY, 0, 10) . '...',
            'php_version' => PHP_VERSION,
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time'),
            'post_max_size' => ini_get('post_max_size'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'test_url' => '/api/gemini?action=test'
        ));
    }
}

/**
 * POST /api/gemini
 * Body: { "text": "treść maila", "images": ["base64...", ...] }
 */
function handleGemini() {
    // Zwiększ limity dla dużych requestów
    ini_set('memory_limit', '256M');
    ini_set('max_execution_time', 120);
    
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
        $errorMsg = $e->getMessage();
        error_log('[Gemini Error] ' . $errorMsg . ' | Text length: ' . strlen($text) . ' | Images: ' . count($images));
        
        // Zwróć więcej szczegółów w trybie dev
        if (defined('DEV_MODE') && DEV_MODE) {
            jsonResponse(array(
                'error' => 'AI processing failed', 
                'message' => $errorMsg,
                'debug' => array(
                    'model' => GEMINI_MODEL,
                    'textLength' => strlen($text),
                    'imagesCount' => count($images)
                )
            ), 500);
        } else {
            jsonResponse(array('error' => 'AI processing failed', 'message' => $errorMsg), 500);
        }
    }
}

/**
 * Helper do analizy treści maila (wywoływany np. przez webhook Gmail)
 */
function analyzeEmailContent($content) {
    try {
        $result = callGeminiAPI($content, array());
        return array('success' => true, 'data' => $result);
    } catch (Exception $e) {
        error_log('[Gemini analyzeEmailContent Error] ' . $e->getMessage());
        return array('error' => $e->getMessage());
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
Zadanie: Jesteś ekspertem od logistyki i analizy zleceń montażowych.
Twoim absolutnym priorytetem jest znalezienie DOKŁADNEGO ADRESU MONTAŻU, aby nawigacja GPS doprowadziła kierowcę prosto do celu.

WYTYCZNE SZCZEGÓŁOWE:

1. ADRES (KRYTYCZNE!):
- Musisz wydobyć PEŁNY adres: Ulica, Numer domu/lokalu, Miasto.
- INTELIGENTNE WYSZUKIWANIE: Jeśli w mailu jest nazwa obiektu (np. "CH Promenada", "Galeria Mokotów", "Szpital Bródnowski"), UŻYJ SWOJEJ WIEDZY, aby wpisać dokładny adres tego miejsca w Warszawie (np. dla Promenady wpisz: "ul. Ostrobramska 75C, Warszawa"). Nie pytaj - wpisz najbardziej prawdopodobny adres.
- Jeśli jest kilka adresów, wybierz ten, gdzie ma być wykonana usługa.

2. OSOBA KONTAKTOWA I TELEFON:
- Znajdź numer telefonu do osoby, która będzie na miejscu lub koordynuje montaż. Szukaj w stopkach!
- UWAGA: Ignoruj numery firmowe: 888 201 250 oraz 22 213 95 96. To są nasze numery. Jeśli klient podaje swój numer w treści (nawet jeśli piszemy z firmowego), wybierz numer klienta.

3. EMAIL KONTAKTOWY:
- Szukaj adresu email klienta. 
- UWAGA: Ignoruj maile z domen @montazreklam24.pl, @montazreklam24.com oraz @newoffice.pl. To są nasze maile firmowe.
- Szukaj maila klienta w treści wiadomości, jeśli nadawca (From) jest jednym z naszych maili.

4. STRESZCZENIE (scopeWorkText) - BARDZO WAŻNE:
- Nie kopiuj maila! Napisz zwięzłe, żołnierskie streszczenie w punktach.
- Co konkretnie trzeba zrobić? (np. "1. Demontaż starego szyldu. 2. Montaż kasetonu 3x1m. 3. Wyklejenie witryny").
- Wypisz wymiary i materiały, jeśli są podane.
- ANALIZA WĄTKU: Jeśli w treści są starsze wiadomości (historia):
  a) Wyraźnie oddziel nowe zlecenie od starego.
  b) Jeśli widzisz starsze prośby, co do których masz podejrzenie, że zostały już wykonane (bo są z odległą datą lub w wątku dalej jest mowa o fakturze/płatności/montażu), dopisz je na końcu listy z przedrostkiem: "[DO WERYFIKACJI - PRAWDOPODOBNIE WYKONANE]".
  c) Dodaj krótką informację, dlaczego tak uważasz (np. "z maila z dnia 12.10").

5. WYCENA I POZYCJE (quoteItems) - KRYTYCZNE:
- Przeszukaj maila pod kątem kwot za poszczególne usługi.
- Jeśli w mailu wymieniasz np. "Projekt: 200 zł, Montaż: 600 zł", stwórz z tego listę pozycji.
- Jeśli podana jest tylko kwota NETTO, dolicz 23% VAT i oblicz BRUTTO.
- Jeśli podana jest tylko kwota BRUTTO, odejmij VAT (dzieląc przez 1.23) i oblicz NETTO.
- Jeśli nie określono czy netto czy brutto, przyjmij że to NETTO i dolicz 23% VAT.
- Zsumuj wszystkie pozycje i wpisz do pól netAmount i grossAmount w obiekcie payment.

FORMAT (JSON):
{
    "suggestedTitle": "Tytuł zlecenia",
    "address": "Ulica Numer, Miasto (Nazwa Obiektu)",
    "scopeWorkText": "1. ...\n2. ...",
    "phoneNumber": "Numer telefonu",
    "email": "Email klienta",
    "nip": "NIP (jeśli jest)",
    "clientName": "Imię i Nazwisko / Nazwa Firmy",
    "quoteItems": [
        { "name": "Nazwa usługi", "netAmount": 100.00, "grossAmount": 123.00, "vatRate": 23 },
        { "name": "Inna usługa", "netAmount": 200.00, "grossAmount": 246.00, "vatRate": 23 }
    ],
    "payment": {
        "type": "TRANSFER",
        "netAmount": 300.00,
        "grossAmount": 369.00
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
        CURLOPT_TIMEOUT => 120,
        CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false, // Niektóre hostingi nie mają aktualnych certyfikatów CA
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_FOLLOWLOCATION => true
    ));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $curlInfo = curl_getinfo($ch);
    curl_close($ch);
    
    // Debug log
    error_log("Gemini API call - HTTP: {$httpCode}, Error: {$error}, URL: {$url}");
    
    if ($error) {
        error_log('[Gemini] cURL error: ' . $error);
        throw new Exception('cURL error: ' . $error);
    }
    
    error_log('[Gemini] Response HTTP ' . $httpCode . ': ' . substr($response, 0, 500));
    
    if ($httpCode !== 200) {
        $errorData = json_decode($response, true);
        $errorMessage = isset($errorData['error']['message']) ? $errorData['error']['message'] : $response;
        error_log('[Gemini] API Error: ' . $errorMessage);
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



