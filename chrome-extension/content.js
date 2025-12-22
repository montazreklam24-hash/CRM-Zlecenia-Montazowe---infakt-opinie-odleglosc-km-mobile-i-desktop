/**
 * CRM Gmail Extension - Content Script
 * Wersja v5.3 - Image Compression Fix
 */

console.log('[CRM] Skrypt v5.3 załadowany!');

// --- STATE ---
let sidebar = null;
let lastMessageId = null;
let uploadedFiles = []; // Przechowuje ręcznie dodane pliki {name, data: base64}
let gmailAttachments = []; // Lista załączników pobrana z Gmail API
let selectedAttachmentIds = []; // ID wybranych załączników z Gmaila

// --- FLOATING BUTTON ---

function createFloatingButton() {
    if (document.getElementById('crm-floating-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'crm-floating-btn';
    btn.innerText = 'CRM';
    
    // Style
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '64px',
        height: '64px',
        backgroundColor: '#f97316',
        color: 'white',
        borderRadius: '50%',
        boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '16px',
        cursor: 'pointer',
        zIndex: '2147483647',
        transition: 'transform 0.2s',
        userSelect: 'none',
        fontFamily: 'Arial, sans-serif',
        border: '2px solid white'
    });

    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout = () => btn.style.transform = 'scale(1.0)';

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSidebar();
    };

    document.body.appendChild(btn);
}

// Sprawdzaj co sekundę
setInterval(createFloatingButton, 1000);


// --- SIDEBAR LOGIC ---

function openSidebar() {
    if (!document.querySelector('.crm-sidebar')) {
        createSidebar();
    }
    const sb = document.querySelector('.crm-sidebar');
    sb.style.display = 'flex';
    requestAnimationFrame(() => sb.classList.add('open'));
    renderSidebar('form');
    
    // Resetuj pliki przy otwarciu
    uploadedFiles = [];
    gmailAttachments = [];
    selectedAttachmentIds = [];
}

function createSidebar() {
    const div = document.createElement('div');
    div.className = 'crm-sidebar';
    div.style.display = 'none';
    div.innerHTML = `
        <div class="crm-sidebar-header">
            <div class="crm-sidebar-title">
               <span>CRM Montaż24</span>
            </div>
            <button id="crm-close" class="crm-sidebar-close">&times;</button>
        </div>
        <div class="crm-sidebar-content"></div>
    `;
    document.body.appendChild(div);
    
    div.querySelector('#crm-close').onclick = () => {
        div.classList.remove('open');
        setTimeout(() => div.style.display = 'none', 300);
    };

    // Globalny Paste listener (gdy sidebar otwarty)
    document.addEventListener('paste', handleGlobalPaste);
}

function handleGlobalPaste(e) {
    const sb = document.querySelector('.crm-sidebar');
    if (!sb || !sb.classList.contains('open')) return;

    if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        let hasFiles = false;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) {
                    processFile(file);
                    hasFiles = true;
                }
            }
        }
        
        if (hasFiles) {
            e.preventDefault(); // Zatrzymaj wklejanie w inne miejsca
        }
    }
}

