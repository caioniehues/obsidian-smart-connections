#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const project_root = path.resolve(__dirname, '..');
const dist_dir = path.join(project_root, 'dist');

console.log('🔗 Obsidian Smart Connections - Development Symlink Setup');
console.log('=========================================================\n');

// Check if dist directory exists
if (!fs.existsSync(dist_dir)) {
  console.error('❌ Error: dist/ directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// Check for required files
const required_files = ['main.js', 'manifest.json', 'styles.css'];
const missing_files = required_files.filter(file => !fs.existsSync(path.join(dist_dir, file)));

if (missing_files.length > 0) {
  console.error(`❌ Error: Missing required files in dist/: ${missing_files.join(', ')}`);
  console.log('Please run "npm run build" first.');
  process.exit(1);
}

// Function to find Obsidian vaults
function findObsidianVaults() {
  const vaults = [];
  const home_dir = os.homedir();
  
  // Common Obsidian config locations
  const config_paths = [
    path.join(home_dir, 'Library', 'Application Support', 'obsidian'), // macOS
    path.join(home_dir, 'AppData', 'Roaming', 'obsidian'), // Windows
    path.join(home_dir, '.config', 'obsidian'), // Linux
  ];
  
  // Check for obsidian.json config file
  for (const config_path of config_paths) {
    const obsidian_json_path = path.join(config_path, 'obsidian.json');
    if (fs.existsSync(obsidian_json_path)) {
      try {
        const config = JSON.parse(fs.readFileSync(obsidian_json_path, 'utf8'));
        if (config.vaults) {
          Object.entries(config.vaults).forEach(([id, vault_info]) => {
            if (vault_info.path && fs.existsSync(vault_info.path)) {
              vaults.push({
                name: path.basename(vault_info.path),
                path: vault_info.path,
                id: id
              });
            }
          });
        }
      } catch (e) {
        console.warn(`Warning: Could not parse ${obsidian_json_path}`);
      }
      break;
    }
  }
  
  // Also check for vaults specified in environment
  if (process.env.DESTINATION_VAULTS) {
    const env_vaults = process.env.DESTINATION_VAULTS.split(',');
    env_vaults.forEach(vault_name => {
      const vault_path = path.resolve(project_root, '..', vault_name);
      if (fs.existsSync(vault_path)) {
        // Check if it's actually an Obsidian vault
        if (fs.existsSync(path.join(vault_path, '.obsidian'))) {
          // Avoid duplicates
          if (!vaults.some(v => v.path === vault_path)) {
            vaults.push({
              name: vault_name,
              path: vault_path,
              id: 'env-' + vault_name
            });
          }
        }
      }
    });
  }
  
  return vaults;
}

// Function to create symlink with platform-specific handling
function createSymlink(source, target) {
  const platform = os.platform();
  
  // Remove existing file/symlink if it exists
  if (fs.existsSync(target)) {
    try {
      const stats = fs.lstatSync(target);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(target);
        console.log(`  ℹ️  Removed existing symlink: ${path.basename(target)}`);
      } else {
        // Backup existing file
        const backup_path = target + '.backup';
        fs.renameSync(target, backup_path);
        console.log(`  ℹ️  Backed up existing file to: ${path.basename(backup_path)}`);
      }
    } catch (e) {
      console.warn(`  ⚠️  Could not remove existing file: ${path.basename(target)}`);
    }
  }
  
  try {
    if (platform === 'win32') {
      // Windows: Try to create symlink, fall back to junction for directories
      try {
        // Try creating a symlink (requires admin or developer mode)
        execSync(`mklink "${target}" "${source}"`, { stdio: 'ignore' });
      } catch (e) {
        // Fall back to copying on Windows if symlink fails
        console.warn(`  ⚠️  Symlink creation failed on Windows (requires admin/developer mode)`);
        console.log(`  📄 Falling back to file copy for ${path.basename(target)}`);
        fs.copyFileSync(source, target);
        return false;
      }
    } else {
      // macOS/Linux: Use relative symlinks for better portability
      const relative_source = path.relative(path.dirname(target), source);
      fs.symlinkSync(relative_source, target, 'file');
    }
    
    console.log(`  ✅ Created symlink: ${path.basename(target)}`);
    return true;
  } catch (err) {
    console.error(`  ❌ Failed to create symlink: ${err.message}`);
    return false;
  }
}

// Main setup process
function setupSymlinks() {
  const vaults = findObsidianVaults();
  
  if (vaults.length === 0) {
    console.log('No Obsidian vaults found.');
    console.log('\nTo specify vaults manually, use:');
    console.log('  DESTINATION_VAULTS=vault1,vault2 npm run dev:setup');
    return;
  }
  
  console.log(`Found ${vaults.length} Obsidian vault(s):\n`);
  
  let success_count = 0;
  let fail_count = 0;
  
  vaults.forEach(vault => {
    console.log(`📁 Vault: ${vault.name}`);
    console.log(`   Path: ${vault.path}`);
    
    const plugin_dir = path.join(vault.path, '.obsidian', 'plugins', 'smart-connections');
    
    // Create plugin directory if it doesn't exist
    if (!fs.existsSync(plugin_dir)) {
      fs.mkdirSync(plugin_dir, { recursive: true });
      console.log(`  📂 Created plugin directory`);
    }
    
    // Create .hotreload file if it doesn't exist
    const hotreload_path = path.join(plugin_dir, '.hotreload');
    if (!fs.existsSync(hotreload_path)) {
      fs.writeFileSync(hotreload_path, '');
      console.log(`  🔥 Created .hotreload file`);
    }
    
    // Create symlinks for each required file
    let vault_success = true;
    required_files.forEach(file => {
      const source = path.join(dist_dir, file);
      const target = path.join(plugin_dir, file);
      
      if (!createSymlink(source, target)) {
        vault_success = false;
      }
    });
    
    if (vault_success) {
      success_count++;
      console.log(`  ✨ Symlinks created successfully!\n`);
    } else {
      fail_count++;
      console.log(`  ⚠️  Some symlinks could not be created (using file copies as fallback)\n`);
    }
  });
  
  // Summary
  console.log('=========================================================');
  console.log('Setup Complete!\n');
  
  if (success_count > 0) {
    console.log(`✅ Successfully set up ${success_count} vault(s) with symlinks`);
    console.log('\n🚀 Development workflow:');
    console.log('  1. Make changes to your source code');
    console.log('  2. Run: npm run build');
    console.log('  3. Changes appear instantly in Obsidian (with .hotreload)');
    console.log('\n💡 Tip: Use "npm run dev:build" to build with USE_SYMLINKS=true automatically');
  }
  
  if (fail_count > 0) {
    console.log(`\n⚠️  ${fail_count} vault(s) fell back to file copying`);
    console.log('  This is normal on Windows without admin/developer mode');
  }
  
  // Platform-specific notes
  const platform = os.platform();
  if (platform === 'win32') {
    console.log('\n📝 Windows Note:');
    console.log('  For symlinks to work, you need either:');
    console.log('  - Developer mode enabled (Windows 10/11)');
    console.log('  - Run as Administrator');
    console.log('  File copying will be used as fallback otherwise.');
  }
}

// Run setup
setupSymlinks();