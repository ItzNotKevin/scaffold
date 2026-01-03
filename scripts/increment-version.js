#!/usr/bin/env node

/**
 * Script to increment the version number in vite.config.ts manifest
 * This is called by the git pre-push hook to automatically update the PWA version
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const viteConfigPath = join(rootDir, 'vite.config.ts');

try {
  // Read vite.config.ts
  let content = readFileSync(viteConfigPath, 'utf8');
  
  // Find version in manifest (format: version: 'X.Y.Z' or version: "X.Y.Z")
  const versionRegex = /version:\s*['"]([\d.]+)['"]/;
  const match = content.match(versionRegex);
  
  if (match) {
    // Extract current version
    const currentVersion = match[1];
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    // Increment patch version
    const newVersion = `${major}.${minor}.${patch + 1}`;
    
    // Replace version in file
    content = content.replace(versionRegex, `version: '${newVersion}'`);
    
    // Write back to file
    writeFileSync(viteConfigPath, content, 'utf8');
    
    console.log(`✅ Version incremented: ${currentVersion} → ${newVersion}`);
  } else {
    // Version doesn't exist, add it (default: 1.0.0)
    // Find the manifest object start
    const manifestStartRegex = /manifest:\s*\{/;
    const manifestMatch = content.match(manifestStartRegex);
    
    if (manifestMatch) {
      const insertPos = manifestMatch.index + manifestMatch[0].length;
      const newLine = "\n        version: '1.0.0',";
      content = content.slice(0, insertPos) + newLine + content.slice(insertPos);
      
      writeFileSync(viteConfigPath, content, 'utf8');
      console.log(`✅ Version added: 1.0.0`);
    } else {
      console.error('❌ Could not find manifest object in vite.config.ts');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Error incrementing version:', error.message);
  process.exit(1);
}

