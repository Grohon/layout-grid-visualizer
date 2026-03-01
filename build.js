const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const lightning = require('lightningcss');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const DIST_ROOT = path.join(__dirname, 'dist');
const DIST = path.join(DIST_ROOT, 'layout-grid-visualizer');

// Files to minify
const JS_FILES = ['background.js', 'content.js', 'popup.js'];
const CSS_FILES = ['grid-overlay.css', 'popup.css'];

// Files to copy as-is
const COPY_FILES = ['manifest.json', 'popup.html'];
const COPY_DIRS = ['icons'];

function cleanDist() {
  fs.rmSync(DIST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    const destPath = path.join(destDir, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

async function minifyJS(file) {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(DIST, file);
  const code = fs.readFileSync(srcPath, 'utf8');

  const result = await minify(code, {
    compress: {
      drop_console: false, // keep console for debugging in production if needed
      passes: 2
    },
    mangle: true,
    output: {
      comments: false
    }
  });

  if (result.error) {
    throw result.error;
  }

  fs.writeFileSync(destPath, result.code, 'utf8');

  const originalSize = Buffer.byteLength(code, 'utf8');
  const minifiedSize = Buffer.byteLength(result.code, 'utf8');
  const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
  console.log(`  JS  ${file}: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
}

function minifyCSS(file) {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(DIST, file);
  const code = fs.readFileSync(srcPath, 'utf8');

  const { code: minifiedCode } = lightning.transform({
    filename: file,
    code: Buffer.from(code),
    minify: true,
    sourceMap: false,
    targets: {
      chrome: 100 << 16
    }
  });

  fs.writeFileSync(destPath, minifiedCode);

  const originalSize = Buffer.byteLength(code, 'utf8');
  const minifiedSize = minifiedCode.length;
  const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
  console.log(`  CSS ${file}: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
}

async function createZip() {
  // Use Node.js built-in zip support or archiver
  // For simplicity, use a child process with PowerShell on Windows
  const { execSync } = require('child_process');
  const zipName = `layout-grid-visualizer-${VERSION}.zip`;
  const zipPath = path.join(__dirname, zipName);

  // Remove existing zip
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // Use PowerShell Compress-Archive
  // Zip the folder itself so that it contains the folder in the root
  execSync(
    `powershell -Command "Compress-Archive -Path '${DIST}' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );

  const zipSize = fs.statSync(zipPath).size;
  console.log(`\n📦 Created ${zipName} (${(zipSize / 1024).toFixed(1)} KB)`);
}

async function build() {
  const shouldZip = process.argv.includes('--zip');

  console.log('🔧 Building Layout Grid Visualizer extension...\n');

  // Step 1: Clean
  cleanDist();
  console.log('📁 Cleaned dist/ directory\n');

  // Step 2: Minify JS
  console.log('Minifying JavaScript:');
  for (const file of JS_FILES) {
    await minifyJS(file);
  }

  // Step 3: Minify CSS
  console.log('\nMinifying CSS:');
  for (const file of CSS_FILES) {
    minifyCSS(file);
  }

  // Step 4: Copy static files
  console.log('\n📋 Copying static files:');
  for (const file of COPY_FILES) {
    copyFile(path.join(__dirname, file), path.join(DIST, file));
    console.log(`  ${file}`);
  }
  for (const dir of COPY_DIRS) {
    copyDir(path.join(__dirname, dir), path.join(DIST, dir));
    console.log(`  ${dir}/`);
  }

  console.log('\n✅ Build complete! Output in dist/');

  // Step 5: Zip if requested
  if (shouldZip) {
    console.log('\n🗜️  Creating zip...');
    await createZip();
  }
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
