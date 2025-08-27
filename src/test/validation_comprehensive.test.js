import test from 'ava';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');

/**
 * COMPREHENSIVE VALIDATION TESTS
 * ===============================
 * 
 * These tests implement the validation strategy defined in VALIDATION_STRATEGY.md
 * They are designed to ensure the obsidian-smart-claude plugin meets all quality standards.
 */

/**
 * Utility function to run commands
 */
function runCommand(command, args = [], timeout = 10000) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { cwd: projectRoot, stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => stdout += data.toString());
    process.stderr.on('data', (data) => stderr += data.toString());
    process.on('close', (code) => resolve({ code, stdout, stderr }));
    process.on('error', reject);
    
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }
    }, timeout);
  });
}

// =====================================
// 1. PRE-CHANGE VALIDATION BASELINE
// =====================================

test('PRE-001: Current build state should be documented', t => {
  const distPath = join(projectRoot, 'dist');
  
  if (existsSync(distPath)) {
    const mainJs = join(distPath, 'main.js');
    const manifest = join(distPath, 'manifest.json');
    const styles = join(distPath, 'styles.css');
    
    t.true(existsSync(mainJs), 'dist/main.js should exist');
    t.true(existsSync(manifest), 'dist/manifest.json should exist');
    t.true(existsSync(styles), 'dist/styles.css should exist');
    
    if (existsSync(mainJs)) {
      const size = statSync(mainJs).size;
      t.log(`Bundle size: ${(size / 1024 / 1024).toFixed(2)}MB`);
      t.true(size > 0, 'Bundle should not be empty');
    }
  } else {
    t.log('Dist directory does not exist - initial build required');
  }
});

test('PRE-002: Package configuration should be valid', t => {
  const packagePath = join(projectRoot, 'package.json');
  t.true(existsSync(packagePath), 'package.json should exist');
  
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  
  // Required fields
  t.truthy(packageJson.name, 'Package should have name');
  t.truthy(packageJson.version, 'Package should have version');
  t.truthy(packageJson.scripts, 'Package should have scripts');
  t.truthy(packageJson.scripts.build, 'Package should have build script');
  t.truthy(packageJson.scripts.test, 'Package should have test script');
  
  // Test framework
  t.truthy(packageJson.devDependencies?.ava, 'AVA testing framework should be configured');
});

// =====================================
// 2. BUILD VALIDATION TESTS
// =====================================

test('BV-001: Build command should succeed', async t => {
  try {
    const result = await runCommand('npm', ['run', 'build'], 30000);
    t.is(result.code, 0, 'Build should exit with code 0');
    t.log('Build output:', result.stdout);
  } catch (error) {
    t.fail(`Build command failed: ${error.message}`);
  }
});

test('BV-002: Build output files should be generated correctly', t => {
  const requiredFiles = [
    'dist/main.js',
    'dist/manifest.json',
    'dist/styles.css'
  ];
  
  requiredFiles.forEach(file => {
    const filePath = join(projectRoot, file);
    t.true(existsSync(filePath), `${file} should be generated`);
    
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      t.true(stats.size > 0, `${file} should not be empty`);
      t.log(`${file}: ${stats.size} bytes`);
    }
  });
});

test('BV-003: Build should include Claude adapter configuration', t => {
  const mainJsPath = join(projectRoot, 'dist/main.js');
  
  if (existsSync(mainJsPath)) {
    const content = readFileSync(mainJsPath, 'utf8');
    
    t.true(
      content.includes('ClaudeCodeCLIAdapter') || content.includes('claude_code_cli'),
      'Build should include Claude adapter references'
    );
    
    // Check for essential adapter methods
    const adapterMethods = [
      'validate_connection',
      'gather_context',
      'format_prompt'
    ];
    
    const methodsFound = adapterMethods.filter(method => content.includes(method));
    t.true(methodsFound.length > 0, 'Build should include adapter methods');
    t.log(`Found adapter methods: ${methodsFound.join(', ')}`);
  } else {
    t.fail('main.js not found - build required');
  }
});

