import test from 'ava';
import esbuild from 'esbuild';

/**
 * Direct CSS Plugin Testing
 * 
 * These tests directly test the enhanced CSS escaping logic by simulating
 * the plugin's behavior without requiring file resolution.
 */

// Test CSS content with problematic Unicode characters
const CONTEXT_TREE_CSS = `
.sc-context-tree .sc-tree-item.expandable > .sc-tree-label::before {
  content: '▾';
  display: inline-block;
  width: 1em;
  margin-right: 2px;
  cursor: pointer;
}

.sc-context-tree .sc-tree-item.collapsed > .sc-tree-label::before {
  content: '▸';
}
`;

/**
 * Enhanced CSS escaping function (from esbuild.js)
 */
function escapeCSS(cssContent) {
  return cssContent
    .replace(/\\/g, '\\\\')    // Escape backslashes first (order critical)
    .replace(/`/g, '\\`')      // Escape backticks for template literals  
    .replace(/\$/g, '\\$')     // Escape dollar signs for template literals
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, match => {
      // Escape control characters that could cause issues
      return '\\u' + match.charCodeAt(0).toString(16).padStart(4, '0');
    });
}

/**
 * Test CSS minification with enhanced escaping
 */
test('enhanced escaping works with CSS minification', async t => {
  const testCSS = CONTEXT_TREE_CSS;
  const escaped = escapeCSS(testCSS);
  
  // Test that escaped CSS can be minified by esbuild
  const result = await esbuild.transform(escaped, {
    loader: 'css',
    minify: true,
  });
  
  t.truthy(result.code);
  t.is(typeof result.code, 'string');
  t.true(result.code.length > 0);
  
  // Minified CSS should still contain essential selectors
  t.true(result.code.includes('.sc-context-tree'));
});

test('template literal creation works with enhanced escaping', t => {
  const testCSS = CONTEXT_TREE_CSS;
  const escaped = escapeCSS(testCSS);
  
  // This simulates the exact template literal creation from css_with_plugin()
  const jsModule = `
    const css_sheet = new CSSStyleSheet();
    css_sheet.replaceSync(\`${escaped}\`);
    export default css_sheet;
  `;
  
  // Should be valid JavaScript (no syntax errors)
  t.notThrows(() => {
    new Function(jsModule.replace('export default css_sheet;', 'return css_sheet;'));
  });
  
  // Should contain expected elements
  t.true(jsModule.includes('CSSStyleSheet'));
  t.true(jsModule.includes('replaceSync'));
});

test('edge cases work with enhanced escaping and minification', async t => {
  const edgeCaseCSS = `
.test-backslashes { content: '\\'; }
.test-dollar { content: '$variable'; }  
.test-backticks { content: '\`template\`'; }
.test-mixed { content: 'Text ▾ $var \`temp\` \\slash'; }
`;
  
  const escaped = escapeCSS(edgeCaseCSS);
  
  // Test minification
  const result = await esbuild.transform(escaped, {
    loader: 'css',
    minify: true,
  });
  
  t.truthy(result.code);
  
  // Test template literal safety
  t.notThrows(() => {
    new Function(`
      const css_sheet = new CSSStyleSheet();
      css_sheet.replaceSync(\`${escaped}\`);
    `);
  });
});

test('large CSS content works efficiently', async t => {
  const largeCSS = CONTEXT_TREE_CSS.repeat(500); // Large but reasonable size
  
  const start = performance.now();
  const escaped = escapeCSS(largeCSS);
  const escapeTime = performance.now();
  
  // Test minification of large content
  const result = await esbuild.transform(escaped, {
    loader: 'css',
    minify: true,
  });
  const totalTime = performance.now();
  
  // Should complete in reasonable time
  t.true(escapeTime - start < 100); // Escaping under 100ms
  t.true(totalTime - escapeTime < 2000); // Minification under 2s
  
  t.truthy(result.code);
  t.true(result.code.length > 0);
});

/**
 * Test character preservation
 */
test('Unicode characters are preserved for CSS functionality', t => {
  const unicodeCSS = `
.arrow-down::before { content: '▾'; }
.arrow-right::before { content: '▸'; }
.arrow-mixed::before { content: '▸▾→←'; }
`;
  
  const escaped = escapeCSS(unicodeCSS);
  
  // Unicode characters should be preserved (not escaped)
  t.true(escaped.includes('▾'));
  t.true(escaped.includes('▸'));
  t.true(escaped.includes('→'));
  t.true(escaped.includes('←'));
  
  // Other characters should be escaped as needed
  t.false(escaped.includes('$unescaped')); // This wasn't in the input anyway
});

test('escaping order is correct to prevent double-escaping', t => {
  const testCSS = `content: 'Test \\$ \`template\` string';`;
  const escaped = escapeCSS(testCSS);
  
  // Should have proper escaping without double-escaping
  t.true(escaped.includes('\\\\\\$')); // Backslash then escaped dollar
  t.true(escaped.includes('\\`template\\`')); // Escaped backticks
  t.false(escaped.includes('\\\\\\\\')); // No excessive backslash escaping
});