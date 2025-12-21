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
- Zakres prac (krótki opis co trzeba zrobić - STRESZCZENIE)
- Sugerowany tytuł zlecenia (krótki, max 50 znaków)

WAŻNE:
- Szukaj adresów w całej treści maila, nie tylko w podpisie
- Jeśli jest wiele adresów, wybierz adres montażu/dostawy
- Dla Warszawy spróbuj określić dzielnicę na podstawie ulicy
- Jeśli w mailu jest nazwa obiektu (np. Promenada), znajdź jego adres
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
  "confidence": 0.8
}

Jeśli nie znalazłeś danego pola, ustaw null.
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
    
    // Formatuj adres do stringa
    let fullAddress = '';
    if (parsed.address) {
        const a = parsed.address;
        fullAddress = [a.street ? a.street + (a.buildingNo ? ' ' + a.buildingNo : '') : '', a.postCode, a.city].filter(Boolean).join(', ');
    }
    parsed.address = fullAddress;
    
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

// =========================================================================
// POBIERANIE ZAŁĄCZNIKÓW (OAuth2)
// =========================================================================

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error('Auth error:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError?.message || 'Brak tokena');
      } else {
        resolve(token);
      }
    });
  });
}

async function importAttachments(messageId) {
  try {
    console.log('[CRM BG] Importing attachments for:', messageId);
    const googleToken = await getAuthToken();
    const result = await apiRequest('import_gmail.php', 'POST', {
      messageId: messageId,
      token: googleToken
    });
    
    console.log('[CRM BG] Import result:', result);
    
    if (result.success && result.attachments) {
      // Zwróć ścieżki do plików
      return result.attachments.map(att => att.path); 
    }
    
    // Jeśli import się nie udał (np. błąd API Google), rzuć błąd
    if (result.error) {
        throw new Error("Import załączników: " + result.error);
    }

    return [];
  } catch (error) {
    console.error('[CRM BG] Attachment import error:', error);
    // Przekaż błąd wyżej, żeby zatrzymać tworzenie zlecenia
    throw error;
  }
}

async function createJobInCRM(jobData) {
  try {
    // 1. Pobierz załączniki (jeśli mamy messageId)
    let projectImages = [];
    let attachmentWarning = null;
    
    // Ważne: messageId musi być przekazane z content.js (pobrane z URL)
    if (jobData.gmailMessageId) {
      try {
        projectImages = await importAttachments(jobData.gmailMessageId);
      } catch (importError) {
        // Jeśli import się nie udał (np. brak włączonego Gmail API), 
        // kontynuujemy BEZ załączników ale zapisujemy ostrzeżenie
        console.warn('[CRM BG] Import załączników nie powiódł się, kontynuuję bez nich:', importError.message);
        attachmentWarning = "Załączniki nie zostały zaimportowane: " + importError.message;
        // NIE blokujemy tworzenia zlecenia!
      }
    } else {
        console.warn('[CRM BG] Brak messageId, pomijam załączniki');
    }

    // 2. Wyślij do CRM
    const result = await apiRequest('jobs', 'POST', {
      jobTitle: jobData.title,
      phoneNumber: jobData.phone,
      email: jobData.email,
      address: jobData.fullAddress,
      scopeWorkText: jobData.description,
      
      // Metadane Gmail
      gmailMessageId: jobData.gmailMessageId || null,
      
      // Załączniki (ścieżki)
      projectImages: projectImages, // Backend musi to obsłużyć!
      
      columnId: 'PREPARE'
    });
    
    return { 
      success: true, 
      job: result.job,
      warning: attachmentWarning  // Może być null jeśli wszystko OK
    };
    
  } catch (error) {
    console.error('[CRM BG] Create job error:', error);
    return { success: false, error: error.message };
  }
}

// =========================================================================
// TEST POŁĄCZENIA
// =========================================================================

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
    chrome.storage.sync.set(DEFAULT_SETTINGS);
    chrome.action.openPopup();
  }
});
