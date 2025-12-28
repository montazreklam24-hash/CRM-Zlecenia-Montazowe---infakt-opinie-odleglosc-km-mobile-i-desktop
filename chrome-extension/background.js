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
  importAttachments: true
};

// =========================================================================
// DEBUG LOGGING
// =========================================================================

const MAX_LOG_ENTRIES = 50;

async function logDebug(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, category, message, data: data ? JSON.stringify(data) : null };
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[CRM BG ${category}]`, message, data || '');
  try {
    const result = await chrome.storage.local.get(['debugLogs']);
    const logs = result.debugLogs || [];
    logs.push(logEntry);
    if (logs.length > MAX_LOG_ENTRIES) logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    await chrome.storage.local.set({ debugLogs: logs });
  } catch (e) { console.error('[CRM BG] Failed to save debug log:', e); }
  
  // Wyślij też do serwera dla łatwego debugowania
  try {
    const settings = await getSettings();
    if (settings.crmUrl) {
      fetch(settings.crmUrl.replace(/\/$/, '') + '/api/debug_log.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, category, message, data })
      }).catch(() => {});
    }
  } catch (e) {}
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
      analyzeEmail(request.data).then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    case 'createJob':
      createJobInCRM(request.data).then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
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
    case 'testGmailMessage':
      testGmailMessage(request.messageId).then(sendResponse).catch(err => sendResponse({ success: false, error: err.message }));
      return true;
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

async function getFullThreadContent(messageId) {
    if (!messageId) return '';
    try {
        const token = await getAuthToken();
        const realId = await getRealMessageId(messageId);
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${realId}?format=minimal`;
        const msgResp = await fetch(msgUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!msgResp.ok) return '';
        const msgData = await msgResp.json();
        const threadId = msgData.threadId;
        if (!threadId) return '';

        const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;
        const threadResp = await fetch(threadUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!threadResp.ok) return '';
        const threadData = await threadResp.json();
        
        let fullText = '';
        const seenTexts = new Set();

        function extractText(parts) {
            let text = '';
            if (!parts) return '';
            if (Array.isArray(parts)) {
                for (const part of parts) text += extractText(part);
                return text;
            }
            if (parts.mimeType === 'text/plain' && parts.body && parts.body.data) {
                try {
                    return atob(parts.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                } catch (e) { return ''; }
            }
            if (parts.parts) return extractText(parts.parts);
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
    } catch (e) { console.error('Error fetching thread content:', e); return ''; }
}

const COMPANY_EMAILS = [
  'montazreklam24@gmail.com', 'montazreklam24@', 'a.korpalski@', 'akorpalski@', 'korpalski@',
  '@montazreklam24.pl', '@montazreklam24.com', '@newoffice.pl', 'kontakt@montazreklam24.pl', 'biuro@montazreklam24.pl', 'info@montazreklam24.pl'
];

function isCompanyEmail(email) {
  if (!email) return false;
  const emailLower = email.toLowerCase().trim();
  return COMPANY_EMAILS.some(ce => emailLower.includes(ce));
}

function extractPhoneFromText(text) {
  if (!text) return null;
  const CRM_PHONES = ['888201250', '222139596'];
  const patterns = [
    /(?:\+48|0048)?\s*([5678]\d{2}[\s\-]?\d{3}[\s\-]?\d{3})/g, // Polskie komórkowe (priorytet)
    /(?:\+48|0048)?\s*(\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/g, // Polskie stacjonarne
    /(?:\+380|00380|380)?\s*(\d{2}[\s\-]?\d{3}[\s\-]?\d{4})/g, // Ukraina
    /(?:\+49|0049|49)?\s*(\d{2,4}[\s\-]?\d{6,9})/g, // Niemcy
    /\b(\d{9})\b/g
  ];
  
  const found = [];
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      let phone = m[0].replace(/[^\d]/g, '');
      if (CRM_PHONES.some(p => phone.includes(p))) continue;
      if (phone.startsWith('48') && phone.length === 11) phone = phone.substring(2);
      if (phone.length >= 7 && phone.length <= 12) found.push(phone);
    }
  }
  
  const valid = found[0];
  if (!valid) return null;
  return valid.length === 9 ? valid.match(/.{1,3}/g).join(' ') : valid;
}

