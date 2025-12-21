<?php
/**
 * Import wiadomości z Gmaila (wraz z załącznikami)
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/images.php'; // Do obsługi zapisywania plików

// Nagłówki CORS i JSON
header('Content-Type: application/json');
// header("Access-Control-Allow-Origin: *"); // handleCORS() w config.php robi to via Apache
handleCORS();

// DEBUG LOGGING
function debugImport($msg) {
    file_put_contents(__DIR__ . '/logs/debug_import.log', date('Y-m-d H:i:s') . " | " . $msg . "\n", FILE_APPEND);
}

// Funkcja pomocnicza do pobierania danych z API Google
function googleApiGet($url, $token) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $token",
        "Accept: application/json"
    ]);
    // Ignoruj weryfikację SSL (dla pewności na localhoście)
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        throw new Exception("cURL Error: $error");
    }
    
    if ($httpCode !== 200) {
        // Spróbuj odczytać błąd z JSONa
        $errData = json_decode($response, true);
        $errMsg = isset($errData['error']['message']) ? $errData['error']['message'] : $response;
        throw new Exception("Google API Error ($httpCode): $errMsg");
    }
    
    return json_decode($response, true);
}

// Funkcja rekurencyjna do wyciągania załączników z zagnieżdżonych "parts"
function extractAttachments($parts, &$attachments) {
    if (!is_array($parts)) return;
    
    foreach ($parts as $part) {
        if (isset($part['filename']) && !empty($part['filename']) && isset($part['body']['attachmentId'])) {
            // To jest załącznik
            $attachments[] = [
                'id' => $part['body']['attachmentId'],
                'filename' => $part['filename'],
                'mimeType' => $part['mimeType'],
                'size' => $part['body']['size']
            ];
        }
        
        // Rekurencja dla zagnieżdżonych części (np. multipart/alternative)
        if (isset($part['parts'])) {
            extractAttachments($part['parts'], $attachments);
        }
    }
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    debugImport("START IMPORT. Input: " . print_r($input, true));
    
    if (!isset($input['messageId']) || !isset($input['token'])) {
        throw new Exception('Brak messageId lub tokenu');
    }
    
    $messageId = trim($input['messageId']);
    $token = trim($input['token']);
    
    // 1. Sprawdź czy to nie jest Thread ID / Legacy ID (długie, > 20 znaków)
    // Jeśli tak, spróbuj najpierw pobrać listę wiadomości w wątku
    if (strlen($messageId) > 20 || substr($messageId, 0, 2) === 'FM') {
        debugImport("Detected potential Thread/Legacy ID: $messageId. Trying to resolve via threads.get...");
        try {
            $threadData = googleApiGet(
                "https://gmail.googleapis.com/gmail/v1/users/me/threads/$messageId?format=minimal",
                $token
            );
            if (isset($threadData['messages']) && count($threadData['messages']) > 0) {
                // Weź ostatnią wiadomość
                $lastMsg = end($threadData['messages']);
                $newMessageId = $lastMsg['id'];
                debugImport("Resolved Thread ID to Message ID: $newMessageId");
                $messageId = $newMessageId;
            }
        } catch (Exception $threadEx) {
            debugImport("Failed to resolve Thread ID: " . $threadEx->getMessage() . ". Proceeding with original ID.");
            // Ignoruj błąd, spróbuj użyć oryginalnego ID
        }
    }

    // 2. Pobierz szczegóły wiadomości
    debugImport("Fetching message details for ID: $messageId");
    $messageData = googleApiGet(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/$messageId",
        $token
    );
    
    // 2. Znajdź załączniki
    $attachments = [];
    if (isset($messageData['payload']['parts'])) {
        extractAttachments($messageData['payload']['parts'], $attachments);
    }
    
    debugImport("Found attachments count: " . count($attachments));
    
    $savedFiles = [];
    
    // 3. Pobierz i zapisz każdy załącznik
    foreach ($attachments as $att) {
        debugImport("Downloading attachment: " . $att['filename'] . " (ID: " . substr($att['id'], 0, 20) . "...)");
        
        $attachmentData = googleApiGet(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/$messageId/attachments/" . $att['id'],
            $token
        );
        
        if (isset($attachmentData['data'])) {
            // Dekodowanie Base64URL (Google używa - i _ zamiast + i /)
            $base64 = str_replace(['-', '_'], ['+', '/'], $attachmentData['data']);
            $fileContent = base64_decode($base64);
            
            if ($fileContent === false) {
                debugImport("Base64 decode failed for: " . $att['filename']);
                continue; // Błąd dekodowania
            }
            
            // Generuj unikalną nazwę pliku
            $extension = pathinfo($att['filename'], PATHINFO_EXTENSION);
            if (empty($extension)) {
                // Zgadnij po mimeType (uproszczone)
                if ($att['mimeType'] === 'application/pdf') $extension = 'pdf';
                elseif ($att['mimeType'] === 'image/jpeg') $extension = 'jpg';
                elseif ($att['mimeType'] === 'image/png') $extension = 'png';
                else $extension = 'bin';
            }
            
            // Bezpieczna nazwa pliku (tylko alfanumeryczne)
            $safeName = preg_replace('/[^a-z0-9]/i', '_', pathinfo($att['filename'], PATHINFO_FILENAME));
            $fileName = date('Ymd_His') . '_' . $safeName . '.' . $extension;
            
            // Użyj istniejącej stałej UPLOAD_DIR
            // Upewnij się, że katalog istnieje
            if (!is_dir(UPLOAD_DIR)) {
                mkdir(UPLOAD_DIR, 0777, true);
            }
            
            $targetPath = UPLOAD_DIR . '/' . $fileName;
            
            if (file_put_contents($targetPath, $fileContent)) {
                $path = '/uploads/' . $fileName;
                // Zapisz URL do pliku (relatywny dla frontendu)
                $savedFiles[] = [
                    'originalName' => $att['filename'],
                    'path' => $path, // URL
                    'mimeType' => $att['mimeType']
                ];
                debugImport("Saved to: $targetPath");
            } else {
                debugImport("Failed to write to: $targetPath");
            }
        } else {
            debugImport("No data in attachment response for: " . $att['filename']);
        }
    }
    
    debugImport("SUCCESS. Saved files: " . count($savedFiles));
    
    // 4. Zwróć listę zapisanych plików
    echo json_encode([
        'success' => true,
        'messageId' => $messageId,
        'snippet' => isset($messageData['snippet']) ? $messageData['snippet'] : '',
        'attachments' => $savedFiles
    ]);

} catch (Exception $e) {
    debugImport("ERROR: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}


