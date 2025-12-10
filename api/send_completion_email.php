<?php
/**
 * API: Wysyłka emaila z prośbą o opinię
 * 
 * Wysyła piękny email HTML z:
 * - Podziękowaniem za montaż
 * - Linkiem do wystawienia opinii Google
 * - Załącznikiem ze zdjęciem z realizacji
 * 
 * POST /api/send_completion_email.php
 * {
 *   "job_id": "123",
 *   "job_title": "Montaż kasetonu",
 *   "to_email": "klient@firma.pl",
 *   "completion_image": "data:image/jpeg;base64,...",
 *   "completion_notes": "Uwagi..."
 * }
 */

require_once __DIR__ . '/config.php';

handleCORS();

// Tylko POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Metoda niedozwolona'], 405);
}

$input = getJsonInput();

// Walidacja
$required = ['job_id', 'job_title', 'to_email'];
foreach ($required as $field) {
    if (empty($input[$field])) {
        jsonResponse(['error' => "Brak wymaganego pola: $field"], 400);
    }
}

$jobId = $input['job_id'];
$jobTitle = $input['job_title'];
$toEmail = $input['to_email'];
$completionImage = isset($input['completion_image']) ? $input['completion_image'] : null;
$completionNotes = isset($input['completion_notes']) ? $input['completion_notes'] : '';

// Walidacja email
if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Nieprawidłowy adres email'], 400);
}

// Link do wizytówki Google
$googleReviewUrl = 'https://g.page/r/CS69RHgLcp94EB0/review';

// Generuj treść HTML
$htmlContent = generateEmailHtml($jobTitle, $googleReviewUrl, $completionNotes);

// Przygotuj email
$subject = "=?UTF-8?B?" . base64_encode("Realizacja montażu - $jobTitle") . "?=";
$fromEmail = "montazreklam24@gmail.com";
$fromName = "Montaż Reklam 24";

// Boundary dla multipart
$boundary = md5(time());

// Nagłówki
$headers = array();
$headers[] = "From: =?UTF-8?B?" . base64_encode($fromName) . "?= <$fromEmail>";
$headers[] = "Reply-To: $fromEmail";
$headers[] = "MIME-Version: 1.0";
$headers[] = "X-Mailer: CRM Montaz Reklam 24";

// Jeśli mamy załącznik - multipart/mixed
if ($completionImage && strpos($completionImage, 'data:image') === 0) {
    $headers[] = "Content-Type: multipart/mixed; boundary=\"$boundary\"";
    
    // Treść emaila
    $body = "--$boundary\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($htmlContent)) . "\r\n";
    
    // Załącznik - zdjęcie
    $body .= "--$boundary\r\n";
    
    // Wyciągnij typ i dane base64
    if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $completionImage, $matches)) {
        $imageType = $matches[1];
        $imageData = $matches[2];
        $filename = "realizacja_$jobId.$imageType";
        
        $body .= "Content-Type: image/$imageType; name=\"$filename\"\r\n";
        $body .= "Content-Disposition: attachment; filename=\"$filename\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= chunk_split($imageData) . "\r\n";
    }
    
    $body .= "--$boundary--";
} else {
    // Bez załącznika - prosty HTML
    $headers[] = "Content-Type: text/html; charset=UTF-8";
    $body = $htmlContent;
}

// Wyślij email
$headersStr = implode("\r\n", $headers);
$result = @mail($toEmail, $subject, $body, $headersStr);

