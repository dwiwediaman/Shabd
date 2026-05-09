#!/usr/bin/env node
// Prevents the namespace/package mismatch crash by ensuring all three sources agree.
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

let errors = 0;

function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`  ✗ ${label}: got "${actual}", expected "${expected}"`);
    errors++;
  } else {
    console.log(`  ✓ ${label}: ${actual}`);
  }
}

// 1. capacitor.config.json appId
const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const capAppId = cap.appId;

// 2. build.gradle namespace + applicationId
const gradle = readFileSync('android/app/build.gradle', 'utf8');
const namespace   = gradle.match(/namespace\s*=\s*"([^"]+)"/)?.[1];
const gradleAppId = gradle.match(/applicationId\s+"([^"]+)"/)?.[1];

// 3. MainActivity.java package declaration (find it dynamically)
const mainActivityPath = execSync(
  'find android/app/src/main/java -name "MainActivity.java"', { encoding: 'utf8' }
).trim();
const javaPackage = readFileSync(mainActivityPath, 'utf8')
  .match(/^package\s+([^;]+);/m)?.[1]?.trim();

console.log('\nShabd config validation:');
check('capacitor appId == gradle applicationId', capAppId, gradleAppId);
check('capacitor appId == gradle namespace',      capAppId, namespace);
check('gradle namespace == MainActivity package', namespace, javaPackage);

if (errors > 0) {
  console.error(`\n❌ ${errors} mismatch(es) found — fix before building\n`);
  process.exit(1);
}
console.log('\n✅ All config values match\n');
