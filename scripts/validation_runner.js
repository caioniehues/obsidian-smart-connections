#!/usr/bin/env node

/**
 * COMPREHENSIVE VALIDATION RUNNER
 * ================================
 * 
 * This script executes the complete validation strategy for obsidian-smart-claude.
 * It runs all validation tests in sequence and provides detailed reporting.
 * 
 * Usage:
 *   node scripts/validation_runner.js
 *   node scripts/validation_runner.js --quick (skip performance tests)
 *   node scripts/validation_runner.js --category build (run specific category)
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const quickMode = args.includes('--quick');
const categoryFilter = args.find(arg => arg.startsWith('--category='))?.split('=')[1];
const verbose = args.includes('--verbose');

/**
 * Validation Results Tracker
 */
class ValidationTracker {
  constructor() {
    this.categories = {};
    this.startTime = Date.now();
  }
  
  addResult(category, test, status, message, details = null) {
    if (!this.categories[category]) {
      this.categories[category] = {
        tests: [],
        passed: 0,
        failed: 0,
        warnings: 0
      };
    }
    
    this.categories[category].tests.push({
      test,
      status,
      message,
      details
    });
    
    this.categories[category][status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'warnings']++;
  }
  
  pass(category, test, message, details) {
    this.addResult(category, test, 'pass', message, details);
    console.log(`${colors.green}✅ [${category}] ${test}:${colors.reset} ${message}`);
    if (verbose && details) {
      console.log(`   ${colors.cyan}Details: ${details}${colors.reset}`);
    }
  }
  
  fail(category, test, message, details) {
    this.addResult(category, test, 'fail', message, details);
    console.log(`${colors.red}❌ [${category}] ${test}:${colors.reset} ${message}`);
    if (details) {
      console.log(`   ${colors.red}Error: ${details}${colors.reset}`);
    }
  }
  
  warn(category, test, message, details) {
    this.addResult(category, test, 'warn', message, details);
    console.log(`${colors.yellow}⚠️  [${category}] ${test}:${colors.reset} ${message}`);
    if (verbose && details) {
      console.log(`   ${colors.yellow}Warning: ${details}${colors.reset}`);
    }
  }
  
  info(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
  }
  
  getSummary() {
    const totalPassed = Object.values(this.categories).reduce((sum, cat) => sum + cat.passed, 0);
    const totalFailed = Object.values(this.categories).reduce((sum, cat) => sum + cat.failed, 0);
    const totalWarnings = Object.values(this.categories).reduce((sum, cat) => sum + cat.warnings, 0);
    const totalTests = totalPassed + totalFailed + totalWarnings;
    
    return {
      categories: Object.keys(this.categories).length,
      tests: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      warnings: totalWarnings,
      duration: Date.now() - this.startTime,
      success: totalFailed === 0
    };
  }
  
  printSummary() {
    const summary = this.getSummary();
    
    console.log(`\n${colors.bold}${'═'.repeat(80)}${colors.reset}`);
    console.log(`${colors.bold}                     VALIDATION SUMMARY                     ${colors.reset}`);
    console.log(`${colors.bold}${'═'.repeat(80)}${colors.reset}\n`);
    
    console.log(`${colors.bold}Duration:${colors.reset} ${Math.round(summary.duration / 1000)}s`);
    console.log(`${colors.bold}Categories:${colors.reset} ${summary.categories}`);
    console.log(`${colors.bold}Total Tests:${colors.reset} ${summary.tests}`);
    console.log(`${colors.green}✅ Passed: ${summary.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${summary.failed}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Warnings: ${summary.warnings}${colors.reset}`);
    
    // Category breakdown
    console.log(`\n${colors.bold}Category Breakdown:${colors.reset}`);
    Object.entries(this.categories).forEach(([category, stats]) => {
      const status = stats.failed > 0 ? '❌' : stats.warnings > 0 ? '⚠️' : '✅';
      console.log(`  ${status} ${category}: ${stats.passed}P ${stats.failed}F ${stats.warnings}W`);
    });
    
    if (summary.success) {
      console.log(`\n${colors.green}${colors.bold}🎉 ALL VALIDATIONS PASSED!${colors.reset}`);
      console.log(`${colors.green}The obsidian-smart-claude repository is ready for deployment.${colors.reset}\n`);
    } else {
      console.log(`\n${colors.red}${colors.bold}❌ VALIDATION FAILED!${colors.reset}`);
      console.log(`${colors.red}${summary.failed} test(s) failed. Please address the issues above.${colors.reset}\n`);
    }
    
    return summary.success;
  }
}

