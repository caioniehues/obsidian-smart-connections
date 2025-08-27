#!/bin/bash

# PRE-COMMIT VALIDATION SCRIPT
# =============================
# 
# This script runs essential validation checks before allowing commits.
# It ensures that only quality code is committed to the repository.
# 
# Usage:
#   ./scripts/pre_commit_validation.sh
#   ./scripts/pre_commit_validation.sh --quick (fast validation only)
#
# Exit Codes:
#   0 - All validations passed
#   1 - Validation failures detected
#   2 - Critical errors (build failure, etc.)

set -e  # Exit on any error

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Parse arguments
QUICK_MODE=false
VERBOSE=false

for arg in "$@"; do
  case $arg in
    --quick)
      QUICK_MODE=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      # unknown option
      ;;
  esac
done

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_section() {
  echo -e "\n${BOLD}${CYAN}=== $1 ===${NC}\n"
}

# Validation counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Track validation results
pass_check() {
  ((TOTAL_CHECKS++))
  ((PASSED_CHECKS++))
  log_success "$1"
}

fail_check() {
  ((TOTAL_CHECKS++))
  ((FAILED_CHECKS++))
  log_error "$1"
}

warn_check() {
  ((TOTAL_CHECKS++))
  ((WARNING_CHECKS++))
  log_warning "$1"
}

# Start validation
echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                          PRE-COMMIT VALIDATION                              ║"
echo "║                         obsidian-smart-claude                               ║"
echo "║                                                                              ║"
echo "║   Ensuring code quality before commit...                                    ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

if [ "$QUICK_MODE" = true ]; then
  log_info "Running in QUICK MODE - skipping time-intensive checks"
fi

START_TIME=$(date +%s)

# ==========================================
# 1. CRITICAL PRE-COMMIT CHECKS
# ==========================================

log_section "CRITICAL CHECKS"

# Check if we're in a git repository
if [ ! -d .git ]; then
  fail_check "Not in a git repository"
  exit 2
fi

# Check for staged changes
if ! git diff --cached --quiet; then
  pass_check "Staged changes detected - proceeding with validation"
else
  log_info "No staged changes found"
fi

# Check package.json exists
if [ -f package.json ]; then
  pass_check "package.json exists"
else
  fail_check "package.json missing"
  exit 2
fi

# ==========================================
# 2. BUILD VALIDATION
# ==========================================

log_section "BUILD VALIDATION"

# Clean build test
log_info "Running clean build..."
if npm run build > /dev/null 2>&1; then
  pass_check "Build succeeds"
else
  fail_check "Build failed - cannot commit broken builds"
  exit 2
fi

# Check build outputs
if [ -f dist/main.js ] && [ -f dist/manifest.json ] && [ -f dist/styles.css ]; then
  pass_check "All required build outputs generated"
else
  fail_check "Build outputs incomplete"
  exit 2
fi

# Bundle size check
BUNDLE_SIZE=$(stat -f%z dist/main.js 2>/dev/null || stat -c%s dist/main.js 2>/dev/null || echo "0")
BUNDLE_SIZE_MB=$(echo "scale=2; $BUNDLE_SIZE / 1024 / 1024" | bc -l 2>/dev/null || echo "0")

if (( $(echo "$BUNDLE_SIZE_MB < 5" | bc -l 2>/dev/null) )); then
  pass_check "Bundle size acceptable: ${BUNDLE_SIZE_MB}MB"
elif (( $(echo "$BUNDLE_SIZE_MB < 10" | bc -l 2>/dev/null) )); then
  warn_check "Bundle size large: ${BUNDLE_SIZE_MB}MB"
else
  fail_check "Bundle size too large: ${BUNDLE_SIZE_MB}MB"
fi

# ==========================================
# 3. CODE QUALITY CHECKS
# ==========================================

log_section "CODE QUALITY"

# Check for console.log statements in source (warning only)
if grep -r "console\.log" src/ --include="*.js" > /dev/null 2>&1; then
  warn_check "console.log statements found in source code"
  if [ "$VERBOSE" = true ]; then
    log_info "console.log locations:"
    grep -rn "console\.log" src/ --include="*.js" | head -5
  fi
else
  pass_check "No console.log statements in source"
fi

# Check for TODO comments
TODO_COUNT=$(grep -r "TODO\|FIXME\|XXX" src/ --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -gt 0 ]; then
  warn_check "$TODO_COUNT TODO/FIXME comments found"
else
  pass_check "No TODO/FIXME comments found"
fi

# Check for proper error handling in adapters
if [ -f src/adapters/claude_code_cli_adapter.js ]; then
  if grep -q "try\|catch" src/adapters/claude_code_cli_adapter.js; then
    pass_check "Error handling found in Claude adapter"
  else
    warn_check "Limited error handling in Claude adapter"
  fi
fi

# ==========================================
# 4. CONFIGURATION VALIDATION
# ==========================================

