/**
 * Skrypt automatycznego backupu projektu
 * Tworzy ZIP z datą i godziną przed każdym buildem
 * 
 * Użycie: node scripts/backup.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Konfiguracja
const BACKUP_DIR = path.join(__dirname, '..', '..', 'CRM-Backups');
const PROJECT_DIR = path.join(__dirname, '..');
const MAX_BACKUPS = 20;

function formatDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hour}-${min}`;
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Utworzono folder backupów: ${BACKUP_DIR}`);
  }
}

function cleanOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.zip'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    toDelete.forEach(f => {
      fs.unlinkSync(f.path);
      console.log(`🗑️ Usunięto stary backup: ${f.name}`);
    });
  }
}

function createBackup() {
  ensureBackupDir();
  
  const timestamp = formatDate();
  const zipName = `CRM-backup-${timestamp}.zip`;
  const zipPath = path.join(BACKUP_DIR, zipName);
  
  console.log(`\n💾 Tworzę backup: ${zipName}`);
  console.log(`📂 Folder docelowy: ${BACKUP_DIR}\n`);

  try {
    // Stwórz tymczasowy folder z plikami do backupu
    const tempDir = path.join(process.env.TEMP || '/tmp', 'crm-backup-temp-' + Date.now());
    
    // PowerShell script jako osobny plik
    const psScript = `
$ErrorActionPreference = "SilentlyContinue"
$source = "${PROJECT_DIR.replace(/\\/g, '\\\\')}"
$dest = "${zipPath.replace(/\\/g, '\\\\')}"
$tempDir = "${tempDir.replace(/\\/g, '\\\\')}"

# Usuń stary temp jeśli istnieje
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

# Utwórz temp folder
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Kopiuj pliki z wykluczeniem
$exclude = @('node_modules', 'dist', '.git')
Get-ChildItem -Path $source | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $tempDir -Recurse -Force
}

# Usuń stary ZIP jeśli istnieje
if (Test-Path $dest) { Remove-Item $dest -Force }

# Utwórz ZIP
Compress-Archive -Path "$tempDir\\*" -DestinationPath $dest -Force

# Posprzątaj
Remove-Item $tempDir -Recurse -Force

Write-Host "OK"
`;

    const psScriptPath = path.join(process.env.TEMP || '/tmp', 'backup-script.ps1');
    fs.writeFileSync(psScriptPath, psScript, 'utf8');
    
    execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    // Usuń skrypt PS
    fs.unlinkSync(psScriptPath);
    
    if (fs.existsSync(zipPath)) {
      const stats = fs.statSync(zipPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`✅ Backup utworzony!`);
      console.log(`📦 Plik: ${zipName}`);
      console.log(`📊 Rozmiar: ${sizeMB} MB`);
      console.log(`📍 Lokalizacja: ${zipPath}\n`);
      
      cleanOldBackups();
    } else {
      throw new Error('ZIP nie został utworzony');
    }
    
  } catch (error) {
    console.error('❌ Błąd tworzenia backupu:', error.message);
    // Nie przerywaj builda - backup jest opcjonalny
    console.log('⚠️ Kontynuuję bez backupu...\n');
  }
}

// Uruchom
createBackup();
