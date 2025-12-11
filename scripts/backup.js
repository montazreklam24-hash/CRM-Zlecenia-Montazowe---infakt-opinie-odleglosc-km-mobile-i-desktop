/**
 * Skrypt automatycznego backupu projektu
 * Tworzy ZIP z datą i godziną przed każdym buildem
 * 
 * Użycie: node scripts/backup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Konfiguracja
const BACKUP_DIR = path.join(__dirname, '..', '..', 'CRM-Backups');
const PROJECT_DIR = path.join(__dirname, '..');
const MAX_BACKUPS = 20; // Trzymaj max 20 ostatnich backupów

// Foldery do pominięcia w backupie
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git', 'CRM-Backups'];

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
    // Windows - użyj PowerShell Compress-Archive
    const excludePattern = EXCLUDE_DIRS.map(d => `-x "${d}\\*"`).join(' ');
    
    // Użyj 7-Zip jeśli dostępny, inaczej PowerShell
    try {
      execSync(`7z a -tzip "${zipPath}" "${PROJECT_DIR}\\*" -xr!node_modules -xr!dist -xr!.git`, { 
        stdio: 'inherit',
        cwd: PROJECT_DIR 
      });
    } catch {
      // Fallback do PowerShell
      const psCommand = `
        $source = "${PROJECT_DIR.replace(/\\/g, '\\\\')}"
        $dest = "${zipPath.replace(/\\/g, '\\\\')}"
        $exclude = @('node_modules', 'dist', '.git')
        
        $tempDir = Join-Path $env:TEMP "crm-backup-temp"
        if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        
        Get-ChildItem -Path $source -Exclude $exclude | Copy-Item -Destination $tempDir -Recurse -Force
        Compress-Archive -Path "$tempDir\\*" -DestinationPath $dest -Force
        Remove-Item $tempDir -Recurse -Force
      `;
      execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { 
        stdio: 'inherit' 
      });
    }
    
    const stats = fs.statSync(zipPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`\n✅ Backup utworzony!`);
    console.log(`📦 Plik: ${zipName}`);
    console.log(`📊 Rozmiar: ${sizeMB} MB`);
    console.log(`📍 Lokalizacja: ${zipPath}\n`);
    
    cleanOldBackups();
    
  } catch (error) {
    console.error('❌ Błąd tworzenia backupu:', error.message);
    process.exit(1);
  }
}

// Uruchom
createBackup();