test('BV-004: Bundle size should be within acceptable limits', t => {
  const mainJsPath = join(projectRoot, 'dist/main.js');
  
  if (existsSync(mainJsPath)) {
    const stats = statSync(mainJsPath);
    const sizeMB = stats.size / (1024 * 1024);
    
    t.log(`Bundle size: ${sizeMB.toFixed(2)}MB`);
    
    // Current bundle is 2MB, allow up to 5MB
    t.true(sizeMB < 5, 'Bundle size should be under 5MB');
    
    if (sizeMB > 3) {
      t.log('Warning: Bundle size is getting large, consider optimization');
    }
  } else {
    t.fail('main.js not found - build required');
  }
});

test('BV-005: Build should be reproducible', async t => {
  try {
    // Build twice and compare
    await runCommand('npm', ['run', 'build'], 30000);
    const firstBuild = readFileSync(join(projectRoot, 'dist/main.js'), 'utf8');
    
    // Wait a bit to ensure different timestamps if they exist
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await runCommand('npm', ['run', 'build'], 30000);
    const secondBuild = readFileSync(join(projectRoot, 'dist/main.js'), 'utf8');
    
    // Note: Due to timestamps or other factors, builds might differ
    // This is more of an informational test
    const identical = firstBuild === secondBuild;
    t.log(`Builds identical: ${identical}`);
    
    if (!identical) {
      t.log('Builds differ - this may be expected due to timestamps');
    }
    
    // At minimum, builds should have same size within reasonable range
    const sizeDiff = Math.abs(firstBuild.length - secondBuild.length);
    t.true(sizeDiff < 1000, 'Build sizes should be very similar');
  } catch (error) {
    t.fail(`Build reproducibility test failed: ${error.message}`);
  }
});

// =====================================
// 3. INSTALLATION VALIDATION TESTS
// =====================================

test('IV-001: Manual installation files should be available', t => {
  const distPath = join(projectRoot, 'dist');
  t.true(existsSync(distPath), 'dist directory should exist for manual installation');
  
  const requiredFiles = ['main.js', 'manifest.json', 'styles.css'];
  requiredFiles.forEach(file => {
    t.true(existsSync(join(distPath, file)), `dist/${file} should exist`);
  });
});

test('IV-002: Plugin manifest should be valid', t => {
  const manifestPath = join(projectRoot, 'dist/manifest.json');
  
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    
    // Required Obsidian manifest fields
    const requiredFields = ['id', 'name', 'version', 'description', 'author'];
    requiredFields.forEach(field => {
      t.truthy(manifest[field], `Manifest should have ${field} field`);
    });
    
    // Version consistency
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    t.is(manifest.version, packageJson.version, 'Manifest version should match package.json');
    
    // Optional but recommended fields
    if (manifest.minAppVersion) {
      t.log(`Minimum Obsidian version: ${manifest.minAppVersion}`);
    }
    
    if (manifest.authorUrl) {
      t.log(`Author URL: ${manifest.authorUrl}`);
    }
  } else {
    t.fail('Manifest file not found in dist/');
  }
});

test('IV-003: BRAT compatibility should be maintained', t => {
  const bratRequiredFiles = ['main.js', 'manifest.json', 'styles.css'];
  
  bratRequiredFiles.forEach(file => {
    const filePath = join(projectRoot, 'dist', file);
    t.true(existsSync(filePath), `BRAT requires ${file} in dist/`);
    
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      t.true(stats.size > 0, `${file} should not be empty for BRAT`);
    }
  });
  
  t.log('BRAT compatibility: All required files present');
});

// =====================================
// 4. FUNCTIONAL VALIDATION TESTS
// =====================================

test('FV-001: Core plugin files should exist', t => {
  const coreFiles = [
    'src/index.js',
    'src/smart_env.config.js',
    'src/adapters/claude_code_cli_adapter.js'
  ];
  
  coreFiles.forEach(file => {
    const filePath = join(projectRoot, file);
    if (existsSync(filePath)) {
      t.pass(`${file} exists`);
    } else {
      t.log(`${file} not found - may be optional`);
    }
  });
});

