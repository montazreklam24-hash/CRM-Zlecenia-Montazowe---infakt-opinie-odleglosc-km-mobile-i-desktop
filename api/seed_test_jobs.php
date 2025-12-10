<?php
/**
 * Skrypt dodający przykładowe zlecenia testowe
 * Uruchom: http://localhost/crm/api/seed_test_jobs.php
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

// Przykładowe dane firm i zleceń
$testJobs = [
    [
        'title' => 'Montaż szyldu podświetlanego LED - Restauracja Bella Italia',
        'client_name' => 'Bella Italia Sp. z o.o.',
        'phone' => '601 234 567',
        'email' => 'marco@bellaitalia.pl',
        'nip' => '5213456789',
        'address' => 'ul. Marszałkowska 123, 00-001 Warszawa',
        'description' => 'Montaż podświetlanego szyldu LED 3x0.8m na fasadzie budynku. Szyld z dibondu z podświetleniem LED od tyłu (halo effect). Konieczne użycie podnośnika koszowego. Podłączenie do istniejącej instalacji elektrycznej.',
        'column_id' => 'MON',
        'value_gross' => 4500.00,
    ],
    [
        'title' => 'Oklejenie witryny folią mrożoną - Kancelaria Prawna',
        'client_name' => 'Kowalski & Partnerzy Kancelaria Prawna',
        'phone' => '602 345 678',
        'email' => 'a.kowalska@kancelaria-kp.pl',
        'nip' => '1234567890',
        'address' => 'ul. Piękna 45/12, 00-672 Warszawa',
        'description' => 'Oklejenie 3 szyb witrynowych folią mrożoną z wyciętym logo firmy. Wymiary: 2x 120x180cm, 1x 80x200cm. Folia typu Oracal 8510 Etched Glass.',
        'column_id' => 'TUE',
        'value_gross' => 1800.00,
    ],
    [
        'title' => 'Kaseton świetlny dwustronny - Apteka Zdrowie',
        'client_name' => 'Apteka Zdrowie Maria Nowak',
        'phone' => '603 456 789',
        'email' => 'apteka.zdrowie@gmail.com',
        'nip' => '9876543210',
        'address' => 'ul. Puławska 256, 02-670 Warszawa',
        'description' => 'Montaż kasetonu świetlnego dwustronnego typu "APTEKA" z zielonym krzyżem LED. Wymiary 60x80cm, mocowanie na wysięgniku 80cm od ściany. Instalacja elektryczna 230V.',
        'column_id' => 'WED',
        'value_gross' => 3200.00,
    ],
    [
        'title' => 'Litery przestrzenne 3D podświetlane - Biuro rachunkowe',
        'client_name' => 'Taxer Biuro Rachunkowe Sp. z o.o.',
        'phone' => '604 567 890',
        'email' => 'biuro@taxer.pl',
        'nip' => '5270123456',
        'address' => 'Al. Jerozolimskie 89/43, 02-001 Warszawa',
        'description' => 'Montaż liter przestrzennych 3D z plexi 20mm, podświetlanych LED od tyłu. Napis "TAXER" - wysokość liter 40cm. Montaż na dystansach 3cm od ściany. Litery w kolorze białym, podświetlenie niebieskie.',
        'column_id' => 'THU',
        'value_gross' => 2800.00,
    ],
    [
        'title' => 'Oklejenie floty 3 samochodów - Firma kurierska',
        'client_name' => 'QuickSend Kurier Sp. z o.o.',
        'phone' => '605 678 901',
        'email' => 't.szybki@quicksend.pl',
        'nip' => '1122334455',
        'address' => 'ul. Logistyczna 15, 05-090 Raszyn',
        'description' => 'Pełne oklejenie 3 samochodów dostawczych (Renault Master) folią polimerową z grafiką firmową. Projekt dostarczony przez klienta. Folia Avery Dennison MPI 1105.',
        'column_id' => 'FRI',
        'value_gross' => 12500.00,
    ],
    [
        'title' => 'Baner mesh wielkoformatowy - Plac budowy',
        'client_name' => 'Budmax Construction S.A.',
        'phone' => '606 789 012',
        'email' => 'k.budowlany@budmax.com.pl',
        'nip' => '5261234567',
        'address' => 'ul. Nowowiejska 10, 02-010 Warszawa',
        'description' => 'Montaż banera mesh 12x4m na ogrodzeniu placu budowy. Baner z oczkami co 50cm. Mocowanie linkami do siatki ogrodzeniowej. Druk jednostronny CMYK.',
        'column_id' => 'PREPARE',
        'value_gross' => 2400.00,
    ],
    [
        'title' => 'Tablica informacyjna z dibondu - Urząd Dzielnicy',
        'client_name' => 'Urząd Dzielnicy Mokotów',
        'phone' => '607 890 123',
        'email' => 'e.urzednik@mokotow.warszawa.pl',
        'nip' => '5252248481',
        'address' => 'ul. Rakowiecka 25, 02-528 Warszawa',
        'description' => 'Montaż tablicy informacyjnej z dibondu 3mm, wymiary 100x70cm. Nadruk UV full color. Montaż na 4 dystansach nierdzewnych. Tablica z informacjami o godzinach pracy urzędu.',
        'column_id' => 'COMPLETED',
        'value_gross' => 850.00,
    ],
    [
        'title' => 'Reklama świetlna na dachu - Hotel Panorama',
        'client_name' => 'Hotel Panorama Warszawa Sp. z o.o.',
        'phone' => '608 901 234',
        'email' => 'recepcja@hotelpanorama.pl',
        'nip' => '7010234567',
        'address' => 'ul. Złota 44, 00-120 Warszawa',
        'description' => 'Montaż wielkogabarytowego neonu LED "HOTEL PANORAMA" na dachu budynku. Wymiary napisu 8x1.2m. Konstrukcja stalowa ocynkowana, litery z aluminium z frontem z plexi i podświetleniem LED. Wymagane pozwolenie na reklamę.',
        'column_id' => 'PREPARE',
        'value_gross' => 45000.00,
    ],
    [
        'title' => 'Potykacz dwustronny A1 - Kwiaciarnia',
        'client_name' => 'Kwiaciarnia "Pod Różą" Halina Kwiatkowska',
        'phone' => '609 012 345',
        'email' => 'kwiaciarnia.podroza@wp.pl',
        'nip' => '8881234567',
        'address' => 'ul. Kwiatowa 8, 00-388 Warszawa',
        'description' => 'Dostawa i złożenie potykacza aluminiowego dwustronnego A1 z nadrukiem. Grafika dwustronna, laminat matowy. Potykacz z profilem klik 32mm.',
        'column_id' => 'MON',
        'value_gross' => 450.00,
    ],
    [
        'title' => 'Kompleksowe oznakowanie biura - Startup IT',
        'client_name' => 'TechFlow Innovations Sp. z o.o.',
        'phone' => '510 123 456',
        'email' => 'jakub@techflow.io',
        'nip' => '5213987654',
        'address' => 'ul. Domaniewska 37, 02-672 Warszawa, Biurowiec Platinium',
        'description' => 'Kompleksowe oznakowanie biura: logo 3D na recepcji (150x50cm), oznakowanie sal konferencyjnych (6 tabliczek), folia mrożona na szklanych ściankach z wyciętymi elementami graficznymi, naklejki kierunkowe na podłogę.',
        'column_id' => 'TUE',
        'value_gross' => 8900.00,
    ],
];

try {
    $pdo = getDB();
    $addedJobs = [];
    
    foreach ($testJobs as $index => $job) {
        // Generuj friendlyId
        $year = date('Y');
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM jobs_ai WHERE friendly_id LIKE '#$year/%'");
        $count = $stmt->fetch()['count'] + 1 + $index;
        $friendlyId = "#$year/" . str_pad($count, 3, '0', STR_PAD_LEFT);
        
        // Wstaw zlecenie do jobs_ai (tabela dla zleceń AI)
        $stmt = $pdo->prepare("
            INSERT INTO jobs_ai (
                friendly_id, title, client_name, phone, email, nip,
                address, description, status, column_id, column_order,
                value_net, value_gross
            ) VALUES (
                :friendly_id, :title, :client_name, :phone, :email, :nip,
                :address, :description, 'NEW', :column_id, :column_order,
                :value_net, :value_gross
            )
        ");
        
        $valueNet = round($job['value_gross'] / 1.23, 2);
        
        $stmt->execute([
            'friendly_id' => $friendlyId,
            'title' => $job['title'],
            'client_name' => $job['client_name'],
            'phone' => $job['phone'],
            'email' => $job['email'],
            'nip' => $job['nip'],
            'address' => $job['address'],
            'description' => $job['description'],
            'column_id' => $job['column_id'],
            'column_order' => $index,
            'value_net' => $valueNet,
            'value_gross' => $job['value_gross'],
        ]);
        
        $addedJobs[] = [
            'id' => $pdo->lastInsertId(),
            'friendlyId' => $friendlyId,
            'title' => $job['title'],
            'client' => $job['client_name'],
        ];
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Dodano ' . count($addedJobs) . ' przykładowych zleceń',
        'jobs' => $addedJobs
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