function extractNipFromText(text) {
  if (!text) return null;
  const dashRegex = /\b\d{3}[-\s]\d{2,3}[-\s]\d{2}[-\s]\d{2,3}\b/g;
  const dashMatches = text.match(dashRegex) || [];
  for (const m of dashMatches) {
      const c = m.replace(/[^0-9]/g, '');
      if (c.length === 10 && isValidNip(c)) return formatNip(c);
  }
  const digitRegex = /\b\d{10}\b/g;
  const digitMatches = text.match(digitRegex) || [];
  for (const d of digitMatches) if (isValidNip(d)) return formatNip(d);
  return null;
}

function isValidNip(nip) {
    if (nip.length !== 10) return false;
    const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(nip[i]) * w[i];
    return (s % 11) === parseInt(nip[9]);
}

function formatNip(nip) { return nip.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4'); }

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
  const promptText = `
Jesteś inteligentnym asystentem CRM dla firmy "Montaż Reklam 24". Twoim zadaniem jest analiza treści wiadomości e-mail (lub całych wątków) i wyciągnięcie danych do zlecenia.

KRYTYCZNE ZASADY:
1. TERMINOLOGIA: Jeśli zlecenie dotyczy witryn, szyb, okien – ZAWSZE używaj słowa "oklejanie" lub "oklejenie". NIGDY "montaż witryn".
2. IDENTYFIKACJA KLIENTA: Musisz aktywnie szukać wszystkich numerów telefonu klienta w całym wątku (również w stopkach). PRIORYTET mają numery komórkowe (9 cyfr).
3. IGNORUJ FIRMĘ: Nigdy nie zwracaj jako danych klienta telefonów firmowych (888 201 250, 22 213 95 96) ani maili firmowych (@montazreklam24.pl, @montazreklam24.com, @newoffice.pl, montazreklam24@gmail.com).
4. ADRESY: 
   - W polu "address" wpisz główny adres MONTAŻU (miejsce pracy). 
   - W polu "addressCandidates" wypisz wszystkie inne adresy znalezione w mailu.
   - Jeśli w mailu jest inny adres rejestrowy/do faktury, wpisz go w pole "billingAddress".
5. WĄTKI: Przeszukaj cały wątek, dane klienta często są w pierwszej wiadomości.

ODPOWIEDZ TYLKO CZYSTYM JSONEM:
{
  "phone": "główny numer (XXX XXX XXX) lub null",
  "phoneCandidates": ["lista wszystkich innych znalezionych numerów telefonów"],
  "email": "email klienta lub null",
  "companyName": "nazwa firmy lub null",
  "nip": "NIP lub null",
  "firstName": "imię lub null",
  "lastName": "nazwisko lub null",
  "address": { "street": "nazwa", "buildingNo": "nr", "apartmentNo": "nr", "city": "miasto", "postCode": "kod", "district": "dzielnica" },
  "addressCandidates": ["lista innych adresów"],
  "billingAddress": { "street": "ul", "buildingNo": "nr", "city": "miasto", "postCode": "kod" },
  "scopeOfWork": "szczegółowy opis (używaj 'oklejanie'!), max 500 znaków",
  "suggestedTitle": "tytuł zlecenia",
  "confidence": 0.0-1.0
}

Mail:
---
${fromEmail ? `Od: ${fromEmail}` : 'Od: (nieznany)'}
Temat: ${emailData.subject || ''}
${contextBody}
---`;

  const parts = [{ text: promptText }];
  if (emailData.images && emailData.images.length > 0) {
    for (const img of emailData.images.slice(0, 4)) {
      if (img.data && img.data.startsWith('data:image')) {
        parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.data.split(',')[1] } });
      }
    }
  }

  try {
    const callGemini = async (p) => {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${settings.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: p }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048 } })
      });
      if (!resp.ok) throw new Error(`Gemini API error (${resp.status})`);
      return resp.json();
    };

    let data = await callGemini(parts);
    if (!data.candidates || !data.candidates[0]) return { success: false, error: 'Brak odpowiedzi' };
    let text = data.candidates[0].content.parts[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed = JSON.parse(text);
    
    // Walidacje
    const realNip = extractNipFromText(contextBody);
    if (realNip) parsed.nip = realNip;
    
    const realPhone = extractPhoneFromText(contextBody);
    if (realPhone) {
        const currentPhone = String(parsed.phone || '');
        if (!currentPhone || currentPhone.includes('032') || currentPhone.includes('222') || currentPhone.length < 9) {
            parsed.phone = realPhone;
            await logDebug('info', 'analyze', 'Phone replaced by regex priority', { phone: realPhone });
        }
    }

    if (parsed.email && isCompanyEmail(parsed.email)) parsed.email = null;
    
    // Adresy
    let fAddr = '';
    if (parsed.address && typeof parsed.address === 'object') {
        const a = parsed.address;
        fAddr = [a.street ? a.street + (a.buildingNo ? ' ' + a.buildingNo : '') : '', a.postCode, a.city].filter(Boolean).join(', ');
    } else fAddr = parsed.address || '';
    parsed.address = fAddr;

    if (parsed.addressCandidates && Array.isArray(parsed.addressCandidates)) {
        parsed.addressCandidates = parsed.addressCandidates.map(addr => {
            if (typeof addr === 'object' && addr !== null) return [addr.street ? addr.street + (addr.buildingNo ? ' ' + addr.buildingNo : '') : '', addr.postCode, addr.city].filter(Boolean).join(', ');
            return addr;
        }).filter(a => a && a !== fAddr);
    } else parsed.addressCandidates = [];

    if (parsed.billingAddress && typeof parsed.billingAddress === 'object') {
        const ba = parsed.billingAddress;
        const bStr = [ba.street ? ba.street + (ba.buildingNo ? ' ' + ba.buildingNo : '') : '', ba.postCode, ba.city].filter(Boolean).join(', ');
        if (bStr && bStr !== fAddr) {
            const note = `\n\n--- DANE DO FAKTURY ---\n${parsed.companyName || ''}\nNIP: ${parsed.nip || ''}\n${bStr}`;
            parsed.scopeOfWork = (parsed.scopeOfWork || '') + note;
            if (!parsed.addressCandidates.includes(bStr)) parsed.addressCandidates.push(bStr);
        }
    }

    if (parsed.phoneCandidates && Array.isArray(parsed.phoneCandidates)) {
        parsed.phoneCandidates = parsed.phoneCandidates.map(p => {
            const d = String(p).replace(/\D/g, '');
            return d.length === 9 ? d.match(/.{1,3}/g).join(' ') : String(p);
        }).filter(p => {
            const cleanP = String(p).replace(/\s/g, '');
            return cleanP && cleanP !== String(parsed.phone).replace(/\s/g, '') && !COMPANY_EMAILS.some(ce => cleanP.includes(ce));
        });
        parsed.phoneCandidates = [...new Set(parsed.phoneCandidates)];
    } else parsed.phoneCandidates = [];

    if (parsed.suggestedTitle) parsed.suggestedTitle = parsed.suggestedTitle.replace(/montaż witryn/gi, 'oklejanie witryn');
    if (parsed.scopeOfWork) parsed.scopeOfWork = parsed.scopeOfWork.replace(/montaż witryn/gi, 'oklejanie witryn');

    return { success: true, data: parsed };
  } catch (error) { return { success: false, error: error.message }; }
}

