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
    
    // Check connection
    await checkConnection(newSettings);
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
    testBtn.textContent = '🔌 Testuj połączenie';
    
    if (result.success) {
      showMessage('Połączenie OK!', 'success');
      updateStatus(true);
    } else {
      showMessage(result.error || 'Błąd połączenia', 'error');
      updateStatus(false);
    }
  };
  
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
});











