import test from 'ava';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as mockFs from 'mock-fs';

// Import the module we're testing (will be created next)
let pathResolver;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.before(async () => {
  // Dynamically import to ensure fresh module
  pathResolver = await import('./path-resolver.js');
});

test.afterEach(() => {
  // Clean up any mocked file system
  mockFs.restore();
  
  // Clear environment variables used in tests
  delete process.env.OBSIDIAN_PLUGIN_PATH;
  delete process.env.JSBRAINS_PATH;
  delete process.env.OBSIDIAN_SMART_ENV_PATH;
  
  // Clear the cache if it exists
  if (pathResolver.clearCache) {
    pathResolver.clearCache();
  }
});

test('getPluginRoot returns current directory when no special context detected', t => {
  const result = pathResolver.getPluginRoot();
  t.is(result, process.cwd());
});

test('getPluginRoot returns OBSIDIAN_PLUGIN_PATH when environment variable is set', t => {
  const testPath = '/mock/vault/.obsidian/plugins/smart-connections';
  process.env.OBSIDIAN_PLUGIN_PATH = testPath;
  
  const result = pathResolver.getPluginRoot();
  t.is(result, testPath);
});

test('getPluginRoot detects Obsidian plugin installation by manifest.json', t => {
  // Mock file system with Obsidian plugin structure
  mockFs({
    '/mock/vault/.obsidian/plugins/smart-connections': {
      'manifest.json': '{"id": "smart-connections"}',
      'main.js': 'content'
    }
  });
  
  // Change working directory to the mocked plugin path
  const originalCwd = process.cwd();
  process.chdir('/mock/vault/.obsidian/plugins/smart-connections');
  
  const result = pathResolver.getPluginRoot();
  t.is(result, '/mock/vault/.obsidian/plugins/smart-connections');
  
  // Restore original working directory
  process.chdir(originalCwd);
});

test('getDependencyPath finds local development dependencies', t => {
  // Mock file system with development structure
  mockFs({
    '/project/obsidian-smart-claude': {
      'package.json': '{}',
      'manifest.json': '{}'
    },
    '/project/jsbrains': {
      'package.json': '{"name": "jsbrains"}'
    }
  });
  
  process.chdir('/project/obsidian-smart-claude');
  
  const result = pathResolver.getDependencyPath('jsbrains');
  t.is(result, path.resolve('/project/jsbrains'));
});

test('getDependencyPath finds dependencies in node_modules', t => {
  // Mock file system with node_modules
  mockFs({
    '/project/plugin': {
      'manifest.json': '{}',
      'node_modules': {
        'jsbrains': {
          'package.json': '{"name": "jsbrains"}'
        }
      }
    }
  });
  
  process.chdir('/project/plugin');
  
  const result = pathResolver.getDependencyPath('jsbrains');
  t.is(result, path.resolve('/project/plugin/node_modules/jsbrains'));
});

test('getDependencyPath uses environment variable override', t => {
  const customPath = '/custom/path/to/jsbrains';
  process.env.JSBRAINS_PATH = customPath;
  
  const result = pathResolver.getDependencyPath('jsbrains');
  t.is(result, customPath);
});

test('getDependencyPath throws error with helpful message when dependency not found', t => {
  mockFs({
    '/empty/project': {
      'manifest.json': '{}'
    }
  });
  
  process.chdir('/empty/project');
  
  const error = t.throws(() => {
    pathResolver.getDependencyPath('missing-package');
  });
  
  t.true(error.message.includes('missing-package'));
  t.true(error.message.includes('Cannot resolve'));
});

test('getDependencyPath handles package names with hyphens correctly', t => {
  process.env.OBSIDIAN_SMART_ENV_PATH = '/test/obsidian-smart-env';
  
  const result = pathResolver.getDependencyPath('obsidian-smart-env');
  t.is(result, '/test/obsidian-smart-env');
});

test('getTestDataPath returns correct path relative to plugin root', t => {
  mockFs({
    '/plugin/root': {
      'manifest.json': '{}',
      'test-data': {
        'sample.json': '{}'
      }
    }
  });
  
  process.chdir('/plugin/root');
  
  const result = pathResolver.getTestDataPath('sample.json');
  t.is(result, path.join('/plugin/root', 'test-data', 'sample.json'));
});

test('resolveRelativePath resolves paths relative to plugin root', t => {
  mockFs({
    '/my/plugin': {
      'manifest.json': '{}',
      'src': {
        'utils': {}
      }
    }
  });
  
  process.chdir('/my/plugin');
  
  const result = pathResolver.resolveRelativePath('src/utils');
  t.is(result, path.resolve('/my/plugin', 'src/utils'));
});

test('path resolution works with Windows-style paths', t => {
  // Test cross-platform path handling
  const unixPath = 'src/utils/file.js';
  const result = pathResolver.resolveRelativePath(unixPath);
  
  // Should work regardless of platform
  t.true(result.endsWith(path.join('src', 'utils', 'file.js')));
});

test('cache returns same result for repeated calls', t => {
  process.env.JSBRAINS_PATH = '/cached/path';
  
  const result1 = pathResolver.getDependencyPath('jsbrains');
  const result2 = pathResolver.getDependencyPath('jsbrains');
  
  t.is(result1, result2);
  t.is(result1, '/cached/path');
});

test('clearCache resets cached paths', t => {
  process.env.JSBRAINS_PATH = '/first/path';
  
  const result1 = pathResolver.getDependencyPath('jsbrains');
  t.is(result1, '/first/path');
  
  // Clear cache and change environment
  pathResolver.clearCache();
  process.env.JSBRAINS_PATH = '/second/path';
  
  const result2 = pathResolver.getDependencyPath('jsbrains');
  t.is(result2, '/second/path');
});

test('validates paths to prevent directory traversal', t => {
  const error = t.throws(() => {
    pathResolver.resolveRelativePath('../../../../../../etc/passwd');
  });
  
  t.true(error.message.includes('Invalid path'));
});

test('handles paths with spaces correctly', t => {
  mockFs({
    '/path with spaces/plugin': {
      'manifest.json': '{}'
    }
  });
  
  process.chdir('/path with spaces/plugin');
  
  const result = pathResolver.getPluginRoot();
  t.is(result, '/path with spaces/plugin');
});

test('handles unicode characters in paths', t => {
  mockFs({
    '/用户/插件': {
      'manifest.json': '{}'
    }
  });
  
  process.chdir('/用户/插件');
  
  const result = pathResolver.getPluginRoot();
  t.is(result, '/用户/插件');
});

test('provides helpful error messages with suggestions', t => {
  mockFs({
    '/project': {
      'manifest.json': '{}'
    }
  });
  
  process.chdir('/project');
  
  const error = t.throws(() => {
    pathResolver.getDependencyPath('smart-blocks');
  });
  
  // Error should include helpful suggestions
  t.true(error.message.includes('smart-blocks'));
  t.true(error.message.includes('npm install') || error.message.includes('environment variable'));
});