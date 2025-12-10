# Plan: System Logowania i Uprawnien

**Data utworzenia:** 2025-12-09
**Status:** Planowane
**Priorytet:** KRYTYCZNY - bezpieczenstwo

---

## Opis

System logowania z kontami uzytkownikow, rolami i uprawnieniami. Administrator ma pelny dostep, pracownicy maja ograniczony widok (bez danych rozliczeniowych). Sesja zapamietywana - bez koniecznosci logowania za kazdym razem.

---

## Stan obecny (NIEBEZPIECZNY)

- Brak logowania - kazdy z linkiem ma dostep
- Dane klientow, adresy, telefony - publicznie dostepne
- Brak rol i uprawnien
- Endpoint `/api/login` istnieje ale nie jest uzywany

---

## FAZA 1: Struktura bazy danych

### 1.1 Tabela `users` (juz istnieje - rozbudowac)

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(50),
  role ENUM('admin', 'worker', 'viewer') DEFAULT 'worker',
  is_active TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  reset_token VARCHAR(255) NULL,
  reset_token_expires DATETIME NULL
);
```

### 1.2 Tabela `sessions` (dla zapamietywania logowania)

```sql
CREATE TABLE sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 1.3 Tabela `permissions` (opcjonalnie - granularne uprawnienia)

```sql
CREATE TABLE user_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  permission VARCHAR(50) NOT NULL,
  -- Mozliwe wartosci:
  -- 'view_jobs', 'edit_jobs', 'delete_jobs',
  -- 'view_finances', 'edit_finances',
  -- 'view_clients', 'manage_users'
  UNIQUE(user_id, permission)
);
```

---

## FAZA 2: Role i uprawnienia

### 2.1 Role

| Rola | Opis | Domyslne uprawnienia |
|------|------|---------------------|
| `admin` | Wlasciciel firmy | Wszystko |
| `worker` | Pracownik montazowy | Ograniczone |
| `viewer` | Tylko podglad | Tylko odczyt |

### 2.2 Uprawnienia dla roli `worker`

**WIDZI:**
- Lista zlecen (swoje lub wszystkie - do ustalenia)
- Dane klienta: imie, telefon, adres montazu
- Zdjecia projektu
- Zakres prac
- Checklista

**NIE WIDZI:**
- Kwoty (netto, brutto, VAT)
- Status platnosci
- Dane do faktury (NIP, nazwa firmy)
- Notatki admina (chyba ze zaznaczone jako widoczne)

**WYJĄTEK - widzi kwoty gdy:**
- Zlecenie oznaczone jako "DO POBRANIA GOTOWKI"
- Wtedy widzi tylko kwote do pobrania

### 2.3 Uprawnienia dla roli `admin`

- Wszystko widoczne
- Zarzadzanie uzytkownikami
- Tworzenie/usuwanie kont
- Nadawanie uprawnien

---

## FAZA 3: Logowanie

### 3.1 Ekran logowania

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              🔧 MONTAZ REKLAM 24 - CRM                      │
│                                                             │
│         ┌─────────────────────────────────┐                 │
│         │  Email                          │                 │
│         └─────────────────────────────────┘                 │
│                                                             │
│         ┌─────────────────────────────────┐                 │
│         │  Haslo                      👁  │                 │
│         └─────────────────────────────────┘                 │
│                                                             │
│         [x] Zapamietaj mnie (30 dni)                        │
│                                                             │
│         ┌─────────────────────────────────┐                 │
│         │         ZALOGUJ SIE             │                 │
│         └─────────────────────────────────┘                 │
│                                                             │
│         Nie pamietasz hasla? [Przypomnij]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Logika logowania

1. Uzytkownik wpisuje email + haslo
2. Backend sprawdza `password_hash` (bcrypt)
3. Jesli OK:
   - Tworzy token sesji (UUID lub JWT)
   - Zapisuje w tabeli `sessions`
   - Ustawia cookie `auth_token` (HttpOnly, Secure)
   - Jesli "Zapamietaj mnie" - token wazny 30 dni
   - Jesli nie - token wazny 24h lub do zamkniecia przegladarki
4. Przekierowanie do Dashboard

### 3.3 Sprawdzanie sesji

Przy kazdym uzyciu API:
1. Sprawdz cookie `auth_token`
2. Znajdz w tabeli `sessions`
3. Sprawdz czy nie wygasl (`expires_at`)
4. Jesli OK - kontynuuj
5. Jesli nie - przekieruj do logowania

---

## FAZA 4: Przypomnienie hasla

### 4.1 Przeplyw

1. Uzytkownik klika "Nie pamietasz hasla?"
2. Wpisuje email
3. System generuje `reset_token` (UUID)
4. Wysyla email z linkiem: `https://crm.../reset?token=xxx`
5. Link wazny 1 godzine
6. Uzytkownik klika link -> formularz nowego hasla
7. Po zmianie - token uniewazniony

### 4.2 Szablon maila

```
Temat: Reset hasla - CRM Montaz Reklam 24

Witaj,

Otrzymalismy prosbe o reset hasla dla Twojego konta.

Kliknij ponizszy link aby ustawic nowe haslo:
https://crm.montazreklam24.pl/reset-password?token=xxx

Link wazny przez 1 godzine.

Jesli nie prosiles o reset hasla - zignoruj ta wiadomosc.

Pozdrawiamy,
Montaz Reklam 24
```

