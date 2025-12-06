/**
 * CRM Gmail Extension - Background Service Worker
 * Obsługuje komunikację z API CRM i Gemini
 */

// Domyślne ustawienia
const DEFAULT_SETTINGS = {
  crmUrl: 'https://montazreklam24.pl/crm',
  crmToken: '',
  geminiApiKey: '',
  autoAnalyze: true
};

// =========================================================================
// KOMUNIKACJA Z CONTENT SCRIPT
// =========================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[CRM BG] Message:', request.action);
  
  switch (request.action) {
    case 'analyzeEmail':
      analyzeEmail(request.data).then(sendResponse);
      return true; // async response
      
    case 'createJob':
      createJobInCRM(request.data).then(sendResponse);
      return true;
      
    case 'searchClient':
      searchClient(request.query).then(sendResponse);
      return true;
      
    case 'createClient':
      createClient(request.data).then(sendResponse);
      return true;
      
    case 'getSettings':
      getSettings().then(sendResponse);
      return true;
      
    case 'saveSettings':
      saveSettings(request.settings).then(sendResponse);
      return true;
      
    case 'testConnection':
      testConnection(request.settings).then(sendResponse);
      return true;
  }
});

// =========================================================================
// ANALIZA EMAILA PRZEZ GEMINI
// =========================================================================

async function analyzeEmail(emailData) {
  const settings = await getSettings();
  
  if (!settings.geminiApiKey) {
    return { success: false, error: 'Brak klucza API Gemini' };
  }
  
  const prompt = `
Jesteś asystentem CRM do wyciągania danych z emaili o zleceniach montażowych reklam.

Przeanalizuj poniższego maila i wyciągnij następujące dane:
- Telefon kontaktowy (telefon, tel, mobile, komórka)
- Email kontaktowy
- Nazwa firmy (jeśli jest)
- NIP (jeśli jest)
- Imię i nazwisko kontaktu
- Adres montażu (ulica, numer, miasto, kod pocztowy, dzielnica)
- Zakres prac (krótki opis co trzeba zrobić)
- Sugerowany tytuł zlecenia (krótki, max 50 znaków)
- Czy jest pilne (true/false)

WAŻNE:
- Szukaj adresów w całej treści maila, nie tylko w podpisie
- Jeśli jest wiele adresów, wybierz adres montażu/dostawy
- Dla Warszawy spróbuj określić dzielnicę na podstawie ulicy
- Numer telefonu formatuj jako: 500 100 200
- NIP formatuj jako: 123-456-78-90

Mail:
---
Od: ${emailData.from}
Temat: ${emailData.subject}
Data: ${emailData.date || ''}

${emailData.body}
---

Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "phone": "...",
  "email": "...",
  "companyName": "...",
  "nip": "...",
  "firstName": "...",
  "lastName": "...",
  "address": {
    "street": "...",
    "buildingNo": "...",
    "apartmentNo": "...",
    "city": "...",
    "postCode": "...",
    "district": "..."
  },
  "scopeOfWork": "...",
  "suggestedTitle": "...",
  "isUrgent": false,
  "confidence": 0.8
}

Jeśli nie znalazłeś danego pola, ustaw null.
Pole "confidence" to Twoja pewność że dobrze wyciągnąłeś dane (0-1).
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024
          }
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[CRM BG] Gemini error:', error);
      return { success: false, error: 'Błąd API Gemini' };
    }
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      return { success: false, error: 'Brak odpowiedzi od Gemini' };
    }
    
    let text = data.candidates[0].content.parts[0].text;
    
    // Usuń markdown jeśli jest
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsed = JSON.parse(text);
    
    return { 
      success: true, 
      data: parsed,
      rawEmail: emailData
    };
    
  } catch (error) {
    console.error('[CRM BG] Analyze error:', error);
    return { success: false, error: error.message };
  }
}

// =========================================================================
// CRM API
// =========================================================================

async function apiRequest(endpoint, method = 'GET', body = null) {
  const settings = await getSettings();
  
  if (!settings.crmUrl || !settings.crmToken) {
    throw new Error('Brak konfiguracji CRM');
  }
  
  const url = settings.crmUrl.replace(/\/$/, '') + '/api/' + endpoint;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + settings.crmToken
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Błąd API');
  }
  
  return data;
}

async function createJobInCRM(jobData) {
  try {
    const result = await apiRequest('jobs', 'POST', {
      jobTitle: jobData.title,
      clientName: jobData.clientName,
      companyName: jobData.companyName,
      contactPerson: jobData.contactPerson,
      phoneNumber: jobData.phone,
      email: jobData.email,
      address: jobData.fullAddress,
      scopeWorkText: jobData.scopeOfWork,
      nip: jobData.nip,
      clientId: jobData.clientId || null,
      gmailThreadId: jobData.threadId || null,
      // Ustaw status na "DO PRZYGOTOWANIA"
      columnId: 'PREPARE'
    });
    
    return { success: true, job: result.job };
    
  } catch (error) {
    console.error('[CRM BG] Create job error:', error);
    return { success: false, error: error.message };
  }
}

async function searchClient(query) {
  try {
    const result = await apiRequest('clients?search=' + encodeURIComponent(query));
    return { success: true, clients: result.clients };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createClient(clientData) {
  try {
    const result = await apiRequest('clients', 'POST', clientData);
    return { success: true, client: result.client };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testConnection(settings) {
  try {
    const url = settings.crmUrl.replace(/\/$/, '') + '/api/ping';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + settings.crmToken
      }
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: 'Nieprawidłowy token' };
    }
  } catch (error) {
    return { success: false, error: 'Nie można połączyć z serwerem' };
  }
}

// =========================================================================
// STORAGE
// =========================================================================

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve(items);
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      resolve({ success: true });
    });
  });
}

// =========================================================================
// INSTALACJA
// =========================================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[CRM] Extension installed');
    
    // Ustaw domyślne ustawienia
    chrome.storage.sync.set(DEFAULT_SETTINGS);
    
    // Otwórz popup z ustawieniami
    chrome.action.openPopup();
  }
});



