# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-27-fix-hardcoded-paths/spec.md

> Created: 2025-08-27
> Status: Ready for Implementation

## Tasks

- [ ] 1. Create Path Resolution Infrastructure
  - [ ] 1.1 Write tests for path-resolver utility module
  - [ ] 1.2 Implement getPluginRoot() function with Obsidian detection
  - [ ] 1.3 Implement getDependencyPath() function with fallback logic
  - [ ] 1.4 Implement helper functions (getTestDataPath, resolveRelativePath)
  - [ ] 1.5 Add caching mechanism for resolved paths
  - [ ] 1.6 Create comprehensive error messages for path resolution failures
  - [ ] 1.7 Verify all path resolver tests pass

- [ ] 2. Update Test Files with Dynamic Paths
  - [ ] 2.1 Write tests to verify test files work with dynamic paths
  - [ ] 2.2 Update build_integration.test.js to use path-resolver
  - [ ] 2.3 Update directory_structure.test.js to use path-resolver
  - [ ] 2.4 Update jsbrains_packages.test.js to use path-resolver
  - [ ] 2.5 Update obsidian_smart_env_package.test.js to use path-resolver
  - [ ] 2.6 Verify all test files run successfully from different directories
  - [ ] 2.7 Verify tests pass in CI environment

- [ ] 3. Update Script Files with Dynamic Paths
  - [ ] 3.1 Write tests for script path handling
  - [ ] 3.2 Update create_jsbrains_packages.js to use relative paths
  - [ ] 3.3 Update fix_jsbrains_exports.js to use relative paths
  - [ ] 3.4 Add path validation to scripts before execution
  - [ ] 3.5 Test scripts from various working directories
  - [ ] 3.6 Verify scripts work when installed as Obsidian plugin

- [ ] 4. Implement Configuration System
  - [ ] 4.1 Write tests for configuration loading
  - [ ] 4.2 Create .env.example with documented path variables
  - [ ] 4.3 Implement dotenv loading with fallback to defaults
  - [ ] 4.4 Add configuration validation on startup
  - [ ] 4.5 Create configuration documentation in README
  - [ ] 4.6 Test configuration in development and production modes
  - [ ] 4.7 Verify environment variable overrides work correctly

- [ ] 5. Cross-Platform Testing and Documentation
  - [ ] 5.1 Write cross-platform path handling tests
  - [ ] 5.2 Test on Windows with different path separators
  - [ ] 5.3 Test on Linux in CI environment
  - [ ] 5.4 Update README with path configuration section
  - [ ] 5.5 Create CONTRIBUTING.md with setup instructions
  - [ ] 5.6 Update CLAUDE.md with path resolution patterns
  - [ ] 5.7 Add migration guide for existing developers
  - [ ] 5.8 Verify complete solution works as Obsidian plugin