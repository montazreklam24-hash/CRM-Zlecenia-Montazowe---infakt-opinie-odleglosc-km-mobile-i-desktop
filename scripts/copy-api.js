/**
 * Skrypt kopiujący folder api/ do dist/api/ po buildzie
 * Uruchamiany automatycznie po `npm run build`
 * Kompatybilny z Windows
 */

import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const apiSrc = resolve(rootDir, 'api');
const apiDest = resolve(rootDir, 'dist', 'api');
const distDir = resolve(rootDir, 'dist');
const uploadsDir = resolve(rootDir, 'dist', 'uploads');

console.log('\n🔄 Kopiowanie api/ do dist/api/...');

if (!existsSync(apiSrc)) {
  console.log('❌ Folder api/ nie istnieje!');
  process.exit(1);
}

if (!existsSync(distDir)) {
  console.log('❌ Folder dist/ nie istnieje! Najpierw uruchom build.');
  process.exit(1);
}

try {
  // Usuń stary folder api w dist jeśli istnieje
  if (existsSync(apiDest)) {
    rmSync(apiDest, { recursive: true, force: true });
  }

  // Windows: użyj xcopy
  if (process.platform === 'win32') {
    execSync(`xcopy /E /I /Y "${apiSrc}" "${apiDest}"`, { stdio: 'inherit' });
  } else {
    execSync(`rsync -av "${apiSrc}/" "${apiDest}/"`, { stdio: 'inherit' });
  }

  console.log('\n✅ Skopiowano api/ → dist/api/');
  
  // Utwórz folder dist/uploads/ z plikami bezpieczeństwa
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  
  // .htaccess dla uploads
  const htaccessContent = `# Bezpośredni dostęp do plików
Options -Indexes

# Dozwolone tylko obrazy
<FilesMatch "\\.(jpg|jpeg|png|gif|webp)$">
    Require all granted
</FilesMatch>

# Zablokuj PHP
<FilesMatch "\\.php$">
    Require all denied
</FilesMatch>
`;
  writeFileSync(resolve(uploadsDir, '.htaccess'), htaccessContent);
  
  // index.php jako fallback
  writeFileSync(resolve(uploadsDir, 'index.php'), '<?php header("HTTP/1.0 403 Forbidden"); exit;');
  
  console.log('✅ Utworzono dist/uploads/ (folder na zdjęcia)');
  console.log('📦 Teraz wgraj ZAWARTOŚĆ folderu dist/ na serwer!');
  console.log('⚠️  Zdjęcia z serwera zostają - nie nadpisuj folderu uploads/!\n');
} catch (error) {
  console.error('❌ Błąd kopiowania:', error.message);
  process.exit(1);
}