async function apiRequest(endpoint, method = 'GET', body = null) {
  const settings = await getSettings();
  if (!settings.crmUrl || !settings.crmToken) throw new Error('Brak konfiguracji CRM');
  const url = settings.crmUrl.replace(/\/$/, '') + '/api/' + endpoint;
  const options = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.crmToken } };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Błąd API');
  return data;
}

async function uploadFileToCRM(fileObj) {
    const settings = await getSettings();
    const url = settings.crmUrl.replace(/\/$/, '') + '/api/upload.php';
    const res = await fetch(fileObj.data);
    const blob = await res.blob();
    const fd = new FormData();
    fd.append('file', blob, fileObj.name);
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + settings.crmToken }, body: fd });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    const result = await response.json();
    if (!result.success || !result.url) throw new Error(result.error || 'Unknown upload error');
    return result.url;
}

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) reject(chrome.runtime.lastError?.message || 'Brak tokena');
      else resolve(token);
    });
  });
}

async function getAttachmentData(messageId, attachmentId) {
  try {
    const token = await getAuthToken();
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Gmail API error: ${resp.status}`);
    const data = await resp.json();
    return { success: true, data: data.data };
  } catch (e) { return { success: false, error: e.message }; }
}

async function getGmailAttachments(messageId) {
  if (!messageId) return { success: false, error: 'Brak Message ID' };
  try {
    const token = await getAuthToken();
    const realId = await getRealMessageId(messageId);
    const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${realId}?format=minimal`;
    const msgResp = await fetch(msgUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!msgResp.ok) throw new Error(`Gmail API error: ${msgResp.status}`);
    const msgData = await msgResp.json();
    const threadId = msgData.threadId;
    if (!threadId) throw new Error('No threadId');

    const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;
    const threadResp = await fetch(threadUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!threadResp.ok) throw new Error(`Gmail API error: ${threadResp.status}`);
    const threadData = await threadResp.json();

    const atts = [];
    function find(parts, msgId, date) {
      if (!parts) return;
      for (const p of parts) {
        if (p.filename && p.body && (p.body.attachmentId || p.body.data)) {
          atts.push({
            id: p.body.attachmentId || `inline-${Math.random().toString(36).substr(2, 9)}`,
            messageId: msgId,
            name: p.filename,
            mimeType: p.mimeType,
            size: p.body.size,
            date: date,
            isInline: !!p.headers?.find(h => h.name.toLowerCase() === 'content-id' || (h.name.toLowerCase() === 'content-disposition' && h.value.toLowerCase().includes('inline')))
          });
        }
        if (p.parts) find(p.parts, msgId, date);
      }
    }
    if (threadData.messages) {
        for (const m of threadData.messages) {
            const d = m.payload.headers.find(h => h.name === 'Date')?.value;
            if (m.payload.parts) find(m.payload.parts, m.id, d);
            else if (m.payload.body) find([m.payload], m.id, d);
        }
    }
    return { success: true, attachments: atts };
  } catch (e) { return { success: false, error: e.message }; }
}

