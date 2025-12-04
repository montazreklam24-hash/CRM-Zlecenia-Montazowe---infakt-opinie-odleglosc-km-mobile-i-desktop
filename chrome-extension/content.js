/**
 * CRM Gmail Extension - Content Script
 * Wstrzykiwany w Gmail, dodaje przycisk CRM i panel boczny
 */

(function() {
  'use strict';
  
  console.log('[CRM] Content script loaded');
  
  let sidebar = null;
  let currentEmailData = null;
  let analysisResult = null;
  
  // =========================================================================
  // OBSERWATOR GMAIL
  // =========================================================================
  
  // Gmail to SPA, musimy obserwować zmiany DOM
  const observer = new MutationObserver((mutations) => {
    checkForEmail();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // =========================================================================
  // DETEKCJA OTWARTEGO EMAILA
  // =========================================================================
  
  function checkForEmail() {
    // Sprawdź czy mamy otwarty email (widok pojedynczego maila)
    const emailView = document.querySelector('[data-message-id]');
    
    if (emailView && !document.querySelector('.crm-btn')) {
      addCrmButton();
    }
    
    // Ukryj sidebar jeśli wracamy do listy
    if (!emailView && sidebar) {
      sidebar.classList.remove('open');
    }
  }
  
  // =========================================================================
  // PRZYCISK CRM W TOOLBARZE
  // =========================================================================
  
  function addCrmButton() {
    // Znajdź toolbar akcji (przy przycisku odpowiedz, prześlij dalej)
    const toolbar = document.querySelector('[gh="mtb"]') || 
                    document.querySelector('.ade') ||
                    document.querySelector('[role="toolbar"]');
    
    if (!toolbar || toolbar.querySelector('.crm-btn')) return;
    
    const btn = document.createElement('button');
    btn.className = 'crm-btn';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M9 21V9"/>
      </svg>
      <span>CRM</span>
    `;
    btn.title = 'Dodaj do CRM';
    btn.onclick = handleCrmClick;
    
    toolbar.appendChild(btn);
    console.log('[CRM] Button added');
  }
  
  async function handleCrmClick() {
    // Wyciągnij dane z emaila
    currentEmailData = extractEmailData();
    
    if (!currentEmailData.body) {
      alert('Nie udało się odczytać treści maila');
      return;
    }
    
    // Pokaż sidebar z loaderem
    showSidebar({ loading: true });
    
    // Analizuj przez Gemini
    const result = await chrome.runtime.sendMessage({
      action: 'analyzeEmail',
      data: currentEmailData
    });
    
    analysisResult = result;
    
    if (result.success) {
      showSidebar({ data: result.data });
    } else {
      showSidebar({ error: result.error });
    }
  }
  
  // =========================================================================
  // EKSTRAKCJA DANYCH Z EMAILA
  // =========================================================================
  
  function extractEmailData() {
    // Nagłówki
    const fromEl = document.querySelector('[email]');
    const from = fromEl ? fromEl.getAttribute('email') : '';
    const fromName = fromEl ? fromEl.getAttribute('name') || fromEl.textContent : '';
    
    // Temat
    const subjectEl = document.querySelector('h2[data-thread-perm-id]') ||
                      document.querySelector('[data-legacy-thread-id]')?.closest('tr')?.querySelector('td:nth-child(7)');
    const subject = subjectEl ? subjectEl.textContent.trim() : '';
    
    // Data
    const dateEl = document.querySelector('[title][data-tooltip]') ||
                   document.querySelector('.g3');
    const date = dateEl ? dateEl.getAttribute('title') || dateEl.textContent : '';
    
    // Treść maila
    const bodyEl = document.querySelector('[data-message-id] .a3s.aiL') ||
                   document.querySelector('[data-message-id] .ii.gt');
    let body = '';
    
    if (bodyEl) {
      // Pobierz tekst bez HTML
      body = bodyEl.innerText || '';
      
      // Jeśli jest wiele wiadomości w wątku, pobierz wszystkie
      const allMessages = document.querySelectorAll('[data-message-id] .a3s.aiL, [data-message-id] .ii.gt');
      if (allMessages.length > 1) {
        body = Array.from(allMessages)
          .map(el => el.innerText)
          .join('\n\n---\n\n');
      }
    }
    
    // ID wątku (do powiązania z CRM)
    const threadEl = document.querySelector('[data-thread-perm-id]');
    const threadId = threadEl ? threadEl.getAttribute('data-thread-perm-id') : null;
    
    console.log('[CRM] Extracted:', { from, subject, bodyLength: body.length });
    
    return {
      from,
      fromName,
      subject,
      date,
      body: body.substring(0, 10000), // Limit dla Gemini
      threadId
    };
  }
  
  // =========================================================================
  // SIDEBAR
  // =========================================================================
  
  function showSidebar(state) {
    if (!sidebar) {
      createSidebar();
    }
    
    sidebar.classList.add('open');
    updateSidebarContent(state);
  }
  
  function createSidebar() {
    sidebar = document.createElement('div');
    sidebar.className = 'crm-sidebar';
    sidebar.innerHTML = `
      <div class="crm-sidebar-header">
        <div class="crm-sidebar-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18"/>
            <path d="M9 21V9"/>
          </svg>
          CRM Assistant
        </div>
        <button class="crm-sidebar-close" title="Zamknij">✕</button>
      </div>
      <div class="crm-sidebar-content">
        <!-- Content will be injected here -->
      </div>
    `;
    
    document.body.appendChild(sidebar);
    
    // Close button
    sidebar.querySelector('.crm-sidebar-close').onclick = () => {
      sidebar.classList.remove('open');
    };
  }
  
  function updateSidebarContent(state) {
    const content = sidebar.querySelector('.crm-sidebar-content');
    
    if (state.loading) {
      content.innerHTML = `
        <div class="crm-loading">
          <div class="crm-spinner"></div>
          <p>Analizuję email z Gemini AI...</p>
        </div>
      `;
      return;
    }
    
    if (state.error) {
      content.innerHTML = `
        <div class="crm-error">
          <span class="crm-error-icon">⚠️</span>
          <p>${state.error}</p>
          <button class="crm-btn-secondary" onclick="window.crmRetryAnalysis()">Spróbuj ponownie</button>
        </div>
      `;
      return;
    }
    
    const data = state.data;
    const confidence = Math.round((data.confidence || 0.5) * 100);
    
    content.innerHTML = `
      <div class="crm-analysis">
        <div class="crm-confidence">
          <span class="crm-confidence-badge ${confidence >= 70 ? 'high' : confidence >= 40 ? 'medium' : 'low'}">
            ${confidence}% pewności
          </span>
          ${data.isUrgent ? '<span class="crm-urgent-badge">🔥 PILNE</span>' : ''}
        </div>
        
        <div class="crm-section">
          <h4>📝 Tytuł zlecenia</h4>
          <input type="text" id="crm-title" class="crm-input" value="${escapeHtml(data.suggestedTitle || '')}" placeholder="Tytuł zlecenia...">
        </div>
        
        <div class="crm-section">
          <h4>👤 Dane kontaktowe</h4>
          <div class="crm-field-row">
            <label>Telefon</label>
            <input type="tel" id="crm-phone" class="crm-input" value="${escapeHtml(data.phone || '')}">
            ${data.phone ? `<a href="tel:${data.phone}" class="crm-action-btn" title="Zadzwoń">📞</a>` : ''}
          </div>
          <div class="crm-field-row">
            <label>Email</label>
            <input type="email" id="crm-email" class="crm-input" value="${escapeHtml(data.email || currentEmailData.from || '')}">
          </div>
          <div class="crm-field-row">
            <label>Imię</label>
            <input type="text" id="crm-firstName" class="crm-input" value="${escapeHtml(data.firstName || '')}">
          </div>
          <div class="crm-field-row">
            <label>Nazwisko</label>
            <input type="text" id="crm-lastName" class="crm-input" value="${escapeHtml(data.lastName || '')}">
          </div>
        </div>
        
        <div class="crm-section">
          <h4>🏢 Firma</h4>
          <div class="crm-field-row">
            <label>Nazwa</label>
            <input type="text" id="crm-company" class="crm-input" value="${escapeHtml(data.companyName || '')}">
          </div>
          <div class="crm-field-row">
            <label>NIP</label>
            <input type="text" id="crm-nip" class="crm-input" value="${escapeHtml(data.nip || '')}" placeholder="123-456-78-90">
          </div>
        </div>
        
        <div class="crm-section">
          <h4>📍 Adres montażu</h4>
          ${data.address ? `
            <div class="crm-address-preview">
              ${formatAddress(data.address)}
              <a href="https://www.google.com/maps/search/${encodeURIComponent(formatAddress(data.address))}" 
                 target="_blank" class="crm-action-btn" title="Nawiguj">🗺️</a>
            </div>
          ` : '<p class="crm-muted">Nie wykryto adresu</p>'}
          <div class="crm-field-row">
            <label>Ulica</label>
            <input type="text" id="crm-street" class="crm-input" value="${escapeHtml(data.address?.street || '')}">
          </div>
          <div class="crm-field-row half">
            <div>
              <label>Nr budynku</label>
              <input type="text" id="crm-buildingNo" class="crm-input" value="${escapeHtml(data.address?.buildingNo || '')}">
            </div>
            <div>
              <label>Nr lokalu</label>
              <input type="text" id="crm-apartmentNo" class="crm-input" value="${escapeHtml(data.address?.apartmentNo || '')}">
            </div>
          </div>
          <div class="crm-field-row half">
            <div>
              <label>Kod</label>
              <input type="text" id="crm-postCode" class="crm-input" value="${escapeHtml(data.address?.postCode || '')}">
            </div>
            <div>
              <label>Miasto</label>
              <input type="text" id="crm-city" class="crm-input" value="${escapeHtml(data.address?.city || '')}">
            </div>
          </div>
          <div class="crm-field-row">
            <label>Dzielnica</label>
            <input type="text" id="crm-district" class="crm-input" value="${escapeHtml(data.address?.district || '')}">
          </div>
        </div>
        
        <div class="crm-section">
          <h4>🔧 Zakres prac</h4>
          <textarea id="crm-scopeOfWork" class="crm-textarea" rows="3">${escapeHtml(data.scopeOfWork || '')}</textarea>
        </div>
        
        <div class="crm-section crm-client-lookup">
          <h4>🔍 Klient w CRM</h4>
          <button class="crm-btn-secondary crm-full-width" onclick="window.crmSearchClient()">
            Szukaj istniejącego klienta
          </button>
          <div id="crm-client-results" class="crm-client-results"></div>
        </div>
        
        <div class="crm-actions">
          <button class="crm-btn-primary crm-full-width" onclick="window.crmCreateJob()">
            ➕ Utwórz zlecenie w CRM
          </button>
          <div class="crm-actions-secondary">
            <button class="crm-btn-secondary" onclick="window.crmCreateClient()">
              👤 Tylko klient
            </button>
            <button class="crm-btn-secondary" onclick="window.crmCopyData()">
              📋 Kopiuj dane
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Ustaw globalne handlery
    window.crmRetryAnalysis = handleCrmClick;
    window.crmCreateJob = createJob;
    window.crmSearchClient = searchClient;
    window.crmCreateClient = createClient;
    window.crmCopyData = copyData;
    window.crmSelectClient = selectClient;
  }
  
  // =========================================================================
  // AKCJE
  // =========================================================================
  
  async function createJob() {
    const data = collectFormData();
    
    showSidebar({ loading: true });
    
    const result = await chrome.runtime.sendMessage({
      action: 'createJob',
      data: {
        title: data.title,
        clientName: data.firstName + ' ' + data.lastName,
        companyName: data.company,
        contactPerson: data.firstName + ' ' + data.lastName,
        phone: data.phone,
        fullAddress: formatAddressFromForm(data),
        scopeOfWork: data.scopeOfWork,
        threadId: currentEmailData?.threadId,
        clientId: data.selectedClientId || null
      }
    });
    
    if (result.success) {
      showSuccess('Zlecenie utworzone!', result.job);
    } else {
      showSidebar({ error: result.error });
    }
  }
  
  async function searchClient() {
    const data = collectFormData();
    const query = data.phone || data.email || data.company || data.nip;
    
    if (!query) {
      alert('Podaj telefon, email, nazwę firmy lub NIP');
      return;
    }
    
    const resultsDiv = document.getElementById('crm-client-results');
    resultsDiv.innerHTML = '<div class="crm-loading-small">Szukam...</div>';
    
    const result = await chrome.runtime.sendMessage({
      action: 'searchClient',
      query
    });
    
    if (result.success && result.clients.length > 0) {
      resultsDiv.innerHTML = result.clients.map(client => `
        <div class="crm-client-item" onclick="window.crmSelectClient(${client.id}, '${escapeHtml(client.displayName)}')">
          <strong>${escapeHtml(client.displayName)}</strong>
          ${client.nip ? `<span class="crm-muted">NIP: ${client.nip}</span>` : ''}
          ${client.phone ? `<span class="crm-muted">📞 ${client.phone}</span>` : ''}
        </div>
      `).join('');
    } else {
      resultsDiv.innerHTML = '<p class="crm-muted">Nie znaleziono klienta</p>';
    }
  }
  
  async function createClient() {
    const data = collectFormData();
    
    const result = await chrome.runtime.sendMessage({
      action: 'createClient',
      data: {
        type: data.company ? 'company' : 'person',
        companyName: data.company,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        nip: data.nip,
        street: data.street,
        buildingNo: data.buildingNo,
        apartmentNo: data.apartmentNo,
        postCode: data.postCode,
        city: data.city
      }
    });
    
    if (result.success) {
      alert('Klient utworzony: ' + result.client.displayName);
      selectClient(result.client.id, result.client.displayName);
    } else {
      alert('Błąd: ' + result.error);
    }
  }
  
  function selectClient(clientId, displayName) {
    // Zapisz wybranego klienta
    const hiddenInput = document.getElementById('crm-selectedClientId') || document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = 'crm-selectedClientId';
    hiddenInput.value = clientId;
    sidebar.querySelector('.crm-sidebar-content').appendChild(hiddenInput);
    
    // Pokaż info
    const resultsDiv = document.getElementById('crm-client-results');
    resultsDiv.innerHTML = `<div class="crm-client-selected">✅ Wybrany: ${escapeHtml(displayName)}</div>`;
  }
  
  function copyData() {
    const data = collectFormData();
    
    const text = `
Tytuł: ${data.title}
Telefon: ${data.phone}
Email: ${data.email}
Firma: ${data.company}
NIP: ${data.nip}
Kontakt: ${data.firstName} ${data.lastName}
Adres: ${formatAddressFromForm(data)}
Zakres: ${data.scopeOfWork}
    `.trim();
    
    navigator.clipboard.writeText(text);
    alert('Dane skopiowane do schowka!');
  }
  
  function showSuccess(message, job) {
    const content = sidebar.querySelector('.crm-sidebar-content');
    content.innerHTML = `
      <div class="crm-success">
        <div class="crm-success-icon">✅</div>
        <h3>${message}</h3>
        <p>Nr zlecenia: <strong>${job.friendlyId || job.id}</strong></p>
        <p>${job.jobTitle}</p>
        <div class="crm-actions">
          <button class="crm-btn-primary" onclick="window.open('${getCrmUrl()}/jobs/${job.id}', '_blank')">
            Otwórz w CRM
          </button>
          <button class="crm-btn-secondary" onclick="window.crmSidebar.classList.remove('open')">
            Zamknij
          </button>
        </div>
      </div>
    `;
    window.crmSidebar = sidebar;
  }
  
  // =========================================================================
  // HELPERS
  // =========================================================================
  
  function collectFormData() {
    return {
      title: document.getElementById('crm-title')?.value || '',
      phone: document.getElementById('crm-phone')?.value || '',
      email: document.getElementById('crm-email')?.value || '',
      firstName: document.getElementById('crm-firstName')?.value || '',
      lastName: document.getElementById('crm-lastName')?.value || '',
      company: document.getElementById('crm-company')?.value || '',
      nip: document.getElementById('crm-nip')?.value || '',
      street: document.getElementById('crm-street')?.value || '',
      buildingNo: document.getElementById('crm-buildingNo')?.value || '',
      apartmentNo: document.getElementById('crm-apartmentNo')?.value || '',
      postCode: document.getElementById('crm-postCode')?.value || '',
      city: document.getElementById('crm-city')?.value || '',
      district: document.getElementById('crm-district')?.value || '',
      scopeOfWork: document.getElementById('crm-scopeOfWork')?.value || '',
      selectedClientId: document.getElementById('crm-selectedClientId')?.value || null
    };
  }
  
  function formatAddress(addr) {
    if (!addr) return '';
    const parts = [];
    if (addr.street) {
      let streetPart = addr.street;
      if (addr.buildingNo) streetPart += ' ' + addr.buildingNo;
      if (addr.apartmentNo) streetPart += '/' + addr.apartmentNo;
      parts.push(streetPart);
    }
    if (addr.postCode || addr.city) {
      parts.push([addr.postCode, addr.city].filter(Boolean).join(' '));
    }
    if (addr.district) {
      parts.push('(' + addr.district + ')');
    }
    return parts.join(', ');
  }
  
  function formatAddressFromForm(data) {
    const parts = [];
    if (data.street) {
      let streetPart = data.street;
      if (data.buildingNo) streetPart += ' ' + data.buildingNo;
      if (data.apartmentNo) streetPart += '/' + data.apartmentNo;
      parts.push(streetPart);
    }
    if (data.postCode || data.city) {
      parts.push([data.postCode, data.city].filter(Boolean).join(' '));
    }
    if (data.district) {
      parts.push('(' + data.district + ')');
    }
    return parts.join(', ');
  }
  
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }
  
  async function getCrmUrl() {
    const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
    return settings.crmUrl || 'https://montazreklam24.pl/crm';
  }
  
  // Start
  checkForEmail();
  
})();