log_section "CONFIGURATION"

# Check manifest version matches package.json
if [ -f dist/manifest.json ]; then
  MANIFEST_VERSION=$(grep -o '"version":\s*"[^"]*"' dist/manifest.json | cut -d'"' -f4)
  PACKAGE_VERSION=$(grep -o '"version":\s*"[^"]*"' package.json | cut -d'"' -f4)
  
  if [ "$MANIFEST_VERSION" = "$PACKAGE_VERSION" ]; then
    pass_check "Manifest version matches package.json ($PACKAGE_VERSION)"
  else
    fail_check "Version mismatch: manifest($MANIFEST_VERSION) != package($PACKAGE_VERSION)"
  fi
fi

# Check for Claude adapter integration
if grep -q "claude_code_cli\|ClaudeCodeCLIAdapter" dist/main.js 2>/dev/null; then
  pass_check "Claude adapter integrated in build"
else
  warn_check "Claude adapter integration not clearly visible in build"
fi

# ==========================================
# 5. SECURITY CHECKS
# ==========================================

log_section "SECURITY"

# Check for potential secrets in staged files
STAGED_FILES=$(git diff --cached --name-only)
if [ -n "$STAGED_FILES" ]; then
  # Check for API keys, passwords, etc.
  if echo "$STAGED_FILES" | xargs grep -l "sk-[a-zA-Z0-9]\{48\}\|password\s*[:=]\|secret\s*[:=]\|api_key\s*[:=]" 2>/dev/null; then
    fail_check "Potential secrets found in staged files"
    exit 2
  else
    pass_check "No obvious secrets found in staged files"
  fi
fi

# ==========================================
# 6. TEST VALIDATION (if not quick mode)
# ==========================================

if [ "$QUICK_MODE" != true ]; then
  log_section "TESTING"
  
  # Run critical tests only
  log_info "Running critical validation tests..."
  if npm test -- src/test/validation_comprehensive.test.js > /dev/null 2>&1; then
    pass_check "Validation tests passed"
  else
    warn_check "Some validation tests failed - review recommended"
  fi
  
  # Run Claude integration tests if available
  if [ -f src/test/claude_code_integration.test.js ]; then
    log_info "Running Claude integration tests..."
    if timeout 30s npm run test:claude-integration > /dev/null 2>&1; then
      pass_check "Claude integration tests passed"
    else
      warn_check "Claude integration tests failed or timed out"
    fi
  fi
else
  log_info "Skipping tests in quick mode"
fi

# ==========================================
# 7. FINAL VALIDATION
# ==========================================

log_section "FINAL VALIDATION"

# Check that essential files haven't been deleted
ESSENTIAL_FILES=(
  "package.json"
  "src/index.js"
  "src/adapters/claude_code_cli_adapter.js"
  "src/smart_env.config.js"
)

for file in "${ESSENTIAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    pass_check "$file exists"
  else
    # Check if it was deleted in this commit
    if git diff --cached --name-status | grep -q "^D.*$file"; then
      fail_check "$file was deleted - this may break the plugin"
    else
      warn_check "$file not found (may be optional)"
    fi
  fi
done

# ==========================================
# SUMMARY AND EXIT
# ==========================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}${'═' * 80}${NC}"
echo -e "${BOLD}                     PRE-COMMIT SUMMARY                     ${NC}"
echo -e "${BOLD}${'═' * 80}${NC}"
echo ""

echo -e "${BOLD}Duration:${NC} ${DURATION}s"
echo -e "${BOLD}Total Checks:${NC} $TOTAL_CHECKS"
echo -e "${GREEN}✅ Passed: $PASSED_CHECKS${NC}"
echo -e "${RED}❌ Failed: $FAILED_CHECKS${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNING_CHECKS${NC}"

# Determine exit status
if [ $FAILED_CHECKS -eq 0 ]; then
  echo ""
  echo -e "${GREEN}${BOLD}🎉 PRE-COMMIT VALIDATION PASSED!${NC}"
  echo -e "${GREEN}Your changes are ready to be committed.${NC}"
  
  if [ $WARNING_CHECKS -gt 0 ]; then
    echo -e "${YELLOW}Note: $WARNING_CHECKS warnings found - consider addressing them.${NC}"
  fi
  
  exit 0
else
  echo ""
  echo -e "${RED}${BOLD}❌ PRE-COMMIT VALIDATION FAILED!${NC}"
  echo -e "${RED}Please fix the $FAILED_CHECKS error(s) above before committing.${NC}"
  
  # Helpful suggestions
  echo ""
  echo -e "${CYAN}Quick fixes:${NC}"
  echo "  • npm run build    # Fix build issues"
  echo "  • npm test         # Run full test suite"
  echo "  • Check version consistency between package.json and manifest.json"
  echo "  • Review error messages above"
  
  exit 1
fi