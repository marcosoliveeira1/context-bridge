const esbuild = require("esbuild");
const { globSync } = require("glob");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
    // Pegamos todos os arquivos .ts de src e src/test
    const entryPoints = globSync('src/**/*.ts').filter(f => !f.endsWith('.d.ts'));

    const ctx = await esbuild.context({
        entryPoints,
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        platform: 'node',
        outdir: 'out',
        external: ['vscode'],
        logLevel: 'info',
    });

    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }


}

main().catch(e => {
    console.error(e);
    process.exit(1);
});