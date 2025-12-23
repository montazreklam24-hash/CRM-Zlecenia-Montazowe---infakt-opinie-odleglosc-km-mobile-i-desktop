<?php
/**
 * Narzędzie do wyszukiwania i usuwania duplikatów zleceń
 * Uruchom: GET /api/find_duplicates.php?action=list  - pokaż duplikaty
 *          GET /api/find_duplicates.php?action=fix   - usuń duplikaty (zostaw najstarszy)
 */

require_once __DIR__ . '/config.php';
handleCORS();

$action = isset($_GET['action']) ? $_GET['action'] : 'list';

$pdo = getDB();

// Znajdź duplikaty w jobs_ai
function findDuplicates($pdo, $table) {
    $sql = "
        SELECT id, friendly_id, title, created_at, column_id
        FROM {$table}
        WHERE id IN (
            SELECT id FROM {$table} 
            GROUP BY id 
            HAVING COUNT(*) > 1
        )
        ORDER BY id, created_at ASC
    ";
    
    // Alternatywnie - znajdź zlecenia o tych samych tytułach
    $sqlByTitle = "
        SELECT id, friendly_id, title, created_at, column_id,
               COUNT(*) OVER (PARTITION BY title) as duplicates
        FROM {$table}
        WHERE title IN (
            SELECT title FROM {$table} 
            GROUP BY title 
            HAVING COUNT(*) > 1
        )
        ORDER BY title, created_at ASC
    ";
    
    // Najprostsze - pokaż wszystkie zlecenia posortowane
    $sqlAll = "SELECT id, friendly_id, title, created_at, column_id FROM {$table} ORDER BY created_at DESC";
    
    $stmt = $pdo->query($sqlAll);
    return $stmt->fetchAll();
}

// Znajdź duplikaty friendly_id
function findDuplicateFriendlyIds($pdo, $table) {
    $sql = "
        SELECT friendly_id, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
        FROM {$table}
        GROUP BY friendly_id
        HAVING COUNT(*) > 1
    ";
    
    try {
        $stmt = $pdo->query($sql);
        return $stmt->fetchAll();
    } catch (Exception $e) {
        return array('error' => $e->getMessage());
    }
}

// Główna logika
$result = array(
    'action' => $action,
    'timestamp' => date('Y-m-d H:i:s')
);

// Znajdź duplikaty friendly_id
$result['duplicates_ai'] = findDuplicateFriendlyIds($pdo, 'jobs_ai');
$result['duplicates_simple'] = findDuplicateFriendlyIds($pdo, 'jobs_simple');

// Podsumowanie
$result['summary'] = array(
    'ai_duplicates' => count($result['duplicates_ai']),
    'simple_duplicates' => count($result['duplicates_simple'])
);

if ($action === 'fix' && ($result['summary']['ai_duplicates'] > 0 || $result['summary']['simple_duplicates'] > 0)) {
    $fixed = array();
    
    // Napraw duplikaty w jobs_ai
    foreach ($result['duplicates_ai'] as $dup) {
        $ids = explode(',', $dup['ids']);
        // Zostaw pierwszy (najstarszy), usuń resztę
        $keepId = array_shift($ids);
        
        foreach ($ids as $deleteId) {
            // Przenieś obrazy do zachowanego zlecenia? Nie - po prostu usuń
            $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND job_type = ?')->execute(array($deleteId, 'ai'));
            $pdo->prepare('DELETE FROM jobs_ai WHERE id = ?')->execute(array($deleteId));
            $fixed[] = array('table' => 'jobs_ai', 'deleted_id' => $deleteId, 'kept_id' => $keepId);
        }
    }
    
    // Napraw duplikaty w jobs_simple
    foreach ($result['duplicates_simple'] as $dup) {
        $ids = explode(',', $dup['ids']);
        $keepId = array_shift($ids);
        
        foreach ($ids as $deleteId) {
            $pdo->prepare('DELETE FROM job_images WHERE job_id = ? AND job_type = ?')->execute(array($deleteId, 'simple'));
            $pdo->prepare('DELETE FROM jobs_simple WHERE id = ?')->execute(array($deleteId));
            $fixed[] = array('table' => 'jobs_simple', 'deleted_id' => $deleteId, 'kept_id' => $keepId);
        }
    }
    
    $result['fixed'] = $fixed;
    $result['message'] = 'Usunięto ' . count($fixed) . ' duplikatów';
}

header('Content-Type: application/json');
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

















