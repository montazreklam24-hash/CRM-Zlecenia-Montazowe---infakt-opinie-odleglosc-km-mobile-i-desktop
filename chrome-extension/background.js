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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[CRM BG] Message:', request.action);
  
  switch (request.action) {
    case 'analyzeEmail':
      analyzeEmail(request.data).then(sendResponse);
      return true; // async response
      
    case 'createJob':
      createJobInCRM(request.data).then(sendResponse);
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
      testGmailMessage(request.messageId)
        .then(result => {
          console.log('[CRM BG] testGmailMessage result:', result);
          sendResponse(result || { success: false, error: 'Brak odpowiedzi z funkcji' });
        })
        .catch(error => {
          console.error('[CRM BG] testGmailMessage error:', error);
          sendResponse({ success: false, error: error.message || 'Nieznany błąd' });
        });
      return true; // async response
  }
});

// =========================================================================
// ANALIZA EMAILA PRZEZ GEMINI
// =========================================================================

// Lista maili firmowych do ignorowania
const COMPANY_EMAILS = [
  'montazreklam24@gmail.com',
  'montazreklam24@',
  'a.korpalski@',
  'akorpalski@',
  'korpalski@',
  '@montazreklam24.pl',
  '@montazreklam24.com',
  'kontakt@montazreklam24.pl',
  'biuro@montazreklam24.pl',
  'info@montazreklam24.pl'
];

function isCompanyEmail(email) {
  if (!email) return false;
  const emailLower = email.toLowerCase().trim();
  return COMPANY_EMAILS.some(companyEmail => emailLower.includes(companyEmail));
}

// Funkcja pomocnicza do wyciągania telefonu z tekstu (fallback)
function extractPhoneFromText(text) {
  if (!text) return null;
  
  // NUMER DO IGNOROWANIA - numer firmy CRM
  const CRM_PHONE_PATTERNS = [
    /888[\s\-]?201[\s\-]?250/g,
    /888201250/g,
    /\+48[\s\-]?888[\s\-]?201[\s\-]?250/g,
    /0048[\s\-]?888[\s\-]?201[\s\-]?250/g
  ];
  
  // Sprawdź czy tekst zawiera tylko numer CRM
  const hasOnlyCrmPhone = CRM_PHONE_PATTERNS.some(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      // Sprawdź czy są inne numery telefonów w tekście
      const allPhones = text.match(/\d{7,}/g) || [];
      return allPhones.length <= 1; // Tylko numer CRM lub brak innych numerów
    }
    return false;
  });
  
  if (hasOnlyCrmPhone) {
    console.log('[CRM BG] Found only CRM phone number, ignoring');
    return null;
  }
  
  // Wzorce dla różnych numerów telefonów
  const patterns = [
    // Polskie komórkowe: +48 500 123 456, +48500123456, 0048 500 123 456
    /(?:\+48|0048)?\s*(\d{3}[\s\-]?\d{3}[\s\-]?\d{3})/g,
    // Polskie stacjonarne: +48 22 123 45 67
    /(?:\+48|0048)?\s*(\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/g,
    // Ukraińskie: +380 50 123 4567, 380501234567, 050 123 4567
    /(?:\+380|00380|380)?\s*(\d{2}[\s\-]?\d{3}[\s\-]?\d{4})/g,
    // Niemieckie: +49 30 12345678, 0049 30 12345678, 030 12345678
    /(?:\+49|0049|49)?\s*(\d{2}[\s\-]?\d{6,8})/g,
    // (500) 123-456, 500-123-456, 500 123 456
    /\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{3})/g,
    // tel. 500123456, telefon: 500123456, tel: 500123456
    /tel[\.:]?\s*(\d{9,}|\d{3}[\s\-]?\d{3}[\s\-]?\d{3})/gi,
    // 9 cyfr pod rząd (polski numer)
    /\b(\d{9})\b/g
  ];
  
  const foundPhones = [];
  
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      let phone = match[0].replace(/[^\d]/g, '');
      
      // Ignoruj numer CRM
      if (phone.includes('888201250') || phone === '888201250') {
        continue;
      }
      
      // Usuń prefiksy krajowe
      if (phone.startsWith('48') && phone.length === 11) {
        phone = phone.substring(2);
      } else if (phone.startsWith('380') && phone.length >= 12) {
        phone = phone.substring(3);
      } else if (phone.startsWith('49') && phone.length >= 11) {
        phone = phone.substring(2);
      }
      
      // Walidacja - musi mieć sensowną długość
      if (phone.length >= 7 && phone.length <= 12) {
        foundPhones.push({
          original: match[0],
          cleaned: phone,
          position: match.index
        });
      }
    }
  }
  
  if (foundPhones.length === 0) {
    return null;
  }
  
  // Wybierz pierwszy numer który nie jest numerem CRM
  const validPhone = foundPhones.find(p => !p.cleaned.includes('888201250'));
  if (!validPhone) {
    return null;
  }
  
  // Formatuj numer
  let formatted = validPhone.cleaned;
  if (formatted.length === 9) {
    // Polski numer komórkowy: XXX XXX XXX
    formatted = formatted.match(/.{1,3}/g).join(' ');
  } else if (formatted.length >= 7) {
    // Inne numery: dodaj spacje co 3 cyfry od końca
    const parts = [];
    let remaining = formatted;
    while (remaining.length > 3) {
      parts.unshift(remaining.slice(-3));
      remaining = remaining.slice(0, -3);
    }
    if (remaining.length > 0) {
      parts.unshift(remaining);
    }
    formatted = parts.join(' ');
  }
  
  return formatted;
}

