import test from 'ava';
import esbuild from 'esbuild';

/**
 * CSS Unicode Character Escaping Tests
 * 
 * These tests validate the enhanced CSS processing plugin's ability to properly
 * handle Unicode characters in CSS content properties when converting to JavaScript
 * template literals. This addresses the "Legacy octal escape sequences cannot be
 * used in template literals" error that prevents smart-context-obsidian bundling.
 */

// Test CSS content with problematic Unicode characters from smart-context-obsidian
const PROBLEMATIC_CSS_SAMPLES = {
  contextTree: `
.sc-context-tree .sc-tree-item.expandable > .sc-tree-label::before {
  content: '▾';
  display: inline-block;
  width: 1em;
}

.sc-context-tree .sc-tree-item.collapsed > .sc-tree-label::before {
  content: '▸';
}`,
  
  unicodeVariations: `
.test-unicode-arrows {
  content: '▸';  /* Right-pointing triangle */
}
.test-unicode-down {
  content: '▾';  /* Down-pointing triangle */  
}
.test-unicode-mixed {
  content: '▸▾→←';  /* Multiple Unicode characters */
}`,

  edgeCases: `
.test-backslashes {
  content: '\\';
}
.test-dollar-signs {
  content: '$variable';
}  
.test-backticks {
  content: '\`template\`';
}
.test-control-chars {
  content: '\n\t\r';
}`,

  complexContent: `
.test-complex::before {
  content: 'Text with ▸ Unicode ▾ and $variables and \`backticks\` and \\backslashes';
}`
};

/**
 * Enhanced CSS escaping function that handles Unicode characters properly
 * This is the implementation we'll test and then integrate into esbuild.js
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
 * Test basic Unicode character escaping functionality
 */
test('escapes Unicode triangle characters correctly', t => {
  const input = "content: '▾';";
  const escaped = escapeCSS(input);
  
  // Unicode characters should remain unchanged (they're safe in template literals)
  // The issue was misidentified - Unicode characters themselves aren't the problem
  t.is(escaped, "content: '▾';");
});

test('escapes backticks correctly', t => {
  const input = "content: '`template`';";
  const expected = "content: '\\`template\\`';";
  const escaped = escapeCSS(input);
  
  t.is(escaped, expected);
});

test('escapes backslashes correctly', t => {
  const input = "content: '\\';";
  const expected = "content: '\\\\';";
  const escaped = escapeCSS(input);
  
  t.is(escaped, expected);
});

test('escapes dollar signs correctly', t => {
  const input = "content: '$variable';";
  const expected = "content: '\\$variable';";
  const escaped = escapeCSS(input);
  
  t.is(escaped, expected);
});

test('escapes control characters correctly', t => {
  const input = "content: '\n\t\r';";
  const expected = "content: '\\u000a\\u0009\\u000d';";
  const escaped = escapeCSS(input);
  
  t.is(escaped, expected);
});

test('handles complex CSS content with multiple escape types', t => {
  const input = PROBLEMATIC_CSS_SAMPLES.complexContent;
  const escaped = escapeCSS(input);
  
  // Should escape backticks, dollar signs, and backslashes while preserving Unicode
  t.true(escaped.includes('\\`backticks\\`'));
  t.true(escaped.includes('\\$variables'));
  t.true(escaped.includes('\\\\backslashes'));
  t.true(escaped.includes('▸')); // Unicode should remain
  t.true(escaped.includes('▾')); // Unicode should remain
});

/**
 * Test template literal safety - the core issue we're solving
 */
test('escaped CSS content is safe in template literals', t => {
  const problematicCSS = PROBLEMATIC_CSS_SAMPLES.contextTree;
  const escaped = escapeCSS(problematicCSS);
  
  // This should not throw a syntax error when used in a template literal
  t.notThrows(() => {
    const templateLiteral = `const css_sheet = new CSSStyleSheet(); css_sheet.replaceSync(\`${escaped}\`);`;
    // Verify the template literal is syntactically valid
    new Function(templateLiteral);
  });
});

test('escaped CSS preserves functionality after escaping', t => {
  const originalCSS = PROBLEMATIC_CSS_SAMPLES.contextTree;
  const escaped = escapeCSS(originalCSS);
  
  // The escaped version should still contain the essential CSS selectors
  t.true(escaped.includes('.sc-context-tree'));
  t.true(escaped.includes('::before'));
  t.true(escaped.includes('content:'));
  
  // Unicode characters should be preserved for CSS functionality
  t.true(escaped.includes('▾'));
  t.true(escaped.includes('▸'));
});

/**
 * Integration test with esbuild CSS processing
 */
test('works with esbuild CSS minification', async t => {
  const testCSS = PROBLEMATIC_CSS_SAMPLES.contextTree;
  const escaped = escapeCSS(testCSS);
  
  // Test that escaped CSS can be processed by esbuild minification
  const result = await esbuild.transform(escaped, {
    loader: 'css',
    minify: true,
  });
  
  t.truthy(result.code);
  t.is(typeof result.code, 'string');
  t.true(result.code.length > 0);
});

/**
 * Performance test for escaping large CSS content
 */
test('escaping performance is reasonable for large CSS', t => {
  // Create large CSS content by repeating problematic patterns
  const largeCSS = PROBLEMATIC_CSS_SAMPLES.complexContent.repeat(1000);
  
  const start = performance.now();
  const escaped = escapeCSS(largeCSS);
  const end = performance.now();
  
  t.truthy(escaped);
  t.true(end - start < 100); // Should complete in under 100ms
});

/**
 * Edge case tests
 */
test('handles empty CSS content', t => {
  const escaped = escapeCSS('');
  t.is(escaped, '');
});

test('handles CSS with no special characters', t => {
  const plainCSS = '.test { color: red; }';
  const escaped = escapeCSS(plainCSS);
  t.is(escaped, plainCSS);
});

test('preserves CSS functionality with mixed character types', t => {
  const mixedCSS = `
.test::before {
  content: 'Mixed: ▸ $var \`template\` \\slash \n';
}`;
  const escaped = escapeCSS(mixedCSS);
  
  // Should preserve CSS structure while escaping problematic characters
  t.true(escaped.includes('.test::before'));
  t.true(escaped.includes('content:'));
  t.true(escaped.includes('▸')); // Unicode preserved
  t.true(escaped.includes('\\$var')); // Dollar escaped
  t.true(escaped.includes('\\`template\\`')); // Backticks escaped
  t.true(escaped.includes('\\\\slash')); // Backslash escaped
});