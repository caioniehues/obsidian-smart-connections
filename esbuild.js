import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { build_smart_env_config } from 'obsidian-smart-env/build_smart_env_config.js';
import { create_banner } from './src/utils/banner.js';

const roots = [
  path.resolve(process.cwd(), 'src'),
  // path.resolve(process.cwd(), '..', 'smart-context-obsidian', 'src'),
];
build_smart_env_config(process.cwd(), roots);

/**
 * Comprehensively escapes CSS content for safe embedding in template literals.
 * Handles all characters that could break template literal syntax:
 * - Backslashes (must be first to avoid double-escaping)
 * - Dollar signs (template literal expression markers)
 * - Backticks (template literal delimiters)
 * - Control characters (converted to Unicode escape sequences)
 * 
 * Preserves safe Unicode characters like arrows (▾, ▸) and other symbols.
 * 
 * @param {string} css - The CSS content to escape
 * @returns {string} The escaped CSS content safe for template literals
 */
function escapeForTemplateLiteral(css) {
  return css
    // 1. Escape backslashes first (to avoid double-escaping later escapes)
    .replace(/\\/g, '\\\\')
    
    // 2. Escape dollar signs (template literal expression markers)
    .replace(/\$/g, '\\$')
    
    // 3. Escape backticks (template literal delimiters)
    .replace(/`/g, '\\`')
    
    // 4. Convert dangerous control characters to Unicode escape sequences
    // This handles characters that could break string parsing or cause issues
    .replace(/[\x00-\x1F\x7F-\x9F]/g, (char) => {
      const code = char.charCodeAt(0);
      // Convert to Unicode escape sequence
      return '\\u' + code.toString(16).padStart(4, '0');
    });
}

/**
 * Plugin to process CSS files imported with an import attribute:
 *   import sheet from './style.css' with { type: 'css' };
 *
 * When such an import is detected, the plugin loads the CSS file,
 * optionally minifies it if the build options request minification,
 * and wraps the CSS text into a new CSSStyleSheet. The module then
 * exports the stylesheet as its default export.
 *
 * @returns {esbuild.Plugin} The esbuild plugin object.
 */
export function css_with_plugin() {
  return {
    name: 'css-with-plugin',
    setup(build) {
      // Intercept all .css files
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        // Check for the "with" import attribute and that its type is 'css'
        if (args.with && args.with.type === 'css') {
          // Read the CSS file contents
          const fs = await import('fs/promises');
          let css_content = await fs.readFile(args.path, 'utf8');

          // Optionally transform (minify) the CSS if minification is enabled
          const should_minify = build.initialOptions.minify || false;
          if (should_minify) {
            const result = await esbuild.transform(css_content, {
              loader: 'css',
              minify: true,
            });
            css_content = result.code;
          }

          // Comprehensive escaping for template literal safety
          const escaped_css = escapeForTemplateLiteral(css_content);

          // Create a JavaScript module that creates a CSSStyleSheet and exports it
          const js_module = `
            const css_sheet = new CSSStyleSheet();
            css_sheet.replaceSync(\`${escaped_css}\`);
            export default css_sheet;
          `;

          return {
            contents: js_module,
            loader: 'js',
          };
        }
        // If the "with" attribute is not present or not type "css",
        // return undefined so that other loaders/plugins can process it.
      });
    },
  };
}

// if directory doesn't exist, create it
if(!fs.existsSync(path.join(process.cwd(), 'dist'))) {
  fs.mkdirSync(path.join(process.cwd(), 'dist'), { recursive: true });
}

const main_path = path.join(process.cwd(), 'dist', 'main.js');
const manifest_path = path.join(process.cwd(), 'manifest.json');
const styles_path = path.join(process.cwd(), 'src', 'styles.css');
// Update manifest.json version
const package_json = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')));
const manifest_json = JSON.parse(fs.readFileSync(manifest_path));
manifest_json.version = package_json.version;
fs.writeFileSync(manifest_path, JSON.stringify(manifest_json, null, 2));
// copy manifest and styles to dist
fs.copyFileSync(manifest_path, path.join(process.cwd(), 'dist', 'manifest.json'));
fs.copyFileSync(styles_path, path.join(process.cwd(), 'dist', 'styles.css'));

const destination_vaults = process.env.DESTINATION_VAULTS?.split(',') || [];
const use_symlinks = process.env.USE_SYMLINKS === 'true';

