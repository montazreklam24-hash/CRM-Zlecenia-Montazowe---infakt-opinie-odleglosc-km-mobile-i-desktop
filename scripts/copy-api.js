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

  // Windows: użyj xcopy
  if (process.platform === 'win32') {
    execSync(`xcopy /E /I /Y "${apiSrc}" "${apiDest}"`, { stdio: 'inherit' });
  } else {
    // Linux/Mac: użyj cp
    execSync(`cp -r "${apiSrc}" "${apiDest}"`, { stdio: 'inherit' });
  }

  console.log('\n✅ Skopiowano api/ → dist/api/');
  console.log('📦 Teraz wgraj tylko folder dist/ na serwer!\n');
} catch (error) {
  console.error('❌ Błąd kopiowania:', error.message);
  process.exit(1);
}