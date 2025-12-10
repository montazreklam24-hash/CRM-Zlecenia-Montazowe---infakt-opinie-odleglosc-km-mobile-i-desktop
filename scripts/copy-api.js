/**
 * Skrypt kopiujący folder api/ do dist/api/ po buildzie
 * Uruchamiany automatycznie po `npm run build`
 * Kompatybilny z Windows
 */

import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const apiSrc = resolve(rootDir, 'api');
const apiDest = resolve(rootDir, 'dist', 'api');
const distDir = resolve(rootDir, 'dist');

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

  // Windows: użyj xcopy z wykluczeniem uploads
  if (process.platform === 'win32') {
    // Najpierw kopiuj wszystko
    execSync(`xcopy /E /I /Y "${apiSrc}" "${apiDest}"`, { stdio: 'inherit' });
    // Usuń folder uploads z dist/api (zostaje tylko na serwerze)
    const uploadsInDist = resolve(apiDest, 'uploads');
    if (existsSync(uploadsInDist)) {
      rmSync(uploadsInDist, { recursive: true, force: true });
      console.log('\n🗑️  Usunięto dist/api/uploads/ (folder uploads jest osobno na serwerze)');
    }
  } else {
    // Linux/Mac: użyj cp z wykluczeniem
    execSync(`rsync -av --exclude='uploads' "${apiSrc}/" "${apiDest}/"`, { stdio: 'inherit' });
  }

  console.log('\n✅ Skopiowano api/ → dist/api/');
  console.log('📦 Teraz wgraj ZAWARTOŚĆ folderu dist/ na serwer!');
  console.log('⚠️  Folder uploads/ na serwerze NIE jest w dist - zostaje nienaruszony!\n');
} catch (error) {
  console.error('❌ Błąd kopiowania:', error.message);
  process.exit(1);
}