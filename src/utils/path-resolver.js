/**
 * Path Resolution Utility for Obsidian Plugin
 * 
 * Provides dynamic path resolution for the Smart Connections plugin
 * to work correctly in different environments:
 * - Development (local file system)
 * - Obsidian plugin installation (.obsidian/plugins/)
 * - CI/CD environments
 * - Cross-platform (Windows, macOS, Linux)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for resolved paths to improve performance
const pathCache = new Map();

/**
 * Gets the root directory of the plugin installation
 * 
 * Priority order:
 * 1. OBSIDIAN_PLUGIN_PATH environment variable
 * 2. Detected Obsidian plugin installation
 * 3. Current working directory (development mode)
 * 
 * @returns {string} Absolute path to plugin root directory
 */
export function getPluginRoot() {
  // Check cache first
  if (pathCache.has('pluginRoot')) {
    return pathCache.get('pluginRoot');
  }
  
  let pluginRoot;
  
  // Priority 1: Environment variable override
  if (process.env.OBSIDIAN_PLUGIN_PATH) {
    pluginRoot = process.env.OBSIDIAN_PLUGIN_PATH;
    pathCache.set('pluginRoot', pluginRoot);
    return pluginRoot;
  }
  
  // Priority 2: Check common Obsidian plugin paths
  const possiblePaths = [
    // Current directory if it contains manifest.json
    process.cwd(),
    // Standard Obsidian plugin paths
    path.join(process.cwd(), '.obsidian', 'plugins', 'smart-connections'),
    path.join(process.cwd(), '.obsidian', 'plugins', 'obsidian-smart-claude'),
    // Development path (two levels up from utils)
    path.resolve(__dirname, '..', '..'),
    // Alternative Obsidian paths
    path.join(process.cwd(), '.obsidian', 'plugins', 'smart-connections-main'),
  ];
  
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(path.join(p, 'manifest.json'))) {
        pluginRoot = p;
        pathCache.set('pluginRoot', pluginRoot);
        return pluginRoot;
      }
    } catch (error) {
      // Skip paths that can't be accessed
      continue;
    }
  }
  
  // Fallback: Use current working directory
  pluginRoot = process.cwd();
  pathCache.set('pluginRoot', pluginRoot);
  return pluginRoot;
}

/**
 * Resolves the path to a dependency package
 * 
 * Resolution order:
 * 1. Environment variable override (e.g., JSBRAINS_PATH)
 * 2. Local development structure (../package-name)
 * 3. Node modules (node_modules/package-name)
 * 4. Throw error with helpful message
 * 
 * @param {string} packageName - Name of the package to resolve
 * @returns {string} Absolute path to the package
 * @throws {Error} If package cannot be found
 */
export function getDependencyPath(packageName) {
  // Check cache first
  const cacheKey = `dep:${packageName}`;
  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey);
  }
  
  // Priority 1: Environment variable override
  const envVarName = packageName.toUpperCase().replace(/-/g, '_') + '_PATH';
  if (process.env[envVarName]) {
    const envPath = process.env[envVarName];
    pathCache.set(cacheKey, envPath);
    return envPath;
  }
  
  const pluginRoot = getPluginRoot();
  
  // Priority 2: Local development structure (sibling directories)
  const devPath = path.resolve(pluginRoot, '..', packageName);
  try {
    if (fs.existsSync(devPath) && fs.statSync(devPath).isDirectory()) {
      pathCache.set(cacheKey, devPath);
      return devPath;
    }
  } catch (error) {
    // Path doesn't exist or can't be accessed
  }
  
  // Priority 3: Node modules
  const nodeModulesPath = path.join(pluginRoot, 'node_modules', packageName);
  try {
    if (fs.existsSync(nodeModulesPath) && fs.statSync(nodeModulesPath).isDirectory()) {
      pathCache.set(cacheKey, nodeModulesPath);
      return nodeModulesPath;
    }
  } catch (error) {
    // Path doesn't exist or can't be accessed
  }
  
  // Not found - throw error with helpful message
  throw new Error(
    `Cannot resolve path for package "${packageName}".\n` +
    `Searched locations:\n` +
    `  1. Environment variable: ${envVarName} (not set)\n` +
    `  2. Development path: ${devPath} (not found)\n` +
    `  3. Node modules: ${nodeModulesPath} (not found)\n\n` +
    `To fix this issue:\n` +
    `  - Run: npm install\n` +
    `  - Or set environment variable: export ${envVarName}=/path/to/${packageName}\n` +
    `  - Or ensure the package exists in one of the searched locations`
  );
}

