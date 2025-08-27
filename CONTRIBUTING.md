# Contributing to Enhanced Smart Connections

Thank you for your interest in contributing to Enhanced Smart Connections! This guide will help you get set up for development and understand our contribution process.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or later)
- **npm** or **pnpm**
- **Git**
- **Claude Code CLI** (optional, for AI features testing)

### Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/obsidian-smart-connections.git
   cd obsidian-smart-connections
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Development Environment**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env to match your local setup (optional)
   # Most developers won't need to modify this
   ```

4. **Build the Plugin**
   ```bash
   npm run build
   ```

5. **Run Tests**
   ```bash
   npm test
   ```

## 📁 Project Structure

```
obsidian-smart-connections/
├── src/
│   ├── utils/
│   │   └── path-resolver.js        # Dynamic path resolution
│   ├── adapters/
│   │   └── claude_code_cli_adapter.js  # Claude Code CLI integration
│   ├── test/                       # Integration tests
│   └── ...
├── scripts/                        # Development scripts
├── .env.example                    # Environment template
├── CLAUDE.md                       # Claude Code development guide
└── CONTRIBUTING.md                 # This file
```

## 🛠️ Dynamic Path Resolution

This project uses **dynamic path resolution** instead of hardcoded paths to ensure cross-platform compatibility.

### Path Resolution System

#### Key Functions
- `getPluginRoot()` - Gets the plugin installation directory
- `getDependencyPath(packageName)` - Resolves JSBrains dependencies
- `getTestDataPath(relativePath)` - Gets test data paths
- `resolveRelativePath(relativePath)` - Resolves relative paths safely

#### Usage Examples

**For Test Files:**
```javascript
// ❌ Don't do this (hardcoded)
const JSBRAINS_PATH = '/Users/someone/CodeProjects/jsbrains';

// ✅ Do this (dynamic)
import { getDependencyPath } from '../utils/path-resolver.js';
const JSBRAINS_PATH = getDependencyPath('jsbrains');
```

**For Script Files:**
```javascript
// ❌ Don't do this (hardcoded)  
const PROJECT_ROOT = '/Users/someone/CodeProjects/obsidian-smart-claude';

// ✅ Do this (dynamic)
import { getPluginRoot } from '../src/utils/path-resolver.js';
const PROJECT_ROOT = getPluginRoot();
```

### Environment Configuration

Create a `.env` file for custom development paths:

```bash
# Override dependency paths for development
JSBRAINS_PATH=/path/to/local/jsbrains
OBSIDIAN_SMART_ENV_PATH=/path/to/local/obsidian-smart-env

# Enable debug logging
DEBUG_PATH_RESOLUTION=true
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test files
npx ava src/test/jsbrains_packages.test.js

# Run with debug output
DEBUG_PATH_RESOLUTION=true npm test

# Test path resolution specifically
npx ava src/utils/path-resolver.test.js
```

### Writing Tests

When writing new tests that involve file paths:

1. **Use path resolver functions** instead of hardcoded paths
2. **Test cross-platform compatibility** when dealing with file systems
3. **Include error scenarios** for path resolution failures
4. **Use descriptive test names** that explain the expected behavior

Example:
```javascript
import test from 'ava';
import { getDependencyPath } from '../utils/path-resolver.js';

test('package resolution works in development environment', t => {
  const jsbrainsPath = getDependencyPath('jsbrains');
  t.true(fs.existsSync(jsbrainsPath), 'JSBrains dependency should be found');
});
```

## 🔧 Development Workflows

### Hot Reload Development
```bash
# Set destination vault in .env
echo "DESTINATION_VAULTS=your-vault-name" >> .env

# Build and watch for changes
npm run dev
```

### Testing Claude Code Integration
```bash
# Verify Claude CLI is available
claude --version

# Run Claude Code specific tests
npm run test:claude-code

# Test with different context sizes
npm run test:claude-code:performance
```

### JSBrains Ecosystem Development

This plugin is part of the JSBrains ecosystem. For local development with JSBrains:

```bash
# Clone JSBrains alongside this project
cd ..
git clone https://github.com/brianpetro/jsbrains.git
cd obsidian-smart-connections

# The path resolver will automatically find ../jsbrains
# Or override in .env:
echo "JSBRAINS_PATH=../jsbrains" >> .env
```

## 📝 Code Style Guidelines

### General Principles
- **Privacy First**: Never log sensitive user content
- **Cross-Platform**: Use path resolver functions for all file operations  
- **Error Handling**: Provide helpful error messages with suggestions
- **Documentation**: Update relevant docs when adding features

### Path Resolution Guidelines
- **Always use path resolver functions** for file system operations
- **Never hardcode absolute paths** in code
- **Provide fallbacks** for missing dependencies
- **Cache resolved paths** for performance
- **Validate paths** to prevent security issues

### Testing Guidelines
- **Test path resolution** in different environments
- **Mock file systems** appropriately for unit tests
- **Include cross-platform test scenarios**
- **Verify error handling** for path resolution failures

## 🐛 Bug Reports

When reporting bugs related to path resolution:

1. **Include your operating system** (Windows, macOS, Linux)
2. **Share your directory structure** (if relevant)
3. **Include path resolution debug output**:
   ```bash
   DEBUG_PATH_RESOLUTION=true npm test 2>&1 | grep "Path Resolver"
   ```
4. **Specify your development setup** (standalone vs JSBrains ecosystem)

## 🚀 Feature Requests

For new features involving file system operations:
- Consider **cross-platform compatibility** from the start
- Use **path resolver patterns** consistently
- Include **comprehensive tests** for different environments
- Update **documentation** accordingly

## 📚 Additional Resources

- **[Claude Code Integration Guide](docs/claude-code-integration.md)** - Local AI setup
- **[Development Guide](docs/development.md)** - Complete build instructions
- **[Architecture Overview](CLAUDE.md)** - Technical implementation details
- **[Path Resolver API](src/utils/path-resolver.js)** - Full API documentation

## 🤝 Community

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions) 
- **Original Plugin**: [Smart Connections by Brian Petro](https://github.com/brianpetro/obsidian-smart-connections)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy Contributing!** 🎉

Remember: every contribution, no matter how small, helps make this plugin better for the entire Obsidian community. Thank you for being part of this privacy-first, local-processing future!