function renderSidebar(state) {
    const content = document.querySelector('.crm-sidebar-content');
    if (!content) return;
    
    if (state === 'form') {
        content.innerHTML = `
            <div class="crm-form">
                <div id="crm-confidence-warning" class="crm-warning-banner" style="display: none;">
                    ⚠️ AI nie jest pewne tych danych. Sprawdź dokładnie!
                </div>
                
                <div class="crm-top-buttons">
                    <button id="crm-read" class="crm-btn-primary crm-btn-half">
                        ✨ Analizuj Maila (AI)
                    </button>
                    <button id="crm-send" class="crm-btn-success crm-btn-half">
                        🚀 Wyślij do CRM
                    </button>
                </div>
                
                <hr class="crm-divider" style="margin: 2px 0;">
                
                <div class="crm-field">
                    <label>Tytuł</label>
                    <input id="crm-input-title">
                </div>
                
                <div class="crm-field">
                    <label>Telefon</label>
                    <input id="crm-input-phone">
                </div>
                
                <div class="crm-field">
                    <label>Email</label>
                    <input id="crm-input-email">
                </div>

                <div class="crm-field">
                    <label>NIP</label>
                    <div style="display: flex; gap: 5px;">
                        <input id="crm-input-nip" style="flex: 1;">
                        <button id="crm-gus-btn" class="crm-btn-mini">GUS</button>
                    </div>
                </div>

                <div class="crm-field">
                    <label>Adres</label>
                    <textarea id="crm-input-address" rows="2"></textarea>
                </div>
                
                <div class="crm-field">
                    <label>Zakres prac</label>
                    <textarea id="crm-input-scope" rows="3"></textarea>
                </div>

                <!-- DRAG & DROP ZONE -->
                <div class="crm-field">
                    <label>Zdjęcia (Drag & Drop / Ctrl+V)</label>
                    <div id="crm-drop-zone" class="crm-drop-zone">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        <span id="crm-drop-text">Upuść pliki tutaj lub wklej</span>
                    </div>
                    <div id="crm-file-list" class="crm-file-list"></div>
                </div>

                <!-- GMAIL ATTACHMENTS SELECTION -->
                <div id="crm-gmail-attachments-section" class="crm-field" style="display: none; margin-top: 10px;">
                    <button id="crm-open-att-modal" class="crm-btn-secondary crm-full-width" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-size: 12px; padding: 8px;">
                        📎 Wybierz załączniki (<span id="crm-att-count">0</span>)
                    </button>
                </div>
            </div>
        `;
        
        setupFormHandlers(content);
        setupDragDrop(content);
        renderFileList(); // Jeśli coś było wcześniej dodane
        updateAttachmentsButton(); // Aktualizuj licznik na przycisku
    }
}

function setupDragDrop(content) {
    const dropZone = content.querySelector('#crm-drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('active'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });
    
    // Kliknięcie otwiera wybór plików
    dropZone.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*'; // Tylko obrazy
        input.onchange = (e) => handleFiles(e.target.files);
        input.click();
    });
}

function handleFiles(files) {
    ([...files]).forEach(processFile);
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        alert(`Plik ${file.name} nie jest obrazkiem.`);
        return;
    }
    
    const dropText = document.getElementById('crm-drop-text');
    if (dropText) dropText.innerText = 'Przetwarzam...';

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Kompresja i resize
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Max wymiar
            const MAX_WIDTH = 1600;
            const MAX_HEIGHT = 1600;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Kompresja JPEG 0.7
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            uploadedFiles.push({
                name: file.name.replace(/\.[^/.]+$/, "") + ".jpg", // Zawsze jpg
                type: 'image/jpeg',
                data: dataUrl
            });
            
            if (dropText) dropText.innerText = 'Upuść pliki tutaj lub wklej';
            renderFileList();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function renderFileList() {
    const list = document.getElementById('crm-file-list');
    if (!list) return;

    list.innerHTML = '';
    uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'crm-file-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'crm-file-name';
        nameSpan.innerText = file.name;
        
        const removeBtn = document.createElement('span');
        removeBtn.className = 'crm-file-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            uploadedFiles.splice(index, 1);
            renderFileList();
        };
        
        item.appendChild(nameSpan);
        item.appendChild(removeBtn);
        list.appendChild(item);
    });
}

