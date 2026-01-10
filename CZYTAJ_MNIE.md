# 🎉 GOTOWE! Wszystko przygotowane do instalacji na Hetzner

## 📦 CO ZOSTAŁO UTWORZONE:

### 1. **START_TUTAJ.txt** 
Główna instrukcja - otwórz i postępuj krok po kroku

### 2. **setup-hetzner.sh**
Automatyczny skrypt instalacyjny dla serwera (już na GitHub)

### 3. **deploy-hetzner.ps1**
Skrypt do wgrywania aktualizacji z Windows

### 4. **INSTALACJA_HETZNER.md**
Pełna dokumentacja techniczna

### 5. **docker-compose.production.yml**
Zostanie utworzony automatycznie przez skrypt na serwerze

---

## 🚀 JAK ZACZĄĆ (SUPER PROSTO):

### **KROK 1:** Otwórz PowerShell
```powershell
ssh root@46.224.89.131
```
Hasło: `iTTCULm3ar9iEgtiNfpK`

### **KROK 2:** Wklej jedną komendę:
```bash
curl -fsSL https://raw.githubusercontent.com/montazreklam24-hash/CRM-Zlecenia-Montazowe---infakt-opinie-odleglosc-km-mobile-i-desktop/omega/setup-hetzner.sh | bash
```

### **KROK 3:** Poczekaj 3-5 minut

### **KROK 4:** Na swoim komputerze uruchom:
```powershell
cd "D:\Programowanie\Cursor\CRM Zlecenia Montazowe - infakt, opinie, odleglosc km, mobile i desktop"
.\deploy-hetzner.ps1
```

### **KROK 5:** Zaimportuj bazę danych
Otwórz: http://46.224.89.131:8081

---

## ✅ GOTOWE!

Aplikacja będzie dostępna pod: **http://46.224.89.131**

---

## 📋 DANE DOSTĘPOWE:

**Serwer:**
- IP: 46.224.89.131
- User: root
- Password: iTTCULm3ar9iEgtiNfpK (zmień przy pierwszym logowaniu!)

**Baza danych (phpMyAdmin):**
- URL: http://46.224.89.131:8081
- Host: db
- Database: crm_db
- User: crm_user
- Password: crm_password_secure_2025

---

## 🎯 CO DALEJ:

1. **Domena** - możesz podpiąć swoją domenę do IP: 46.224.89.131
2. **SSL** - można zainstalować darmowy certyfikat Let's Encrypt
3. **Backupy** - włącz w panelu Hetzner (opcjonalne)

---

Wszystkie szczegóły w pliku **START_TUTAJ.txt** - otwórz go i zaczynaj! 🚀
