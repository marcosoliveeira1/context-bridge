import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ProjectCompiler } from '../compile_project';
import { ProjectSpreader } from '../spread_project';

suite('Context Bridge Test Suite', () => {
	const testWorkspace = path.resolve(__dirname, '../../test-fixtures');

	setup(async () => {
		await fs.mkdir(testWorkspace, { recursive: true });
	});

	teardown(async () => {
		await fs.rm(testWorkspace, { recursive: true, force: true });
	});

	test('Compiler: Should ignore default directories', async () => {
		const nodeModules = path.join(testWorkspace, 'node_modules');
		const srcFile = path.join(testWorkspace, 'index.ts');
		const outFile = path.join(testWorkspace, 'out.txt');

		await fs.mkdir(nodeModules, { recursive: true });
		await fs.writeFile(srcFile, 'console.log("hello")', 'utf8');
		await fs.writeFile(path.join(nodeModules, 'ignore.js'), 'ignore me', 'utf8');

		const compiler = new ProjectCompiler({
			projectRoot: testWorkspace,
			outputFile: outFile
		});

		const count = await compiler.run();
		const content = await fs.readFile(outFile, 'utf8');

		assert.strictEqual(count, 1, 'Deveria ter compilado apenas 1 arquivo');
		assert.ok(content.includes('--- START: index.ts ---'));
		assert.ok(!content.includes('node_modules'), 'Não deveria incluir arquivos do node_modules');
	});

	test('Spreader: Should extract files correctly and prevent path traversal', async () => {
		const inputFile = path.join(testWorkspace, 'input.txt');
		const maliciousContent = `


--- START: safe.ts ---
const a = 1;
--- END: safe.ts ---

--- START: ../../evil.txt ---
hacked
--- END: ../../evil.txt ---
`;
		await fs.writeFile(inputFile, maliciousContent, 'utf8');

		const spreader = new ProjectSpreader({
			inputFile,
			outputDirectory: testWorkspace,
			force: true
		});

		const count = await spreader.run();

		const safeExists = await fs.access(path.join(testWorkspace, 'safe.ts')).then(() => true).catch(() => false);
		const evilExists = await fs.access(path.resolve(testWorkspace, '../../evil.txt')).then(() => true).catch(() => false);

		assert.strictEqual(count, 1, 'Deveria ter extraído apenas o arquivo seguro');
		assert.ok(safeExists, 'Arquivo seguro deveria existir');
		assert.ok(!evilExists, 'Tentativa de Path Traversal deveria ter falhado');
	});


});