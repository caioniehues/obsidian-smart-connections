import test from 'ava';
import esbuild from 'esbuild';
import { css_with_plugin } from '../../esbuild.js';

/**
 * CSS Plugin Integration Tests
 * 
 * These tests validate that the enhanced CSS processing plugin works correctly
 * with esbuild's minification process and handles the problematic Unicode
 * characters from smart-context-obsidian without errors.
 */

// Test CSS content that previously caused build failures
const PROBLEMATIC_CSS = `
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

.test-escaping {
  content: 'Mixed: $var \`template\` \\slash';
}
`;

/**
 * Test the enhanced CSS plugin with esbuild integration
 */
test('CSS plugin handles Unicode characters with minification', async t => {
  // Create a temporary CSS file content for testing
  const testCSS = PROBLEMATIC_CSS;
  
  try {
    // Test with minification enabled (this was failing before the fix)
    const result = await esbuild.build({
      stdin: {
        contents: `import styles from './test.css' with { type: 'css' };`,
        loader: 'js',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      minify: true,  // This is the critical test - minification was causing issues
      plugins: [
        css_with_plugin(),
        {
          name: 'test-css-provider',
          setup(build) {
            build.onLoad({ filter: /\.css$/ }, async (args) => {
              if (args.path.endsWith('test.css')) {
                return {
                  contents: testCSS,
                  loader: 'css'
                };
              }
            });
          },
        },
      ],
    });
    
    // Should complete without errors
    t.truthy(result);
    t.is(result.errors.length, 0);
    t.truthy(result.outputFiles);
    t.truthy(result.outputFiles[0]);
    
    // The output should be valid JavaScript
    const output = result.outputFiles[0].text;
    t.truthy(output);
    t.true(output.includes('CSSStyleSheet'));
    
  } catch (error) {
    t.fail(`Build failed with error: ${error.message}`);
  }
});

test('CSS plugin handles edge cases without errors', async t => {
  const edgeCaseCSS = `
.test-backslashes { content: '\\'; }
.test-dollar { content: '$variable'; }
.test-backticks { content: '\`template\`'; }
.test-control { content: '\n\t\r'; }
.test-unicode { content: '▾▸→←'; }
`;
  
  try {
    const result = await esbuild.build({
      stdin: {
        contents: `import styles from './edge.css' with { type: 'css' };`,
        loader: 'js',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      minify: true,
      plugins: [
        css_with_plugin(),
        {
          name: 'edge-css-provider',
          setup(build) {
            build.onLoad({ filter: /edge\.css$/ }, async (args) => {
              return {
                contents: edgeCaseCSS,
                loader: 'css'
              };
            });
          },
        },
      ],
    });
    
    t.truthy(result);
    t.is(result.errors.length, 0);
    
    const output = result.outputFiles[0].text;
    t.truthy(output);
    t.true(output.includes('CSSStyleSheet'));
    
  } catch (error) {
    t.fail(`Edge case build failed: ${error.message}`);
  }
});

/**
 * Test performance with larger CSS content
 */
test('CSS plugin handles large CSS content efficiently', async t => {
  // Generate large CSS with repeated problematic patterns
  const largeCSS = PROBLEMATIC_CSS.repeat(100);
  
  const start = performance.now();
  
  try {
    const result = await esbuild.build({
      stdin: {
        contents: `import styles from './large.css' with { type: 'css' };`,
        loader: 'js',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      minify: true,
      plugins: [
        css_with_plugin(),
        {
          name: 'large-css-provider',
          setup(build) {
            build.onLoad({ filter: /large\.css$/ }, async (args) => {
              return {
                contents: largeCSS,
                loader: 'css'
              };
            });
          },
        },
      ],
    });
    
    const end = performance.now();
    
    t.truthy(result);
    t.is(result.errors.length, 0);
    
    // Should complete in reasonable time (under 5 seconds)
    t.true(end - start < 5000);
    
  } catch (error) {
    t.fail(`Large CSS build failed: ${error.message}`);
  }
});

/**
 * Test that CSS functionality is preserved after escaping
 */
test('CSS plugin preserves CSS functionality after escaping', async t => {
  try {
    const result = await esbuild.build({
      stdin: {
        contents: `import styles from './functional.css' with { type: 'css' };`,
        loader: 'js',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [
        css_with_plugin(),
        {
          name: 'functional-css-provider',
          setup(build) {
            build.onLoad({ filter: /functional\.css$/ }, async (args) => {
              return {
                contents: PROBLEMATIC_CSS,
                loader: 'css'
              };
            });
          },
        },
      ],
    });
    
    t.truthy(result);
    t.is(result.errors.length, 0);
    
    const output = result.outputFiles[0].text;
    
    // Should preserve essential CSS content
    t.true(output.includes('sc-context-tree'));
    t.true(output.includes('expandable'));
    t.true(output.includes('collapsed'));
    t.true(output.includes('before'));
    
    // Unicode characters should be preserved for CSS functionality
    t.true(output.includes('▾') || output.includes('\\u25be'));
    t.true(output.includes('▸') || output.includes('\\u25b8'));
    
  } catch (error) {
    t.fail(`Functional CSS build failed: ${error.message}`);
  }
});