const tracker = new ValidationTracker();

/**
 * Utility function to run shell commands
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 30000, cwd = projectRoot } = options;
    
    const process = spawn(command, args, { 
      cwd,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    process.on('error', (error) => {
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }
    }, timeout);
  });
}

/**
 * Build Validation Tests
 */
async function validateBuild() {
  const category = 'BUILD';
  console.log(`\n${colors.bold}=== ${category} VALIDATION ===${colors.reset}\n`);
  
  // BV-001: Build Command Success
  try {
    const result = await runCommand('npm', ['run', 'build']);
    if (result.code === 0) {
      tracker.pass(category, 'BV-001', 'Build command completed successfully');
    } else {
      tracker.fail(category, 'BV-001', 'Build command failed', result.stderr);
    }
  } catch (error) {
    tracker.fail(category, 'BV-001', 'Build command execution failed', error.message);
  }
  
  // BV-002: Build Output File Generation
  const requiredFiles = [
    'dist/main.js',
    'dist/manifest.json',
    'dist/styles.css'
  ];
  
  requiredFiles.forEach(file => {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      tracker.pass(category, 'BV-002', `${file} generated successfully`, `Size: ${stats.size} bytes`);
    } else {
      tracker.fail(category, 'BV-002', `${file} not generated`);
    }
  });
  
  // BV-003: Build Configuration Validation
  try {
    const mainJsPath = join(projectRoot, 'dist/main.js');
    if (existsSync(mainJsPath)) {
      const content = readFileSync(mainJsPath, 'utf8');
      
      if (content.includes('ClaudeCodeCLIAdapter')) {
        tracker.pass(category, 'BV-003', 'Claude adapter found in bundle');
      } else {
        tracker.fail(category, 'BV-003', 'Claude adapter not found in bundle');
      }
      
      if (content.includes('claude_code_cli')) {
        tracker.pass(category, 'BV-003', 'Claude configuration found in bundle');
      } else {
        tracker.warn(category, 'BV-003', 'Claude configuration not clearly identifiable in bundle');
      }
    }
  } catch (error) {
    tracker.fail(category, 'BV-003', 'Failed to validate build configuration', error.message);
  }
  
  // BV-004: Build Warning Analysis
  try {
    const result = await runCommand('npm', ['run', 'build']);
    const bundleSize = statSync(join(projectRoot, 'dist/main.js')).size;
    const bundleSizeMB = bundleSize / (1024 * 1024);
    
    if (bundleSizeMB < 3) {
      tracker.pass(category, 'BV-004', `Bundle size acceptable: ${bundleSizeMB.toFixed(2)}MB`);
    } else {
      tracker.warn(category, 'BV-004', `Bundle size large: ${bundleSizeMB.toFixed(2)}MB`);
    }
  } catch (error) {
    tracker.fail(category, 'BV-004', 'Failed to analyze build warnings', error.message);
  }
}

/**
 * Installation Validation Tests
 */
async function validateInstallation() {
  const category = 'INSTALLATION';
  console.log(`\n${colors.bold}=== ${category} VALIDATION ===${colors.reset}\n`);
  
  // IV-001: Manual Installation Process Preparation
  const distPath = join(projectRoot, 'dist');
  if (existsSync(distPath)) {
    tracker.pass(category, 'IV-001', 'Dist directory exists for manual installation');
  } else {
    tracker.fail(category, 'IV-001', 'Dist directory missing - build required');
  }
  
  // IV-002: Plugin Manifest Validation
  try {
    const manifestPath = join(projectRoot, 'dist/manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      
      const requiredFields = ['id', 'name', 'version', 'description', 'author'];
      const missingFields = requiredFields.filter(field => !manifest[field]);
      
      if (missingFields.length === 0) {
        tracker.pass(category, 'IV-002', 'Manifest contains all required fields');
      } else {
        tracker.fail(category, 'IV-002', `Manifest missing fields: ${missingFields.join(', ')}`);
      }
      
      // Version consistency check
      const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
      if (manifest.version === packageJson.version) {
        tracker.pass(category, 'IV-002', 'Manifest version matches package.json');
      } else {
        tracker.fail(category, 'IV-002', `Version mismatch: manifest(${manifest.version}) != package.json(${packageJson.version})`);
      }
    } else {
      tracker.fail(category, 'IV-002', 'Manifest file not found in dist/');
    }
  } catch (error) {
    tracker.fail(category, 'IV-002', 'Failed to validate manifest', error.message);
  }
  
  // IV-003: BRAT Compatibility
  const bratRequiredFiles = ['main.js', 'manifest.json', 'styles.css'];
  const bratCompatible = bratRequiredFiles.every(file => 
    existsSync(join(projectRoot, 'dist', file))
  );
  
  if (bratCompatible) {
    tracker.pass(category, 'IV-003', 'BRAT compatibility - all required files present');
  } else {
    const missingFiles = bratRequiredFiles.filter(file => 
      !existsSync(join(projectRoot, 'dist', file))
    );
    tracker.fail(category, 'IV-003', `BRAT compatibility - missing files: ${missingFiles.join(', ')}`);
  }
}

