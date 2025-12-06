/**
 * CRM Gmail Extension - Content Script
 * Uproszczona wersja z 2 przyciskami: ZACZYTAJ / WYŚLIJ DO CRM
 */

(function() {
  'use strict';
  
  console.log('[CRM] Content script loaded v2.0');
  
  let sidebar = null;
  let currentEmailData = null;
  let formData = {
    title: '',
    phone: '',
    email: '',
    contactPerson: '',
    companyName: '',
    nip: '',
    address: '',
    scopeOfWork: ''
  };
  
  // =========================================================================
  // OBSERWATOR GMAIL - wykrywa otwarcie maila
  // =========================================================================
  
  const observer = new MutationObserver(() => {
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
    const emailView = document.querySelector('[data-message-id]');
    
    if (emailView && !document.querySelector('.crm-btn')) {
      addCrmButton();
    }
    
    if (!emailView && sidebar) {
      sidebar.classList.remove('open');
    }
  }
  
  // =========================================================================
  // PRZYCISK CRM W TOOLBARZE GMAIL
  // =========================================================================
  
  function addCrmButton() {
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
    btn.title = 'Otwórz panel CRM';
    btn.onclick = openSidebar;
    
    toolbar.appendChild(btn);
    console.log('[CRM] Button added to toolbar');
  }
  
  // =========================================================================
  // EKSTRAKCJA DANYCH Z EMAILA
  // =========================================================================
  
  function extractEmailData() {
    // Email nadawcy
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
    
    // Treść maila (cały wątek)
    const allMessages = document.querySelectorAll('[data-message-id] .a3s.aiL, [data-message-id] .ii.gt');
    let body = '';
    
    if (allMessages.length > 0) {
      body = Array.from(allMessages)
        .map(el => el.innerText)
        .join('\n\n---\n\n');
    }
    
    // ID wątku
    const threadEl = document.querySelector('[data-thread-perm-id]');
    const threadId = threadEl ? threadEl.getAttribute('data-thread-perm-id') : null;
    
    console.log('[CRM] Extracted email:', { from, subject, bodyLength: body.length });
    
    return {
      from,
      fromName,
      subject,
      date,
      body: body.substring(0, 15000), // Limit dla Gemini
      threadId
    };
  }
  
  // =========================================================================
  // SIDEBAR - PANEL BOCZNY
  // =========================================================================
  
  function openSidebar() {
    currentEmailData = extractEmailData();
    
    if (!sidebar) {
      createSidebar();
    }
    
    // Ustaw email z nagłówka
    formData.email = currentEmailData.from || '';
    
    sidebar.classList.add('open');
    renderSidebarContent();
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
          CRM Montaż 24
        </div>
        <button class="crm-sidebar-close" title="Zamknij">✕</button>
      </div>
      <div class="crm-sidebar-content"></div>
    `;
    
    document.body.appendChild(sidebar);
    
    sidebar.querySelector('.crm-sidebar-close').onclick = () => {
      sidebar.classList.remove('open');
    };
  }
  
  function renderSidebarContent(state = 'form') {
    const content = sidebar.querySelector('.crm-sidebar-content');
    
    if (state === 'loading') {
      content.innerHTML = `
        <div class="crm-loading">
          <div class="crm-spinner"></div>
          <p>Analizuję email z Gemini AI...</p>
        </div>
      `;
      return;
    }
    
    if (state === 'sending') {
      content.innerHTML = `
        <div class="crm-loading">
          <div class="crm-spinner"></div>
          <p>Tworzę zlecenie w CRM...</p>
        </div>
      `;
      return;
    }
    
    if (state === 'success') {
      content.innerHTML = `
        <div class="crm-success">
          <div class="crm-success-icon">✅</div>
          <h3>Zlecenie utworzone!</h3>
          <p>Możesz teraz zamknąć panel.</p>
          <button class="crm-btn-secondary crm-full-width" onclick="document.querySelector('.crm-sidebar').classList.remove('open')">
            Zamknij
          </button>
        </div>
      `;
      return;
    }
    
    if (state === 'error') {
      content.innerHTML = `
        <div class="crm-error">
          <span class="crm-error-icon">⚠️</span>
          <p>Wystąpił błąd. Sprawdź ustawienia rozszerzenia.</p>
          <button class="crm-btn-secondary" id="crm-retry-btn">Spróbuj ponownie</button>
        </div>
      `;
      content.querySelector('#crm-retry-btn').onclick = () => renderSidebarContent('form');
      return;
    }
    
    // FORMULARZ
    content.innerHTML = `
      <div class="crm-form">
        <!-- 2 GŁÓWNE PRZYCISKI -->
        <div class="crm-main-actions">
          <button class="crm-btn-primary crm-full-width" id="crm-read-btn">
            📧 ZACZYTAJ Z MAILA
          </button>
          <p class="crm-hint">Gemini AI przeanalizuje wątek i wypełni pola</p>
        </div>
        
        <hr class="crm-divider">
        
        <!-- FORMULARZ Z POLAMI -->
        <div class="crm-section">
          <h4>📝 Dane zlecenia</h4>
          
          <div class="crm-field">
            <label>Tytuł zlecenia</label>
            <input type="text" id="crm-title" value="${escapeHtml(formData.title)}" placeholder="np. Montaż kaseton Żabka Mokotów">
          </div>
          
          <div class="crm-field">
            <label>Zakres prac</label>
            <textarea id="crm-scope" rows="3" placeholder="Co trzeba zrobić...">${escapeHtml(formData.scopeOfWork)}</textarea>
          </div>
        </div>
        
        <div class="crm-section">
          <h4>👤 Kontakt</h4>
          
          <div class="crm-field">
            <label>Telefon</label>
            <input type="tel" id="crm-phone" value="${escapeHtml(formData.phone)}" placeholder="500 100 200">
          </div>
          
          <div class="crm-field">
            <label>Email</label>
            <input type="email" id="crm-email" value="${escapeHtml(formData.email)}" placeholder="klient@firma.pl">
          </div>
          
          <div class="crm-field">
            <label>Osoba kontaktowa</label>
            <input type="text" id="crm-contact" value="${escapeHtml(formData.contactPerson)}" placeholder="Jan Kowalski">
          </div>
        </div>
        
        <div class="crm-section">
          <h4>🏢 Firma</h4>
          
          <div class="crm-field">
            <label>Nazwa firmy</label>
            <input type="text" id="crm-company" value="${escapeHtml(formData.companyName)}" placeholder="Firma Sp. z o.o.">
          </div>
          
          <div class="crm-field">
            <label>NIP</label>
            <input type="text" id="crm-nip" value="${escapeHtml(formData.nip)}" placeholder="123-456-78-90">
          </div>
        </div>
        
        <div class="crm-section">
          <h4>📍 Adres montażu</h4>
          
          <div class="crm-field">
            <label>Pełny adres</label>
            <textarea id="crm-address" rows="2" placeholder="ul. Przykładowa 10, 00-001 Warszawa">${escapeHtml(formData.address)}</textarea>
          </div>
        </div>
        
        <hr class="crm-divider">
        
        <!-- PRZYCISK WYŚLIJ -->
        <div class="crm-main-actions">
          <button class="crm-btn-success crm-full-width" id="crm-send-btn">
            🚀 WYŚLIJ DO CRM
          </button>
          <p class="crm-hint">Utworzy zlecenie w systemie CRM</p>
        </div>
      </div>
    `;
    
    // Event listenery
    content.querySelector('#crm-read-btn').onclick = handleReadFromEmail;
    content.querySelector('#crm-send-btn').onclick = handleSendToCRM;
    
    // Zapisuj dane przy zmianie pól
    const inputs = content.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const field = e.target.id.replace('crm-', '');
        const mapping = {
          'title': 'title',
          'scope': 'scopeOfWork',
          'phone': 'phone',
          'email': 'email',
          'contact': 'contactPerson',
          'company': 'companyName',
          'nip': 'nip',
          'address': 'address'
        };
        if (mapping[field]) {
          formData[mapping[field]] = e.target.value;
        }
      });
    });
  }
  
  // =========================================================================
  // AKCJA: ZACZYTAJ Z MAILA (Gemini)
  // =========================================================================
  
  async function handleReadFromEmail() {
    if (!currentEmailData || !currentEmailData.body) {
      alert('Nie udało się odczytać treści maila. Otwórz email i spróbuj ponownie.');
      return;
    }
    
    renderSidebarContent('loading');
    
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'analyzeEmail',
        data: currentEmailData
      });
      
      if (result.success && result.data) {
        // Wypełnij formData danymi z Gemini
        const d = result.data;
        formData.title = d.suggestedTitle || '';
        formData.phone = d.phone || '';
        formData.email = d.email || currentEmailData.from || '';
        formData.contactPerson = [d.firstName, d.lastName].filter(Boolean).join(' ') || '';
        formData.companyName = d.companyName || '';
        formData.nip = d.nip || '';
        formData.scopeOfWork = d.scopeOfWork || '';
        
        // Adres
        if (d.address) {
          const addr = d.address;
          const parts = [];
          if (addr.street) {
            let street = addr.street;
            if (addr.buildingNo) street += ' ' + addr.buildingNo;
            if (addr.apartmentNo) street += '/' + addr.apartmentNo;
            parts.push(street);
          }
          if (addr.postCode || addr.city) {
            parts.push([addr.postCode, addr.city].filter(Boolean).join(' '));
          }
          if (addr.district) {
            parts.push('(' + addr.district + ')');
          }
          formData.address = parts.join(', ');
        }
        
        console.log('[CRM] Gemini parsed:', formData);
        renderSidebarContent('form');
        
      } else {
        console.error('[CRM] Gemini error:', result.error);
        alert('Błąd analizy: ' + (result.error || 'Nieznany błąd'));
        renderSidebarContent('form');
      }
      
    } catch (error) {
      console.error('[CRM] Error:', error);
      alert('Błąd połączenia z Gemini. Sprawdź ustawienia.');
      renderSidebarContent('form');
    }
  }
  
  // =========================================================================
  // AKCJA: WYŚLIJ DO CRM
  // =========================================================================
  
  async function handleSendToCRM() {
    // Walidacja
    if (!formData.title && !formData.phone && !formData.address) {
      alert('Wypełnij przynajmniej tytuł, telefon lub adres!');
      return;
    }
    
    renderSidebarContent('sending');
    
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'createJob',
        data: {
          title: formData.title || 'Zlecenie z Gmail',
          clientName: formData.contactPerson || formData.companyName || 'Nieznany',
          companyName: formData.companyName,
          contactPerson: formData.contactPerson,
          phone: formData.phone,
          email: formData.email,
          fullAddress: formData.address,
          scopeOfWork: formData.scopeOfWork,
          nip: formData.nip,
          threadId: currentEmailData?.threadId
        }
      });
      
      if (result.success) {
        console.log('[CRM] Job created:', result.job);
        renderSidebarContent('success');
        
        // Wyczyść formularz
        formData = {
          title: '',
          phone: '',
          email: '',
          contactPerson: '',
          companyName: '',
          nip: '',
          address: '',
          scopeOfWork: ''
        };
        
      } else {
        console.error('[CRM] Create job error:', result.error);
        alert('Błąd tworzenia zlecenia: ' + (result.error || 'Nieznany błąd'));
        renderSidebarContent('form');
      }
      
    } catch (error) {
      console.error('[CRM] Error:', error);
      alert('Błąd połączenia z CRM. Sprawdź ustawienia.');
      renderSidebarContent('form');
    }
  }
  
  // =========================================================================
  // HELPERS
  // =========================================================================
  
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }
  
  // Start
  checkForEmail();
  
})();
