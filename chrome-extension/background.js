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
// DEBUG LOGGING
// =========================================================================

const MAX_LOG_ENTRIES = 50;

async function logDebug(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level, // 'info', 'warn', 'error'
    category, // 'oauth', 'import', 'api', etc.
    message,
    data: data ? JSON.stringify(data) : null
  };
  
  // Log do console
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[consoleMethod](`[CRM BG ${category}]`, message, data || '');
  
  // Zapisz do storage
  try {
    const result = await chrome.storage.local.get(['debugLogs']);
    const logs = result.debugLogs || [];
    logs.push(logEntry);
    
    // Zachowaj tylko ostatnie MAX_LOG_ENTRIES wpisów
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    }
    
    await chrome.storage.local.set({ debugLogs: logs });
  } catch (e) {
    console.error('[CRM BG] Failed to save debug log:', e);
  }
}

async function getDebugLogs() {
  const result = await chrome.storage.local.get(['debugLogs']);
  return result.debugLogs || [];
}

async function clearDebugLogs() {
  await chrome.storage.local.set({ debugLogs: [] });
}

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
      
    case 'testGmailConnection':
      testGmailConnection().then(sendResponse);
      return true;
      
    case 'getDebugLogs':
      getDebugLogs().then(sendResponse);
      return true;
      
    case 'clearDebugLogs':
      clearDebugLogs().then(() => sendResponse({ success: true }));
      return true;
  }
});

// =========================================================================
// ANALIZA EMAILA PRZEZ GEMINI
// =========================================================================

// Funkcja pomocnicza do wyciągania telefonu z tekstu (fallback)
function extractPhoneFromText(text) {
  if (!text) return null;
  
  // Wzorce dla polskich numerów telefonów
  const patterns = [
    // +48 500 123 456, +48500123456, 0048 500 123 456
    /(?:\+48|0048)?\s*(\d{3}[\s\-]?\d{3}[\s\-]?\d{3})/g,
    // (500) 123-456, 500-123-456, 500 123 456
    /\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{3})/g,
    // tel. 500123456, telefon: 500123456, tel: 500123456
    /tel[\.:]?\s*(\d{9}|\d{3}[\s\-]?\d{3}[\s\-]?\d{3})/gi,
    // 9 cyfr pod rząd (polski numer)
    /\b(\d{9})\b/g
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Weź pierwszy znaleziony numer
      let phone = matches[0].replace(/[^\d]/g, '');
      // Jeśli zaczyna się od 48 lub 0048, usuń prefix
      if (phone.startsWith('48') && phone.length === 11) {
        phone = phone.substring(2);
      }
      // Jeśli ma 9 cyfr, zwróć
      if (phone.length === 9) {
        return phone.match(/.{1,3}/g).join(' ');
      }
    }
  }
  
  return null;
}