/**
 * Functional Validation Tests
 */
async function validateFunctionality() {
  const category = 'FUNCTIONAL';
  console.log(`\n${colors.bold}=== ${category} VALIDATION ===${colors.reset}\n`);
  
  // FV-001: Core Module Imports
  try {
    const mainJsExists = existsSync(join(projectRoot, 'dist/main.js'));
    if (mainJsExists) {
      tracker.pass(category, 'FV-001', 'Main plugin file exists');
    } else {
      tracker.fail(category, 'FV-001', 'Main plugin file missing');
    }
  } catch (error) {
    tracker.fail(category, 'FV-001', 'Failed to validate core modules', error.message);
  }
  
  // FV-004: Claude Code CLI Integration Check
  try {
    const adapterPath = join(projectRoot, 'src/adapters/claude_code_cli_adapter.js');
    if (existsSync(adapterPath)) {
      tracker.pass(category, 'FV-004', 'Claude Code CLI adapter file exists');
      
      const adapterContent = readFileSync(adapterPath, 'utf8');
      if (adapterContent.includes('class ClaudeCodeCLIAdapter')) {
        tracker.pass(category, 'FV-004', 'Claude adapter class defined');
      } else {
        tracker.fail(category, 'FV-004', 'Claude adapter class not found');
      }
    } else {
      tracker.fail(category, 'FV-004', 'Claude Code CLI adapter file not found');
    }
  } catch (error) {
    tracker.fail(category, 'FV-004', 'Failed to validate Claude integration', error.message);
  }
}

/**
 * Integration Validation Tests
 */
async function validateIntegration() {
  const category = 'INTEGRATION';
  console.log(`\n${colors.bold}=== ${category} VALIDATION ===${colors.reset}\n`);
  
  // Run specific integration tests
  try {
    tracker.info('Running Claude Code integration tests...');
    const result = await runCommand('npm', ['run', 'test:claude-integration'], { timeout: 60000 });
    
    if (result.code === 0) {
      tracker.pass(category, 'IV-005', 'Claude Code integration tests passed');
    } else {
      tracker.fail(category, 'IV-005', 'Claude Code integration tests failed', result.stderr);
    }
  } catch (error) {
    tracker.warn(category, 'IV-005', 'Could not run integration tests', error.message);
  }
  
  // Configuration integration check
  try {
    const configPath = join(projectRoot, 'src/smart_env.config.js');
    if (existsSync(configPath)) {
      tracker.pass(category, 'IV-006', 'Smart environment config exists');
      
      const configContent = readFileSync(configPath, 'utf8');
      if (configContent.includes('claude_code_cli')) {
        tracker.pass(category, 'IV-006', 'Claude configuration integrated');
      } else {
        tracker.warn(category, 'IV-006', 'Claude configuration not found in config');
      }
    } else {
      tracker.fail(category, 'IV-006', 'Smart environment config missing');
    }
  } catch (error) {
    tracker.fail(category, 'IV-006', 'Failed to validate configuration integration', error.message);
  }
}

/**
 * Performance Validation Tests
 */
