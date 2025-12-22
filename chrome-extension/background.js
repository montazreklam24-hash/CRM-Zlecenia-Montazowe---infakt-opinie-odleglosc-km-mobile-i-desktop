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
  
  const parts = [{ text: `Jesteś asystentem CRM. Wyciągnij dane klienta WYŁĄCZNIE na podstawie poniższego maila i historii wątku.
- Telefon, Email klienta (IGNORUJ FIRMOWE), Firma, NIP, Imię, Adres montażu, Zakres prac, Tytuł.
- KRYTYCZNE: Używaj TYLKO danych tekstowych z maila. NIE zmyślaj NIP-u ani telefonu, jeśli go nie ma.
- KRYTYCZNE: Jeśli w stopce jest podany NIP (np. NIP 526-10-16-043), przepisz go DOKŁADNIE tak jak jest. NIE używaj swojej wiedzy o firmach do podstawiania innych numerów.
- Używaj "oklejanie witryn" zamiast "montaż witryn".

Mail:
---
${fromEmail ? `Od: ${fromEmail}` : ''}
Temat: ${emailData.subject || ''}
${contextBody}
---
Odpowiedz TYLKO JSON: { "phone": "...", "email": "...", "companyName": "...", "nip": "...", "firstName": "...", "lastName": "...", "address": { "street": "...", "buildingNo": "...", "apartmentNo": "...", "city": "...", "postCode": "..." }, "scopeOfWork": "...", "suggestedTitle": "..." }` }];

  if (emailData.images?.length > 0) {
    for (const img of emailData.images.slice(0, 4)) {
      if (img.data?.startsWith('data:image')) {
        parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.data.split(',')[1] } });
      }
    }
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${settings.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 2048 } })
    });
    if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
    const resData = await response.json();
    const parsed = JSON.parse(resData.candidates[0].content.parts[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    
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
    if (parsed.address && typeof parsed.address === 'object') {
        const a = parsed.address;
        parsed.address = [a.street ? a.street + (a.buildingNo ? ' ' + a.buildingNo : '') : '', a.postCode, a.city].filter(Boolean).join(', ');
    }
    return { success: true, data: parsed };
  } catch (error) {
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
  // Support both old (messageId, ids) and new (list of objects) signatures
  // But here we implement the new one: list of {id, messageId}
  
  if (!Array.isArray(attachmentsToImport)) {
      // Fallback for old calls if any
      return []; 
  }

  await logDebug('info', 'import', 'Starting attachment import (multi-message)', { 
    count: attachmentsToImport.length 
  });
  
  try {
    const googleToken = await getAuthToken();
    const resultPaths = [];

    // Group by messageId to optimize calls? Or just fetch one by one?
    // Let's fetch one by one for simplicity first, or group if API allows.
    // The PHP script takes messageId + selectedIds. 
    // We can group by messageId and call API for each message.
    
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
    await logDebug('info', 'createJob', 'Checking import settings', { 
      importAttachments: settings.importAttachments,
      hasMessageId: !!finalMessageId,
      messageId: finalMessageId,
      selectedAttachmentsCount: jobData.selectedAttachments?.length
    });
    
    if (settings.importAttachments) {
        // Nowa logika: jeśli mamy przekazaną listę obiektów selectedAttachments, używamy jej
        if (jobData.selectedAttachments && jobData.selectedAttachments.length > 0) {
            try {
                const importedFiles = await importAttachments(jobData.selectedAttachments);
                
                await logDebug('info', 'createJob', 'Import completed (new method)', { 
                    count: importedFiles.length 
                });
                
                if (importedFiles.length > 0) {
                    projectImages = importedFiles;
                }
            } catch (e) {
                attachmentWarning = "Błąd importu załączników: " + e.message;
            }
        } 
        // Stara logika (fallback): jeśli mamy tylko ID wiadomości i listę ID
        else if (finalMessageId) {
             // ... code for fallback if needed, but we rely on selectedAttachments now ...
             // Skip fallback to avoid confusion, assumption is selectedAttachments is always sent now
             await logDebug('info', 'createJob', 'No selectedAttachments array provided, skipping import');
        }
    } else {
        await logDebug('info', 'createJob', 'Import attachments disabled in settings');
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
    await logDebug('info', 'createJob', 'Sending job to CRM', {
      title: jobData.title,
      attachmentsCount: projectImages.length,
      attachments: projectImages,
      hasPdf: projectImages.some(path => path.includes('.pdf')),
      hasImages: projectImages.some(path => /\.(jpg|jpeg|png|gif|webp)$/i.test(path))
    });
    
    const result = await apiRequest('jobs', 'POST', {
      jobTitle: jobData.title,
      phoneNumber: jobData.phone,
      email: jobData.email,
      address: jobData.fullAddress,
      scopeWorkText: jobData.description,
      
      // Metadane Gmail - wysyłamy poprawne ID
      gmailMessageId: finalMessageId || null,
      
      // Załączniki - WSZYSTKIE pliki: obrazy, PDF-y, dokumenty (ścieżki, nie base64!)
      projectImages: projectImages, 
      
      columnId: 'PREPARE'
    });
    
    await logDebug('info', 'createJob', 'Job created successfully', {
      jobId: result.job?.id,
      attachmentsInResponse: result.job?.projectImages?.length || 0
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
    await logDebug('info', 'gus', 'Starting GUS lookup', { nip });
    const settings = await getSettings();
    if (!settings.crmUrl) throw new Error('Brak adresu CRM w ustawieniach');
    
    // Używamy endpointu /api/gus/nip/{nip}
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
      await logDebug('info', 'gus', 'GUS lookup successful', { company: data.company?.name });
      return { success: true, company: data.company };
    } else {
      await logDebug('warn', 'gus', 'GUS lookup failed', { error: data.error });
      return { success: false, error: data.error || 'Nie znaleziono firmy' };
    }
  } catch (error) {
    await logDebug('error', 'gus', 'GUS lookup error', { error: error.message });
    return { success: false, error: error.message };
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

/**
 * Testuje pobieranie konkretnego maila przez Gmail API
 * Zwraca szczegółowe informacje o mailu: nadawca, załączniki, treść
 * Akceptuje Message ID lub URL Gmail
 */
async function testGmailMessage(messageIdOrUrl) {
  try {
    await logDebug('info', 'testMessage', 'Testing Gmail message fetch', { input: messageIdOrUrl });
    
    if (!messageIdOrUrl || typeof messageIdOrUrl !== 'string') {
      return {
        success: false,
        error: 'Brak Message ID lub URL'
      };
    }
    
    // Wyciągnij Message ID z URL jeśli podano URL
    let messageId = messageIdOrUrl.trim();
    let finalMessageId = null;
    
    if (messageId.includes('mail.google.com')) {
      try {
        // To jest URL - wyciągnij Message ID z hash
        const urlObj = new URL(messageId);
        const hash = urlObj.hash || '';
        const hashParts = hash.split('/');
        
        for (const part of hashParts) {
          const cleanId = part.split('?')[0].split('#')[0].trim();
          // Message ID w Gmail to zwykle 16-20 znaków hex
          if (cleanId && cleanId.length >= 16 && cleanId.length <= 20 && 
              !cleanId.startsWith('FM') && !cleanId.startsWith('msg-') &&
              /^[a-zA-Z0-9_-]+$/.test(cleanId)) {
            messageId = cleanId;
            await logDebug('info', 'testMessage', 'Extracted Message ID from URL', { url: messageIdOrUrl, messageId });
            break;
          }
        }
        
        if (messageId === messageIdOrUrl.trim()) {
          // Nie znaleziono Message ID w URL - spróbuj z ostatniej części hash
          const lastPart = hashParts[hashParts.length - 1]?.split('?')[0]?.split('#')[0]?.trim();
          if (lastPart && lastPart.length >= 10) {
            messageId = lastPart;
            await logDebug('info', 'testMessage', 'Using last part of hash as Message ID', { messageId });
          } else {
            return {
              success: false,
              error: 'Nie znaleziono Message ID w podanym URL. Wklej bezpośrednio Message ID (np. z konsoli przeglądarki).'
            };
          }
        }
      } catch (urlError) {
        await logDebug('error', 'testMessage', 'Error parsing URL', { error: urlError.message });
        return {
          success: false,
          error: `Błąd parsowania URL: ${urlError.message}. Wklej bezpośrednio Message ID.`
        };
      }
    }
    
    if (!messageId || messageId.length < 10) {
      return {
        success: false,
        error: `Nieprawidłowy Message ID: "${messageId}". Musi mieć co najmniej 10 znaków.`
      };
    }
    
    // 1. Pobierz token OAuth
    const token = await getAuthToken();
    
    // 2. Waliduj Message ID przed użyciem
    await logDebug('info', 'testMessage', 'Validating Message ID', { 
      messageId, 
      length: messageId.length,
      startsWithFM: messageId.startsWith('FM'),
      isValidFormat: /^[a-zA-Z0-9_-]+$/.test(messageId)
    });
    
    // Message ID musi być krótki hex (16-20 znaków) i nie może być Thread ID
    if (messageId.length > 20 || messageId.startsWith('FM') || messageId.startsWith('msg-')) {
      await logDebug('info', 'testMessage', 'Looks like Thread ID, resolving', { messageId });
      finalMessageId = await getRealMessageId(messageId);
      await logDebug('info', 'testMessage', 'Resolved to Message ID', { original: messageId, resolved: finalMessageId });
      
      if (!finalMessageId || finalMessageId === messageId) {
        return {
          success: false,
          error: `Nie można rozwiązać Thread ID "${messageId}". Upewnij się że:\n1. Otworzyłeś konkretny mail (nie listę maili)\n2. Mail jest w pełni załadowany\n3. Spróbuj użyć przycisku "Pobierz z Gmail" gdy masz otwarty konkretny mail`
        };
      }
    } else {
      finalMessageId = messageId;
    }
    
    // Finalna walidacja Message ID
    if (!finalMessageId || finalMessageId.length < 16 || finalMessageId.length > 20) {
      return {
        success: false,
        error: `Nieprawidłowy Message ID: "${finalMessageId}" (długość: ${finalMessageId?.length || 0}). Message ID musi mieć 16-20 znaków.`
      };
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(finalMessageId)) {
      return {
        success: false,
        error: `Nieprawidłowy format Message ID: "${finalMessageId}". Dozwolone tylko litery, cyfry, _ i -.`
      };
    }
    
    // 3. Pobierz szczegóły maila
    const messageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${finalMessageId}`;
    await logDebug('info', 'testMessage', 'Fetching message', { url: messageUrl, messageId: finalMessageId });
    
    const response = await fetch(messageUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      await logDebug('error', 'testMessage', 'Failed to fetch message', { 
        status: response.status, 
        error: errorText 
      });
      return {
        success: false,
        error: `Gmail API error (${response.status}): ${errorText.substring(0, 200)}`
      };
    }
    
    const messageData = await response.json();
    
    // 4. Wyciągnij dane z maila
    const headers = messageData.payload?.headers || [];
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : null;
    };
    
    const from = getHeader('From');
    const to = getHeader('To');
    const subject = getHeader('Subject');
    const date = getHeader('Date');
    
    // 5. Wyciągnij załączniki
    const attachments = [];
    function extractAttachments(parts) {
      if (!Array.isArray(parts)) return;
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            attachmentId: part.body.attachmentId
          });
        }
        if (part.parts) {
          extractAttachments(part.parts);
        }
      }
    }
    
    if (messageData.payload?.parts) {
      extractAttachments(messageData.payload.parts);
    }
    
    // 6. Wyciągnij treść maila (snippet lub pierwsze 500 znaków)
    const snippet = messageData.snippet || '';
    let bodyText = '';
    function extractBody(parts) {
      if (!Array.isArray(parts)) return;
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          const base64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
          bodyText = atob(base64).substring(0, 1000);
          return;
        }
        if (part.parts) {
          extractBody(part.parts);
        }
      }
    }
    if (messageData.payload?.parts) {
      extractBody(messageData.payload.parts);
    }
    
    // 7. Sprawdź czy email nadawcy jest firmowy
    const fromEmail = from ? from.match(/<([^>]+)>/) : null;
    const fromEmailAddress = fromEmail ? fromEmail[1] : (from || '').split('<')[0].trim();
    const isCompanyEmail = fromEmailAddress ? COMPANY_EMAILS.some(ce => fromEmailAddress.toLowerCase().includes(ce.toLowerCase())) : false;
    
    // 8. Sprawdź czy telefon w treści to numer CRM
    const phoneRegex = /(\+?48\s?)?(\d{3}[\s\-]?\d{3}[\s\-]?\d{3}|\d{9})/g;
    const phonesInBody = (snippet + bodyText).match(phoneRegex) || [];
    const hasCrmPhone = phonesInBody.some(p => p.replace(/\D/g, '').includes('888201250'));
    
    const result = {
      success: true,
      messageId: finalMessageId,
      from: from,
      fromEmail: fromEmailAddress,
      isCompanyEmail: isCompanyEmail,
      to: to,
      subject: subject,
      date: date,
      snippet: snippet.substring(0, 200),
      bodyPreview: bodyText.substring(0, 200),
      attachments: attachments.map(att => ({
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        sizeKB: Math.round(att.size / 1024)
      })),
      attachmentsCount: attachments.length,
      phonesFound: phonesInBody,
      hasCrmPhone: hasCrmPhone,
      analysis: {
        shouldIgnoreEmail: isCompanyEmail,
        shouldIgnorePhone: hasCrmPhone,
        attachmentsToImport: attachments.length
      }
    };
    
    await logDebug('info', 'testMessage', 'Message analysis complete', result);
    
    // Upewnij się że zawsze zwracamy obiekt z success
    if (!result || typeof result !== 'object' || result.success === undefined) {
      console.error('[CRM BG] testGmailMessage: Invalid result format', result);
      return {
        success: false,
        error: 'Funkcja zwróciła nieprawidłowy format odpowiedzi',
        rawResult: result
      };
    }
    
    console.log('[CRM BG] testGmailMessage: Returning result', { success: result.success });
    return result;
    
  } catch (error) {
    await logDebug('error', 'testMessage', 'Error testing message', { 
      message: error.message, 
      stack: error.stack,
      input: messageIdOrUrl
    });
    
    const errorResult = {
      success: false,
      error: error.message || 'Nieznany błąd',
      details: error.stack ? error.stack.substring(0, 500) : null,
      input: messageIdOrUrl
    };
    
    console.error('[CRM BG] testGmailMessage error:', errorResult);
    return errorResult;
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