async function analyzeEmail(emailData) {
  await logDebug('info', 'analyze', 'Starting email analysis', { 
    hasImages: emailData.images?.length > 0,
    imagesCount: emailData.images?.length || 0
  });
  
  const settings = await getSettings();
  
  if (!settings.geminiApiKey) {
    return { success: false, error: 'Brak klucza API Gemini' };
  }
  
  // Sprawdź email nadawcy
  const fromEmail = emailData.fromEmail || emailData.from || null;
  if (fromEmail) {
    await logDebug('info', 'analyze', 'Email from field', { fromEmail, isCompany: isCompanyEmail(fromEmail) });
  }
  
  // Przygotuj części dla Gemini (tekst + obrazy)
  const parts = [
    { text: `
Jesteś asystentem CRM do wyciągania danych z emaili o zleceniach montażowych reklam.

Przeanalizuj poniższego maila i wyciągnij następujące dane:
- Telefon kontaktowy (telefon, tel, mobile, komórka) - BARDZO WAŻNE!
- Email kontaktowy - BARDZO WAŻNE! (MUSI być z innego adresu niż maile firmowe)
- Nazwa firmy (jeśli jest)
- NIP (jeśli jest)
- Imię i nazwisko kontaktu
- Adres montażu (ulica, numer, miasto, kod pocztowy, dzielnica)
- Zakres prac (szczegółowy opis co konkretnie trzeba zrobić - NIE pisz "montaż witryn", tylko "oklejanie witryn" lub konkretne prace)
- Sugerowany tytuł zlecenia (krótki, max 50 znaków)

================================================================================
KRYTYCZNE INSTRUKCJE - EMAIL KONTAKTOWY:
================================================================================

⚠️ MAILE FIRMOWE DO IGNOROWANIA - TO NIE SĄ MAILE KLIENTA:
- montazreklam24@gmail.com
- montazreklam24@* (wszystkie warianty)
- a.korpalski@* (wszystkie warianty)
- akorpalski@* (wszystkie warianty)
- korpalski@* (wszystkie warianty)
- *@montazreklam24.pl (wszystkie maile z tej domeny)
- *@montazreklam24.com (wszystkie maile z tej domeny)
- kontakt@montazreklam24.pl
- biuro@montazreklam24.pl
- info@montazreklam24.pl

🚨 WAŻNE - JAK ROZPOZNAĆ EMAIL KLIENTA:
1. Email klienta MUSI być z INNEGO adresu niż maile firmowe powyżej
2. Czasami firma pisze PIERWSZY mail (wygląda jak zapytanie), ale to NIE jest email klienta!
3. Email klienta to ZAWSZE odpowiedź z innego adresu niż maile firmowe
4. Szukaj emaila w:
   - Polu "Od:" (From) - jeśli to nie jest mail firmowy, to jest mail klienta
   - Podpisie maila (jeśli jest inny niż firmowy)
   - Treści maila (jeśli klient podaje swój email)

✅ JAK WYBRAĆ WŁAŚCIWY EMAIL:
1. Sprawdź pole "Od:" (From) - jeśli NIE zawiera żadnego z maili firmowych, użyj tego
2. Jeśli pole "Od:" zawiera mail firmowy:
   - Szukaj w treści maila - klient może podać swój email w odpowiedzi
   - Szukaj w podpisie - klient może podać swój email
   - Jeśli nie znajdziesz innego maila niż firmowy, ustaw email: null

3. IGNORUJ:
   - Wszystkie maile zawierające "montazreklam24"
   - Wszystkie maile zawierające "korpalski"
   - Wszystkie maile z domeny @montazreklam24.pl lub @montazreklam24.com
   - Maile kontaktowe firmy (kontakt@, biuro@, info@)

4. Jeśli znajdziesz TYLKO maile firmowe lub nie znajdziesz żadnego maila klienta:
   - Ustaw email: null
   - NIE wpisuj maila firmowego jako email klienta!
   - NIE wpisuj "brak" ani "nie znaleziono"

📝 PRZYKŁADY:
- ❌ BŁĘDNE: "montazreklam24@gmail.com" → email: null (to mail firmy)
- ❌ BŁĘDNE: "a.korpalski@gmail.com" → email: null (to mail firmy)
- ✅ POPRAWNE: "klient@firma.pl" → email: "klient@firma.pl" (to mail klienta)
- ✅ POPRAWNE: "jan.kowalski@gmail.com" → email: "jan.kowalski@gmail.com" (to mail klienta)

================================================================================

================================================================================
KRYTYCZNE INSTRUKCJE - TELEFON KONTAKTOWY:
================================================================================

⚠️ NUMER DO IGNOROWANIA:
- NUMER 888 201 250 (lub 888201250, +48 888 201 250, itp.) TO JEST NUMER FIRMY CRM
- NIGDY nie dodawaj tego numeru jako telefon kontaktowy klienta!
- Jeśli znajdziesz tylko ten numer, ustaw phone: null

🔍 JAK SZUKAĆ TELEFONU - SZUKAJ WSZĘDZIE:
1. PRZECZYTAJ CAŁĄ TREŚĆ MAILA od początku do końca - każdy wiersz, każdy znak
2. Szukaj w:
   - Treści głównej maila
   - Podpisie nadawcy (na końcu maila)
   - Stopce maila
   - Nagłówkach (jeśli są widoczne)
   - Wszystkich miejscach gdzie może być kontakt

📱 FORMATY NUMERÓW DO ROZPOZNANIA:

POLSKIE NUMERY:
- Komórkowe: 500 123 456, 500-123-456, 500123456, +48 500 123 456, 0048 500 123 456, (500) 123-456
- Stacjonarne: 22 123 45 67, 22-123-45-67, +48 22 123 45 67, (22) 123-45-67
- Z prefiksem: +48, 0048, 48
- Format: 9 cyfr (komórkowe) lub 7-9 cyfr (stacjonarne z numerem kierunkowym)

UKRAIŃSKIE NUMERY:
- Format: +380 XX XXX XXXX, 380 XX XXX XXXX, 0XX XXX XXXX
- Przykłady: +380 50 123 4567, 380501234567, 050 123 4567
- Szukaj numerów zaczynających się od +380, 380, lub 0XX (gdzie XX to kod operatora: 50, 63, 67, 68, 73, 93, 95, 96, 97, 98, 99)

NIEMIECKIE NUMERY:
- Format: +49 XX XXXX XXXX, 0049 XX XXXX XXXX, 0XX XXXX XXXX
- Przykłady: +49 30 12345678, 0049 30 12345678, 030 12345678
- Szukaj numerów zaczynających się od +49, 0049, lub 0XX (gdzie XX to kod obszaru)

INNE ZAGRANICZNE:
- Format: +[kod kraju] [numer]
- Przykłady: +1 555 123 4567 (USA), +44 20 1234 5678 (UK), +33 1 23 45 67 89 (Francja)

🔑 SŁOWA KLUCZOWE DO SZUKANIA:
- "telefon:", "tel:", "tel.", "telefon", "phone", "mobile", "komórka", "kom.", "mob."
- "kontakt:", "contact:", "kontaktowy"
- "dzwonić pod:", "zadzwoń:", "call:", "ruf an:"
- "Nr tel:", "Nr telefonu:", "Numer:", "Phone:", "Tel.:"

✅ JAK WYBRAĆ WŁAŚCIWY NUMER:
1. Jeśli jest wiele numerów, wybierz:
   - Numer komórkowy zamiast stacjonarnego (jeśli oba są)
   - Numer bezpośredni zamiast centrali (jeśli oba są)
   - Numer klienta zamiast numeru firmy CRM (888 201 250)
   - Numer w podpisie nadawcy (często główny kontakt)
   
2. IGNORUJ:
   - Numery faksu (fax, faks)
   - Numery centrali jeśli jest bezpośredni
   - Numer 888 201 250 (to numer CRM)
   - Numery w stopce reklamowej (jeśli nie są głównym kontaktem)

3. Jeśli znajdziesz tylko numer 888 201 250 lub nie znajdziesz żadnego numeru klienta:
   - Ustaw phone: null
   - NIE wpisuj "brak", "nie znaleziono", "888 201 250"

📝 FORMATOWANIE WYNIKU:
- Usuń wszystkie znaki niebędące cyframi
- Jeśli jest prefiks kraju (+48, +380, +49), usuń go (zostaw tylko numer lokalny)
- Formatuj jako: XXX XXX XXX (spacje co 3 cyfry)
- Przykłady:
  * "500123456" → "500 123 456"
  * "+48 500 123 456" → "500 123 456"
  * "+380 50 123 4567" → "501234567" (lub zostaw z prefiksem jeśli nie można usunąć)
  * "22 123 45 67" → "22 123 45 67"

================================================================================
KRYTYCZNE INSTRUKCJE - ADRES MONTAŻU:
================================================================================

🔍 JAK SZUKAĆ ADRESU - SZUKAJ WSZĘDZIE:
1. PRZECZYTAJ CAŁĄ TREŚĆ MAILA - adres może być w różnych miejscach
2. Szukaj w:
   - Treści głównej maila (często na początku lub w środku)
   - Podpisie nadawcy
   - Stopce maila
   - W kontekście "montaż", "instalacja", "dostawa", "adres", "lokalizacja"
   - W opisie zakresu prac (gdzie jest wspomniane miejsce montażu)

📍 FORMATY ADRESÓW DO ROZPOZNANIA:

POLSKIE ADRESY:
- Format: "ul. [nazwa] [numer], [kod pocztowy] [miasto]"
- Przykłady:
  * "ul. Marszałkowska 1, 00-001 Warszawa"
  * "Marszałkowska 1, Warszawa"
  * "Wołoska 3, 02-001 Warszawa"
  * "al. Jerozolimskie 123/125, 02-017 Warszawa"
  * "ul. Nowy Świat 15/17, Warszawa"
  * "Plac Zamkowy 1, 00-277 Warszawa"

ELEMENTY ADRESU:
- Ulica: "ul.", "ulica", "Ulica", "street", "Strasse"
- Aleje: "al.", "aleja", "Aleja", "avenue", "Avenue"
- Place: "pl.", "plac", "Plac", "square", "Square"
- Numery: mogą być pojedyncze (15), z ułamkiem (15/17), z literą (15A)
- Kody pocztowe: XX-XXX (5 cyfr z myślnikiem)
- Miasta: Warszawa, Kraków, Wrocław, Poznań, Gdańsk, itp.

DZIELNICE WARSZAWY (jeśli adres w Warszawie):
- Szukaj kontekstu: "dzielnica", "dz.", "w dzielnicy", "na [nazwa dzielnicy]"
- Typowe dzielnice: Śródmieście, Mokotów, Praga, Żoliborz, Wola, Ochota, Bielany, Targówek, itp.
- Możesz określić dzielnicę na podstawie ulicy (np. "Marszałkowska" → Śródmieście)

🎯 JAK WYBRAĆ WŁAŚCIWY ADRES:
1. Jeśli jest wiele adresów, wybierz:
   - Adres montażu/instalacji zamiast adresu korespondencyjnego
   - Adres w kontekście "montaż", "instalacja", "dostawa", "lokalizacja"
   - Adres obiektu/firmy gdzie ma być wykonana praca
   - Adres w treści głównej zamiast w stopce (jeśli oba są różne)

2. PRIORYTET:
   - Adres z kodem pocztowym i pełnymi danymi
   - Adres w kontekście montażu/instalacji
   - Adres obiektu/firmy (nie adres prywatny nadawcy jeśli to firma)

3. Jeśli adres jest niepełny:
   - Uzupełnij miasto jeśli jest kod pocztowy
   - Jeśli jest tylko miasto bez ulicy, zostaw ulicę jako null
   - Jeśli jest tylko ulica bez numeru, zostaw buildingNo jako null

📝 ROZBIJANIE ADRESU NA CZĘŚCI:
- street: nazwa ulicy (bez "ul.", "ulica", "al.", "aleja", "pl.", "plac")
- buildingNo: numer budynku (15, 15/17, 15A)
- apartmentNo: numer mieszkania/lokalu (jeśli jest: "m. 5", "lok. 10", "ap. 3")
- city: miasto
- postCode: kod pocztowy (XX-XXX)
- district: dzielnica (jeśli jest w Warszawie lub innym dużym mieście)

================================================================================
KRYTYCZNE INSTRUKCJE - ZAKRES PRAC:
================================================================================

⚠️ WAŻNE - JĘZYK I TERMINOLOGIA:
- NIGDY nie pisz "montaż witryn" - to jest BŁĘDNE!
- Pisz: "oklejanie witryn", "oklejenie witryn", "oklejanie okien", "oklejenie okien"
- Używaj słów: oklejanie, oklejenie, folia, naklejanie, naklejka
- NIE używaj: montaż (chyba że chodzi o montaż reklamy, nie witryn)

🔍 JAK SZUKAĆ I OPISYWAĆ ZAKRES PRAC:
1. PRZECZYTAJ CAŁĄ TREŚĆ MAILA - zakres prac może być opisany w różnych miejscach
2. Szukaj w:
   - Treści głównej maila
   - Opisie zlecenia
   - Liście wymagań
   - Kontekście zdjęć (jeśli są załączniki)

📋 TYPOWE ZAKRESY PRAC (przykłady):
- "Oklejanie okien folią matową/przezroczystą"
- "Oklejenie drzwi wejściowych folią z nadrukiem"
- "Oklejanie witryny sklepowej folią reklamową"
- "Oklejenie okien biurowych folią przeciwsłoneczną"
- "Naklejanie folii na szyby z logo firmy"
- "Oklejanie okien i drzwi folią dekoracyjną"

🎯 JAK DOPRECYZOWAĆ ZAKRES:
- Opisz CO konkretnie: oklejanie okien, drzwi, witryn, itp.
- Opisz JAK: folią matową, przezroczystą, z nadrukiem, reklamową
- Opisz GDZIE: okna główne, boczne, drzwi wejściowe, witryna sklepowa
- Opisz ILE: ile okien, ile metrów kwadratowych (jeśli jest w mailu)

📸 ANALIZA ZDJĘĆ (jeśli są załączniki):
- Jeśli w mailu są zdjęcia/załączniki, przeanalizuj je dokładnie
- Opisz co widać na zdjęciach: jakie okna, drzwi, witryny
- Określ co trzeba okleić na podstawie zdjęć
- Jeśli na zdjęciu widać logo/napis do wykonania, opisz to
- Jeśli widać wymiary lub oznaczenia, uwzględnij je w opisie

================================================================================
INNE WAŻNE DANE:
================================================================================

- Szukaj adresów w całej treści maila, nie tylko w podpisie
- Jeśli w mailu jest nazwa obiektu (np. "Promenada", "Galeria Mokotów"), znajdź jego adres
- NIP formatuj jako: 123-456-78-90
- Email: szukaj w całej treści, często w podpisie
- Zakres prac: szczegółowy opis (max 300 znaków), co KONKRETNIE ma być zrobione - użyj słowa "oklejanie" zamiast "montaż"

Mail:
---
${fromEmail ? `Od: ${fromEmail}${isCompanyEmail(fromEmail) ? ' (UWAGA: To jest mail firmowy, szukaj emaila klienta w treści!)' : ''}` : 'Od: (nieznany)'}
Temat: ${emailData.subject || ''}
Data: ${emailData.date || ''}

${emailData.body}
---

Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "phone": "...",
  "email": "...",
  "companyName": "...",
  "nip": "...",
  "firstName": "...",
  "lastName": "...",
  "address": {
    "street": "...",
    "buildingNo": "...",
    "apartmentNo": "...",
    "city": "...",
    "postCode": "...",
    "district": "..."
  },
  "scopeOfWork": "...",
  "suggestedTitle": "...",
  "confidence": 0.8
}

Jeśli nie znalazłeś danego pola, ustaw null. 

🚨 KRYTYCZNE ZASADY - ZAWSZE PRZESTRZEGAJ:

1. TELEFON:
   - NIGDY nie zwracaj numeru 888 201 250 (w żadnym formacie: 888201250, +48 888 201 250, itp.)
   - Jeśli znajdziesz TYLKO ten numer lub nie znajdziesz żadnego numeru klienta → phone: null
   - NIE wpisuj "brak", "nie znaleziono", "888 201 250"

2. EMAIL:
   - NIGDY nie zwracaj maili firmowych: montazreklam24@gmail.com, a.korpalski@*, *@montazreklam24.pl, *@montazreklam24.com
   - Jeśli znajdziesz TYLKO maile firmowe lub nie znajdziesz maila klienta → email: null
   - NIE wpisuj maila firmowego jako email klienta!

3. TYTUŁ I ZAKRES PRAC:
   - NIGDY nie używaj słowa "montaż witryn" - zawsze pisz "oklejanie witryn" lub "oklejenie witryn"
   - Jeśli w mailu jest "montaż witryn", zamień na "oklejanie witryn"
   - Używaj słów: oklejanie, oklejenie, folia, naklejanie
   - NIE używaj: montaż (chyba że chodzi o montaż reklamy, nie witryn)
`
    }
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
    // Dodaj instrukcję o analizie zdjęć na końcu promptu
    parts[0].text += `

📸 ANALIZA ZDJĘĆ I ZAŁĄCZNIKÓW (jeśli są powyżej):
- Przeanalizuj dokładnie wszystkie załączone zdjęcia i obrazy
- Opisz co widać na zdjęciach: jakie okna, drzwi, witryny, szyby, powierzchnie do oklejenia
- Określ co trzeba okleić na podstawie zdjęć - być bardzo konkretnym
- Jeśli na zdjęciu widać logo/napis do wykonania, opisz to szczegółowo (kolory, rozmiary, pozycja)
- Jeśli widać wymiary lub oznaczenia, uwzględnij je w zakresie prac
- Użyj informacji ze zdjęć do doprecyzowania zakresu prac - zdjęcia są kluczowe!
- Jeśli zdjęcia pokazują konkretne okna/drzwi do oklejenia, opisz to dokładnie (np. "oklejenie 3 okien od frontu, każde 1.5m x 1.2m")
- Jeśli widać istniejące reklamy lub elementy do wymiany, opisz to
- Zwróć uwagę na kolory, materiały, tekstury widoczne na zdjęciach
- Jeśli zdjęcia pokazują różne widoki (front, tył, boki), opisz każdy widok osobno
- Użyj szczegółów ze zdjęć do stworzenia dokładnego zakresu prac - nie pomijaj żadnych szczegółów!
`;
  }
  
    const prompt = parts[0].text;

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
    
    // Fallback: jeśli Gemini nie znalazło telefonu, spróbuj wyciągnąć z tekstu
    if (!parsed.phone || parsed.phone === 'null' || parsed.phone === null) {
      const phoneMatch = extractPhoneFromText(emailData.body);
      if (phoneMatch) {
        parsed.phone = phoneMatch;
        console.log('[CRM BG] Phone extracted via fallback:', phoneMatch);
      }
    }
    
    // Formatuj telefon (usuń niepotrzebne znaki, zostaw tylko cyfry i spacje)
    if (parsed.phone && parsed.phone !== 'null') {
      parsed.phone = parsed.phone.replace(/[^\d\s]/g, '').replace(/\s+/g, ' ').trim();
      // Jeśli ma 9 cyfr, sformatuj jako XXX XXX XXX
      const digits = parsed.phone.replace(/\s/g, '');
      
      // KRYTYCZNE: Sprawdź czy to nie jest numer CRM (888 201 250)
      if (digits === '888201250' || digits.includes('888201250')) {
        await logDebug('warn', 'analyze', 'Found CRM phone number in parsed data, ignoring', { phone: parsed.phone });
        parsed.phone = null;
      } else if (digits.length === 9) {
        parsed.phone = digits.match(/.{1,3}/g).join(' ');
      }
    }
    
    // KRYTYCZNE: Ostateczna walidacja telefonu - sprawdź czy nie jest to numer CRM
    if (parsed.phone && parsed.phone !== 'null' && parsed.phone !== null) {
      const phoneDigits = parsed.phone.replace(/\s/g, '').replace(/[^\d]/g, '');
      if (phoneDigits === '888201250' || phoneDigits.includes('888201250')) {
        await logDebug('warn', 'analyze', 'CRM phone detected in final validation, setting to null');
        parsed.phone = null;
      }
    }
    
    // KRYTYCZNE: Walidacja emaila - sprawdź czy to nie jest mail firmowy
    if (parsed.email && parsed.email !== 'null' && parsed.email !== null) {
      const emailLower = parsed.email.toLowerCase().trim();
      if (isCompanyEmail(emailLower)) {
        await logDebug('warn', 'analyze', 'Found company email in parsed data, ignoring', { email: parsed.email });
        parsed.email = null;
      }
    }
    
    // KRYTYCZNE: Ostateczna walidacja emaila - sprawdź jeszcze raz
    if (parsed.email && parsed.email !== 'null' && parsed.email !== null) {
      const emailLower = parsed.email.toLowerCase().trim();
      if (isCompanyEmail(emailLower)) {
        await logDebug('warn', 'analyze', 'Company email detected in final validation, setting to null', { email: parsed.email });
        parsed.email = null;
      }
    }
    
    // Fallback: jeśli nie ma emaila lub jest firmowy, spróbuj wyciągnąć z treści
    if (!parsed.email || parsed.email === 'null' || parsed.email === null) {
      // Szukaj emaili w treści (prosty regex)
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
      const foundEmails = emailData.body.match(emailRegex) || [];
      const clientEmail = foundEmails.find(email => {
        const emailLower = email.toLowerCase().trim();
        return !isCompanyEmail(emailLower);
      });
      if (clientEmail) {
        parsed.email = clientEmail.toLowerCase().trim();
        await logDebug('info', 'analyze', 'Email extracted from body', { email: parsed.email });
      } else {
        parsed.email = null;
        await logDebug('info', 'analyze', 'No client email found, only company emails or none');
      }
    }
    
    // KRYTYCZNE: Ostatnia kontrola - jeśli nadal jest firmowy, ustaw null
    if (parsed.email && parsed.email !== 'null' && parsed.email !== null) {
      if (isCompanyEmail(parsed.email)) {
        parsed.email = null;
      }
    }
    
    // Formatuj adres do stringa
    let fullAddress = '';
    if (parsed.address) {
        const a = parsed.address;
        fullAddress = [a.street ? a.street + (a.buildingNo ? ' ' + a.buildingNo : '') : '', a.postCode, a.city].filter(Boolean).join(', ');
    }
    parsed.address = fullAddress;
    
    // KRYTYCZNE: Popraw tytuł - zamień "montaż witryn" na "oklejanie witryn"
    if (parsed.suggestedTitle && parsed.suggestedTitle.includes('montaż witryn')) {
      parsed.suggestedTitle = parsed.suggestedTitle.replace(/montaż witryn/gi, 'oklejanie witryn');
      await logDebug('info', 'analyze', 'Fixed title: replaced "montaż witryn" with "oklejanie witryn"');
    }
    if (parsed.scopeOfWork && parsed.scopeOfWork.includes('montaż witryn')) {
      parsed.scopeOfWork = parsed.scopeOfWork.replace(/montaż witryn/gi, 'oklejanie witryn');
      await logDebug('info', 'analyze', 'Fixed scopeOfWork: replaced "montaż witryn" with "oklejanie witryn"');
    }
    if (parsed.scopeWorkText && parsed.scopeWorkText.includes('montaż witryn')) {
      parsed.scopeWorkText = parsed.scopeWorkText.replace(/montaż witryn/gi, 'oklejanie witryn');
      await logDebug('info', 'analyze', 'Fixed scopeWorkText: replaced "montaż witryn" with "oklejanie witryn"');
    }
    
    await logDebug('info', 'analyze', 'Final parsed data', { 
      phone: parsed.phone,
      email: parsed.email,
      title: parsed.suggestedTitle?.substring(0, 50)
    });
    console.log('[CRM BG] Parsed data:', parsed);
    
    return { 
      success: true, 
      data: parsed,
      rawEmail: emailData
    };
    
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

async function importAttachments(messageId) {
  await logDebug('info', 'import', 'Starting attachment import', { messageId, messageIdLength: messageId?.length });
  
  try {
    const googleToken = await getAuthToken();
    await logDebug('info', 'import', 'Sending import request to API', { messageId, hasToken: !!googleToken });
    
    const result = await apiRequest('import_gmail.php', 'POST', {
      messageId: messageId,
      token: googleToken
    });
    
    await logDebug('info', 'import', 'Import API response received', { 
      success: result.success, 
      attachmentsCount: result.attachments?.length || 0,
      error: result.error || null
    });
    
    if (result.success && result.attachments) {
      // Zwróć WSZYSTKIE załączniki - nie tylko obrazy, ale też PDF-y i inne pliki
      const paths = result.attachments.map(att => att.path);
      const fileTypes = result.attachments.map(att => ({
        path: att.path,
        mimeType: att.mimeType,
        originalName: att.originalName
      }));
      
      await logDebug('info', 'import', 'Import successful - ALL attachments', { 
        attachmentsCount: paths.length, 
        paths,
        fileTypes: fileTypes.map(f => `${f.originalName} (${f.mimeType})`)
      });
      
      // Loguj szczegóły każdego pliku
      result.attachments.forEach((att, idx) => {
        logDebug('info', 'import', `Attachment ${idx + 1}: ${att.originalName}`, {
          path: att.path,
          mimeType: att.mimeType,
          isImage: att.mimeType?.startsWith('image/'),
          isPdf: att.mimeType === 'application/pdf'
        });
      });
      
      return paths; // Zwróć wszystkie ścieżki - obrazy, PDF-y, wszystko
    }
    
    // Jeśli import się nie udał (np. błąd API Google), rzuć błąd
    if (result.error) {
        await logDebug('warn', 'import', 'Import failed with error', { error: result.error });
        
        // Jeśli to błąd autoryzacji/konta, wyczyść token, żeby wymusić ponowne logowanie
        if (result.error.includes('400') || result.error.includes('401') || result.error.includes('403')) {
            await logDebug('warn', 'oauth', 'Auth error detected, clearing cached token', { error: result.error });
            chrome.identity.removeCachedAuthToken({ token: googleToken }, () => {
              logDebug('info', 'oauth', 'Cached token cleared');
            });
        }
        throw new Error("Import załączników: " + result.error);
    }

    await logDebug('warn', 'import', 'Import completed but no attachments found');
    return [];
  } catch (error) {
    await logDebug('error', 'import', 'Attachment import error', { 
      message: error.message, 
      stack: error.stack,
      messageId 
    });
    // Przekaż błąd wyżej, żeby zatrzymać tworzenie zlecenia
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
    looksLikeThreadId: threadIdOrMessageId?.length >= 20 || threadIdOrMessageId?.startsWith('FM')
  });
  
  // Jeśli ID wygląda na poprawne messageId (krótkie hex), zwróć je
  if (!threadIdOrMessageId || (threadIdOrMessageId.length < 20 && !threadIdOrMessageId.startsWith('FM'))) {
      await logDebug('info', 'messageId', 'ID looks like valid Message ID, using as-is');
      return threadIdOrMessageId;
  }

  // Jeśli to długie ID (Thread ID lub Legacy), pytamy API o listę wiadomości w wątku
  try {
    const token = await getAuthToken();
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadIdOrMessageId}?format=minimal`;
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
      messageId: finalMessageId 
    });
    
    if (settings.importAttachments) {
        await logDebug('info', 'createJob', 'Import attachments enabled, processing', { 
          hasMessageId: !!finalMessageId,
          messageId: finalMessageId 
        });
        
        if (finalMessageId) {
            await logDebug('info', 'createJob', 'Resolving message ID', { original: finalMessageId });
            finalMessageId = await getRealMessageId(finalMessageId);
            await logDebug('info', 'createJob', 'Message ID resolved', { resolved: finalMessageId });
        } else {
            await logDebug('warn', 'createJob', 'Brak messageId w jobData', { jobDataKeys: Object.keys(jobData) });
        }

        if (finalMessageId) {
          try {
            await logDebug('info', 'createJob', 'Calling importAttachments', { messageId: finalMessageId });
            const importedFiles = await importAttachments(finalMessageId);
            
            await logDebug('info', 'createJob', 'Import completed', { 
              importedFilesCount: importedFiles?.length || 0,
              importedFiles: importedFiles,
              isArray: Array.isArray(importedFiles)
            });
            
            // Dodaj WSZYSTKIE załączniki - obrazy, PDF-y, wszystko
            if (Array.isArray(importedFiles) && importedFiles.length > 0) {
              projectImages = importedFiles;
              await logDebug('info', 'createJob', 'Gmail attachments added to projectImages', { 
                count: projectImages.length,
                files: projectImages
              });
            } else {
              await logDebug('warn', 'createJob', 'importAttachments returned empty array or invalid data', { 
                importedFiles: importedFiles,
                type: typeof importedFiles
              });
            }
          } catch (importError) {
            await logDebug('error', 'createJob', 'Import załączników nie powiódł się', { 
              error: importError.message,
              stack: importError.stack,
              name: importError.name
            });
            attachmentWarning = "Załączniki Gmail nie zostały pobrane: " + importError.message;
          }
        } else {
            await logDebug('warn', 'createJob', 'Brak messageId po resolucji, pomijam załączniki Gmail', {
              originalMessageId: jobData.gmailMessageId
            });
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

