import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
// Ajustado para olhar tanto em out quanto em dist, dependendo de onde seu esbuild joga
files: 'out/test/**/*.test.js',
mocha: {
ui: 'tdd',
timeout: 20000
}
});