if ($result) {
    // Zapisz info do bazy (opcjonalnie)
    try {
        $pdo = getDB();
        
        // Sprawdź czy to jobs_ai czy jobs_simple
        $stmt = $pdo->prepare("SELECT id FROM jobs_ai WHERE id = ?");
        $stmt->execute(array($jobId));
        $isAiJob = $stmt->fetch();
        
        $table = $isAiJob ? 'jobs_ai' : 'jobs_simple';
        
        // Aktualizuj rekord
        $stmt = $pdo->prepare("
            UPDATE $table 
            SET review_request_sent_at = NOW(),
                review_request_email = ?
            WHERE id = ?
        ");
        $stmt->execute(array($toEmail, $jobId));
        
    } catch (Exception $e) {
        // Loguj błąd ale nie przerywaj - mail został wysłany
        error_log("Błąd zapisu review_request: " . $e->getMessage());
    }
    
    jsonResponse([
        'success' => true,
        'message' => "Email wysłany do: $toEmail"
    ]);
} else {
    // Pobierz błąd
    $error = error_get_last();
    error_log("Błąd wysyłki email: " . json_encode($error));
    
    jsonResponse([
        'success' => false,
        'error' => 'Nie udało się wysłać emaila. Sprawdź konfigurację serwera.',
        'details' => $error ? $error['message'] : 'Brak szczegółów'
    ], 500);
}

/**
 * Generuj piękny HTML emaila
 */
function generateEmailHtml($jobTitle, $googleReviewUrl, $notes = '') {
    $notesSection = '';
    if (!empty($notes)) {
        $notesSection = "
        <div style='background:#f8f9fa; padding:15px; border-radius:8px; margin:20px 0; border-left:4px solid #28a745;'>
            <strong>📝 Informacja od ekipy:</strong><br>
            " . nl2br(htmlspecialchars($notes)) . "
        </div>";
    }
    
    return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>
    
    <div style='text-align: center; margin-bottom: 30px;'>
        <h1 style='color: #28a745; margin: 0;'>✅ Montaż zakończony!</h1>
        <p style='color: #666; font-size: 14px;'>$jobTitle</p>
    </div>
    
    <p>Dzień dobry,</p>
    
    <p>Dziękujemy za skorzystanie z usług <strong>Montaż Reklam 24</strong>! 🙏</p>
    
    $notesSection
    
    <p>Czy mogę mieć do Państwa <strong>małą prośbę</strong> o pozostawienie pozytywnej opinii w Google?</p>
    
    <p>Będzie mi bardzo miło – każda opinia wiele nam daje 😊</p>
    
    <p>Jeśli dodadzą Państwo także zdjęcia z realizacji, będzie to dodatkowa forma reklamy także Państwa lokalu lub marki.</p>
    
    <div style='text-align: center; margin: 30px 0;'>
        <a href='$googleReviewUrl' 
           style='display: inline-block; background: #4285f4; color: white; padding: 15px 40px; 
                  text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px;
                  box-shadow: 0 4px 15px rgba(66,133,244,0.3);'>
            ⭐ Wystaw opinię w Google
        </a>
    </div>
    
    <p style='font-size: 14px; color: #666;'>
        Oczywiście każda opinia, nawet bez zdjęć, jest dla nas cenna.
    </p>
    
    <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
    
    <p>Jeśli mają Państwo ochotę, zapraszam także do obserwowania naszych profili:</p>
    
    <p style='font-size: 14px;'>
        📸 <a href='https://www.instagram.com/montazreklam24/' style='color: #E4405F;'>Instagram</a> &nbsp;|&nbsp;
        📘 <a href='https://www.facebook.com/montazreklam24' style='color: #1877F2;'>Facebook</a>
    </p>
    
    <p style='margin-top: 30px;'>
        Dziękuję za pomoc – bardzo nam to pomaga rozwijać firmę i docierać do nowych Klientów.
    </p>
    
    <p>Serdecznie pozdrawiam,<br>
    <strong>Zespół Montaż Reklam 24</strong></p>
    
    <div style='margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;'>
        <p>
            Montaż Reklam 24<br>
            📞 +48 123 456 789 | 📧 kontakt@montazreklam24.pl<br>
            🌐 www.montazreklam24.pl
        </p>
    </div>
    
</body>
</html>";
}
?>

