import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { ProjectCompiler } from '../compile_project';
import { ProjectSpreader } from '../spread_project';

/**

* REVISÃO SÊNIOR:
* Este teste é 100% isolado. Ele não lê NADA da sua pasta 'test-fixtures'.
* Se o erro de ENOENT persistir após rodar este arquivo, significa que o
* seu ambiente de execução está lendo um arquivo compilado antigo.
*/
suite('Context Bridge Clean Test Suite', () => {
    let tempDir: string;
    setup(async () => {
        // Criamos um workspace fake no sistema temporário do SO
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-clean-test-'));
    });
    teardown(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    test('Compiler: Deve filtrar arquivos corretamente', async () => {
        // Criar cenário
        await fs.writeFile(path.join(tempDir, 'valid.ts'), 'console.log(1)');
        await fs.mkdir(path.join(tempDir, 'node_modules'));
        await fs.writeFile(path.join(tempDir, 'node_modules/bad.ts'), 'console.log(2)');
        const compiler = new ProjectCompiler({
            projectRoot: tempDir,
            outputFile: '',
            saveToHistory: false
        });

        const result = await compiler.run();

        assert.strictEqual(result.count, 1, 'Deveria ignorar o node_modules');
        assert.ok(result.content.includes('valid.ts'));
        assert.ok(!result.content.includes('node_modules'));



    });
    test('Spreader: Deve sanitizar e gravar arquivos', async () => {
        const input = `--- START: new.ts ---\nconst x = 10;\n--- END: new.ts ---`;
        const spreader = new ProjectSpreader({
            inputFile: '',
            outputDirectory: tempDir
        });
        const count = await spreader.run(input);
        assert.strictEqual(count, 1);

        const saved = await fs.readFile(path.join(tempDir, 'new.ts'), 'utf8');
        assert.strictEqual(saved.trim(), 'const x = 10;');



    });
    test('VS Code: Comandos registrados', async () => {
        const extension =
            vscode.extensions.getExtension('undefined_publisher.context-bridge')
            ?? vscode.extensions.all.find(ext => ext.packageJSON?.name === 'context-bridge');

        assert.ok(extension, 'Extensão context-bridge não encontrada no host de testes');

        if (!extension!.isActive) {
            await extension!.activate();
        }

        const cmds = await vscode.commands.getCommands(true);
        assert.ok(cmds.includes('project.compileProject'));
        assert.ok(cmds.includes('project.gitStagedDiff'));
    });
});