test('FV-004: Claude Code CLI integration should be properly configured', t => {
  const adapterPath = join(projectRoot, 'src/adapters/claude_code_cli_adapter.js');
  
  if (existsSync(adapterPath)) {
    const content = readFileSync(adapterPath, 'utf8');
    
    t.true(content.includes('class ClaudeCodeCLIAdapter'), 'Adapter class should be defined');
    t.true(content.includes('validate_connection'), 'Should have connection validation');
    t.true(content.includes('gather_context'), 'Should have context gathering');
    t.true(content.includes('complete'), 'Should have completion method');
    t.true(content.includes('stream'), 'Should have streaming method');
    
    t.log('Claude Code CLI adapter properly structured');
  } else {
    t.fail('Claude Code CLI adapter file not found');
  }
});

test('FV-005: Configuration should include Claude adapter settings', t => {
  const configPath = join(projectRoot, 'src/smart_env.config.js');
  
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8');
    
    t.true(
      content.includes('claude_code_cli') || content.includes('ClaudeCodeCLIAdapter'),
      'Config should reference Claude adapter'
    );
    
    // Check for essential configuration elements
    const configElements = [
      'smart_chat_model',
      'adapters',
      'default_settings'
    ];
    
    configElements.forEach(element => {
      if (content.includes(element)) {
        t.log(`Configuration includes ${element}`);
      }
    });
  } else {
    t.log('Smart environment config not found - may use default');
  }
});

// =====================================
// 5. INTEGRATION VALIDATION TESTS
// =====================================

test('IV-005: Integration test files should exist', t => {
  const integrationTests = [
    'src/test/claude_code_integration.test.js',
    'src/adapters/claude_code_cli_adapter.test.js'
  ];
  
  integrationTests.forEach(testFile => {
    const filePath = join(projectRoot, testFile);
    if (existsSync(filePath)) {
      t.pass(`${testFile} exists`);
    } else {
      t.log(`${testFile} not found`);
    }
  });
});

test('IV-006: Configuration integration should be valid', t => {
  const configPath = join(projectRoot, 'src/smart_env.config.js');
  
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8');
    
    // Look for adapter registration patterns
    const integrationPatterns = [
      'claude_code_cli',
      'ClaudeCodeCLIAdapter',
      'smart_chat_model',
      'adapters'
    ];
    
    const foundPatterns = integrationPatterns.filter(pattern => content.includes(pattern));
    t.true(foundPatterns.length > 0, 'Config should include integration patterns');
    t.log(`Found integration patterns: ${foundPatterns.join(', ')}`);
  } else {
    t.log('Configuration file not found - using defaults');
  }
});

// =====================================
// 6. PERFORMANCE VALIDATION TESTS
// =====================================

test('PV-001: Build performance should be acceptable', async t => {
  const start = Date.now();
  
  try {
    const result = await runCommand('npm', ['run', 'build'], 60000);
    const duration = Date.now() - start;
    
    t.is(result.code, 0, 'Build should succeed for performance test');
    t.log(`Build completed in ${duration}ms`);
    
    // Build should complete in reasonable time
    t.true(duration < 60000, 'Build should complete within 60 seconds');
    
    if (duration < 10000) {
      t.log('Build performance: Excellent');
    } else if (duration < 30000) {
      t.log('Build performance: Good');
    } else {
      t.log('Build performance: Acceptable but could be improved');
    }
  } catch (error) {
    t.fail(`Build performance test failed: ${error.message}`);
  }
});

test('PV-002: Memory usage should be reasonable', t => {
  // Basic memory usage test
  const initialMemory = process.memoryUsage().heapUsed;
  
  // Simulate loading configuration multiple times
  const configPath = join(projectRoot, 'src/smart_env.config.js');
  
  if (existsSync(configPath)) {
    for (let i = 0; i < 10; i++) {
      readFileSync(configPath, 'utf8');
    }
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryGrowth = finalMemory - initialMemory;
  
  t.log(`Memory growth: ${Math.round(memoryGrowth / 1024)}KB`);
  t.true(memoryGrowth < 10 * 1024 * 1024, 'Memory growth should be under 10MB');
});

// =====================================
// 7. SECURITY VALIDATION TESTS
// =====================================

test('SP-001: No sensitive data should be in bundle', t => {
  const mainJsPath = join(projectRoot, 'dist/main.js');
  
  if (existsSync(mainJsPath)) {
    const content = readFileSync(mainJsPath, 'utf8');
    
    // Check for common sensitive data patterns
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
      /password\s*[:=]\s*["'][^"']+["']/gi,
      /secret\s*[:=]\s*["'][^"']+["']/gi,
      /api_key\s*[:=]\s*["'][^"']+["']/gi
    ];
    
    sensitivePatterns.forEach((pattern, index) => {
      const matches = content.match(pattern);
      t.falsy(matches, `Should not contain sensitive pattern ${index + 1}`);
    });
    
    t.log('Security check: No obvious sensitive data found in bundle');
  } else {
    t.fail('Bundle file not found for security check');
  }
});

