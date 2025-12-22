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
  importAttachments: true // Domyślnie WŁĄCZONE (naprawa pobierania)
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

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('[CRM BG] Message:', request.action);
  
  switch (request.action) {
    case 'analyzeEmail':
      analyzeEmail(request.data)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // async response
      
    case 'createJob':
      createJobInCRM(request.data)
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, error: err.message }));
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
      clearDebugLogs().then(function() { sendResponse({ success: true }); });
      return true;
      
    case 'testGmailMessage':
      testGmailMessage(request.messageId)
        .then(function(result) {
          console.log('[CRM BG] testGmailMessage result:', result);
          sendResponse(result || { success: false, error: 'Brak odpowiedzi z funkcji' });
        })
        .catch(function(error) {
          console.error('[CRM BG] testGmailMessage error:', error);
          sendResponse({ success: false, error: error.message || 'Nieznany błąd' });
        });
      return true; // async response

    case 'lookupGus':
      lookupGusInCRM(request.nip).then(sendResponse);
      return true;

    case 'getGmailAttachments':
      getGmailAttachments(request.messageId).then(sendResponse);
      return true;

    case 'getAttachmentData':
      getAttachmentData(request.messageId, request.attachmentId).then(sendResponse);
      return true;
  }
  return false;
});

// =========================================================================
// ANALIZA EMAILA PRZEZ GEMINI
// =========================================================================

