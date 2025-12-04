<?php
/**
 * InfaktClient.php - Klient API inFakt dla CRM
 * Kompatybilny z PHP 5.6
 * Wersja dostosowana do uniwersalnych faktur (nie tylko fototapety)
 */

class InfaktClient {
    private $apiKey;
    private $apiUrl;
    private $debug = false;
    
    public function __construct($apiKey, $apiUrl = 'https://api.infakt.pl/v3') {
        $this->apiKey = $apiKey;
        $this->apiUrl = rtrim($apiUrl, '/');
    }
    
    public function setDebug($debug) {
        $this->debug = $debug;
    }
    
    private function log($message) {
        if ($this->debug) {
            error_log('[inFakt] ' . $message);
        }
    }

    /**
     * Wykonaj request do API inFakt
     */
    private function request($method, $endpoint, $data = null) {
        $url = $this->apiUrl . '/' . ltrim($endpoint, '/');
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSLVERSION, 6); // TLS 1.2
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $headers = array(
            'X-inFakt-ApiKey: ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: application/json'
        );
        
        if ($method === 'POST' || $method === 'PUT') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        }
        
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            throw new Exception("cURL Error: " . $error);
        }
        
        $decoded = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $errorMsg = 'HTTP ' . $httpCode;
            if (isset($decoded['error'])) {
                $errorMsg = $decoded['error'];
            } elseif (isset($decoded['errors'])) {
                $errorMsg = is_array($decoded['errors']) ? json_encode($decoded['errors']) : $decoded['errors'];
            } elseif (isset($decoded['message'])) {
                $errorMsg = $decoded['message'];
            }
            $this->log("API Error: $errorMsg | Response: " . substr($response, 0, 500));
            throw new Exception("inFakt API Error: " . $errorMsg);
        }
        
        return $decoded;
    }
    
    // =========================================================================
    // KLIENCI
    // =========================================================================
    
    /**
     * Znajdź klienta po NIP
     */
    public function findClientByNip($nip) {
        $nip = preg_replace('/[^0-9]/', '', $nip);
        if (empty($nip)) return null;
        
        try {
            $result = $this->request('GET', '/clients.json?tax_no=' . urlencode($nip));
            if (isset($result['entities']) && count($result['entities']) > 0) {
                return $result['entities'][0];
            }
        } catch (Exception $e) {
            $this->log("Find by NIP failed: " . $e->getMessage());
        }
        return null;
    }
    
    /**
     * Znajdź klienta po email
     */
    public function findClientByEmail($email) {
        if (empty($email)) return null;
        
        try {
            $result = $this->request('GET', '/clients.json?email=' . urlencode($email));
            if (isset($result['entities']) && count($result['entities']) > 0) {
                return $result['entities'][0];
            }
        } catch (Exception $e) {
            $this->log("Find by email failed: " . $e->getMessage());
        }
        return null;
    }
    
    /**
     * Znajdź lub utwórz klienta
     * @param array $clientData Dane klienta z CRM
     * @return int|null ID klienta w inFakt
     */
    public function findOrCreateClient($clientData) {
        $email = isset($clientData['email']) ? $clientData['email'] : '';
        $nip = isset($clientData['nip']) ? preg_replace('/[^0-9]/', '', $clientData['nip']) : '';
        $isCompany = isset($clientData['type']) && $clientData['type'] === 'company';
        
        // Szukaj po NIP (firmy)
        if (!empty($nip)) {
            $existing = $this->findClientByNip($nip);
            if ($existing) {
                $this->log("Found client by NIP: " . $existing['id']);
                return $existing['id'];
            }
        }
        
        // Szukaj po email (osoby prywatne)
        if (!$isCompany && !empty($email)) {
            $existing = $this->findClientByEmail($email);
            if ($existing) {
                $this->log("Found client by email: " . $existing['id']);
                return $existing['id'];
            }
        }
        
        // Utwórz nowego klienta
        return $this->createClient($clientData);
    }
    
    /**
     * Utwórz nowego klienta w inFakt
     */
    public function createClient($clientData) {
        $isCompany = isset($clientData['type']) && $clientData['type'] === 'company';
        $nip = isset($clientData['nip']) ? preg_replace('/[^0-9]/', '', $clientData['nip']) : null;
        
        // Nazwa firmy lub imię+nazwisko
        $companyName = '';
        if ($isCompany && !empty($clientData['company_name'])) {
            $companyName = $clientData['company_name'];
        } else {
            $firstName = isset($clientData['first_name']) ? $clientData['first_name'] : '';
            $lastName = isset($clientData['last_name']) ? $clientData['last_name'] : '';
            $companyName = trim($firstName . ' ' . $lastName);
        }
        
        $payload = array(
            'client' => array(
                'company_name' => $companyName,
                'first_name' => $isCompany ? '' : (isset($clientData['first_name']) ? $clientData['first_name'] : ''),
                'last_name' => $isCompany ? '' : (isset($clientData['last_name']) ? $clientData['last_name'] : ''),
                'email' => isset($clientData['email']) ? $clientData['email'] : '',
                'phone' => isset($clientData['phone']) ? $clientData['phone'] : '',
                'street' => isset($clientData['street']) ? $clientData['street'] : '',
                'zip_code' => isset($clientData['post_code']) ? $clientData['post_code'] : '',
                'city' => isset($clientData['city']) ? $clientData['city'] : '',
                'nip' => $nip,
                'payment_method' => isset($clientData['payment_method']) ? $clientData['payment_method'] : 'transfer',
            )
        );
        
        $this->log("Creating client: " . json_encode($payload));
        
        $result = $this->request('POST', '/clients.json', $payload);
        return isset($result['id']) ? $result['id'] : null;
    }
    
    /**
     * Aktualizuj klienta w inFakt
     */
    public function updateClient($infaktClientId, $clientData) {
        $isCompany = isset($clientData['type']) && $clientData['type'] === 'company';
        $nip = isset($clientData['nip']) ? preg_replace('/[^0-9]/', '', $clientData['nip']) : null;
        
        $companyName = '';
        if ($isCompany && !empty($clientData['company_name'])) {
            $companyName = $clientData['company_name'];
        } else {
            $firstName = isset($clientData['first_name']) ? $clientData['first_name'] : '';
            $lastName = isset($clientData['last_name']) ? $clientData['last_name'] : '';
            $companyName = trim($firstName . ' ' . $lastName);
        }
        
        $payload = array(
            'client' => array(
                'company_name' => $companyName,
                'first_name' => $isCompany ? '' : (isset($clientData['first_name']) ? $clientData['first_name'] : ''),
                'last_name' => $isCompany ? '' : (isset($clientData['last_name']) ? $clientData['last_name'] : ''),
                'email' => isset($clientData['email']) ? $clientData['email'] : '',
                'phone' => isset($clientData['phone']) ? $clientData['phone'] : '',
                'street' => isset($clientData['street']) ? $clientData['street'] : '',
                'zip_code' => isset($clientData['post_code']) ? $clientData['post_code'] : '',
                'city' => isset($clientData['city']) ? $clientData['city'] : '',
                'nip' => $nip,
            )
        );
        
        try {
            $this->request('PUT', '/clients/' . $infaktClientId . '.json', $payload);
            return true;
        } catch (Exception $e) {
            $this->log("Update client failed: " . $e->getMessage());
            return false;
        }
    }
    
    // =========================================================================
    // FAKTURY
    // =========================================================================
    
    /**
     * Utwórz fakturę/proformę
     * @param int $clientId ID klienta w inFakt
     * @param array $items Pozycje faktury [['name' => '', 'quantity' => 1, 'unit_price_net' => 100.00, 'vat_rate' => 23], ...]
     * @param array $options Opcje: type (vat/proforma), description, due_days, mark_paid, install_address, phone
     * @return array|null Dane utworzonej faktury (id, number)
     */
    public function createInvoice($clientId, $items, $options = array()) {
        $type = isset($options['type']) ? $options['type'] : 'vat';
        $dueDays = isset($options['due_days']) ? intval($options['due_days']) : 7;
        $description = isset($options['description']) ? $options['description'] : '';
        $installAddress = isset($options['install_address']) ? $options['install_address'] : '';
        $phone = isset($options['phone']) ? $options['phone'] : '';
        $markPaid = isset($options['mark_paid']) && $options['mark_paid'];
        
        // Buduj opis
        $descParts = array();
        if (!empty($description)) $descParts[] = $description;
        if (!empty($installAddress)) $descParts[] = 'Adres montażu: ' . $installAddress;
        if (!empty($phone)) $descParts[] = 'Tel. klienta: ' . $phone;
        $finalDescription = implode(' | ', $descParts);
        
        // Buduj pozycje (ceny w groszach!)
        $invoiceItems = array();
        foreach ($items as $item) {
            $netPrice = round(floatval($item['unit_price_net']) * 100); // Konwersja na grosze
            $vatRate = isset($item['vat_rate']) ? strval($item['vat_rate']) : '23';
            
            $invoiceItems[] = array(
                'name' => $item['name'],
                'quantity' => isset($item['quantity']) ? floatval($item['quantity']) : 1,
                'unit_net_price' => $netPrice,
                'tax_symbol' => $vatRate,
            );
        }
        
        $payload = array(
            'invoice' => array(
                'client_id' => intval($clientId),
                'kind' => $type === 'proforma' ? 'proforma' : 'vat',
                'sell_date' => date('Y-m-d'),
                'issue_date' => date('Y-m-d'),
                'payment_type' => 'wire_transfer',
                'payment_to_kind' => 'payment_date',
                'payment_to' => date('Y-m-d', strtotime('+' . $dueDays . ' days')),
                'description' => $finalDescription,
                'services' => $invoiceItems,
            )
        );
        
        if ($markPaid) {
            $payload['invoice']['paid_date'] = date('Y-m-d');
        }
        
        $this->log("Creating invoice: " . json_encode($payload));
        
        $result = $this->request('POST', '/invoices.json', $payload);
        
        if (isset($result['id'])) {
            return array(
                'id' => $result['id'],
                'number' => isset($result['number']) ? $result['number'] : null,
                'kind' => $type,
            );
        }
        
        return null;
    }
    
    /**
     * Pobierz dane faktury
     */
    public function getInvoice($invoiceId) {
        try {
            return $this->request('GET', '/invoices/' . $invoiceId . '.json');
        } catch (Exception $e) {
            $this->log("Get invoice failed: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Oznacz fakturę jako opłaconą
     */
    public function markAsPaid($invoiceId, $paidDate = null) {
        if (!$paidDate) $paidDate = date('Y-m-d');
        
        $payload = array(
            'invoice' => array(
                'paid_date' => $paidDate
            )
        );
        
        try {
            $this->request('PUT', '/invoices/' . $invoiceId . '.json', $payload);
            return true;
        } catch (Exception $e) {
            $this->log("Mark as paid failed: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Utwórz link do udostępniania faktury
     */
    public function createShareLink($invoiceId) {
        try {
            $result = $this->request('POST', '/invoices/' . $invoiceId . '/share_links.json');
            return isset($result['share_link']) ? $result['share_link'] : null;
        } catch (Exception $e) {
            $this->log("Create share link failed: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Pobierz PDF faktury
     * @return string|null Dane binarne PDF
     */
    public function getInvoicePdf($invoiceId) {
        $url = $this->apiUrl . '/invoices/' . $invoiceId . '/pdf.json?document_type=original';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSLVERSION, 6);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'X-inFakt-ApiKey: ' . $this->apiKey,
            'Accept: application/pdf'
        ));
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);
        
        if ($httpCode === 200 && strpos($contentType, 'pdf') !== false) {
            return $response;
        }
        
        $this->log("PDF download failed: HTTP $httpCode");
        return null;
    }
    
    /**
     * Wyślij fakturę emailem (przez inFakt)
     */
    public function sendInvoiceByEmail($invoiceId, $email) {
        $payload = array(
            'print_type' => 'original',
            'email' => $email
        );
        
        try {
            $this->request('POST', '/invoices/' . $invoiceId . '/deliver_via_email.json', $payload);
            return true;
        } catch (Exception $e) {
            $this->log("Send email failed: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Lista faktur
     */
    public function getInvoices($params = array()) {
        $query = http_build_query($params);
        $endpoint = '/invoices.json' . ($query ? '?' . $query : '');
        
        try {
            $result = $this->request('GET', $endpoint);
            return isset($result['entities']) ? $result['entities'] : array();
        } catch (Exception $e) {
            $this->log("Get invoices failed: " . $e->getMessage());
            return array();
        }
    }
}

