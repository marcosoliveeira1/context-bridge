import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
// Aponta para os arquivos compilados pelo esbuild
files: 'out/test/**/*.test.js',
mocha: {
ui: 'tdd',
timeout: 10000
}
});