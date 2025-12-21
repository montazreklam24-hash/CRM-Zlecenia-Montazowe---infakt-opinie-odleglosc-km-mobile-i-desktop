<?php
// fix_db_data.php
header('Content-Type: text/plain; charset=utf-8');

// Use Docker default credentials
$host = 'db'; 
$db = 'crm_db';
$user = 'crm_user';
$pass = 'crm_password';
$charset = 'utf8mb4';

echo "Connecting to DB...\n";
try {
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}

// Dictionary of manual fixes based on observations
// Pattern: "Word with ??" => "Correct Word"
// We use SQL LIKE to match.
$fixes = [
    // Cities / Places
    ['??ytnia', 'Żytnia'],
    ['????d??', 'Łódź'],
    ['Mi??sk', 'Mińsk'],
    ['J??drzej??w', 'Jędrzejów'],
    ['Szwole??er??w', 'Szwoleżerów'],
    ['K??odzko', 'Kłodzko'],
    ['G??ra', 'Góra'],
    ['??wi??tokrzyska', 'Świętokrzyska'],
    
    // Common words
    ['samoch??d', 'samochód'],
    ['Fiko??ek', 'Fikołek'],
    ['Zwi??zek', 'Związek'],
    ['Pracodawc??w', 'Pracodawców'],
    ['mro??ona', 'mrożona'],
    ['Mro??onki', 'Mrożonki'],
    ['Nie??wieska', 'Niedźwiedzka'], // Guessing common street
    ['Micha??owicza', 'Michałowicza'],
    ['mro??onki', 'mrożonki'],
    ['map??', 'mapę'],
    ['??wiata', 'świata'],
    ['Zaj??c', 'Zając'],
    ['Sprawiedliwo??ci', 'Sprawiedliwości'],
    ['Pruszk??w', 'Pruszków'],
    ['??w.', 'św.'],
    ['bia??ych', 'białych'],
    ['Wo??oska', 'Wołoska'],
    ['Pu??awska', 'Puławska'],
    ['Paw??a', 'Pawła'],
    ['wyci??tymi', 'wyciętymi'],
    ['pi??tro', 'piętro'],
    ['szk??o', 'szkło'],
    ['bia??a', 'biała'],
    ['czarni??', 'czarną'],
    ['du??y', 'duży'],
    ['du??a', 'duża'],
    ['ma??y', 'mały'],
    ['ma??a', 'mała'],
    ['??aden', 'Żaden'],
    ['??adna', 'Żadna'],
    ['??adne', 'Żadne'],
    ['??oliborz', 'Żoliborz'],
    ['Wola', 'Wola'],
    ['Mokot??w', 'Mokotów'],
    ['Bia??o????ka', 'Białołęka'],
    ['Targ??wek', 'Targówek'],
    ['Wawer', 'Wawer'],
    ['Ursyn??w', 'Ursynów'],
    ['Bemowo', 'Bemowo'],
    ['Wilan??w', 'Wilanów'],
    ['W??ochy', 'Włochy'],
    ['Rembert??w', 'Rembertów'],
    ['Weso??a', 'Wesoła'],
    ['Praga P????noc', 'Praga Północ'],
    ['Praga Po??udnie', 'Praga Południe'],
    ['Ursus', 'Ursus'],
    ['Bielany', 'Bielany'],
    ['Ochota', 'Ochota'],
    ['??r??dmie??cie', 'Śródmieście'],
    
    // Actions
    ['odda??', 'oddać'],
    ['zrob??', 'zrobić'],
    ['monta??', 'montaż'],
    ['demonta??', 'demontaż'],
    ['wyklejenie', 'wyklejenie'],
    
    // General
    ['kaseton??w', 'kasetonów'],
    ['szyld??w', 'szyldów'],
    ['foli??', 'folią'],
    ['oklej??', 'okleję'],
    ['b??dzie', 'będzie'],
    ['mog??', 'mogę'],
    ['si??', 'się'],
    ['prosz??', 'proszę'],
    ['dla', 'dla'],
];

echo "Applying fixes...\n";
$count = 0;

foreach ($fixes as $fix) {
    list($bad, $good) = $fix;
    
    // Check titles
    $sql = "UPDATE jobs_ai SET title = REPLACE(title, ?, ?) WHERE title LIKE ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$bad, $good, "%$bad%"]);
    $c = $stmt->rowCount();
    if ($c > 0) {
        echo "Fixed '$bad' -> '$good' in $c titles\n";
        $count += $c;
    }

    // Check addresses
    $sql = "UPDATE jobs_ai SET address = REPLACE(address, ?, ?) WHERE address LIKE ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$bad, $good, "%$bad%"]);
    $c = $stmt->rowCount();
    if ($c > 0) {
        echo "Fixed '$bad' -> '$good' in $c addresses\n";
        $count += $c;
    }
    
    // Check descriptions
    $sql = "UPDATE jobs_ai SET description = REPLACE(description, ?, ?) WHERE description LIKE ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$bad, $good, "%$bad%"]);
    $c = $stmt->rowCount();
    if ($c > 0) {
        echo "Fixed '$bad' -> '$good' in $c descriptions\n";
        $count += $c;
    }
}

echo "Done. Total modifications: $count\n";

// Generic "double question mark" check
$stmt = $pdo->query("SELECT COUNT(*) FROM jobs_ai WHERE title LIKE '%??%' OR address LIKE '%??%'");
$remaining = $stmt->fetchColumn();
if ($remaining > 0) {
    echo "\nWARNING: There are still $remaining records with '??'. These need manual fixing or more rules.\n";
    
    $stmt = $pdo->query("SELECT id, title, address FROM jobs_ai WHERE title LIKE '%??%' OR address LIKE '%??%' LIMIT 10");
    foreach ($stmt->fetchAll() as $row) {
        echo " - [{$row['id']}] {$row['title']} | {$row['address']}\n";
    }
}
