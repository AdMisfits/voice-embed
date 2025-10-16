const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  try {
    // Build minified version
    const result = await esbuild.build({
      entryPoints: ['src/voice-note.ts'],
      bundle: true,
      minify: true,
      format: 'iife',
      target: 'es2019',
      outfile: 'dist/voice-note.min.js',
      sourcemap: false,
      metafile: true,
      treeShaking: true,
      legalComments: 'none',
      pure: ['console.log'],
      drop: ['console'],
    });

    // Calculate size
    const minFile = fs.readFileSync('dist/voice-note.min.js');
    const sizeKB = (minFile.length / 1024).toFixed(2);
    console.log(`✓ Built voice-note.min.js (${sizeKB} KB)`);

    // Check gzipped size
    const zlib = require('zlib');
    const gzipped = zlib.gzipSync(minFile);
    const gzipSizeKB = (gzipped.length / 1024).toFixed(2);
    console.log(`✓ Gzipped size: ${gzipSizeKB} KB`);

    // Build unminified version for debugging
    await esbuild.build({
      entryPoints: ['src/voice-note.ts'],
      bundle: true,
      minify: false,
      format: 'iife',
      target: 'es2019',
      outfile: 'dist/voice-note.js',
      sourcemap: true,
    });

    console.log('✓ Built voice-note.js (debug version)');

    // Generate TypeScript declarations
    const { execSync } = require('child_process');
    execSync('npx tsc --declaration --emitDeclarationOnly --outDir dist', { stdio: 'inherit' });
    console.log('✓ Generated TypeScript declarations');

    // Create metafile analysis
    if (result.metafile) {
      fs.writeFileSync('dist/meta.json', JSON.stringify(result.metafile, null, 2));
      console.log('✓ Generated build metadata');
    }

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

build();