async function analyzeEmail(emailData) {
  const settings = await getSettings();
  
  if (!settings.geminiApiKey) {
    return { success: false, error: 'Brak klucza API Gemini' };
  }
  
  const prompt = `
Jesteś asystentem CRM do wyciągania danych z emaili o zleceniach montażowych reklam.

Przeanalizuj poniższego maila i wyciągnij następujące dane:
- Telefon kontaktowy (telefon, tel, mobile, komórka) - BARDZO WAŻNE!
- Email kontaktowy
- Nazwa firmy (jeśli jest)
- NIP (jeśli jest)
- Imię i nazwisko kontaktu
- Adres montażu (ulica, numer, miasto, kod pocztowy, dzielnica)
- Zakres prac (krótki opis co trzeba zrobić - STRESZCZENIE)
- Sugerowany tytuł zlecenia (krótki, max 50 znaków)

WAŻNE - TELEFON:
- Szukaj numerów telefonów w CAŁEJ treści maila - w tekście, podpisie, stopce
- Telefon może być w różnych formatach: 500123456, 500-123-456, 500 123 456, +48 500 123 456, (500) 123-456, tel. 500123456, telefon: 500123456
- Polskie numery: 9 cyfr (bez prefiksu kraju) lub z +48/0048
- Formatuj jako: 500 123 456 (tylko cyfry ze spacjami co 3)
- Jeśli jest wiele numerów, wybierz główny kontaktowy (nie faks, nie centrala jeśli jest bezpośredni)
- Szukaj słów kluczowych: telefon, tel., mobile, komórka, kontakt, tel:

WAŻNE - INNE DANE:
- Szukaj adresów w całej treści maila, nie tylko w podpisie
- Jeśli jest wiele adresów, wybierz adres montażu/dostawy
- Dla Warszawy spróbuj określić dzielnicę na podstawie ulicy
- Jeśli w mailu jest nazwa obiektu (np. Promenada), znajdź jego adres
- NIP formatuj jako: 123-456-78-90

Mail:
---
Temat: ${emailData.subject || ''}
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

Jeśli nie znalazłeś danego pola, ustaw null. Dla telefonu - jeśli nie ma numeru, ustaw null (NIE pisz "brak" ani "nie znaleziono").
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
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('[CRM BG] JSON parse error:', e, 'Text:', text);
      return { success: false, error: 'Błąd parsowania odpowiedzi AI' };
    }
    
    // Fallback: jeśli Gemini nie znalazło telefonu, spróbuj wyciągnąć z tekstu
    if (!parsed.phone || parsed.phone === 'null' || parsed.phone === null) {
      const phoneMatch = extractPhoneFromText(emailData.body);
      if (phoneMatch) {
        parsed.phone = phoneMatch;
        console.log('[CRM BG] Phone extracted via fallback:', phoneMatch);
      }
    }
    
    // Formatuj telefon (usuń niepotrzebne znaki, zostaw tylko cyfry i spacje)
    if (parsed.phone && parsed.phone !== 'null') {
      parsed.phone = parsed.phone.replace(/[^\d\s]/g, '').replace(/\s+/g, ' ').trim();
      // Jeśli ma 9 cyfr, sformatuj jako XXX XXX XXX
      const digits = parsed.phone.replace(/\s/g, '');
      if (digits.length === 9) {
        parsed.phone = digits.match(/.{1,3}/g).join(' ');
      }
    }
    
    // Formatuj adres do stringa
    let fullAddress = '';
    if (parsed.address) {
        const a = parsed.address;
        fullAddress = [a.street ? a.street + (a.buildingNo ? ' ' + a.buildingNo : '') : '', a.postCode, a.city].filter(Boolean).join(', ');
    }
    parsed.address = fullAddress;
    
    console.log('[CRM BG] Parsed data:', parsed);
    
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
  await logDebug('info', 'oauth', 'Requesting OAuth token...');
  
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        const error = chrome.runtime.lastError?.message || 'Brak tokena';
        logDebug('error', 'oauth', 'Failed to get OAuth token', { error: chrome.runtime.lastError });
        reject(error);
      } else {
        logDebug('info', 'oauth', 'OAuth token obtained', { tokenLength: token.length, tokenPrefix: token.substring(0, 20) + '...' });
        resolve(token);
      }
    });
  });
}

async function importAttachments(messageId) {
  await logDebug('info', 'import', 'Starting attachment import', { messageId, messageIdLength: messageId?.length });
  
  try {
    const googleToken = await getAuthToken();
    await logDebug('info', 'import', 'Sending import request to API', { messageId, hasToken: !!googleToken });
    
    const result = await apiRequest('import_gmail.php', 'POST', {
      messageId: messageId,
      token: googleToken
    });
    
    await logDebug('info', 'import', 'Import API response received', { 
      success: result.success, 
      attachmentsCount: result.attachments?.length || 0,
      error: result.error || null
    });
    
    if (result.success && result.attachments) {
      const paths = result.attachments.map(att => att.path);
      await logDebug('info', 'import', 'Import successful', { attachmentsCount: paths.length, paths });
      return paths;
    }
    
    // Jeśli import się nie udał (np. błąd API Google), rzuć błąd
    if (result.error) {
        await logDebug('warn', 'import', 'Import failed with error', { error: result.error });
        
        // Jeśli to błąd autoryzacji/konta, wyczyść token, żeby wymusić ponowne logowanie
        if (result.error.includes('400') || result.error.includes('401') || result.error.includes('403')) {
            await logDebug('warn', 'oauth', 'Auth error detected, clearing cached token', { error: result.error });
            chrome.identity.removeCachedAuthToken({ token: googleToken }, () => {
              logDebug('info', 'oauth', 'Cached token cleared');
            });
        }
        throw new Error("Import załączników: " + result.error);
    }

    await logDebug('warn', 'import', 'Import completed but no attachments found');
    return [];
  } catch (error) {
    await logDebug('error', 'import', 'Attachment import error', { 
      message: error.message, 
      stack: error.stack,
      messageId 
    });
    // Przekaż błąd wyżej, żeby zatrzymać tworzenie zlecenia
    throw error;
  }
}

// =========================================================================
// POBIERANIE Message ID z Thread ID (naprawa błędu 400)
// =========================================================================
async function getRealMessageId(threadIdOrMessageId) {
  await logDebug('info', 'messageId', 'Resolving message ID', { 
    inputId: threadIdOrMessageId, 
    inputLength: threadIdOrMessageId?.length,
    looksLikeThreadId: threadIdOrMessageId?.length >= 20 || threadIdOrMessageId?.startsWith('FM')
  });
  
  // Jeśli ID wygląda na poprawne messageId (krótkie hex), zwróć je
  if (!threadIdOrMessageId || (threadIdOrMessageId.length < 20 && !threadIdOrMessageId.startsWith('FM'))) {
      await logDebug('info', 'messageId', 'ID looks like valid Message ID, using as-is');
      return threadIdOrMessageId;
  }

  // Jeśli to długie ID (Thread ID lub Legacy), pytamy API o listę wiadomości w wątku
  try {
    const token = await getAuthToken();
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadIdOrMessageId}?format=minimal`;
    await logDebug('info', 'messageId', 'Fetching thread data from Gmail API', { url });
    
    const response = await fetch(url, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    });
    
    await logDebug('info', 'messageId', 'Gmail API response', { 
      status: response.status, 
      ok: response.ok 
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      await logDebug('warn', 'messageId', 'Failed to resolve thread ID, using original', { 
        status: response.status, 
        error: errorText 
      });
      return threadIdOrMessageId; // Fallback
    }
    
    const data = await response.json();
    if (data.messages && data.messages.length > 0) {
        // Zwróć ID ostatniej wiadomości w wątku
        const lastMsg = data.messages[data.messages.length - 1];
        await logDebug('info', 'messageId', 'Thread ID resolved to Message ID', { 
          threadId: threadIdOrMessageId,
          messageId: lastMsg.id,
          messagesInThread: data.messages.length
        });
        return lastMsg.id;
    }
    
    await logDebug('warn', 'messageId', 'Thread has no messages, using original ID');
  } catch (e) {
    await logDebug('error', 'messageId', 'Error resolving thread ID', { 
      error: e.message, 
      stack: e.stack 
    });
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
        await logDebug('info', 'createJob', 'Import attachments enabled, processing', { 
          hasMessageId: !!finalMessageId,
          messageId: finalMessageId 
        });
        
        if (finalMessageId) {
            finalMessageId = await getRealMessageId(finalMessageId);
        }

        if (finalMessageId) {
          try {
            projectImages = await importAttachments(finalMessageId);
          } catch (importError) {
            await logDebug('warn', 'createJob', 'Import załączników nie powiódł się, kontynuuję bez nich', { 
              error: importError.message 
            });
            attachmentWarning = "Załączniki Gmail nie zostały pobrane: " + importError.message;
          }
        } else {
            await logDebug('warn', 'createJob', 'Brak messageId, pomijam załączniki Gmail');
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

async function testGmailConnection() {
  await logDebug('info', 'test', 'Starting Gmail OAuth connection test');
  
  try {
    // 1. Pobierz token OAuth
    const token = await getAuthToken();
    await logDebug('info', 'test', 'OAuth token obtained for test');
    
    // 2. Testuj połączenie z Gmail API - pobierz profil użytkownika
    const profileUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
    await logDebug('info', 'test', 'Testing Gmail API connection', { url: profileUrl });
    
    const response = await fetch(profileUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    await logDebug('info', 'test', 'Gmail API response received', { 
      status: response.status, 
      ok: response.ok 
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      await logDebug('error', 'test', 'Gmail API test failed', { 
        status: response.status, 
        error: errorText 
      });
      
      // Jeśli błąd autoryzacji, wyczyść token
      if (response.status === 401 || response.status === 403) {
        await logDebug('warn', 'test', 'Clearing invalid token');
        chrome.identity.removeCachedAuthToken({ token }, () => {});
      }
      
      return { 
        success: false, 
        error: `Gmail API error (${response.status}): ${errorText.substring(0, 100)}` 
      };
    }
    
    const profile = await response.json();
    await logDebug('info', 'test', 'Gmail API test successful', { 
      emailAddress: profile.emailAddress 
    });
    
    return { 
      success: true, 
      emailAddress: profile.emailAddress 
    };
    
  } catch (error) {
    await logDebug('error', 'test', 'Gmail connection test error', { 
      message: error.message, 
      stack: error.stack 
    });
    return { 
      success: false, 
      error: error.message 
    };
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
