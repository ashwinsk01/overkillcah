#!/usr/bin/env node
/**
 * Build script for CAH-Hyper production optimization
 * Handles data preparation, compression, and asset bundling
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Building CAH-Hyper for production...\n');

// Step 1: Generate fresh binary data
console.log('📊 Generating binary card data...');
try {
  process.chdir('prep');
  execSync('python3 create_json_binary.py', { stdio: 'inherit' });
  execSync('python3 compress_json.py', { stdio: 'inherit' });
  
  // Move files to binaries
  execSync('mv cards.json.bin ../binaries/', { stdio: 'inherit' });
  execSync('mv cards.json.bin.br ../binaries/', { stdio: 'inherit' });
  
  process.chdir('..');
  console.log('✅ Binary data generated\n');
} catch (error) {
  console.error('❌ Error generating binary data:', error.message);
  process.exit(1);
}

// Step 2: Verify file sizes and compression ratios
console.log('📈 Analyzing compression efficiency...');
const uncompressedSize = fs.statSync('binaries/cards.json.bin').size;
const compressedSize = fs.statSync('binaries/cards.json.bin.br').size;
const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(1);

console.log(`   Uncompressed: ${uncompressedSize.toLocaleString()} bytes`);
console.log(`   Compressed:   ${compressedSize.toLocaleString()} bytes`);
console.log(`   Savings:      ${compressionRatio}% reduction`);
console.log('✅ Compression analysis complete\n');

// Step 3: Calculate total payload size
console.log('📦 Calculating total payload size...');
const htmlSize = fs.statSync('index.html').size;
const jsSize = fs.statSync('app.js').size;
const totalSize = htmlSize + jsSize + compressedSize;

console.log(`   HTML:         ${htmlSize.toLocaleString()} bytes`);
console.log(`   JavaScript:   ${jsSize.toLocaleString()} bytes`);
console.log(`   Cards data:   ${compressedSize.toLocaleString()} bytes`);
console.log(`   TOTAL:        ${totalSize.toLocaleString()} bytes`);

const targetSize = 500 * 1024; // 500KB target
const sizeStatus = totalSize <= targetSize ? '🎯' : '⚠️';
console.log(`   ${sizeStatus} Target <500KB: ${(totalSize / 1024).toFixed(1)}KB / 500KB`);
console.log('✅ Payload analysis complete\n');

// Step 4: Create production start script
const startScript = `#!/bin/bash
echo "🎮 Starting CAH-Hyper Production Server..."
echo "📊 Payload size: ${(totalSize / 1024).toFixed(1)}KB"
echo "📡 Server: http://localhost:8080"
echo "🔌 WebSocket: ws://localhost:8081"
echo ""
node server.js
`;

fs.writeFileSync('start.sh', startScript);
fs.chmodSync('start.sh', 0o755);

console.log('🎉 Build complete! Production optimizations:');
console.log('   ✅ Binary JSON format with Brotli compression');
console.log('   ✅ Efficient WebSocket binary messaging');
console.log('   ✅ Canvas-based rendering for performance');
console.log('   ✅ Server-side decompression fallback');
console.log(`   ✅ Total payload: ${(totalSize / 1024).toFixed(1)}KB`);
console.log('\n🚀 Run ./start.sh to launch the production server');