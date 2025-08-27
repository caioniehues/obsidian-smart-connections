# Spec: Fix Hardcoded Paths for Obsidian Plugin Portability

> Created: 2025-08-27
> Status: Ready for Implementation
> Priority: High

## Executive Summary

Fix all hardcoded absolute paths in the codebase to ensure the plugin works correctly when installed in any Obsidian vault on any user's system. This is critical for plugin distribution and cross-platform compatibility.

## Problem Statement

The current codebase contains multiple hardcoded absolute paths pointing to `/Users/caio.niehues/CodeProjects/`, which causes several critical issues:

1. **Plugin Installation Failure**: When installed as an Obsidian plugin in `.obsidian/plugins/`, the hardcoded paths will not exist on other users' systems
2. **Test Failures**: Tests fail on other developers' machines or CI/CD environments
3. **Cross-Platform Incompatibility**: Paths are macOS-specific and won't work on Windows or Linux
4. **Development Friction**: New contributors cannot run tests or scripts without modifying paths

### Affected Files
- `scripts/create_jsbrains_packages.js`
- `scripts/fix_jsbrains_exports.js`
- `src/test/build_integration.test.js`
- `src/test/directory_structure.test.js`
- `src/test/jsbrains_packages.test.js`
- `src/test/obsidian_smart_env_package.test.js`

## Solution

Implement a comprehensive path resolution strategy that:

1. **Uses Relative Paths**: Replace all absolute paths with relative paths from the plugin root
2. **Supports Obsidian Context**: Detect when running as an Obsidian plugin and adjust paths accordingly
3. **Environment Variables**: Support optional environment variables for development overrides
4. **Cross-Platform Compatibility**: Use Node.js path module for platform-agnostic path handling

## Requirements

### Functional Requirements
- All tests must pass regardless of installation location
- Scripts must work when run from any directory
- Plugin must function correctly when installed in `.obsidian/plugins/`
- Support development mode with local dependencies
- Maintain backward compatibility for existing development setups

### Non-Functional Requirements
- Zero configuration required for basic usage
- Clear error messages when paths cannot be resolved
- Documentation for path configuration options
- Performance: Path resolution should not impact startup time

## Success Criteria

1. ✅ All hardcoded paths replaced with dynamic resolution
2. ✅ Tests pass on macOS, Windows, and Linux
3. ✅ Plugin works when installed in any Obsidian vault
4. ✅ Scripts executable from any working directory
5. ✅ CI/CD pipeline runs without path modifications
6. ✅ New developers can clone and run tests immediately

## Implementation Approach

### Phase 1: Path Resolution Infrastructure
- Create a central path resolution utility module
- Implement detection for Obsidian plugin context
- Add support for environment variable overrides

### Phase 2: Update Test Files
- Replace hardcoded paths in all test files
- Use relative paths from project root
- Add fallback mechanisms for different contexts

### Phase 3: Update Scripts
- Modify scripts to use dynamic path resolution
- Ensure scripts work from any working directory
- Add validation for required directories

### Phase 4: Configuration System
- Create `.env.example` template
- Document configuration options
- Implement graceful fallbacks

## Risk Mitigation

- **Risk**: Breaking existing development workflows
  - **Mitigation**: Support environment variables for custom paths
  
- **Risk**: Tests failing in CI/CD
  - **Mitigation**: Thorough testing in GitHub Actions

- **Risk**: Plugin not finding dependencies
  - **Mitigation**: Implement robust fallback mechanisms

## Testing Strategy

1. Unit tests for path resolution utilities
2. Integration tests for all affected files
3. End-to-end tests simulating Obsidian plugin installation
4. Cross-platform testing on Windows, macOS, and Linux
5. CI/CD pipeline validation

## Documentation Updates

- Update README with path configuration section
- Add CONTRIBUTING.md with development setup instructions
- Document environment variables in .env.example
- Update CLAUDE.md with path resolution patterns