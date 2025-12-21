/**
 * CRM Gmail Extension - Background Service Worker
 * Obsługuje komunikację z API CRM i Gemini
 */

// Domyślne ustawienia
const DEFAULT_SETTINGS = {
  crmUrl: 'http://localhost:8080',
  crmToken: '',
  geminiApiKey: '',
  autoAnalyze: true,
  importAttachments: false // Domyślnie WYŁĄCZONE (aby uniknąć problemów z OAuth)
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
// UPLOAD PLIKÓW (Multipart)
// =========================================================================

async function uploadFileToCRM(fileObj) {
    const settings = await getSettings();
    if (!settings.crmUrl || !settings.crmToken) {
        throw new Error('Brak konfiguracji CRM');
    }

    const url = settings.crmUrl.replace(/\/$/, '') + '/api/upload.php';
    
    // Konwertuj Base64 na Blob
    const res = await fetch(fileObj.data);
    const blob = await res.blob();
    
    const formData = new FormData();
    formData.append('file', blob, fileObj.name);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + settings.crmToken
            // Content-Type NIE MOŻE być ustawiony ręcznie przy FormData!
        },
        body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const result = await response.json();
    if (!result.success || !result.url) {
        throw new Error(result.error || 'Unknown upload error');
    }

    return result.url;
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
        // Jeśli to błąd autoryzacji/konta, wyczyść token, żeby wymusić ponowne logowanie
        if (result.error.includes('400') || result.error.includes('401') || result.error.includes('403')) {
            console.warn('[CRM BG] Auth error detected. Clearing cached token to force re-login next time.');
            chrome.identity.removeCachedAuthToken({ token: googleToken }, () => {});
        }
        throw new Error("Import załączników: " + result.error);
    }

    return [];
  } catch (error) {
    console.error('[CRM BG] Attachment import error:', error);
    // Przekaż błąd wyżej, żeby zatrzymać tworzenie zlecenia
    throw error;
  }
}

// =========================================================================
// POBIERANIE Message ID z Thread ID (naprawa błędu 400)
// =========================================================================
async function getRealMessageId(threadIdOrMessageId) {
  // Jeśli ID wygląda na poprawne messageId (krótkie hex), zwróć je
  if (!threadIdOrMessageId || (threadIdOrMessageId.length < 20 && !threadIdOrMessageId.startsWith('FM'))) {
      return threadIdOrMessageId;
  }

  // Jeśli to długie ID (Thread ID lub Legacy), pytamy API o listę wiadomości w wątku
  try {
    const token = await getAuthToken();
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadIdOrMessageId}?format=minimal`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    if (!response.ok) return threadIdOrMessageId; // Fallback
    
    const data = await response.json();
    if (data.messages && data.messages.length > 0) {
        // Zwróć ID ostatniej wiadomości w wątku
        const lastMsg = data.messages[data.messages.length - 1];
        console.log('[CRM BG] Resolved Thread ID', threadIdOrMessageId, 'to Message ID', lastMsg.id);
        return lastMsg.id;
    }
  } catch (e) {
    console.error('[CRM BG] Error resolving thread ID:', e);
  }
  
  return threadIdOrMessageId;
}

async function createJobInCRM(jobData) {
  try {
    const settings = await getSettings();
    let finalMessageId = jobData.gmailMessageId;
    let projectImages = [];
    let attachmentWarning = null;

    // 1. POBIERZ ZAŁĄCZNIKI Z GMAILA (JEŚLI WŁĄCZONE)
    if (settings.importAttachments) {
        if (finalMessageId) {
            finalMessageId = await getRealMessageId(finalMessageId);
        }

        if (finalMessageId) {
          try {
            projectImages = await importAttachments(finalMessageId);
          } catch (importError) {
            console.warn('[CRM BG] Import załączników nie powiódł się, kontynuuję bez nich:', importError.message);
            attachmentWarning = "Załączniki Gmail nie zostały pobrane: " + importError.message;
          }
        } else {
            console.warn('[CRM BG] Brak messageId, pomijam załączniki Gmail');
        }
    }

    // 2. DODAJ RĘCZNE ZAŁĄCZNIKI (MANUAL UPLOAD)
    // TERAZ: Uploadujemy pliki NAJPIERW, i wysyłamy tylko URL-e
    if (jobData.manualAttachments && Array.isArray(jobData.manualAttachments)) {
        console.log('[CRM BG] Uploading manual attachments:', jobData.manualAttachments.length);
        
        const uploadPromises = jobData.manualAttachments
            .filter(file => file.data && file.data.startsWith('data:image'))
            .map(file => uploadFileToCRM(file)
                .catch(err => {
                    console.error('Failed to upload file:', file.name, err);
                    attachmentWarning = (attachmentWarning ? attachmentWarning + "\n" : "") + 
                                      `Nie udało się wgrać ${file.name}: ${err.message}`;
                    return null;
                })
            );
            
        const uploadedUrls = await Promise.all(uploadPromises);
        const validUrls = uploadedUrls.filter(url => url !== null);
        
        projectImages = [...projectImages, ...validUrls];
    }

    // 3. WYŚLIJ DO CRM
    const result = await apiRequest('jobs', 'POST', {
      jobTitle: jobData.title,
      phoneNumber: jobData.phone,
      email: jobData.email,
      address: jobData.fullAddress,
      scopeWorkText: jobData.description,
      
      // Metadane Gmail - wysyłamy poprawne ID
      gmailMessageId: finalMessageId || null,
      
      // Załączniki (teraz tylko URL-e lub ścieżki, nie base64!)
      projectImages: projectImages, 
      
      columnId: 'PREPARE'
    });
    
    return { 
      success: true, 
      job: result.job,
      warning: attachmentWarning 
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