/**
 * NOWE PODEJŚCIE:
 * 1. PHP pobiera WSZYSTKIE załączniki z Gmaila i zapisuje je na serwerze
 * 2. PHP zwraca listę z originalName i path dla każdego pliku
 * 3. Rozszerzenie filtruje po nazwie - do CRM trafiają tylko wybrane
 */
async function importAttachments(selectedAttachments, gmailMessageId) {
  await logDebug('info', 'import', 'importAttachments called (NEW approach)', { 
    selectedCount: selectedAttachments?.length,
    gmailMessageId
  });
  
  if (!gmailMessageId) {
    await logDebug('error', 'import', 'No gmailMessageId provided');
    return [];
  }
  
  const settings = await getSettings();
  
  // 1. Pobierz token Gmail
  let token;
  try {
    token = await getAuthToken();
  } catch (e) {
    await logDebug('error', 'import', 'Failed to get Gmail token', e.message);
    return [];
  }
  
  // 2. Wyślij do PHP - pobierz WSZYSTKIE załączniki
  const url = settings.crmUrl.replace(/\/$/, '') + '/api/import_gmail.php';
  await logDebug('info', 'import', 'Calling PHP to fetch ALL attachments', { url, messageId: gmailMessageId });
  
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.crmToken
      },
      body: JSON.stringify({ 
        messageId: gmailMessageId, 
        token: token 
      })
    });
    
    const data = await resp.json();
    await logDebug('info', 'import', 'PHP response', { 
      success: data.success, 
      attachmentsCount: data.attachments?.length,
      error: data.error
    });
    
    if (!data.success || !data.attachments) {
      await logDebug('error', 'import', 'PHP import failed', data.error);
      return [];
    }
    
    // 3. FILTRUJ po nazwie - tylko wybrane załączniki trafiają do karty
    const selectedNames = new Set((selectedAttachments || []).map(a => a.name?.toLowerCase()));
    await logDebug('info', 'import', 'Filtering by names', { 
      allFromPHP: data.attachments.map(a => a.originalName),
      selectedNames: Array.from(selectedNames)
    });
    
    const filteredPaths = data.attachments
      .filter(a => selectedNames.has(a.originalName?.toLowerCase()))
      .map(a => a.path);
    
    await logDebug('info', 'import', 'Filtered result', { 
      totalFromPHP: data.attachments.length,
      filtered: filteredPaths.length,
      paths: filteredPaths
    });
    
    return {
      paths: filteredPaths,
      threadId: data.threadId || null
    };
    
  } catch (e) {
    await logDebug('error', 'import', 'Exception during import', e.message);
    return { paths: [], threadId: null };
  }
}