---

## FAZA 5: Zarzadzanie uzytkownikami (panel admina)

### 5.1 Lista uzytkownikow

```
┌─────────────────────────────────────────────────────────────┐
│  UZYTKOWNICY                              [+ Dodaj]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👤 Jan Kowalski          admin@montazreklam24.pl           │
│     Rola: Administrator   Ostatnie logowanie: dzis 14:30   │
│                                            [Edytuj]         │
│                                                             │
│  👤 Piotr Nowak           piotr@montazreklam24.pl           │
│     Rola: Pracownik       Ostatnie logowanie: wczoraj      │
│                                    [Edytuj] [Dezaktywuj]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Dodawanie uzytkownika

1. Admin wpisuje: email, imie, rola
2. System generuje tymczasowe haslo lub link aktywacyjny
3. Wysyla email do pracownika
4. Pracownik ustawia wlasne haslo

### 5.3 Edycja uzytkownika

- Zmiana roli
- Reset hasla
- Dezaktywacja konta (bez usuwania)
- Granularne uprawnienia (opcjonalnie)

---

## FAZA 6: Frontend - ukrywanie elementow

### 6.1 Hook `usePermissions`

```typescript
const { canView, canEdit, role } = usePermissions();

// Uzycie:
{canView('finances') && <FinanceSection />}
{canEdit('jobs') && <EditButton />}
```

### 6.2 Elementy do ukrycia dla roli `worker`

W `JobCard.tsx`:
- [ ] Sekcja fakturowania (cala)
- [ ] Kwoty netto/brutto
- [ ] Status platnosci (chyba ze "gotowka do pobrania")
- [ ] NIP, dane firmy
- [ ] Notatki admina

W `Dashboard.tsx`:
- [ ] Filtry po statusie platnosci
- [ ] Podsumowanie finansowe (jesli bedzie)

---

## FAZA 7: Backend - zabezpieczenie API

### 7.1 Middleware autoryzacji

Kazdy endpoint sprawdza:
1. Czy uzytkownik zalogowany
2. Czy ma uprawnienia do tej akcji

```php
// api/auth.php
function requireAuth() {
    $user = getCurrentUser();
    if (!$user) {
        jsonResponse(['error' => 'Unauthorized'], 401);
        exit;
    }
    return $user;
}

function requireRole($roles) {
    $user = requireAuth();
    if (!in_array($user['role'], $roles)) {
        jsonResponse(['error' => 'Forbidden'], 403);
        exit;
    }
    return $user;
}
```

### 7.2 Filtrowanie danych dla workera

```php
function mapJobToFrontend($job, $userRole) {
    $data = [...]; // podstawowe dane
    
    if ($userRole !== 'admin') {
        // Ukryj dane finansowe
        unset($data['payment']);
        unset($data['data']['nip']);
        // chyba ze gotowka do pobrania
        if ($job['payment_status'] === 'cash') {
            $data['cashToCollect'] = $job['value_gross'];
        }
    }
    
    return $data;
}
```

---

## Pliki do modyfikacji/utworzenia

| Plik | Akcja |
|------|-------|
| `api/auth.php` | Rozbudowa - sesje, reset hasla |
| `api/users.php` | NOWY - CRUD uzytkownikow |
| `src/components/Login.tsx` | Rozbudowa - zapamietaj mnie, reset |
| `src/components/ResetPassword.tsx` | NOWY - formularz resetu |
| `src/components/UserManagement.tsx` | NOWY - panel admina |
| `src/hooks/usePermissions.ts` | NOWY - hook uprawnien |
| `src/components/JobCard.tsx` | Ukrywanie sekcji wg roli |
| `src/components/Dashboard.tsx` | Ukrywanie elementow wg roli |

---

## Kolejnosc implementacji

### Etap 1 - Podstawowe zabezpieczenie (PILNE)
1. [ ] Wlaczyc wymog logowania na froncie
2. [ ] Naprawic endpoint `/api/login`
3. [ ] Sesje z tokenem w cookie
4. [ ] "Zapamietaj mnie" - dlugi token

### Etap 2 - Role
5. [ ] Dodac kolumne `role` do tabeli `users`
6. [ ] Hook `usePermissions` na froncie
7. [ ] Ukrywanie elementow dla roli `worker`

### Etap 3 - Zarzadzanie
8. [ ] Panel uzytkownikow (tylko admin)
9. [ ] Dodawanie/edycja uzytkownikow
10. [ ] Reset hasla przez email

### Etap 4 - Detale (na pozniej)
11. [ ] Granularne uprawnienia
12. [ ] Logi logowan
13. [ ] Rozpoznawanie IP (opcjonalne)

---

## Uwagi bezpieczenstwa

- Hasla przechowywane jako bcrypt hash (NIE plaintext!)
- Tokeny sesji - losowe UUID lub JWT
- Cookie: HttpOnly, Secure, SameSite=Strict
- HTTPS wymagane (juz jest na serwerze)
- Rate limiting na logowanie (ochrona przed brute-force)
- Wylogowanie po X nieudanych probach
