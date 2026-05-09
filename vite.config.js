import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
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