/**
 * Gets the path to test data files
 * 
 * @param {string} relativePath - Path relative to test-data directory
 * @returns {string} Absolute path to test data file
 */
export function getTestDataPath(relativePath) {
  const pluginRoot = getPluginRoot();
  return path.join(pluginRoot, 'test-data', relativePath);
}

/**
 * Resolves a relative path from the plugin root
 * Validates the path to prevent directory traversal attacks
 * 
 * @param {string} relativePath - Path relative to plugin root
 * @returns {string} Absolute resolved path
 * @throws {Error} If path is invalid or attempts directory traversal
 */
export function resolveRelativePath(relativePath) {
  const pluginRoot = getPluginRoot();
  const resolved = path.resolve(pluginRoot, relativePath);
  
  // Security: Ensure resolved path is within plugin root
  const normalizedRoot = path.normalize(pluginRoot);
  const normalizedResolved = path.normalize(resolved);
  
  if (!normalizedResolved.startsWith(normalizedRoot)) {
    throw new Error(
      `Invalid path: "${relativePath}" attempts to access outside plugin directory.\n` +
      `Plugin root: ${normalizedRoot}\n` +
      `Resolved to: ${normalizedResolved}`
    );
  }
  
  return resolved;
}

/**
 * Clears the path cache
 * Useful for testing or when paths change at runtime
 */
export function clearCache() {
  pathCache.clear();
}

/**
 * Gets information about the current path configuration
 * Useful for debugging path resolution issues
 * 
 * @returns {Object} Current path configuration
 */
export function getPathInfo() {
  return {
    pluginRoot: getPluginRoot(),
    workingDirectory: process.cwd(),
    platform: process.platform,
    pathSeparator: path.sep,
    environmentVariables: {
      OBSIDIAN_PLUGIN_PATH: process.env.OBSIDIAN_PLUGIN_PATH || '(not set)',
      JSBRAINS_PATH: process.env.JSBRAINS_PATH || '(not set)',
      OBSIDIAN_SMART_ENV_PATH: process.env.OBSIDIAN_SMART_ENV_PATH || '(not set)',
      SMART_CHAT_OBSIDIAN_PATH: process.env.SMART_CHAT_OBSIDIAN_PATH || '(not set)',
      SMART_CONTEXT_OBSIDIAN_PATH: process.env.SMART_CONTEXT_OBSIDIAN_PATH || '(not set)',
    },
    cache: {
      size: pathCache.size,
      entries: Array.from(pathCache.entries())
    }
  };
}

/**
 * Validates that a dependency exists and is accessible
 * 
 * @param {string} packageName - Name of the package to validate
 * @returns {boolean} True if package exists and is accessible
 */
export function validateDependency(packageName) {
  try {
    const depPath = getDependencyPath(packageName);
    return fs.existsSync(depPath) && fs.statSync(depPath).isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Gets all available dependencies
 * Useful for debugging and validation
 * 
 * @returns {Object} Map of package names to their resolved paths
 */
export function getAllDependencies() {
  const dependencies = [
    'jsbrains',
    'obsidian-smart-env',
    'smart-chat-obsidian',
    'smart-context-obsidian',
    'smart-plugins-obsidian'
  ];
  
  const result = {};
  for (const dep of dependencies) {
    try {
      result[dep] = {
        path: getDependencyPath(dep),
        exists: true
      };
    } catch (error) {
      result[dep] = {
        path: null,
        exists: false,
        error: error.message.split('\n')[0] // First line of error
      };
    }
  }
  
  return result;
}

// Default export for convenience
export default {
  getPluginRoot,
  getDependencyPath,
  getTestDataPath,
  resolveRelativePath,
  clearCache,
  getPathInfo,
  validateDependency,
  getAllDependencies
};