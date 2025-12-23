# Konfiguracja PHPMailer dla wysyłki emaili

## Instalacja PHPMailer

1. Zainstaluj Composer (jeśli jeszcze nie masz):
   ```bash
   # Windows (PowerShell)
   Invoke-WebRequest https://getcomposer.org/Composer-Setup.exe -OutFile composer-setup.exe
   # Uruchom installer
   
   # Linux/Mac
   curl -sS https://getcomposer.org/installer | php
   ```

2. Zainstaluj PHPMailer:
   ```bash
   composer install
   ```

   Lub jeśli composer nie jest dostępny globalnie:
   ```bash
   php composer.phar install
   ```

## Konfiguracja SMTP

### Opcja 1: Plik .env (zalecane)

Utwórz plik `api/.env` z następującą konfiguracją:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=twoj_email@gmail.com
SMTP_PASSWORD=twoje_haslo_aplikacji
SMTP_FROM_EMAIL=twoj_email@gmail.com
SMTP_FROM_NAME=Montaż Reklam 24
SMTP_SECURE=tls
```

### Opcja 2: Bezpośrednio w config.php

Edytuj `api/config.php` i zmień wartości domyślne:

```php
define('SMTP_HOST', env('SMTP_HOST', 'smtp.gmail.com'));
define('SMTP_PORT', env('SMTP_PORT', 587));
define('SMTP_USERNAME', env('SMTP_USERNAME', 'twoj_email@gmail.com'));
define('SMTP_PASSWORD', env('SMTP_PASSWORD', 'twoje_haslo_aplikacji'));
define('SMTP_FROM_EMAIL', env('SMTP_FROM_EMAIL', 'twoj_email@gmail.com'));
define('SMTP_FROM_NAME', env('SMTP_FROM_NAME', 'Montaż Reklam 24'));
define('SMTP_SECURE', env('SMTP_SECURE', 'tls'));
```

## Konfiguracja Gmail

Jeśli używasz Gmail:

1. **Włącz weryfikację dwuetapową** na koncie Google
2. **Utwórz hasło aplikacji**:
   - Przejdź do: https://myaccount.google.com/apppasswords
   - Wybierz "Aplikacja" → "Poczta"
   - Wybierz "Urządzenie" → "Inne (Niestandardowa nazwa)"
   - Wpisz "CRM Montaż Reklam 24"
   - Skopiuj wygenerowane hasło (16 znaków)
3. **Użyj hasła aplikacji** jako `SMTP_PASSWORD` w konfiguracji

## Inne serwery SMTP

### Outlook/Office 365
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=tls
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=twoj_api_key_sendgrid
SMTP_SECURE=tls
```

### Mailtrap (do testów)
```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USERNAME=twoj_username_mailtrap
SMTP_PASSWORD=twoje_haslo_mailtrap
SMTP_SECURE=tls
```

## Testowanie

Po konfiguracji możesz przetestować wysyłkę emaili przez:
1. Otwarcie zlecenia w CRM
2. Kliknięcie "ZAKOŃCZ ZLECENIE"
3. Dodanie zdjęcia z realizacji
4. Wpisanie emaila klienta
5. Kliknięcie "Wyślij i zakończ"

## Rozwiązywanie problemów

### PHPMailer nie jest zainstalowany
- Upewnij się, że `composer install` został wykonany
- Sprawdź czy folder `vendor/` istnieje w katalogu głównym projektu

### Błąd autentykacji SMTP
- Sprawdź czy `SMTP_USERNAME` i `SMTP_PASSWORD` są poprawne
- Dla Gmail: użyj hasła aplikacji, nie zwykłego hasła
- Sprawdź czy weryfikacja dwuetapowa jest włączona (Gmail)

### Błąd połączenia SMTP
- Sprawdź czy port nie jest zablokowany przez firewall
- Sprawdź czy `SMTP_HOST` jest poprawny
- Dla Gmail: upewnij się, że używasz portu 587 (TLS) lub 465 (SSL)

### Email nie dociera
- Sprawdź folder SPAM
- Sprawdź logi PHP: `api/logs/`
- Sprawdź logi PHPMailer w odpowiedzi API

## Fallback do mail()

Jeśli PHPMailer nie jest zainstalowany, system automatycznie użyje funkcji `mail()` PHP jako fallback. Jednak ta metoda jest mniej niezawodna i może nie działać na wszystkich serwerach.

