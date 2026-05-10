import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Pull versionName + versionCode from the single source of truth: android/app/build.gradle.
// At CI time the bump step rewrites versionCode BEFORE `npm run build` runs,
// so this always reflects the actual AAB the user will install.
const gradle = readFileSync(resolve(__dirname, 'android/app/build.gradle'), 'utf8');
const versionName = (gradle.match(/versionName\s+"([^"]+)"/)  || [, '0.0'])[1];
const versionCode = (gradle.match(/versionCode\s+(\d+)/)      || [, '0'  ])[1];

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  define: {
    __APP_VERSION__:  JSON.stringify(versionName),
    __VERSION_CODE__: JSON.stringify(versionCode),
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    root: 'src',
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: '../coverage',
      include: [
        'game/gameState.js',
        'game/seedEngine.js',
        'game/wordleMechanic.js',
        'game/transliterator.js',
        'i18n.js',
      ],
      exclude: [
        // Browser-only / canvas / screen code — not unit-testable
        'game/shareImage.js',
        'game/wordDb.js',
        'components/**',
        'screens/**',
        'main.js',
        'feedback.js',
        'notifications.js',
      ],
      thresholds: {
        lines:     80,
        functions: 80,
        branches:  80,
        statements: 80,
      },
    },
  },
});
