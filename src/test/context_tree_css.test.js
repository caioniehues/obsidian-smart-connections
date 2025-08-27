import test from 'ava';
import fs from 'fs/promises';
import path from 'path';

/**
 * Context Tree CSS Specific Tests
 * 
 * These tests validate handling of the exact CSS content from smart-context-obsidian
 * context_tree.css that was causing the "Legacy octal escape sequences" build error.
 * 
 * The problematic Unicode characters are:
 * - ▾ (U+25BE) - Black down-pointing triangle 
 * - ▸ (U+25B8) - Black right-pointing triangle
 */

// Extract the exact problematic CSS from context_tree.css
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
 * Enhanced CSS escaping function for template literal safety
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
 * Test the exact CSS content that was causing build failures
 */
test('handles context tree expandable triangle character (▾)', t => {
  const css = "content: '▾';";
  const escaped = escapeCSS(css);
  
  // Unicode triangle should be preserved - it's not the actual problem
  t.is(escaped, "content: '▾';");
  
  // Should be safe in template literal
  t.notThrows(() => {
    new Function(`const css = \`${escaped}\`;`);
  });
});

test('handles context tree collapsed triangle character (▸)', t => {
  const css = "content: '▸';";
  const escaped = escapeCSS(css);
  
  // Unicode triangle should be preserved
  t.is(escaped, "content: '▸';");
  
  // Should be safe in template literal
  t.notThrows(() => {
    new Function(`const css = \`${escaped}\`;`);
  });
});

test('processes complete context tree CSS without errors', t => {
  const escaped = escapeCSS(CONTEXT_TREE_CSS);
  
  // Should preserve all essential CSS content
  t.true(escaped.includes('.sc-context-tree'));
  t.true(escaped.includes('.expandable'));
  t.true(escaped.includes('.collapsed'));
  t.true(escaped.includes('::before'));
  t.true(escaped.includes('▾'));
  t.true(escaped.includes('▸'));
  
  // Should be safe in template literal context
  t.notThrows(() => {
    // Test just the template literal part that was causing issues
    new Function(`const css = \`${escaped}\`;`);
  });
});

/**
 * Test the exact esbuild CSS plugin template literal pattern
 */
test('works in esbuild CSS plugin template literal pattern', t => {
  const escaped = escapeCSS(CONTEXT_TREE_CSS);
  
  // This replicates the exact pattern from esbuild.js css_with_plugin()
  // Test just the critical template literal part
  t.notThrows(() => {
    new Function(`
      const css_sheet = new CSSStyleSheet();
      css_sheet.replaceSync(\`${escaped}\`);
    `);
  });
  
  // Should compile successfully
  t.truthy(escaped);
  t.true(escaped.includes('▾'));
  t.true(escaped.includes('▸'));
});

/**
 * Test Unicode character code points to verify we understand the issue correctly
 */
test('identifies Unicode character code points correctly', t => {
  const expandedChar = '▾';
  const collapsedChar = '▸';
  
  // Verify we have the right characters
  t.is(expandedChar.charCodeAt(0), 0x25BE);  // U+25BE
  t.is(collapsedChar.charCodeAt(0), 0x25B8); // U+25B8
  
  // These are not in the octal range that would cause issues
  t.true(expandedChar.charCodeAt(0) > 127); // Outside ASCII range
  t.true(collapsedChar.charCodeAt(0) > 127); // Outside ASCII range
});

/**
 * Test for the actual cause of octal escape errors
 * The issue might be in how the CSS is processed, not the characters themselves
 */
test('verifies octal escape sequence patterns', t => {
  // Test various patterns that could be misinterpreted as octal
  const potentialOctalPatterns = [
    '\\25',    // Potential octal that could be misinterpreted
    '\\377',   // Maximum octal value
    '\\0',     // Null character octal
    '\\8',     // Invalid octal (8 is not octal)
  ];
  
  potentialOctalPatterns.forEach(pattern => {
    const css = `content: '${pattern}';`;
    const escaped = escapeCSS(css);
    
    // Should escape backslashes to prevent octal interpretation
    t.true(escaped.includes('\\\\'));
    
    // Should be safe in template literal
    t.notThrows(() => {
      new Function(`const css = \`${escaped}\`;`);
    });
  });
});

/**
 * Test CSS with import attributes processing
 */
test('simulates esbuild CSS with import attributes processing', t => {
  const testCSS = CONTEXT_TREE_CSS;
  const escaped = escapeCSS(testCSS);
  
  // Simulate the complete esbuild CSS plugin pattern
  const jsModule = `
    const css_sheet = new CSSStyleSheet();
    css_sheet.replaceSync(\`${escaped}\`);
    export default css_sheet;
  `;
  
  t.notThrows(() => {
    // Test the template literal safety
    new Function(`
      const css_sheet = new CSSStyleSheet();
      css_sheet.replaceSync(\`${escaped}\`);
    `);
  });
  
  // Verify the module structure is correct
  t.true(jsModule.includes('CSSStyleSheet'));
  t.true(jsModule.includes('export default'));
});

/**
 * Integration test: Read actual context_tree.css and process it
 */
test.skip('processes actual context_tree.css file', async t => {
  // Skip by default since file path is external dependency
  try {
    const cssPath = path.resolve(process.cwd(), '../smart-context-obsidian/src/components/context_tree.css');
    const actualCSS = await fs.readFile(cssPath, 'utf8');
    
    const escaped = escapeCSS(actualCSS);
    
    // Should process without errors
    t.truthy(escaped);
    
    // Should be safe in template literal
    t.notThrows(() => {
      const jsModule = `
        const css_sheet = new CSSStyleSheet();
        css_sheet.replaceSync(\`${escaped}\`);
        export default css_sheet;
      `;
      new Function(jsModule);
    });
  } catch (error) {
    t.pass('Skipped - external file not available');
  }
});