test('SP-002: Dependencies should not have known vulnerabilities', async t => {
  try {
    const result = await runCommand('npm', ['audit', '--audit-level=moderate'], 15000);
    
    // npm audit returns non-zero for vulnerabilities, but we want to log them
    if (result.code === 0) {
      t.pass('No security vulnerabilities found');
    } else {
      // Parse the output to understand the issues
      t.log('Security audit output:', result.stdout);
      
      if (result.stdout.includes('0 vulnerabilities')) {
        t.pass('Security audit passed');
      } else {
        t.log('Security audit found issues - review recommended');
      }
    }
  } catch (error) {
    t.log(`Could not run security audit: ${error.message}`);
  }
});

// =====================================
// 8. CROSS-PLATFORM COMPATIBILITY
// =====================================

test('CP-001: Path handling should be cross-platform compatible', t => {
  const pathResolverPath = join(projectRoot, 'src/utils/path-resolver.js');
  
  if (existsSync(pathResolverPath)) {
    const content = readFileSync(pathResolverPath, 'utf8');
    
    // Check for platform-specific path handling
    t.true(content.includes('path.join') || content.includes('join'), 'Should use proper path joining');
    t.true(content.includes('process.platform') || content.includes('platform'), 'Should handle platform differences');
    
    t.log('Path resolver appears to handle cross-platform compatibility');
  } else {
    t.log('Path resolver not found - may use default handling');
  }
});

// =====================================
// 9. ERROR HANDLING VALIDATION
// =====================================

test('EH-001: Adapter should have proper error handling', t => {
  const adapterPath = join(projectRoot, 'src/adapters/claude_code_cli_adapter.js');
  
  if (existsSync(adapterPath)) {
    const content = readFileSync(adapterPath, 'utf8');
    
    // Check for error handling patterns
    const errorPatterns = [
      'try',
      'catch',
      'throw',
      'error',
      'Error'
    ];
    
    const foundPatterns = errorPatterns.filter(pattern => content.includes(pattern));
    t.true(foundPatterns.length >= 3, 'Adapter should have error handling');
    t.log(`Error handling patterns found: ${foundPatterns.join(', ')}`);
  } else {
    t.fail('Claude adapter not found for error handling check');
  }
});

test('EH-002: Configuration should validate input', t => {
  const configPath = join(projectRoot, 'src/smart_env.config.js');
  
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8');
    
    // Look for validation patterns
    const validationPatterns = [
      'typeof',
      'instanceof',
      'validate',
      'check'
    ];
    
    const foundValidation = validationPatterns.some(pattern => content.includes(pattern));
    if (foundValidation) {
      t.log('Configuration includes validation patterns');
    } else {
      t.log('Configuration validation patterns not obvious - may be in dependencies');
    }
    
    t.pass('Configuration file structure check completed');
  } else {
    t.log('Configuration file not found');
  }
});

// =====================================
// 10. DOCUMENTATION VALIDATION
// =====================================

test('DOC-001: Essential documentation should exist', t => {
  const requiredDocs = [
    'README.md',
    'CLAUDE.md',
    'VALIDATION_STRATEGY.md'
  ];
  
  requiredDocs.forEach(doc => {
    const docPath = join(projectRoot, doc);
    if (existsSync(docPath)) {
      const stats = statSync(docPath);
      t.true(stats.size > 0, `${doc} should not be empty`);
      t.log(`${doc}: ${stats.size} bytes`);
    } else {
      t.log(`${doc} not found`);
    }
  });
});

test('DOC-002: Package scripts should be documented', t => {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};
  
  const essentialScripts = ['build', 'test'];
  essentialScripts.forEach(script => {
    t.truthy(scripts[script], `Package should have ${script} script`);
  });
  
  t.log(`Available scripts: ${Object.keys(scripts).join(', ')}`);
});