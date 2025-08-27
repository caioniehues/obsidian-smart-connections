# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-27-fix-hardcoded-paths/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Technical Requirements

### Path Resolution Strategy

1. **Plugin Context Detection**
   ```javascript
   function getPluginRoot() {
     // Check if running as Obsidian plugin
     if (process.env.OBSIDIAN_PLUGIN_PATH) {
       return process.env.OBSIDIAN_PLUGIN_PATH;
     }
     
     // Check common Obsidian plugin paths
     const possiblePaths = [
       path.join(process.cwd(), '.obsidian', 'plugins', 'smart-connections'),
       path.join(process.cwd(), '.obsidian', 'plugins', 'obsidian-smart-claude'),
       process.cwd() // Development mode
     ];
     
     for (const p of possiblePaths) {
       if (fs.existsSync(path.join(p, 'manifest.json'))) {
         return p;
       }
     }
     
     return process.cwd();
   }
   ```

2. **Dependency Path Resolution**
   ```javascript
   function getDependencyPath(packageName) {
     const pluginRoot = getPluginRoot();
     
     // Try local development structure first
     const devPath = path.resolve(pluginRoot, '..', packageName);
     if (fs.existsSync(devPath)) {
       return devPath;
     }
     
     // Try node_modules
     const nodeModulesPath = path.join(pluginRoot, 'node_modules', packageName);
     if (fs.existsSync(nodeModulesPath)) {
       return nodeModulesPath;
     }
     
     // Use environment variable override if available
     const envVarName = `${packageName.toUpperCase().replace(/-/g, '_')}_PATH`;
     if (process.env[envVarName]) {
       return process.env[envVarName];
     }
     
     throw new Error(`Cannot resolve path for ${packageName}`);
   }
   ```

### File-Specific Implementations

#### Test Files Pattern
Replace:
```javascript
const JSBRAINS_PATH = '/Users/caio.niehues/CodeProjects/jsbrains';
```

With:
```javascript
import { getDependencyPath } from '../utils/path-resolver.js';
const JSBRAINS_PATH = getDependencyPath('jsbrains');
```

#### Script Files Pattern
Replace:
```javascript
const PROJECT_ROOT = '/Users/caio.niehues/CodeProjects/obsidian-smart-claude';
```

With:
```javascript
import { getPluginRoot } from './utils/path-resolver.js';
const PROJECT_ROOT = getPluginRoot();
```

### Environment Variables

Create `.env.example`:
```bash
# Optional: Override dependency paths for development
# JSBRAINS_PATH=/path/to/local/jsbrains
# OBSIDIAN_SMART_ENV_PATH=/path/to/local/obsidian-smart-env
# SMART_CHAT_OBSIDIAN_PATH=/path/to/local/smart-chat-obsidian
# SMART_CONTEXT_OBSIDIAN_PATH=/path/to/local/smart-context-obsidian

# Optional: Specify plugin installation path
# OBSIDIAN_PLUGIN_PATH=/path/to/vault/.obsidian/plugins/smart-connections
```

### Utility Module Structure

`src/utils/path-resolver.js`:
```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getPluginRoot() {
  // Implementation as shown above
}

export function getDependencyPath(packageName) {
  // Implementation as shown above
}

export function getTestDataPath(relativePath) {
  return path.join(getPluginRoot(), 'test-data', relativePath);
}

export function resolveRelativePath(relativePath) {
  return path.resolve(getPluginRoot(), relativePath);
}

export default {
  getPluginRoot,
  getDependencyPath,
  getTestDataPath,
  resolveRelativePath
};
```

### Cross-Platform Considerations

1. **Path Separators**: Always use `path.join()` and `path.resolve()`
2. **Case Sensitivity**: Use consistent casing for file names
3. **Line Endings**: Configure `.gitattributes` for consistent line endings
4. **Permissions**: Don't assume write permissions outside plugin directory

### Testing Approach

1. **Mock File System**: Use mock-fs for unit testing path resolution
2. **Multiple Contexts**: Test in development, plugin, and CI environments
3. **Platform Matrix**: Run tests on Windows, macOS, and Linux in CI
4. **Edge Cases**: Test with spaces in paths, unicode characters, symlinks

### Migration Strategy

1. **Phase 1**: Create path-resolver utility and tests
2. **Phase 2**: Update one test file as proof of concept
3. **Phase 3**: Batch update remaining test files
4. **Phase 4**: Update scripts
5. **Phase 5**: Add configuration system
6. **Phase 6**: Update documentation

### Backward Compatibility

- Support existing hardcoded paths via environment variables
- Provide migration script for existing developers
- Log warnings when using deprecated path patterns
- Maintain compatibility for 2 release cycles

## Performance Considerations

- Cache resolved paths to avoid repeated file system checks
- Lazy load path resolution only when needed
- Use synchronous APIs during initialization for simplicity

## Security Considerations

- Validate resolved paths to prevent directory traversal attacks
- Don't expose absolute paths in error messages to end users
- Sanitize environment variable inputs

## Error Handling

- Clear error messages indicating which path could not be resolved
- Suggest solutions (install dependencies, set environment variables)
- Graceful degradation when optional dependencies are missing
- Log detailed debug information when DEBUG environment variable is set