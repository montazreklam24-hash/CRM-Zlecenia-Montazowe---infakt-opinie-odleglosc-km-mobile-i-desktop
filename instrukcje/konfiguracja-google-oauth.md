# Konfiguracja Google OAuth - Logowanie przez Google

## Krok 1: Utwórz Google OAuth App

1. Przejdź do: https://console.cloud.google.com/apis/credentials
2. Wybierz projekt lub utwórz nowy
3. Kliknij **"Utwórz poświadczenia"** → **"Identyfikator klienta OAuth"**
4. Wybierz typ: **"Aplikacja internetowa"**
5. Dodaj **URI przekierowania**:
   - **Lokalnie**: `http://localhost:8080/api/auth/google/callback`
   - **Produkcja**: `https://twoja-domena.pl/api/auth/google/callback`
6. Zapisz **Client ID** i **Client Secret**

## Krok 2: Konfiguracja w projekcie

### Opcja A: Plik `.env` (zalecane)

Utwórz lub edytuj plik `api/.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=twoj_client_id_z_google
GOOGLE_OAUTH_CLIENT_SECRET=twoj_client_secret_z_google
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
```

### Opcja B: Bezpośrednio w `api/config.php`

Edytuj wartości domyślne w liniach 72-74:

```php
define('GOOGLE_OAUTH_CLIENT_ID', env('GOOGLE_OAUTH_CLIENT_ID', 'twoj_client_id'));
define('GOOGLE_OAUTH_CLIENT_SECRET', env('GOOGLE_OAUTH_CLIENT_SECRET', 'twoj_client_secret'));
define('GOOGLE_OAUTH_REDIRECT_URI', env('GOOGLE_OAUTH_REDIRECT_URI', 'http://localhost:8080/api/auth/google/callback'));
```

## Krok 3: Migracja bazy danych

Uruchom migrację, aby dodać kolumnę `google_id`:

```bash
php api/migrations/add_google_id_to_users.php
```

Lub ręcznie w bazie danych:

```sql
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL;
CREATE INDEX idx_google_id ON users(google_id);
```

## Krok 4: Testowanie

1. Odśwież stronę logowania
2. Kliknij **"Zaloguj się przez Google"**
3. Wybierz konto Google
4. Zostaniesz automatycznie zalogowany

## Jak to działa

1. **Użytkownik klika przycisk** → przekierowanie do Google
2. **Google prosi o autoryzację** → użytkownik wybiera konto
3. **Google zwraca kod** → backend wymienia go na token
4. **Backend pobiera dane użytkownika** → email, imię, nazwisko
5. **Backend tworzy/zaktualizuje konto** w bazie danych
6. **Backend tworzy sesję** → zwraca token do frontendu
7. **Frontend loguje użytkownika** → automatyczne przekierowanie

## Bezpieczeństwo

- ✅ Tokeny są wymieniane bezpiecznie przez HTTPS
- ✅ Hasła nie są przechowywane dla użytkowników Google
- ✅ Sesje działają tak samo jak przy zwykłym logowaniu
- ✅ Użytkownicy mogą łączyć konta (email + Google)

## Rozwiązywanie problemów

### Błąd: "Google OAuth nie jest skonfigurowany"
- Sprawdź czy `GOOGLE_OAUTH_CLIENT_ID` i `GOOGLE_OAUTH_CLIENT_SECRET` są ustawione
- Sprawdź plik `.env` lub `config.php`

### Błąd: "redirect_uri_mismatch"
- Sprawdź czy URI przekierowania w Google Console dokładnie pasuje do `GOOGLE_OAUTH_REDIRECT_URI`
- Upewnij się że używasz `http://` dla localhost i `https://` dla produkcji

### Błąd: "Nie udało się pobrać danych użytkownika"
- Sprawdź czy w Google Console masz włączone API "Google+ API" lub "People API"
- Sprawdź logi PHP w `api/logs/`

### Kolumna google_id nie istnieje
- Uruchom migrację: `php api/migrations/add_google_id_to_users.php`
- Lub dodaj ręcznie przez SQL

## Produkcja

Przed wdrożeniem na produkcję:

1. **Zmień `GOOGLE_OAUTH_REDIRECT_URI`** na domenę produkcyjną
2. **Dodaj domenę produkcyjną** w Google Console jako URI przekierowania
3. **Przetestuj** logowanie na produkcji
4. **Sprawdź HTTPS** - Google wymaga HTTPS dla produkcji

