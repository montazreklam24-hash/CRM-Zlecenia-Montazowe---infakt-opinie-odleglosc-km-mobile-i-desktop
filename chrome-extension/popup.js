/**
 * CRM Gmail Extension - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const crmUrlInput = document.getElementById('crmUrl');
  const crmTokenInput = document.getElementById('crmToken');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const autoAnalyzeCheckbox = document.getElementById('autoAnalyze');
  const importAttachmentsCheckbox = document.getElementById('importAttachments');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const testGmailBtn = document.getElementById('testGmailBtn');
  const openCrmBtn = document.getElementById('openCrm');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const message = document.getElementById('message');
  
  // Load saved settings
  const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
  
  crmUrlInput.value = settings.crmUrl || '';
  crmTokenInput.value = settings.crmToken || '';
  geminiApiKeyInput.value = settings.geminiApiKey || '';
  autoAnalyzeCheckbox.checked = settings.autoAnalyze !== false;
  importAttachmentsCheckbox.checked = settings.importAttachments === true; // Domyślnie false
  
  // Update status
  await checkConnection(settings);
  
  // Load diagnostics
  await loadDiagnostics();
  
  // Diagnostics toggle
  const diagnosticsToggle = document.getElementById('diagnosticsToggle');
  const diagnosticsPanel = document.getElementById('diagnosticsPanel');
  const diagnosticsArrow = document.getElementById('diagnosticsArrow');
  
  if (diagnosticsToggle && diagnosticsPanel) {
    diagnosticsToggle.onclick = () => {
      const isVisible = diagnosticsPanel.style.display !== 'none';
      diagnosticsPanel.style.display = isVisible ? 'none' : 'block';
      diagnosticsArrow.textContent = isVisible ? '▼' : '▲';
      if (!isVisible) {
        loadDiagnostics();
      }
    };
  }
  
  // Refresh logs button
  const refreshLogsBtn = document.getElementById('refreshLogsBtn');
  if (refreshLogsBtn) {
    refreshLogsBtn.onclick = async () => {
      await loadDiagnostics();
      showMessage('Logi odświeżone', 'success');
    };
  }
  
  // Clear logs button
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  if (clearLogsBtn) {
    clearLogsBtn.onclick = async () => {
      if (confirm('Czy na pewno chcesz wyczyścić wszystkie logi?')) {
        await chrome.runtime.sendMessage({ action: 'clearDebugLogs' });
        await loadDiagnostics();
        showMessage('Logi wyczyszczone', 'success');
      }
    };
  }
  
  // Test message button
  const testMessageBtn = document.getElementById('testMessageBtn');
  const testMessageIdInput = document.getElementById('testMessageIdInput');
  const testMessageResult = document.getElementById('testMessageResult');
  const getMessageIdBtn = document.getElementById('getMessageIdBtn');
  
  // Pobierz Message ID z aktualnie otwartego maila w Gmail
  if (getMessageIdBtn && testMessageIdInput) {
    getMessageIdBtn.onclick = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url.includes('mail.google.com')) {
          showMessage('Otwórz mail w Gmail i spróbuj ponownie', 'error');
          return;
        }
        
        getMessageIdBtn.disabled = true;
        getMessageIdBtn.textContent = '⏳ Szukam...';
        
        // Wykonaj skrypt w kontekście Gmaila aby pobrać Message ID
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Użyj tej samej logiki co w content.js - ale bardziej szczegółowej
            function getCurrentMessageId() {
              // Strategia 1: Sprawdź wszystkie elementy z data-message-id
              const messageElements = document.querySelectorAll('[data-message-id]');
              const foundIds = [];
              
              for (let i = messageElements.length - 1; i >= 0; i--) {
                let id = messageElements[i].getAttribute('data-message-id');
                if (id) {
                  // Usuń prefiksy jak #msg-a:r- jeśli są
                  id = id.replace(/^#msg-[a-z]:r-/, '').replace(/^msg-[a-z]:r-/, '').replace(/^#/, '').trim();
                  
                  foundIds.push({ 
                    id: id, 
                    original: messageElements[i].getAttribute('data-message-id'),
                    source: 'data-message-id', 
                    element: messageElements[i].tagName 
                  });
                  
                  // Prawdziwy Message ID to krótki hex (16-20 znaków), nie zaczyna się od FM ani msg-
                  // Musi być tylko alfanumeryczny (bez dwukropków, hashów, etc.)
                  if (id && 
                      id.length >= 16 && id.length <= 20 && 
                      !id.startsWith('FM') && 
                      !id.startsWith('msg-') && 
                      !id.includes(':') &&
                      !id.includes('#') &&
                      /^[a-zA-Z0-9_-]+$/.test(id)) {
                    return { id, source: 'data-message-id', valid: true };
                  }
                }
              }
              
              // Strategia 2: Sprawdź URL hash - może zawierać Message ID
              const hash = window.location.hash;
              if (hash) {
                const hashParts = hash.split('/');
                for (let part of hashParts) {
                  let cleanId = part.split('?')[0].split('#')[0].trim();
                  // Usuń prefiksy jeśli są
                  cleanId = cleanId.replace(/^#msg-[a-z]:r-/, '').replace(/^msg-[a-z]:r-/, '').replace(/^#/, '').trim();
                  
                  if (cleanId && 
                      cleanId.length >= 16 && cleanId.length <= 20 && 
                      !cleanId.startsWith('FM') && 
                      !cleanId.startsWith('msg-') &&
                      !cleanId.includes(':') &&
                      !cleanId.includes('#') &&
                      /^[a-zA-Z0-9_-]+$/.test(cleanId)) {
                    return { id: cleanId, source: 'url-hash', valid: true };
                  }
                }
              }
              
              // Strategia 3: Sprawdź elementy z klasą zawierającą "message" lub atrybuty aria-label z message
              const messageDivs = document.querySelectorAll('div[class*="message"], div[class*="Message"], [aria-label*="message" i]');
              for (let div of messageDivs) {
                for (let attr of div.attributes) {
                  if (attr.name.startsWith('data-') && attr.value) {
                    let value = attr.value.trim();
                    // Usuń prefiksy jeśli są
                    value = value.replace(/^#msg-[a-z]:r-/, '').replace(/^msg-[a-z]:r-/, '').replace(/^#/, '').trim();
                    
                    if (value && 
                        value.length >= 16 && value.length <= 20 && 
                        !value.startsWith('FM') && 
                        !value.startsWith('msg-') &&
                        !value.includes(':') &&
                        !value.includes('#') &&
                        /^[a-zA-Z0-9_-]+$/.test(value)) {
                      return { id: value, source: attr.name, valid: true };
                    }
                  }
                }
              }
              
              // Strategia 4: Sprawdź czy jesteśmy na konkretnym mailu - szukaj w URL po otwarciu maila
              // Gmail czasami używa formatu: #inbox/threadId lub #label/.../messageId
              if (hash) {
                // Szukaj ostatniej części hash która może być Message ID
                const parts = hash.split('/').filter(p => p && !p.includes('?') && !p.includes('#'));
                for (let i = parts.length - 1; i >= 0; i--) {
                  let part = parts[i].trim();
                  part = part.replace(/^#msg-[a-z]:r-/, '').replace(/^msg-[a-z]:r-/, '').replace(/^#/, '').trim();
                  
                  if (part && 
                      part.length >= 16 && part.length <= 20 && 
                      !part.startsWith('FM') && 
                      !part.startsWith('msg-') &&
                      !part.includes(':') &&
                      !part.includes('#') &&
                      /^[a-zA-Z0-9_-]+$/.test(part)) {
                    return { id: part, source: 'url-hash-last-part', valid: true };
                  }
                }
              }
              
              return { id: null, source: 'none', valid: false, foundIds: foundIds.slice(0, 5) };
            }
            
            const result = getCurrentMessageId();
            
            // Jeśli nie znaleziono, spróbuj użyć Thread ID i przekonwertować przez API
            // Ale najpierw sprawdź czy jesteśmy na konkretnym mailu
            const isMessageView = window.location.hash.includes('/message/') || 
                                  document.querySelector('[role="main"] [role="article"]') ||
                                  document.querySelector('div[data-thread-perm-id]');
            
            return {
              messageId: result.id,
              url: window.location.href,
              found: result.valid,
              source: result.source,
              isMessageView: !!isMessageView,
              debug: {
                foundIds: result.foundIds || [],
                hash: window.location.hash.substring(0, 200),
                hasMessageView: !!isMessageView
              }
            };
          }
        });
        
        getMessageIdBtn.disabled = false;
        getMessageIdBtn.textContent = '📋 Pobierz z Gmail';
        
        if (results && results[0] && results[0].result) {
          const result = results[0].result;
          console.log('[Popup] getMessageId result:', result);
          
          if (result.found && result.messageId) {
            testMessageIdInput.value = result.messageId;
            showMessage(`✅ Znaleziono Message ID: ${result.messageId} (źródło: ${result.source})`, 'success');
          } else if (result.debug && result.debug.foundIds && result.debug.foundIds.length > 0) {
            // Znaleziono ID ale nie są prawidłowe - pokaż debug info
            const foundIdsList = result.debug.foundIds.map((item, i) => {
              const original = item.original || item.id;
              const cleaned = item.id;
              return `${i+1}. "${original}" → "${cleaned}" (${item.source})`;
            }).join('\n');
            
            const debugInfo = `Znaleziono ${result.debug.foundIds.length} ID, ale żadne nie jest prawidłowe.\n\nZnalezione ID:\n${foundIdsList}\n\nURL hash: ${result.debug.hash || 'brak'}\nWidok maila: ${result.isMessageView ? 'TAK' : 'NIE'}\n\n⚠️ WAŻNE:\n1. Musisz być na KONKRETNYM mailu (kliknij na mail w liście)\n2. NIE możesz być na liście maili\n3. Mail musi być w pełni załadowany\n4. Spróbuj otworzyć mail w nowej karcie i użyć przycisku ponownie`;
            
            testMessageResult.textContent = debugInfo;
            testMessageResult.style.display = 'block';
            testMessageResult.style.color = '#fbbf24';
            showMessage('⚠️ Nie znaleziono prawidłowego Message ID. Sprawdź szczegóły poniżej.', 'error');
          } else {
            // Spróbuj użyć URL jako fallback
            testMessageIdInput.value = result.url;
            showMessage('⚠️ Nie znaleziono Message ID, użyto URL. Kliknij "Analizuj" aby wyciągnąć ID z URL.', 'error');
          }
        } else {
          showMessage('❌ Nie znaleziono Message ID. Upewnij się że:\n1. Masz otwarty konkretny mail (kliknij na mail w liście)\n2. Mail jest w pełni załadowany\n3. Nie jesteś na liście maili, tylko na konkretnym mailu', 'error');
        }
      } catch (e) {
        getMessageIdBtn.disabled = false;
        getMessageIdBtn.textContent = '📋 Pobierz z Gmail';
        showMessage('Błąd: ' + e.message, 'error');
      }
    };
  }
  
  if (testMessageBtn && testMessageIdInput && testMessageResult) {
    testMessageBtn.onclick = async () => {
      const input = testMessageIdInput.value.trim();
      if (!input) {
        showMessage('Podaj Message ID lub URL do maila', 'error');
        return;
      }
      
      testMessageBtn.disabled = true;
      testMessageBtn.textContent = '⏳ Analizuję...';
      testMessageResult.style.display = 'none';
      
        try {
        console.log('[Popup] Testing Gmail message:', input);
        
        // Timeout dla odpowiedzi (45 sekund - Gmail API może być wolne)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout - brak odpowiedzi po 45 sekundach. Sprawdź czy Gmail OAuth działa.')), 45000)
        );
        
        const messagePromise = chrome.runtime.sendMessage({ 
          action: 'testGmailMessage',
          messageId: input
        }).catch(err => {
          console.error('[Popup] Error sending message:', err);
          throw err;
        });
        
        const result = await Promise.race([messagePromise, timeoutPromise]);
        console.log('[Popup] Received result:', result);
        
        testMessageBtn.disabled = false;
        testMessageBtn.textContent = '🔍 Analizuj konkretny mail';
        
        if (!result) {
          testMessageResult.textContent = 'BŁĄD: Brak odpowiedzi z rozszerzenia. Sprawdź konsolę (F12).';
          testMessageResult.style.display = 'block';
          testMessageResult.style.color = '#ef4444';
          return;
        }
        
        if (result && result.success) {
          const output = `
ANALIZA MAILA:
==============
Message ID: ${result.messageId}
Od: ${result.from}
Email nadawcy: ${result.fromEmail}
⚠️ Czy mail firmowy: ${result.isCompanyEmail ? 'TAK - BĘDZIE IGNOROWANY' : 'NIE - OK'}
Do: ${result.to}
Temat: ${result.subject}
Data: ${result.date}

ZAŁĄCZNIKI (${result.attachmentsCount}):
${result.attachments.map((att, i) => `  ${i+1}. ${att.filename} (${att.mimeType}, ${att.sizeKB} KB)`).join('\n')}

TELEFONY W TREŚCI:
${result.phonesFound.length > 0 ? result.phonesFound.map(p => `  - ${p}`).join('\n') : '  Brak'}
⚠️ Czy jest numer CRM (888 201 250): ${result.hasCrmPhone ? 'TAK - BĘDZIE IGNOROWANY' : 'NIE'}

PODGLĄD TREŚCI:
${result.snippet || result.bodyPreview || 'Brak'}

ANALIZA:
========
Email klienta: ${result.analysis.shouldIgnoreEmail ? '❌ IGNOROWANY (mail firmowy)' : '✅ BĘDZIE UŻYTY'}
Telefon klienta: ${result.analysis.shouldIgnorePhone ? '❌ IGNOROWANY (numer CRM)' : result.phonesFound.length > 0 ? '✅ BĘDZIE UŻYTY' : '⚠️ BRAK'}
Załączniki do importu: ${result.analysis.attachmentsToImport} plików
          `.trim();
          
          testMessageResult.textContent = output;
          testMessageResult.style.display = 'block';
          testMessageResult.style.color = result.analysis.shouldIgnoreEmail || result.analysis.shouldIgnorePhone ? '#fbbf24' : '#10b981';
        } else {
          testMessageResult.textContent = `BŁĄD: ${result.error}`;
          testMessageResult.style.display = 'block';
          testMessageResult.style.color = '#ef4444';
        }
      } catch (e) {
        testMessageBtn.disabled = false;
        testMessageBtn.textContent = '🔍 Analizuj konkretny mail';
        testMessageResult.textContent = `Błąd: ${e.message}`;
        testMessageResult.style.display = 'block';
        testMessageResult.style.color = '#ef4444';
      }
    };
  }
  
  // Manual Injection Button
  const injectBtn = document.getElementById('injectPanel');
  if (injectBtn) {
      injectBtn.onclick = async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab) return;
          
          if (!tab.url.includes('mail.google.com')) {
              showMessage('To działa tylko na Gmailu!', 'error');
              return;
          }
          
          try {
              await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content.js']
              });
              // Również wstrzyknij CSS jeśli trzeba
              await chrome.scripting.insertCSS({
                  target: { tabId: tab.id },
                  files: ['content.css']
              });
              
              showMessage('Panel wstrzyknięty!', 'success');
              // Zamknij popup
              setTimeout(() => window.close(), 1000);
          } catch (e) {
              showMessage('Błąd: ' + e.message, 'error');
          }
      };
  }

  // Open CRM link
  openCrmBtn.onclick = (e) => {
    e.preventDefault();
    let url = crmUrlInput.value || 'https://montazreklam24.pl/crm';
    
    // HACK dla wersji lokalnej:
    // Jeśli URL wskazuje na backend (8080), a my chcemy otworzyć frontend (3003)
    if (url.includes(':8080')) {
        url = url.replace(':8080', ':3000');
    }
    
    chrome.tabs.create({ url });
  };
  
  // Save settings
  saveBtn.onclick = async () => {
    const newSettings = {
      crmUrl: crmUrlInput.value.trim(),
      crmToken: crmTokenInput.value.trim(),
      geminiApiKey: geminiApiKeyInput.value.trim(),
      autoAnalyze: autoAnalyzeCheckbox.checked,
      importAttachments: importAttachmentsCheckbox.checked
    };
    
    // Validate
    if (!newSettings.crmUrl) {
      showMessage('Podaj URL do CRM', 'error');
      return;
    }
    
    if (!newSettings.geminiApiKey) {
      showMessage('Podaj klucz API Gemini', 'error');
      return;
    }
    
    // Save
    await chrome.runtime.sendMessage({ action: 'saveSettings', settings: newSettings });
    
    showMessage('Ustawienia zapisane!', 'success');
    
    // Jeśli włączono automatyczne pobieranie załączników, przypomnij o teście Gmail
    if (newSettings.importAttachments) {
      setTimeout(() => {
        showMessage('💡 Włączono pobieranie załączników! Kliknij "Testuj Gmail OAuth" aby sprawdzić połączenie.', 'success');
      }, 1500);
    }
    
    // Check connection
    await checkConnection(newSettings);
    
    // Odśwież diagnostykę jeśli jest otwarta
    if (diagnosticsPanel && diagnosticsPanel.style.display !== 'none') {
      await loadDiagnostics();
    }
  };
  
  // Test connection
  testBtn.onclick = async () => {
    testBtn.disabled = true;
    testBtn.textContent = '⏳ Sprawdzam...';
    
    const testSettings = {
      crmUrl: crmUrlInput.value.trim(),
      crmToken: crmTokenInput.value.trim()
    };
    
    const result = await chrome.runtime.sendMessage({ 
      action: 'testConnection', 
      settings: testSettings 
    });
    
    testBtn.disabled = false;
    testBtn.textContent = '🔌 Testuj połączenie CRM';
    
    if (result.success) {
      showMessage('Połączenie OK!', 'success');
      updateStatus(true);
    } else {
      showMessage(result.error || 'Błąd połączenia', 'error');
      updateStatus(false);
    }
  };
  
  // Test Gmail OAuth connection
  if (testGmailBtn) {
    testGmailBtn.onclick = async () => {
      testGmailBtn.disabled = true;
      testGmailBtn.textContent = '⏳ Sprawdzam Gmail...';
      
      try {
        const result = await chrome.runtime.sendMessage({ 
          action: 'testGmailConnection'
        });
        
        testGmailBtn.disabled = false;
        testGmailBtn.textContent = '📧 Testuj Gmail OAuth';
        
        if (result.success) {
          showMessage(`✅ Gmail OAuth OK! Email: ${result.emailAddress || 'Połączono'}`, 'success');
          // Odśwież status w diagnostyce jeśli jest otwarta
          if (diagnosticsPanel && diagnosticsPanel.style.display !== 'none') {
            await loadDiagnostics();
          }
        } else {
          const errorMsg = result.error || 'Nieznany błąd';
          showMessage(`❌ Gmail OAuth błąd: ${errorMsg}`, 'error');
          // Jeśli błąd autoryzacji, pokaż pomoc
          if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('authentication')) {
            setTimeout(() => {
              showMessage('💡 Wskazówka: Spróbuj ponownie - otworzy się okno logowania Google', 'success');
            }, 3000);
          }
        }
      } catch (e) {
        testGmailBtn.disabled = false;
        testGmailBtn.textContent = '📧 Testuj Gmail OAuth';
        showMessage('Błąd: ' + e.message, 'error');
      }
    };
  }
  
  // Check connection on load
  async function checkConnection(settings) {
    if (!settings.crmUrl || !settings.crmToken) {
      updateStatus(false, 'Skonfiguruj połączenie');
      return;
    }
    
    const result = await chrome.runtime.sendMessage({ 
      action: 'testConnection', 
      settings 
    });
    
    if (result.success) {
      updateStatus(true);
    } else {
      updateStatus(false, result.error);
    }
  }
  
  function updateStatus(connected, text = null) {
    statusDot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
    
    if (text) {
      statusText.innerHTML = text;
    } else if (connected) {
      statusText.innerHTML = '<strong>Połączono</strong> z CRM';
    } else {
      statusText.innerHTML = '<strong>Brak połączenia</strong>';
    }
  }
  
  function showMessage(text, type) {
    message.textContent = text;
    message.className = 'message ' + type;
    
    setTimeout(() => {
      message.className = 'message';
    }, 3000);
  }
  
  async function loadDiagnostics() {
    // Check Gmail status
    const gmailStatusText = document.getElementById('gmailStatusText');
    if (gmailStatusText) {
      try {
        const gmailResult = await chrome.runtime.sendMessage({ action: 'testGmailConnection' });
        if (gmailResult.success) {
          gmailStatusText.textContent = `✅ Połączono (${gmailResult.emailAddress || 'OK'})`;
          gmailStatusText.style.color = '#10b981';
        } else {
          gmailStatusText.textContent = `❌ Błąd: ${gmailResult.error || 'Nieznany błąd'}`;
          gmailStatusText.style.color = '#ef4444';
        }
      } catch (e) {
        gmailStatusText.textContent = `❌ Błąd: ${e.message}`;
        gmailStatusText.style.color = '#ef4444';
      }
    }
    
    // Load debug logs
    const debugLogsDiv = document.getElementById('debugLogs');
    if (debugLogsDiv) {
      try {
        const logs = await chrome.runtime.sendMessage({ action: 'getDebugLogs' });
        if (logs && logs.length > 0) {
          const logText = logs.slice(-20).reverse().map(log => {
            const time = new Date(log.timestamp).toLocaleTimeString('pl-PL');
            const levelIcon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️';
            const dataStr = log.data ? `\n   Data: ${log.data}` : '';
            return `[${time}] ${levelIcon} [${log.category}] ${log.message}${dataStr}`;
          }).join('\n\n');
          debugLogsDiv.textContent = logText || 'Brak logów';
        } else {
          debugLogsDiv.textContent = 'Brak logów';
        }
      } catch (e) {
        debugLogsDiv.textContent = `Błąd ładowania logów: ${e.message}`;
      }
    }
  }
});