// Kompresja obrazu do max 1600px i JPEG 0.7
async function compressImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1600;
      let { width, height } = img;
      
      if (width > height && width > MAX) {
        height *= MAX / width;
        width = MAX;
      } else if (height > MAX) {
        width *= MAX / height;
        height = MAX;
      }
      
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 }).then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }).catch(() => resolve(null));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function getRealMessageId(idOrThreadId) {
  if (idOrThreadId && /^[a-f0-9]{16}$/.test(idOrThreadId)) return idOrThreadId;
  try {
    const token = await getAuthToken();
    let cleanId = idOrThreadId.includes(':') ? idOrThreadId.split(':').pop() : idOrThreadId;
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${cleanId}?format=minimal`;
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!resp.ok) return idOrThreadId;
    const data = await resp.json();
    if (data.messages && data.messages.length > 0) return data.messages[data.messages.length - 1].id;
  } catch (e) {}
  return idOrThreadId;
}

async function createJobInCRM(jobData) {
  try {
    const settings = await getSettings();
    let finalMessageId = jobData.gmailMessageId;
    let projectImages = [];
    let attachmentWarning = null;

    await logDebug('info', 'createJob', 'Starting job creation', {
        title: jobData.title,
        gmailMessageId: jobData.gmailMessageId,
        selectedAttachmentsCount: jobData.selectedAttachments?.length || 0,
        manualAttachmentsCount: jobData.manualAttachments?.length || 0,
        importAttachmentsEnabled: settings.importAttachments
    });

    if (settings.importAttachments && jobData.selectedAttachments?.length > 0 && finalMessageId) {
        await logDebug('info', 'createJob', 'Will import Gmail attachments (NEW: PHP fetches all, we filter)', {
            selectedCount: jobData.selectedAttachments.length,
            selectedNames: jobData.selectedAttachments.map(a => a.name),
            gmailMessageId: finalMessageId
        });
        try {
            const importResult = await importAttachments(jobData.selectedAttachments, finalMessageId);
            projectImages = importResult.paths;
            if (importResult.threadId) {
                jobData.gmailThreadId = importResult.threadId;
                await logDebug('info', 'createJob', 'Got threadId from PHP', { threadId: importResult.threadId });
            }
            await logDebug('info', 'createJob', 'Gmail attachments imported', { paths: projectImages });
        } catch (e) { 
            attachmentWarning = "Błąd importu: " + e.message;
            await logDebug('error', 'createJob', 'Gmail attachments import failed', { error: e.message });
        }
    } else {
        await logDebug('info', 'createJob', 'Skipping Gmail attachments import', {
            reason: !settings.importAttachments ? 'disabled in settings' : 
                    !jobData.selectedAttachments?.length ? 'no attachments selected' : 
                    'no messageId'
        });
    }

    if (jobData.manualAttachments && Array.isArray(jobData.manualAttachments)) {
        const urls = await Promise.all(jobData.manualAttachments.filter(f => f.data?.startsWith('data:image')).map(f => uploadFileToCRM(f).catch(() => null)));
        projectImages = [...projectImages, ...urls.filter(u => u !== null)];
    }

    const result = await apiRequest('jobs', 'POST', {
      jobTitle: jobData.title,
      phoneNumber: jobData.phone,
      email: jobData.email,
      nip: jobData.nip,
      address: jobData.fullAddress,
      scopeWorkText: jobData.description,
      gmailMessageId: finalMessageId || null,
      gmailThreadId: jobData.gmailThreadId || null,
      projectImages: projectImages, 
      columnId: 'PREPARE',
      
      // Dane do faktury
      billingName: jobData.billingName,
      billingNip: jobData.billingNip,
      billingStreet: jobData.billingStreet,
      billingBuilding: jobData.billingBuilding,
      billingApartment: jobData.billingApartment,
      billingPostcode: jobData.billingPostcode,
      billingCity: jobData.billingCity,
      billingEmail: jobData.billingEmail
    });
    return { success: true, job: result.job, warning: attachmentWarning };
  } catch (error) { return { success: false, error: error.message }; }
}

async function testConnection(settings) {
  try {
    const url = settings.crmUrl.replace(/\/$/, '') + '/api/ping';
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': 'Bearer ' + settings.crmToken } });
    return { success: resp.ok, error: resp.ok ? null : 'Nieprawidłowy token' };
  } catch (error) { return { success: false, error: 'Błąd połączenia' }; }
}

async function lookupGusInCRM(nip) {
  try {
    const settings = await getSettings();
    const url = settings.crmUrl.replace(/\/$/, '') + '/api/gus/nip/' + nip;
    const resp = await fetch(url, { method: 'GET', headers: { 'Authorization': 'Bearer ' + settings.crmToken }, Accept: 'application/json' });
    const data = await resp.json();
    return { success: resp.ok, company: data.company, error: resp.ok ? null : data.error };
  } catch (error) { return { success: false, error: error.message }; }
}

async function testGmailConnection() {
  try {
    const token = await getAuthToken();
    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) chrome.identity.removeCachedAuthToken({ token }, () => {});
      return { success: false, error: `Błąd API: ${resp.status}` };
    }
    const profile = await resp.json();
    return { success: true, emailAddress: profile.emailAddress };
  } catch (error) { return { success: false, error: error.message }; }
}

async function testGmailMessage(idOrUrl) {
  try {
    let id = idOrUrl.trim();
    if (id.includes('mail.google.com')) {
        const h = new URL(id).hash || '';
        for (const p of h.split('/')) {
          const c = p.split('?')[0].split('#')[0].trim();
          if (c.length >= 16 && c.length <= 20) { id = c; break; }
        }
    }
    const token = await getAuthToken();
    const realId = await getRealMessageId(id);
    const resp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${realId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!resp.ok) return { success: false, error: `Błąd: ${resp.status}` };
    const data = await resp.json();
    return { success: true, snippet: data.snippet };
  } catch (error) { return { success: false, error: error.message }; }
}

async function getSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => resolve(items)));
}

async function saveSettings(settings) {
  return new Promise((resolve) => chrome.storage.sync.set(settings, () => resolve({ success: true })));
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.storage.sync.set(DEFAULT_SETTINGS);
});