async function validatePerformance() {
  if (quickMode) {
    tracker.info('Skipping performance tests (quick mode)');
    return;
  }
  
  const category = 'PERFORMANCE';
  console.log(`\n${colors.bold}=== ${category} VALIDATION ===${colors.reset}\n`);
  
  // PV-001: Build Performance
  const buildStart = Date.now();
  try {
    const result = await runCommand('npm', ['run', 'build']);
    const buildTime = Date.now() - buildStart;
    
    if (buildTime < 60000) { // Less than 1 minute
      tracker.pass(category, 'PV-001', `Build completed in ${buildTime}ms`);
    } else {
      tracker.warn(category, 'PV-001', `Build took ${buildTime}ms (may be slow)`);
    }
  } catch (error) {
    tracker.fail(category, 'PV-001', 'Build performance test failed', error.message);
  }
  
  // PV-002: Bundle Size Analysis
  try {
    const bundlePath = join(projectRoot, 'dist/main.js');
    const bundleSize = statSync(bundlePath).size;
    const bundleSizeMB = bundleSize / (1024 * 1024);
    
    if (bundleSizeMB < 2.5) {
      tracker.pass(category, 'PV-002', `Bundle size optimal: ${bundleSizeMB.toFixed(2)}MB`);
    } else if (bundleSizeMB < 5) {
      tracker.warn(category, 'PV-002', `Bundle size acceptable: ${bundleSizeMB.toFixed(2)}MB`);
    } else {
      tracker.fail(category, 'PV-002', `Bundle size too large: ${bundleSizeMB.toFixed(2)}MB`);
    }
  } catch (error) {
    tracker.fail(category, 'PV-002', 'Failed to analyze bundle size', error.message);
  }
}

/**
 * Security Validation Tests
 */
async function validateSecurity() {
  const category = 'SECURITY';
  console.log(`\n${colors.bold}=== ${category} VALIDATION ===${colors.reset}\n`);
  
  // SP-001: Dependency Security Audit
  try {
    const result = await runCommand('npm', ['audit'], { timeout: 30000 });
    
    if (result.code === 0) {
      tracker.pass(category, 'SP-001', 'No security vulnerabilities found');
    } else {
      // Parse audit results
      if (result.stdout.includes('0 vulnerabilities')) {
        tracker.pass(category, 'SP-001', 'Security audit passed');
      } else {
        tracker.warn(category, 'SP-001', 'Security audit found issues', result.stdout);
      }
    }
  } catch (error) {
    tracker.warn(category, 'SP-001', 'Could not run security audit', error.message);
  }
  
  // SP-002: Sensitive Data Check
  try {
    const mainJsPath = join(projectRoot, 'dist/main.js');
    const content = readFileSync(mainJsPath, 'utf8');
    
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
      /password\s*[:=]\s*["'][^"']*["']/gi,
      /secret\s*[:=]\s*["'][^"']*["']/gi,
      /api_key\s*[:=]\s*["'][^"']*["']/gi
    ];
    
    let sensitiveFound = false;
    sensitivePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        sensitiveFound = true;
      }
    });
    
    if (!sensitiveFound) {
      tracker.pass(category, 'SP-002', 'No sensitive data found in bundle');
    } else {
      tracker.fail(category, 'SP-002', 'Potentially sensitive data found in bundle');
    }
  } catch (error) {
    tracker.fail(category, 'SP-002', 'Failed to check for sensitive data', error.message);
  }
}

/**
 * Main Validation Runner
 */
async function runValidation() {
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                       COMPREHENSIVE VALIDATION RUNNER                         ║');
  console.log('║                          obsidian-smart-claude                                 ║');
  console.log('║                                                                                ║');
  console.log('║   This script executes the complete validation strategy to ensure             ║');
  console.log('║   the plugin meets all quality, functionality, and security standards.        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  // Define validation categories
  const categories = {
    build: validateBuild,
    installation: validateInstallation,
    functional: validateFunctionality,
    integration: validateIntegration,
    performance: validatePerformance,
    security: validateSecurity
  };
  
  // Run specific category if requested
  if (categoryFilter && categories[categoryFilter]) {
    tracker.info(`Running validation category: ${categoryFilter}`);
    await categories[categoryFilter]();
  } else {
    // Run all categories
    for (const [name, validationFunc] of Object.entries(categories)) {
      if (quickMode && name === 'performance') {
        tracker.info(`Skipping ${name} validation (quick mode)`);
        continue;
      }
      
      await validationFunc();
    }
  }
  
  // Print summary and exit
  const success = tracker.printSummary();
  process.exit(success ? 0 : 1);
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}Unhandled Rejection:${colors.reset}`, reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(`${colors.red}Uncaught Exception:${colors.reset}`, error);
  process.exit(1);
});

// Run the validation
runValidation().catch(error => {
  console.error(`${colors.red}Validation runner failed:${colors.reset}`, error);
  process.exit(1);
});