function updateAttachmentsButton() {
    const section = document.getElementById('crm-gmail-attachments-section');
    const countSpan = document.getElementById('crm-att-count');
    if (!section || !countSpan) return;

    if (gmailAttachments.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    countSpan.innerText = selectedAttachmentIds.length;
}

function openAttachmentsModal() {
    const existing = document.querySelector('.crm-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'crm-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    
    modal.innerHTML = `
        <div class="crm-modal-header">
            <h2>Wybierz załączniki</h2>
            <button class="crm-modal-close" style="font-size: 30px; line-height: 1;">&times;</button>
        </div>
        <div class="crm-modal-body">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div class="crm-modal-actions">
                    <button id="crm-att-select-all" class="crm-btn-text">Zaznacz wszystko</button>
                    <span style="color: #cbd5e1;">|</span>
                    <button id="crm-att-select-none" class="crm-btn-text">Odznacz wszystko</button>
                </div>
                <div style="font-size: 12px; color: #64748b; font-weight: 600;">
                    Wybrano: <span id="crm-selected-count-modal">0</span> / ${gmailAttachments.length}
                </div>
            </div>
            
            <div class="crm-att-grid">
                <!-- Grid wyrenderowany przez JS -->
            </div>
        </div>
        <div class="crm-modal-footer">
            <button class="crm-btn-secondary crm-modal-cancel" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; width: auto; padding: 10px 24px;">Anuluj</button>
            <button class="crm-btn-primary crm-modal-save" style="width: auto; padding: 10px 32px;">Zastosuj wybór</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const grid = modal.querySelector('.crm-att-grid');
    const selectedCountSpan = modal.querySelector('#crm-selected-count-modal');
    
    function updateCountDisplay() {
        if (selectedCountSpan) selectedCountSpan.innerText = selectedAttachmentIds.length;
    }

    function renderGrid() {
        grid.innerHTML = '';
        gmailAttachments.forEach(att => {
            const isSelected = selectedAttachmentIds.includes(att.id);
            const card = document.createElement('div');
            card.className = `crm-att-card ${isSelected ? 'selected' : ''}`;
            card.dataset.id = att.id;
            
            const isImage = att.mimeType.startsWith('image/');
            const ext = att.name.split('.').pop().toUpperCase();

            card.innerHTML = `
                <div class="crm-att-checkbox"></div>
                <div class="crm-att-zoom-btn" title="Powiększ">🔍</div>
                ${isImage ? `
                    <img class="crm-att-preview" src="" alt="Ładowanie..." data-id="${att.id}">
                ` : `
                    <div class="crm-att-file-icon">
                        <span>${ext === 'PDF' ? '📕' : '📄'}</span>
                        <span>${ext}</span>
                    </div>
                `}
                <div class="crm-att-label">${att.name}</div>
            `;

            // Obsługa zaznaczania
            card.onclick = (e) => {
                // Jeśli kliknięto w lupę, nie zaznaczaj
                if (e.target.classList.contains('crm-att-zoom-btn')) return;
                
                const selected = !selectedAttachmentIds.includes(att.id);
                toggleAttachment(att.id, selected);
                card.classList.toggle('selected', selected);
                updateCountDisplay();
            };

            // Obsługa powiększania
            const zoomBtn = card.querySelector('.crm-att-zoom-btn');
            if (zoomBtn) {
                zoomBtn.onclick = (e) => {
                    e.stopPropagation();
                    showLargePreview(att);
                };
            }

            grid.appendChild(card);
            
            // Jeśli to obrazek, zacznij go ładować
            if (isImage) {
                loadThumbnail(att.id, att.messageId, card.querySelector('.crm-att-preview'));
            }
        });
        updateCountDisplay();
    }

    async function loadThumbnail(attachmentId, messageId, imgElement) {
        // Spróbuj pobrać z cache jeśli już pobieraliśmy
        const response = await chrome.runtime.sendMessage({
            action: 'getAttachmentData',
            messageId: messageId, // Użyj poprawnego ID wiadomości z której pochodzi załącznik
            attachmentId: attachmentId
        });

        if (response.success && response.data) {
            // Konwertuj base64url na base64
            const base64 = response.data.replace(/-/g, '+').replace(/_/g, '/');
            imgElement.src = `data:image/jpeg;base64,${base64}`;
        } else {
            imgElement.alt = "Błąd wczytywania";
        }
    }

    function showLargePreview(att) {
        const zoomOverlay = document.createElement('div');
        zoomOverlay.className = 'crm-zoom-overlay';
        
        const zoomImg = document.createElement('img');
        zoomImg.className = 'crm-zoom-image';
        zoomImg.src = ''; // Na razie puste
        
        zoomOverlay.appendChild(zoomImg);
        document.body.appendChild(zoomOverlay);

        // Załaduj pełny obrazek
        loadThumbnail(att.id, att.messageId, zoomImg);

        zoomOverlay.onclick = () => zoomOverlay.remove();
    }

    function toggleAttachment(id, selected) {
        if (selected) {
            if (!selectedAttachmentIds.includes(id)) selectedAttachmentIds.push(id);
        } else {
            selectedAttachmentIds = selectedAttachmentIds.filter(item => item !== id);
        }
    }

    modal.querySelector('#crm-att-select-all').onclick = () => {
        selectedAttachmentIds = gmailAttachments.map(a => a.id);
        renderGrid();
    };

    modal.querySelector('#crm-att-select-none').onclick = () => {
        selectedAttachmentIds = [];
        renderGrid();
    };

    modal.querySelector('.crm-modal-close').onclick = 
    modal.querySelector('.crm-modal-cancel').onclick = () => {
        overlay.remove();
    };

    modal.querySelector('.crm-modal-save').onclick = () => {
        updateAttachmentsButton();
        overlay.remove();
    };

    renderGrid();
}

/**
 * Pobiera aktualny Message ID z Gmaila używając wielu strategii
 * Zwraca prawdziwy Message ID (krótkie hex), nie Thread ID ani Legacy ID
 */
function getCurrentMessageId() {
    console.log('[CRM Content] Getting message ID...');
    
    // Strategia 1: DOM
    const legacyElements = document.querySelectorAll('div[data-legacy-message-id]');
    if (legacyElements.length > 0) {
        for (let i = legacyElements.length - 1; i >= 0; i--) {
            const id = legacyElements[i].getAttribute('data-legacy-message-id');
             if (id && id.length >= 10) return id;
        }
    }

    const legacyThreadElements = document.querySelectorAll('div[data-legacy-thread-id]');
    if (legacyThreadElements.length > 0) {
        for (let i = legacyThreadElements.length - 1; i >= 0; i--) {
            const id = legacyThreadElements[i].getAttribute('data-legacy-thread-id');
             if (id && id.length >= 10) return id;
        }
    }

    const messageElements = document.querySelectorAll('div[data-message-id]');
    if (messageElements.length > 0) {
        for (let i = messageElements.length - 1; i >= 0; i--) {
            const id = messageElements[i].getAttribute('data-message-id');
            if (id && id.length >= 10) return id;
        }
    }

    // Strategia 2: Sprawdź URL hash (Fallback)
    const hash = window.location.hash;
    if (hash) {
        // Parsuj hash: #inbox/18123abc...
        // Często ostatnia część to ID
        const parts = hash.split('/');
        // Szukamy części która wygląda jak ID (długa liczba szesnastkowa lub legacy)
        // Iterujemy od końca
        for (let i = parts.length - 1; i >= 0; i--) {
             const part = parts[i].split('?')[0].split('#')[0];
             // Walidacja ID: minimum 5 znaków, alfanumeryczne
             if (part.length > 5 && /^[a-zA-Z0-9_-]+$/.test(part)) {
                 console.log('[CRM Content] Found ID from URL hash:', part);
                 return part;
             }
        }
    }

    // Strategia 3: Sprawdź parametry URL (np. view=msg&th=...)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('th')) {
        const th = urlParams.get('th');
        console.log('[CRM Content] Found ID from URL param th:', th);
        return th;
    }
    
    // Strategia 4: Ostateczny fallback do DOM (nawet jeśli to FM id)
    if (messageElements.length > 0) {
        const lastMsg = messageElements[messageElements.length - 1];
        const id = lastMsg.getAttribute('data-message-id');
        if (id) {
             console.log('[CRM Content] Found fallback ID from DOM:', id);
             return id;
        }
    }
    
    console.warn('[CRM Content] Could not find Message ID');
    return null;
}

/**
 * Pobiera obrazy z aktualnego maila (z załączników i inline)
 * Zwraca tablicę obiektów {data: base64, mimeType: string}
 */
async function getEmailImages() {
    const images = [];
    
    try {
        // 1. Znajdź wszystkie obrazy w treści maila (inline)
        const emailBody = document.querySelector('[role="main"]') || document.body;
        const imgElements = emailBody.querySelectorAll('img[src]');
        
        for (const img of imgElements) {
            try {
                const src = img.src;
                // Pomiń obrazy systemowe Gmaila i te bez http/data (bezpieczniejszy fetch)
                if ((src.includes('googleusercontent.com') && !src.includes('attachment')) || 
                    (!src.startsWith('http') && !src.startsWith('data:'))) {
                    continue;
                }
                
                // Spróbuj pobrać obraz jako base64 z timeoutem
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(src, { signal: controller.signal }).catch(() => null);
                clearTimeout(timeoutId);

                if (response && response.ok) {
                    const blob = await response.blob();
                    if (blob.type.startsWith('image/')) {
                        const base64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        images.push({
                            data: base64,
                            mimeType: blob.type
                        });
                        console.log('[CRM Content] Found inline image:', blob.type, blob.size, 'bytes');
                    }
                }
            } catch (e) {
                console.warn('[CRM Content] Failed to extract image:', e);
            }
        }
        
        // 2. Jeśli mamy messageId, spróbuj pobrać załączniki przez API (jeśli użytkownik ma włączone importAttachments)
        // To będzie zrobione w background.js jeśli importAttachments jest włączone
        
    } catch (e) {
        console.error('[CRM Content] Error getting email images:', e);
    }
    
    return images;
}

function setupFormHandlers(content) {
    // PRZYCISK ZAŁĄCZNIKÓW
    const attBtn = content.querySelector('#crm-open-att-modal');
    if (attBtn) {
        attBtn.onclick = () => openAttachmentsModal();
    }

    // 1. ZACZYTAJ
    content.querySelector('#crm-read').onclick = async () => {
        const btn = content.querySelector('#crm-read');
        const originalText = btn.innerText;
        btn.innerText = '⏳ Analizuję...';
        btn.disabled = true;

        // Resetuj załączniki przed nową analizą
        gmailAttachments = [];
        selectedAttachmentIds = [];
        updateAttachmentsButton();

        try {
            const bodyText = document.body.innerText.substring(0, 15000); 
            
            // Pobierz ID używając nowej funkcji
            const messageId = getCurrentMessageId();
            lastMessageId = messageId;
            
            // Pobierz obrazy z maila (jeśli są)
            const emailImages = await getEmailImages();
            console.log('[CRM Content] Found', emailImages.length, 'images in email');
            
            // Pobierz adres email nadawcy z maila (jeśli dostępny)
            let fromEmail = null;
            try {
                // Spróbuj znaleźć email nadawcy w DOM Gmaila
                const fromElement = document.querySelector('[email]');
                if (fromElement) {
                    fromEmail = fromElement.getAttribute('email');
                } else {
                    // Alternatywnie, szukaj w tekście "Od:"
                    const fromText = Array.from(document.querySelectorAll('span, div')).find(el => 
                        el.textContent && el.textContent.includes('Od:') && el.textContent.includes('@')
                    );
                    if (fromText) {
                        const emailMatch = fromText.textContent.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
                        if (emailMatch) {
                            fromEmail = emailMatch[0];
                        }
                    }
                }
            } catch (e) {
                console.warn('[CRM Content] Could not extract from email:', e);
            }
            
            // Loguj informacje przed wysłaniem
            console.log('[CRM Content] Sending to analyze:', {
                messageId: messageId,
                messageIdLength: messageId?.length,
                fromEmail: fromEmail,
                bodyLength: bodyText.length,
                imagesCount: emailImages.length
            });
            
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeEmail',
                data: { 
                    body: bodyText, 
                    subject: document.title,
                    messageId: messageId,
                    date: new Date().toISOString(),
                    images: emailImages, // Przekaż obrazy do analizy
                    fromEmail: fromEmail // Przekaż email nadawcy
                }
            });
            
            // POBIERZ LISTĘ ZAŁĄCZNIKÓW DO WYBORU
            if (messageId) {
                console.log('[CRM Content] Fetching attachments list for:', messageId);
                try {
                    const attRes = await chrome.runtime.sendMessage({
                        action: 'getGmailAttachments',
                        messageId: messageId
                    });
                    
                    console.log('[CRM Content] Attachments response:', attRes);
                    
                    if (attRes && attRes.success && attRes.attachments) {
                        // 1. USUWANIE DUPLIKATÓW I FILTROWANIE ŚMIECI
                        const seen = new Set();
                        // Bardziej precyzyjna czarna lista - tylko jeśli to mały plik obrazu
                        const blacklist = ['logo', 'montazreklam', 'newoffice', 'footer', 'stopka', 'sygnatura', 'facebook', 'instagram', 'linkedin'];
                        
                        gmailAttachments = attRes.attachments.filter(att => {
                            if (!att.name) return false;
                            
                            // Unikalność (nazwa + rozmiar)
                            const key = `${att.name}-${att.size}`;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        });

                        console.log('[CRM Content] Final attachments list:', gmailAttachments);

                        // INTELIGENTNE ZAZNACZANIE (Zamiast usuwania, po prostu odznaczamy śmieci)
                        selectedAttachmentIds = gmailAttachments
                            .filter(att => {
                                // Prawdziwe załączniki (nie inline) zaznaczamy zawsze
                                if (!att.isInline) return true;

                                const nameLower = att.name.toLowerCase();
                                const isImage = /\.(png|jpg|jpeg|gif)$/i.test(nameLower);
                                
                                // Odznacz małe grafiki systemowe i te z czarnej listy
                                if (isImage && att.size < 40000) {
                                    if (/^image\d{3}\.(png|jpg|jpeg|gif)$/i.test(nameLower)) return false;
                                    if (blacklist.some(word => nameLower.includes(word))) return false;
                                }

                                return true;
                            })
                            .map(a => a.id);
                            
                        updateAttachmentsButton();
                        
                        // ZAWSZE otwieraj okno jeśli są jakiekolwiek załączniki
                        if (gmailAttachments.length > 0) {
                            console.log('[CRM Content] Opening attachments modal...');
                            openAttachmentsModal();
                        }
                    } else if (attRes && !attRes.success) {
                        console.error('[CRM Content] Failed to fetch attachments:', attRes.error);
                    }
                } catch (err) {
                    console.error('[CRM Content] Error sending getGmailAttachments message:', err);
                }
            }
            
            console.log('[CRM Content] Analysis response:', {
                success: response.success,
                phone: response.data?.phone,
                email: response.data?.email,
                hasError: !!response.error
            });
            
            if (response.success && response.data) {
                const d = response.data;
                
                // Pokaż ostrzeżenie jeśli confidence jest niskie
                const warningBanner = document.getElementById('crm-confidence-warning');
                if (warningBanner) {
                    warningBanner.style.display = (d.confidence !== undefined && d.confidence < 0.7) ? 'block' : 'none';
                }

                document.getElementById('crm-input-title').value = d.suggestedTitle || '';
                document.getElementById('crm-input-phone').value = d.phone || ''; 
                document.getElementById('crm-input-email').value = d.email || '';
                document.getElementById('crm-input-nip').value = d.nip || '';
                document.getElementById('crm-input-address').value = d.address || '';
                document.getElementById('crm-input-scope').value = d.scopeWorkText || d.scopeOfWork || '';

                // Dodaj sugestie dla telefonu
                renderSuggestions('crm-input-phone', d.phoneCandidates);
                // Dodaj sugestie dla adresu
                renderSuggestions('crm-input-address', d.addressCandidates);

            } else {
                alert('Błąd AI: ' + (response.error || 'Brak danych'));
            }
        } catch (e) {
            alert('Błąd: ' + e.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    };

    // GUS BUTTON
    const gusBtn = content.querySelector('#crm-gus-btn');
    if (gusBtn) {
        gusBtn.onclick = async () => {
            const nipInput = document.getElementById('crm-input-nip');
            const nip = nipInput.value.replace(/[^\d]/g, '');
            if (nip.length !== 10) {
                alert('Podaj poprawny NIP (10 cyfr)');
                return;
            }

            const originalText = gusBtn.innerText;
            gusBtn.innerText = '⏳...';
            gusBtn.disabled = true;

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'lookupGus',
                    nip: nip
                });

                if (response.success && response.company) {
                    const c = response.company;
                    // Uzupełnij dane
                    if (c.name) document.getElementById('crm-input-title').value = c.name.substring(0, 50);
                    
                    let fullAddr = '';
                    if (c.street) {
                        fullAddr = c.street;
                        if (c.postCode || c.city) fullAddr += ', ' + [c.postCode, c.city].filter(Boolean).join(' ');
                    }
                    if (fullAddr) document.getElementById('crm-input-address').value = fullAddr;
                    
                    // Poinformuj użytkownika
                    alert('Znaleziono firmę: ' + c.name);
                } else {
                    alert('Błąd GUS: ' + (response.error || 'Nie znaleziono firmy'));
                }
            } catch (e) {
                alert('Błąd połączenia: ' + e.message);
            } finally {
                gusBtn.innerText = originalText;
                gusBtn.disabled = false;
            }
        };
    }

    // 2. WYŚLIJ
    content.querySelector('#crm-send').onclick = async () => {
        const btn = content.querySelector('#crm-send');
        const originalText = btn.innerText;
        btn.innerText = '🚀 Wysyłam...';
        btn.disabled = true;

        const title = document.getElementById('crm-input-title').value;
        const phone = document.getElementById('crm-input-phone').value;
        const email = document.getElementById('crm-input-email').value;
        const nip = document.getElementById('crm-input-nip').value;
        const address = document.getElementById('crm-input-address').value;
        const scope = document.getElementById('crm-input-scope').value;
        
        // ID - użyj zapisanego lub pobierz ponownie
        let messageId = lastMessageId || getCurrentMessageId();
        // Oczyść ID z nieprawidłowych znaków (zachowaj tylko alfanumeryczne, _, -)
        if (messageId) {
            messageId = messageId.replace(/[^a-zA-Z0-9_\-]/g, '');
        }
        
        // Loguj przed wysłaniem
            console.log('[CRM Content] Creating job with:', {
            messageId: messageId,
            messageIdLength: messageId?.length,
            manualAttachments: uploadedFiles.length,
            selectedGmailAttachments: selectedAttachmentIds.length,
            title: title.substring(0, 50),
            phone: phone,
            email: email
        });

        // Znajdź pełne obiekty załączników na podstawie wybranych ID
        const selectedAttachmentsFull = gmailAttachments
            .filter(att => selectedAttachmentIds.includes(att.id))
            .map(att => ({
                id: att.id,
                messageId: att.messageId, // WAŻNE: To jest ID wiadomości z której pochodzi załącznik
                name: att.name,
                mimeType: att.mimeType,
                size: att.size
            }));

        try {
            const res = await chrome.runtime.sendMessage({
                action: 'createJob',
                data: { 
                    title, 
                    phone, 
                    email, 
                    nip,
                    fullAddress: address, 
                    description: scope,
                    gmailMessageId: messageId,
                    manualAttachments: uploadedFiles,
                    selectedAttachments: selectedAttachmentsFull, // Przekazujemy pełne obiekty
                    selectedAttachmentIds: selectedAttachmentIds // Dla wstecznej kompatybilności (opcjonalnie)
                }
            });

            console.log('[CRM Content] Create job response:', {
                success: res.success,
                warning: res.warning,
                error: res.error
            });
            
            if (res.success) {
                let message = '<div class="crm-success"><div class="crm-success-icon">✅</div><h3>Zlecenie wysłane!</h3>';
                if (res.warning) {
                    message += '<p>⚠️ ' + res.warning + '</p>';
                }
                message += '</div>';
                
                content.innerHTML = message;
                
                // Wyczyść pliki po sukcesie
                uploadedFiles = [];
                
                setTimeout(() => {
                    document.querySelector('.crm-sidebar').classList.remove('open');
                    renderSidebar('form'); 
                }, res.warning ? 4000 : 2000);
            } else {
                alert('Błąd CRM: ' + res.error);
            }
        } catch (e) {
            alert('Błąd sieci: ' + e.message);
        } finally {
            if (btn) {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
    };
}

function renderSuggestions(inputId, candidates) {
    const input = document.getElementById(inputId);
    if (!input || !candidates || !Array.isArray(candidates) || candidates.length === 0) {
        // Usuń istniejące sugestie jeśli są
        const existing = input.parentElement.querySelector('.crm-suggestions');
        if (existing) existing.remove();
        return;
    }

    let suggestionsDiv = input.parentElement.querySelector('.crm-suggestions');
    if (!suggestionsDiv) {
        suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'crm-suggestions';
        input.parentElement.appendChild(suggestionsDiv);
    }

    suggestionsDiv.innerHTML = '<div class="crm-suggestion-label">Inne wykryte:</div>';
    
    candidates.forEach(val => {
        const chip = document.createElement('div');
        chip.className = 'crm-suggestion-chip';
        chip.innerText = val;
        chip.onclick = () => {
            input.value = val;
            // Opcjonalnie: usuń chip po kliknięciu lub zaznacz jako wybrany
        };
        suggestionsDiv.appendChild(chip);
    });
}