// Funkcja pomocnicza do pobierania pełnej treści wątku
async function getFullThreadContent(messageId) {
    if (!messageId) return '';
    try {
        const token = await getAuthToken();
        const realId = await getRealMessageId(messageId);
        
        // 1. Pobierz ID wątku
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${realId}?format=minimal`;
        const msgResp = await fetch(msgUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!msgResp.ok) return '';
        const msgData = await msgResp.json();
        const threadId = msgData.threadId;
        
        if (!threadId) return '';

        // 2. Pobierz cały wątek
        const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;
        const threadResp = await fetch(threadUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!threadResp.ok) return '';
        const threadData = await threadResp.json();
        
        let fullText = '';
        const seenTexts = new Set(); // Żeby nie powielać treści

        // Funkcja do wyciągania tekstu z payloadu
        function extractText(parts) {
            let text = '';
            if (!parts) return '';
            
            if (Array.isArray(parts)) {
                for (const part of parts) {
                    text += extractText(part);
                }
                return text;
            }
            
            if (parts.mimeType === 'text/plain' && parts.body && parts.body.data) {
                try {
                    const decoded = atob(parts.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                    return decoded;
                } catch (e) { return ''; }
            }
            
            if (parts.parts) {
                return extractText(parts.parts);
            }
            
            return '';
        }

        if (threadData.messages) {
            for (const msg of threadData.messages) {
                const text = extractText(msg.payload);
                if (text && text.length > 20) {
                    const cleanText = text.replace(/^>.*$/gm, '').trim(); 
                    if (!seenTexts.has(cleanText)) {
                        fullText += `\n\n--- WIADOMOŚĆ Z DNIA ${new Date(parseInt(msg.internalDate)).toLocaleString()} ---\n${cleanText}`;
                        seenTexts.add(cleanText);
                    }
                }
            }
        }
        
        return fullText;
    } catch (e) {
        console.error('Error fetching thread content:', e);
        return '';
    }
}

const COMPANY_EMAILS = [
  'montazreklam24@gmail.com',
  'montazreklam24@',
  'a.korpalski@',
  'akorpalski@',
  'korpalski@',
  '@montazreklam24.pl',
  '@montazreklam24.com',
  '@newoffice.pl',
  'kontakt@montazreklam24.pl',
  'biuro@montazreklam24.pl',
  'info@montazreklam24.pl'
];

function isCompanyEmail(email) {
  if (!email) return false;
  const emailLower = email.toLowerCase().trim();
  return COMPANY_EMAILS.some(companyEmail => emailLower.includes(companyEmail));
}

function extractPhoneFromText(text) {
  if (!text) return null;
  const CRM_PHONE_PATTERNS = [
    /888[\s\-]?201[\s\-]?250/g,
    /888201250/g,
    /\+48[\s\-]?888[\s\-]?201[\s\-]?250/g,
    /0048[\s\-]?888[\s\-]?201[\s\-]?250/g,
    /22[\s\-]?213[\s\-]?95[\s\-]?96/g,
    /222139596/g
  ];
  
  const hasOnlyCrmPhone = CRM_PHONE_PATTERNS.some(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      const allPhones = text.match(/\d{7,}/g) || [];
      return allPhones.length <= 1;
    }
    return false;
  });
  
  if (hasOnlyCrmPhone) return null;
  
  const patterns = [
    /(?:\+48|0048)?\s*(\d{3}[\s\-]?\d{3}[\s\-]?\d{3})/g,
    /(?:\+48|0048)?\s*(\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/g,
    /(?:\+380|00380|380)?\s*(\d{2}[\s\-]?\d{3}[\s\-]?\d{4})/g,
    /(?:\+49|0049|49)?\s*(\d{2}[\s\-]?\d{6,8})/g,
    /\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{3})/g,
    /tel[\.:]?\s*(\d{9,}|\d{3}[\s\-]?\d{3}[\s\-]?\d{3})/gi,
    /\b(\d{9})\b/g
  ];
  
  const foundPhones = [];
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      let phone = match[0].replace(/[^\d]/g, '');
      if (phone.includes('888201250') || phone === '888201250') continue;
      if (phone.startsWith('48') && phone.length === 11) phone = phone.substring(2);
      if (phone.length >= 7 && phone.length <= 12) foundPhones.push({ cleaned: phone });
    }
  }
  
  const validPhone = foundPhones[0];
  if (!validPhone) return null;
  
  let formatted = validPhone.cleaned;
  if (formatted.length === 9) {
    formatted = formatted.match(/.{1,3}/g).join(' ');
  }
  return formatted;
}

function extractNipFromText(text) {
  if (!text) return null;
  
  // Szukaj ciągów cyfr które mogą być NIP-em (różne formaty)
  // 1. Formaty z myślnikami: 123-456-78-90, 123-45-67-890
  const dashRegex = /\b\d{3}[-\s]\d{2,3}[-\s]\d{2}[-\s]\d{2,3}\b/g;
  const dashMatches = text.match(dashRegex) || [];
  
  for (const match of dashMatches) {
      const cleaned = match.replace(/[^0-9]/g, '');
      if (cleaned.length === 10 && isValidNip(cleaned)) return formatNip(cleaned);
  }
  
  // 2. Szukaj 10 cyfr pod rząd (może być z przedrostkiem NIP)
  const digitRegex = /\b\d{10}\b/g;
  const digitMatches = text.match(digitRegex) || [];
  
  for (const digits of digitMatches) {
      if (isValidNip(digits)) return formatNip(digits);
  }
  
  // 3. Ostateczność: szukaj czegokolwiek po słowie NIP
  const nipPrefixRegex = /(?:NIP|VAT)[\s:.-]*([0-9\-\s]{10,15})/gi;
  const prefixMatches = [...text.matchAll(nipPrefixRegex)];
  for (const match of prefixMatches) {
      const cleaned = match[1].replace(/[^0-9]/g, '');
      if (cleaned.length === 10 && isValidNip(cleaned)) return formatNip(cleaned);
  }
  
  return null;
}

function isValidNip(nip) {
    if (nip.length !== 10) return false;
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(nip[i]) * weights[i];
    return (sum % 11) === parseInt(nip[9]);
}

function formatNip(nip) {
    return nip.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4');
}

async function analyzeEmail(emailData) {
  await logDebug('info', 'analyze', 'Starting email analysis', { messageId: emailData.messageId });
  const settings = await getSettings();
  if (!settings.geminiApiKey) return { success: false, error: 'Brak klucza API Gemini' };
  
  let contextBody = emailData.body;
  if (emailData.messageId) {
      const threadContent = await getFullThreadContent(emailData.messageId);
      if (threadContent) contextBody = emailData.body + "\n\n=== PEŁNA HISTORIA ===\n" + threadContent;
  }
  
  const fromEmail = emailData.fromEmail || emailData.from || null;
  if (fromEmail) {
    await logDebug('info', 'analyze', 'Email from field', { fromEmail, isCompany: isCompanyEmail(fromEmail) });
  }
  
  // Przygotuj części dla Gemini (tekst + obrazy)
  const promptText = `
Jesteś inteligentnym asystentem CRM dla firmy "Montaż Reklam 24". Twoim zadaniem jest analiza treści wiadomości e-mail (lub całych wątków) i wyciągnięcie danych do zlecenia.

KRYTYCZNE ZASADY:
1. TERMINOLOGIA: Jeśli zlecenie dotyczy witryn, szyb, okien – ZAWSZE używaj słowa "oklejanie" lub "oklejenie". NIGDY "montaż witryn".
2. IDENTYFIKACJA KLIENTA: Musisz aktywnie szukać numeru telefonu klienta w całym wątku (również w stopkach).
3. IGNORUJ FIRMĘ: Nigdy nie zwracaj jako danych klienta telefonów firmowych (888 201 250, 22 213 95 96) ani maili firmowych (@montazreklam24.pl, @montazreklam24.com, @newoffice.pl, montazreklam24@gmail.com).
4. ADRESY: 
   - W polu "address" wpisz adres MONTAŻU (gdzie ekipa ma pojechać). 
   - Jeśli w mailu jest inny adres rejestrowy/do faktury, wpisz go w pole "billingAddress".
   - Jeśli jest tylko jeden adres, użyj go w obu miejscach.
5. WĄTKI: Przeszukaj cały wątek, dane klienta często są w pierwszej wiadomości.

ODPOWIEDZ TYLKO CZYSTYM JSONEM:
{
  "phone": "XXX XXX XXX lub null",
  "email": "email klienta lub null",
  "companyName": "nazwa firmy lub null",
  "nip": "NIP lub null",
  "firstName": "imię lub null",
  "lastName": "nazwisko lub null",
  "address": {
    "street": "ulica bez ul.",
    "buildingNo": "nr budynku",
    "apartmentNo": "nr lokalu lub null",
    "city": "miasto",
    "postCode": "kod XX-XXX",
    "district": "dzielnica lub null"
  },
  "billingAddress": {
    "street": "ulica",
    "buildingNo": "nr",
    "city": "miasto",
    "postCode": "kod"
  },
  "scopeOfWork": "szczegółowy opis (używaj 'oklejanie'!), max 500 znaków",
  "suggestedTitle": "tytuł zlecenia",
  "confidence": 0.0-1.0
}

Mail do analizy:
---
${fromEmail ? `Od: ${fromEmail}` : 'Od: (nieznany)'}
Temat: ${emailData.subject || ''}
Data: ${emailData.date || ''}

${contextBody}
---
`;

  const parts = [
    { text: promptText }
  ];
  
  // Dodaj obrazy jeśli są dostępne
  if (emailData.images && emailData.images.length > 0) {
    await logDebug('info', 'analyze', 'Adding images to analysis', { count: emailData.images.length });
    for (const img of emailData.images.slice(0, 4)) { // Max 4 obrazy (limit Gemini)
      if (img.data && img.data.startsWith('data:image')) {
        // Wyciągnij base64 bez prefixu data:image/...
        const base64Data = img.data.split(',')[1];
        const mimeType = img.mimeType || 'image/jpeg';
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
    }
  }

  try {
    // Funkcja pomocnicza do wywołania API Gemini
    const callGemini = async (payloadParts) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${settings.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: payloadParts }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      return response.json();
    };

    let data;
    try {
      await logDebug('info', 'analyze', 'Sending request to Gemini', { 
        partsCount: parts.length,
        hasImages: parts.length > 1
      });
      
      data = await callGemini(parts);
      
    } catch (error) {
      // Jeśli błąd to 400 (Bad Request) i mamy obrazy - spróbuj ponownie BEZ obrazów
      if (parts.length > 1 && error.message.includes('400')) {
        await logDebug('warn', 'analyze', 'Gemini returned 400 with images. Retrying with text only...', { error: error.message });
        
        // Zostaw tylko pierwszą część (tekst)
        const textOnlyParts = [parts[0]];
        // Dodaj notatkę do promptu że obrazów nie udało się przetworzyć
        textOnlyParts[0].text += '\n\n(UWAGA: Analiza obrazów nie powiodła się z powodu błędu API. Przeanalizuj tylko tekst.)';
        
        try {
          data = await callGemini(textOnlyParts);
          await logDebug('info', 'analyze', 'Retry with text only successful');
        } catch (retryError) {
          throw new Error(`Gemini retry failed: ${retryError.message}`);
        }
      } else {
        throw error;
      }
    }
    
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
    
    // KRYTYCZNA ZMIANA: Priorytet dla danych wyciągniętych REGEXEM z tekstu
    // AI (Gemini) ma tendencję do "zmyślania" danych na podstawie nazw firm z bazy wiedzy Google.
    // Dlatego zawsze najpierw ufamy temu, co fizycznie jest napisane w mailu.
    
    const realNip = extractNipFromText(contextBody);
    if (realNip) {
        parsed.nip = realNip;
        await logDebug('info', 'analyze', 'NIP overwritten by regex match', { nip: realNip });
    }

    const realPhone = extractPhoneFromText(contextBody);
    if (realPhone) {
        parsed.phone = realPhone;
        await logDebug('info', 'analyze', 'Phone overwritten by regex match', { phone: realPhone });
    }

    if (parsed.email && isCompanyEmail(parsed.email)) parsed.email = null;
    if (!parsed.email || parsed.email === 'null') {
        const foundEmails = contextBody.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi) || [];
        parsed.email = foundEmails.find(e => !isCompanyEmail(e)) || null;
    }

    // Formatuj adres montażu do stringa
    let fullAddress = '';
    if (parsed.address && typeof parsed.address === 'object') {
        const a = parsed.address;
        fullAddress = [a.street ? a.street + (a.buildingNo ? ' ' + a.buildingNo : '') : '', a.postCode, a.city].filter(Boolean).join(', ');
    } else if (typeof parsed.address === 'string') {
        fullAddress = parsed.address;
    }
    parsed.address = fullAddress;

    // Obsługa adresu do faktury (billingAddress)
    if (parsed.billingAddress && typeof parsed.billingAddress === 'object') {
        const ba = parsed.billingAddress;
        const billingStr = [ba.street ? ba.street + (ba.buildingNo ? ' ' + ba.buildingNo : '') : '', ba.postCode, ba.city].filter(Boolean).join(', ');
        
        // Jeśli adres do faktury jest inny niż adres montażu, dodaj go do zakresu prac/notatek
        if (billingStr && billingStr !== fullAddress) {
            const billingNote = `\n\n--- DANE DO FAKTURY ---\n${parsed.companyName || ''}\nNIP: ${parsed.nip || ''}\n${billingStr}`;
            if (parsed.scopeOfWork) {
                parsed.scopeOfWork += billingNote;
            } else {
                parsed.scopeOfWork = billingNote;
            }
            await logDebug('info', 'analyze', 'Added billing address to scopeOfWork');
        }
    }
    
    // KRYTYCZNE: Popraw tytuł - zamień "montaż witryn" na "oklejanie witryn"
    if (parsed.suggestedTitle && parsed.suggestedTitle.includes('montaż witryn')) {
      parsed.suggestedTitle = parsed.suggestedTitle.replace(/montaż witryn/gi, 'oklejanie witryn');
    }
    if (parsed.scopeOfWork && parsed.scopeOfWork.includes('montaż witryn')) {
      parsed.scopeOfWork = parsed.scopeOfWork.replace(/montaż witryn/gi, 'oklejanie witryn');
    }
    
    await logDebug('info', 'analyze', 'Final parsed data', { 
      phone: parsed.phone,
      email: parsed.email,
      title: parsed.suggestedTitle?.substring(0, 50)
    });
    
    return { success: true, data: parsed };
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

/**
 * Pobiera listę załączników dla danej wiadomości bezpośrednio z Gmail API
 */
async function getAttachmentData(messageId, attachmentId) {
  try {
    const token = await getAuthToken();
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);
    
    const data = await response.json();
    return { success: true, data: data.data }; // Base64url data
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Pobiera listę załączników dla danej wiadomości LUB CAŁEGO WĄTKU bezpośrednio z Gmail API
 */
async function getGmailAttachments(messageId) {
  if (!messageId) {
    await logDebug('warn', 'getAttachments', 'No messageId provided');
    return { success: false, error: 'Brak Message ID' };
  }
  
  await logDebug('info', 'getAttachments', 'Fetching attachments list for thread', { messageId });
  
  try {
    const token = await getAuthToken();
    const realId = await getRealMessageId(messageId);
    
    // 1. Pobierz ID wątku dla tej wiadomości
    const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${realId}?format=minimal`;
    const msgResp = await fetch(msgUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    
    if (!msgResp.ok) throw new Error(`Gmail API error (msg): ${msgResp.status}`);
    const msgData = await msgResp.json();
    const threadId = msgData.threadId;

    if (!threadId) throw new Error('Could not find threadId');

    // 2. Pobierz CAŁY wątek
    const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;
    const threadResp = await fetch(threadUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    
    if (!threadResp.ok) throw new Error(`Gmail API error (thread): ${threadResp.status}`);
    const threadData = await threadResp.json();

    const attachments = [];
    
    function findAttachments(parts, msgId, msgDate) {
      if (!parts) return;
      for (const part of parts) {
        if (part.filename && part.body && (part.body.attachmentId || part.body.data)) {
          attachments.push({
            id: part.body.attachmentId || `inline-${Math.random().toString(36).substr(2, 9)}`,
            messageId: msgId, // WAŻNE: Przypisujemy ID wiadomości do załącznika
            name: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            date: msgDate, // Data wiadomości
            isInline: !!part.headers?.find(h => {
              const name = h.name.toLowerCase();
              return name === 'content-id' || (name === 'content-disposition' && h.value.toLowerCase().includes('inline'));
            })
          });
        }
        if (part.parts) findAttachments(part.parts, msgId, msgDate);
      }
    }
    
    // Iteruj przez wszystkie wiadomości w wątku
    if (threadData.messages && Array.isArray(threadData.messages)) {
        for (const message of threadData.messages) {
            const dateHeader = message.payload.headers.find(h => h.name === 'Date');
            const msgDate = dateHeader ? dateHeader.value : null;

            if (message.payload && message.payload.parts) {
                findAttachments(message.payload.parts, message.id, msgDate);
            } else if (message.payload && message.payload.body && (message.payload.body.attachmentId || message.payload.body.data)) {
                 findAttachments([message.payload], message.id, msgDate);
            }
        }
    }
    
    await logDebug('info', 'getAttachments', 'Found attachments in thread', { count: attachments.length });
    return { success: true, attachments };
  } catch (e) {
    await logDebug('error', 'getAttachments', 'Error fetching attachments', { error: e.message });
    return { success: false, error: e.message };
  }
}

async function importAttachments(attachmentsToImport) {
  if (!Array.isArray(attachmentsToImport)) {
      return []; 
  }

  await logDebug('info', 'import', 'Starting attachment import (multi-message)', { 
    count: attachmentsToImport.length 
  });
  
  try {
    const googleToken = await getAuthToken();
    const resultPaths = [];
    
    const byMessage = {};
    for (const att of attachmentsToImport) {
        if (!byMessage[att.messageId]) byMessage[att.messageId] = [];
        byMessage[att.messageId].push(att.id);
    }

    for (const [msgId, attIds] of Object.entries(byMessage)) {
        await logDebug('info', 'import', `Importing from message ${msgId}`, { ids: attIds });
        
        const result = await apiRequest('import_gmail.php', 'POST', {
            messageId: msgId,
            token: googleToken,
            selectedIds: attIds
        });
        
        if (result.success && result.attachments) {
             const paths = result.attachments.map(att => att.path);
             resultPaths.push(...paths);
        } else {
             await logDebug('warn', 'import', `Failed to import from ${msgId}`, { error: result.error });
        }
    }
    
    return resultPaths;

  } catch (error) {
    await logDebug('error', 'import', 'Attachment import error', { 
      message: error.message, 
      stack: error.stack 
    });
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
    isThreadId: threadIdOrMessageId?.length >= 20 || threadIdOrMessageId?.includes(':') || threadIdOrMessageId?.startsWith('FM')
  });
  
  // Jeśli ID wygląda na poprawne messageId (16 znaków hex), zwróć je
  if (threadIdOrMessageId && /^[a-f0-9]{16}$/.test(threadIdOrMessageId)) {
      await logDebug('info', 'messageId', 'ID is valid Hex Message ID, using as-is');
      return threadIdOrMessageId;
  }

  // Jeśli ID wygląda na dłuższą formę (Thread ID), pytamy API o listę wiadomości w wątku
  try {
    const token = await getAuthToken();
    // Jeśli ID zawiera prefiks typu "thread-f:", użyj tylko części po dwukropku lub wyczyść
    let cleanId = threadIdOrMessageId;
    if (cleanId.includes(':')) {
        cleanId = cleanId.split(':').pop();
    }
    
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${cleanId}?format=minimal`;
    await logDebug('info', 'messageId', 'Fetching thread data from Gmail API', { url });
    
    const response = await fetch(url, { 
      headers: { 'Authorization': `Bearer ${token}` } 
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
        if (jobData.selectedAttachments && jobData.selectedAttachments.length > 0) {
            try {
                const importedFiles = await importAttachments(jobData.selectedAttachments);
                if (importedFiles.length > 0) {
                    projectImages = importedFiles;
                }
            } catch (e) {
                attachmentWarning = "Błąd importu załączników: " + e.message;
            }
        } 
    }

    // 2. DODAJ RĘCZNE ZAŁĄCZNIKI (MANUAL UPLOAD)
    if (jobData.manualAttachments && Array.isArray(jobData.manualAttachments)) {
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
      gmailMessageId: finalMessageId || null,
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

async function lookupGusInCRM(nip) {
  try {
    const settings = await getSettings();
    const url = settings.crmUrl.replace(/\/$/, '') + '/api/gus/nip/' + nip;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + settings.crmToken,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    if (response.ok) {
      return { success: true, company: data.company };
    } else {
      return { success: false, error: data.error || 'Nie znaleziono firmy' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testGmailConnection() {
  try {
    const token = await getAuthToken();
    const profileUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
    const response = await fetch(profileUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        chrome.identity.removeCachedAuthToken({ token }, () => {});
      }
      return { success: false, error: `Gmail API error (${response.status})` };
    }
    
    const profile = await response.json();
    return { success: true, emailAddress: profile.emailAddress };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testGmailMessage(messageIdOrUrl) {
  try {
    let messageId = messageIdOrUrl.trim();
    if (messageId.includes('mail.google.com')) {
        const urlObj = new URL(messageId);
        const hash = urlObj.hash || '';
        const hashParts = hash.split('/');
        for (const part of hashParts) {
          const cleanId = part.split('?')[0].split('#')[0].trim();
          if (cleanId && cleanId.length >= 16 && cleanId.length <= 20) {
            messageId = cleanId;
            break;
          }
        }
    }
    
    const token = await getAuthToken();
    const finalMessageId = await getRealMessageId(messageId);
    
    const messageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${finalMessageId}`;
    const response = await fetch(messageUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    
    if (!response.ok) return { success: false, error: `Gmail API error (${response.status})` };
    
    const messageData = await response.json();
    return { success: true, snippet: messageData.snippet };
  } catch (error) {
    return { success: false, error: error.message };
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
    chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
});