// get first argument as entry point
const entry_point = process.argv[2] || 'src/index.js';

// update release_notes.md with version
const release_notes_path = path.join(process.cwd(), 'src', 'views', 'release_notes_view.js');
const release_notes_lines = fs.readFileSync(release_notes_path, 'utf8').split('\n');
const release_notes_version_file_exists = fs.existsSync(path.join(process.cwd(), 'releases', package_json.version + '.md'));
if(release_notes_version_file_exists) {
  for(let i = 0; i < release_notes_lines.length; i++) {
    if(release_notes_lines[i].startsWith('import release_notes_md from')) {
      release_notes_lines[i] = `import release_notes_md from '../../releases/${package_json.version}.md' with { type: 'markdown' };`;
      break;
    }
  }
  const updated_release_notes_text = release_notes_lines.join('\n');
  fs.writeFileSync(release_notes_path, updated_release_notes_text);
}

// Heavy external dependencies that should remain external to reduce bundle size
// smart-context-obsidian FIXED - now bundled to eliminate runtime dependencies
const HEAVY_EXTERNALS = [
  'electron',
  'obsidian',
  'crypto',
  '@xenova/transformers',
  '@huggingface/transformers',
  'http',
  'url',
  // Note: smart-context-obsidian was removed from externals to achieve local-first architecture
  // This allows complete bundling and eliminates runtime dependency failures
];

// markdown plugin
const markdown_plugin = {
  name: 'markdown',
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, async (args) => {
      if(args.with && args.with.type === 'markdown') {
        const text = await fs.promises.readFile(args.path, 'utf8');
        return {
          contents: `export default ${JSON.stringify(text)};`,
          loader: 'js'
        };
      }
    });
  }
};
// Build the project
const copyright_banner = create_banner(package_json);
esbuild.build({
  entryPoints: [entry_point],
  outfile: 'dist/main.js',
  format: 'cjs',
  bundle: true,
  write: true,
  target: "es2022",
  logLevel: "info",
  treeShaking: true,
  platform: 'node',
  preserveSymlinks: true,
  external: HEAVY_EXTERNALS,
  define: {
    'process.env.DEFAULT_OPEN_ROUTER_API_KEY': JSON.stringify(process.env.DEFAULT_OPEN_ROUTER_API_KEY || ''),
  },
  plugins: [css_with_plugin(), markdown_plugin],
  banner: { js: copyright_banner },
}).then(() => {
  console.log('Build complete');
  const release_file_paths = [manifest_path, styles_path, main_path];
  
  for(let vault of destination_vaults) {
    const destDir = path.join(process.cwd(), '..', vault, '.obsidian', 'plugins', 'smart-connections');
    
    // Ensure destination directory exists
    fs.mkdirSync(destDir, { recursive: true });
    
    // Create .hotreload file if it doesn't exist
    if(!fs.existsSync(path.join(destDir, '.hotreload'))) {
      fs.writeFileSync(path.join(destDir, '.hotreload'), '');
    }
    
    if(use_symlinks) {
      console.log(`Creating symlinks in ${destDir}`);
      
      // Create symlinks for each file
      release_file_paths.forEach(source_path => {
        const dest_path = path.join(destDir, path.basename(source_path));
        
        // Remove existing file/symlink if it exists
        try {
          if(fs.existsSync(dest_path)) {
            fs.unlinkSync(dest_path);
          }
        } catch(e) {
          console.warn(`Could not remove existing file: ${dest_path}`);
        }
        
        // Create symlink
        try {
          // Use relative path for better portability
          const relative_source = path.relative(destDir, source_path);
          fs.symlinkSync(relative_source, dest_path, 'file');
          console.log(`  ✓ Symlinked ${path.basename(source_path)}`);
        } catch(err) {
          console.error(`Failed to create symlink for ${path.basename(source_path)}: ${err.message}`);
          console.log(`  Falling back to copy for ${path.basename(source_path)}`);
          fs.copyFileSync(source_path, dest_path);
        }
      });
      
      console.log(`Symlinks created in ${destDir}`);
    } else {
      console.log(`Copying files to ${destDir}`);
      
      release_file_paths.forEach(file_path => {
        fs.copyFileSync(file_path, path.join(destDir, path.basename(file_path)));
      });
      
      console.log(`Copied files to ${destDir}`);
    }
  }
}).catch(() => process.exit(1));
