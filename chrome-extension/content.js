/**
 * CRM Gmail Extension - Content Script
 * Wersja v5.3 - Image Compression Fix
 */

console.log('[CRM] Skrypt v5.3 załadowany!');

// --- STATE ---
let sidebar = null;
let lastMessageId = null;
let uploadedFiles = []; // Przechowuje ręcznie dodane pliki {name, data: base64}

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
            </div>
        `;
        
        setupFormHandlers(content);
        setupDragDrop(content);
        renderFileList(); // Jeśli coś było wcześniej dodane
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

/**
 * Pobiera aktualny Message ID z Gmaila używając wielu strategii
 * Zwraca prawdziwy Message ID (krótkie hex), nie Thread ID ani Legacy ID
 */
function getCurrentMessageId() {
    console.log('[CRM Content] Getting message ID...');
    
    // Strategia 1: Sprawdź data-message-id w elementach wiadomości
    // Gmail używa różnych formatów - szukamy prawdziwego Message ID (krótkie hex, 16-20 znaków)
    const messageElements = document.querySelectorAll('div[data-message-id], tr[data-message-id]');
    for (let i = messageElements.length - 1; i >= 0; i--) {
        const id = messageElements[i].getAttribute('data-message-id');
        if (id) {
            // Prawdziwy Message ID to krótki hex (16-20 znaków), nie zaczyna się od FM ani msg-
            if (id.length >= 16 && id.length <= 20 && !id.startsWith('FM') && !id.startsWith('msg-')) {
                console.log('[CRM Content] Found Message ID from data-message-id:', id);
                return id;
            }
        }
    }
    
    // Strategia 2: Sprawdź URL hash - może zawierać Message ID
    const hash = window.location.hash;
    if (hash) {
        const hashParts = hash.split('/');
        for (let part of hashParts) {
            const cleanId = part.split('?')[0].split('#')[0];
            // Walidacja: krótki hex, nie Thread ID ani Legacy ID
            if (cleanId && cleanId.length >= 16 && cleanId.length <= 20 && 
                !cleanId.startsWith('FM') && !cleanId.startsWith('msg-') &&
                /^[a-zA-Z0-9_-]+$/.test(cleanId)) {
                console.log('[CRM Content] Found Message ID from URL hash:', cleanId);
                return cleanId;
            }
        }
    }
    
    // Strategia 3: Sprawdź atrybuty aria-label lub data-legacy-thread-id (może zawierać Message ID w innym formacie)
    const threadElements = document.querySelectorAll('[data-legacy-thread-id], [aria-label*="message"]');
    for (let elem of threadElements) {
        const threadId = elem.getAttribute('data-legacy-thread-id');
        if (threadId && threadId.length >= 16 && threadId.length <= 20 && 
            !threadId.startsWith('FM') && !threadId.startsWith('msg-')) {
            console.log('[CRM Content] Found Message ID from legacy-thread-id:', threadId);
            return threadId;
        }
    }
    
    // Strategia 4: Sprawdź elementy z klasą zawierającą "message" - mogą mieć ID w atrybutach
    const messageDivs = document.querySelectorAll('div[class*="message"], div[class*="Message"]');
    for (let div of messageDivs) {
        // Sprawdź wszystkie atrybuty data-*
        for (let attr of div.attributes) {
            if (attr.name.startsWith('data-') && attr.value) {
                const value = attr.value.trim();
                if (value.length >= 16 && value.length <= 20 && 
                    !value.startsWith('FM') && !value.startsWith('msg-') &&
                    /^[a-zA-Z0-9_-]+$/.test(value)) {
                    console.log('[CRM Content] Found Message ID from data attribute:', value, 'attr:', attr.name);
                    return value;
                }
            }
        }
    }
    
    // Strategia 5: Fallback - użyj ostatniego data-message-id nawet jeśli wygląda na Thread ID
    // Background.js spróbuje go rozwiązać
    if (messageElements.length > 0) {
        const lastMsg = messageElements[messageElements.length - 1];
        const fallbackId = lastMsg.getAttribute('data-message-id');
        if (fallbackId) {
            console.log('[CRM Content] Using fallback ID (will be resolved by background):', fallbackId);
            return fallbackId;
        }
    }
    
    // Strategia 6: Ostatnia deska ratunku - URL hash bez walidacji
    if (hash) {
        const urlId = hash.split('/').pop().split('?')[0].split('#')[0];
        if (urlId && urlId.length > 5) {
            console.log('[CRM Content] Using ID from URL as last resort:', urlId);
            return urlId.replace(/[^a-zA-Z0-9_-]/g, '');
        }
    }
    
    console.warn('[CRM Content] Could not find Message ID');
    return null;
}

function setupFormHandlers(content) {
    // 1. ZACZYTAJ
    content.querySelector('#crm-read').onclick = async () => {
        const btn = content.querySelector('#crm-read');
        const originalText = btn.innerText;
        btn.innerText = '⏳ Analizuję...';
        btn.disabled = true;

        try {
            const bodyText = document.body.innerText.substring(0, 15000); 
            
            // Pobierz ID używając nowej funkcji
            const messageId = getCurrentMessageId();
            lastMessageId = messageId;
            
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeEmail',
                data: { 
                    body: bodyText, 
                    subject: document.title,
                    messageId: messageId,
                    date: new Date().toISOString()
                }
            });
            
            if (response.success && response.data) {
                const d = response.data;
                document.getElementById('crm-input-title').value = d.suggestedTitle || '';
                document.getElementById('crm-input-phone').value = d.phone || ''; 
                document.getElementById('crm-input-email').value = d.email || '';
                document.getElementById('crm-input-address').value = d.address || '';
                document.getElementById('crm-input-scope').value = d.scopeWorkText || d.scopeOfWork || '';
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

    // 2. WYŚLIJ
    content.querySelector('#crm-send').onclick = async () => {
        const btn = content.querySelector('#crm-send');
        const originalText = btn.innerText;
        btn.innerText = '🚀 Wysyłam...';
        btn.disabled = true;

        const title = document.getElementById('crm-input-title').value;
        const phone = document.getElementById('crm-input-phone').value;
        const email = document.getElementById('crm-input-email').value;
        const address = document.getElementById('crm-input-address').value;
        const scope = document.getElementById('crm-input-scope').value;
        
        // ID - użyj zapisanego lub pobierz ponownie
        let messageId = lastMessageId || getCurrentMessageId();
        // Oczyść ID z nieprawidłowych znaków (zachowaj tylko alfanumeryczne, _, -)
        if (messageId) {
            messageId = messageId.replace(/[^a-zA-Z0-9_\-]/g, '');
        }

        try {
            const res = await chrome.runtime.sendMessage({
                action: 'createJob',
                data: { 
                    title, 
                    phone, 
                    email, 
                    fullAddress: address, 
                    description: scope,
                    gmailMessageId: messageId,
                    manualAttachments: uploadedFiles // <-- Przekazujemy skompresowane pliki
                }
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
