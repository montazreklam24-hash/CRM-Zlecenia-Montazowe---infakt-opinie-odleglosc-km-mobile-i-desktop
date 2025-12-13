<?php
// Skrypt diagnostyczny do sprawdzania zlecenia "testowe 8"
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/jobs.php'; // Zawiera mapJobToFrontend
require_once __DIR__ . '/api/jobs_simple.php'; // Zawiera mapJobSimpleToFrontend

// Symulacja użytkownika (aby requireAuth nie blokowało)
// W tym środowisku CLI nie ma sesji, więc musimy to ominąć lub wywołać funkcje bezpośrednio
// Użyjemy bezpośredniego dostępu do bazy, aby sprawdzić stan.

echo "🔍 Sprawdzanie zlecenia 'testowe 8' w bazie danych...\n";

try {
    $pdo = getDB();
    
    // 1. Sprawdź jobs_simple
    $stmt = $pdo->prepare("SELECT * FROM jobs_simple WHERE title LIKE ? OR description LIKE ?");
    $stmt->execute(['%testowe 8%', '%testowe 8%']);
    $simpleJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "--------------------------------------------------\n";
    echo "Tabela 'jobs_simple': " . count($simpleJobs) . " wyników\n";
    foreach ($simpleJobs as $job) {
        echo "ID: " . $job['id'] . "\n";
        echo "Title: " . $job['title'] . "\n";
        echo "Column ID: " . $job['column_id'] . "\n";
        echo "Status: " . $job['status'] . "\n";
        echo "Created At: " . $job['created_at'] . "\n";
        echo "--------------------------------------------------\n";
    }
    
    // 2. Sprawdź jobs_ai (dla pewności)
    $stmt = $pdo->prepare("SELECT * FROM jobs_ai WHERE title LIKE ? OR description LIKE ?");
    $stmt->execute(['%testowe 8%', '%testowe 8%']);
    $aiJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Tabela 'jobs_ai': " . count($aiJobs) . " wyników\n";
    foreach ($aiJobs as $job) {
        echo "ID: " . $job['id'] . "\n";
        echo "Title: " . $job['title'] . "\n";
        echo "Column ID: " . $job['column_id'] . "\n";
        echo "--------------------------------------------------\n";
    }
    
} catch (Exception $e) {
    echo "❌ Błąd bazy danych: " . $e->getMessage() . "\n";
}

echo "\n🔍 Testowanie logiki 'jobs-all' (symulacja)...\n";
// Symulujemy to co robi handleJobsAll, ale bez wymogu autoryzacji
$allJobs = [];

// Zlecenia AI
try {
    $stmt = $pdo->query("SELECT * FROM jobs_ai ORDER BY column_order ASC, created_at DESC");
    $jobsAI = $stmt->fetchAll();
    foreach ($jobsAI as $job) {
        $mapped = mapJobToFrontend($job);
        $mapped['type'] = 'ai';
        $allJobs[] = $mapped;
    }
} catch (Exception $e) {}

// Zlecenia Simple
try {
    $stmt = $pdo->query("SELECT * FROM jobs_simple ORDER BY column_order ASC, created_at DESC");
    $jobsSimple = $stmt->fetchAll();
    foreach ($jobsSimple as $job) {
        $mapped = mapJobSimpleToFrontend($job);
        // mapJobSimpleToFrontend dodaje type='simple'
        $allJobs[] = $mapped;
    }
} catch (Exception $e) {}

// Szukamy naszego zlecenia w wynikach
$foundInAll = false;
foreach ($allJobs as $j) {
    if (stripos($j['data']['jobTitle'], 'testowe 8') !== false) {
        $foundInAll = true;
        echo "✅ Zlecenie ZNALEZIONE w wynikach połączonych!\n";
        echo "   ID: " . $j['id'] . "\n";
        echo "   Type: " . $j['type'] . "\n";
        echo "   Column: " . $j['columnId'] . "\n";
        break;
    }
}

if (!$foundInAll) {
    echo "❌ Zlecenie NIE ZNALEZIONE w wynikach połączonych (ale może być w bazie).\n";
}

