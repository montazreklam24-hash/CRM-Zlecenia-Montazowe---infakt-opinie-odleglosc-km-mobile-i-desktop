/**
 * CRM Gmail Extension - Content Script
 * Wersja v5.1 - Fixed Syntax
 */

console.log('[CRM] Skrypt v5.1 załadowany!');

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
        backgroundColor: '#2563eb',
        color: 'white',
        borderRadius: '50%',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
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

let sidebar = null;
let lastMessageId = null;

function openSidebar() {
    if (!document.querySelector('.crm-sidebar')) {
        createSidebar();
    }
    const sb = document.querySelector('.crm-sidebar');
    sb.style.display = 'flex';
    requestAnimationFrame(() => sb.classList.add('open'));
    renderSidebar('form');
}

function createSidebar() {
    const div = document.createElement('div');
    div.className = 'crm-sidebar';
    div.style.display = 'none';
    div.innerHTML = `
        <div class="crm-sidebar-header" style="background:#2563eb;color:white;padding:15px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:bold;">CRM Montaż24</span>
            <button id="crm-close" style="background:none;border:none;color:white;font-size:24px;cursor:pointer;">&times;</button>
        </div>
        <div class="crm-sidebar-content" style="padding:15px;overflow-y:auto;height:calc(100% - 60px);"></div>
    `;
    document.body.appendChild(div);
    
    div.querySelector('#crm-close').onclick = () => {
        div.classList.remove('open');
        setTimeout(() => div.style.display = 'none', 300);
    };
}

function renderSidebar(state) {
    const content = document.querySelector('.crm-sidebar-content');
    if (!content) return;
    
    if (state === 'form') {
        content.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <button id="crm-read" style="width:100%;padding:12px;background:#3b82f6;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
                    ✨ Analizuj Maila (AI)
                </button>
                <hr style="border:0;border-top:1px solid #ddd;margin:5px 0;">
                
                <label style="font-size:12px;color:#666;font-weight:bold;">Tytuł:</label>
                <input id="crm-input-title" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">
                
                <label style="font-size:12px;color:#666;font-weight:bold;">Telefon:</label>
                <input id="crm-input-phone" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">
                
                <label style="font-size:12px;color:#666;font-weight:bold;">Email:</label>
                <input id="crm-input-email" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">

                <label style="font-size:12px;color:#666;font-weight:bold;">Adres:</label>
                <textarea id="crm-input-address" rows="2" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;font-family:sans-serif;"></textarea>
                
                <label style="font-size:12px;color:#666;font-weight:bold;">Zakres prac (Streszczenie):</label>
                <textarea id="crm-input-scope" rows="4" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;font-family:sans-serif;"></textarea>
                
                <button id="crm-send" style="width:100%;padding:12px;background:#10b981;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;margin-top:10px;">
                    🚀 Wyślij do CRM
                </button>
            </div>
        `;
        
        // --- HANDLERS ---

        // 1. ZACZYTAJ
        content.querySelector('#crm-read').onclick = async () => {
            const btn = content.querySelector('#crm-read');
            const originalText = btn.innerText;
            btn.innerText = '⏳ Analizuję...';
            btn.disabled = true;

            try {
                const bodyText = document.body.innerText.substring(0, 15000); 
                
                // Pobierz ID
                let messageId = null;
                const urlParts = window.location.hash.split('/');
                if (urlParts.length > 1) {
                    const potentialId = urlParts[urlParts.length - 1];
                    if (potentialId.length > 5 && !potentialId.includes('?')) {
                        messageId = potentialId;
                    }
                }
                // Fallback do DOM
                if (!messageId) {
                    const msgElement = document.querySelector('[data-message-id]');
                    if (msgElement) messageId = msgElement.getAttribute('data-message-id');
                }
                
                lastMessageId = messageId;
                console.log('[CRM] ID:', lastMessageId);
                
                const response = await chrome.runtime.sendMessage({
                    action: 'analyzeEmail',
                    data: { 
                        body: bodyText, 
                        subject: document.title,
                        messageId: messageId,
                        from: '', // Opcjonalne, wyciągane w BG lub tutaj
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
            
            // ID - solidna ekstrakcja
            let messageId = lastMessageId;
            if (!messageId) {
                 const urlParts = window.location.hash.split('/');
                 messageId = urlParts[urlParts.length - 1];
            }
            
            // Oczyszczanie ID z ewentualnych śmieci (np. #, ?, &)
            if (messageId) {
                // Usuń wszystko co nie jest znakiem alfanumerycznym
                // Google Message ID to zazwyczaj [a-zA-Z0-9_-]+
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
                        gmailMessageId: messageId
                    }
                });
                if (res.success) {
                    let message = '<h3 style="color:green;text-align:center;padding:20px;">✅ Zlecenie wysłane!</h3>';
                    if (res.warning) {
                        message += '<p style="color:orange;text-align:center;font-size:12px;padding:0 10px;">⚠️ ' + res.warning + '</p>';
                    }
                    content.innerHTML = message;
                    setTimeout(() => {
                        document.querySelector('.crm-sidebar').classList.remove('open');
                        renderSidebar('form'); // Reset formularza
                    }, res.warning ? 4000 : 2000); // Dłużej jeśli jest ostrzeżenie
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
}
