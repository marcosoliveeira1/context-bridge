import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { ProjectCompiler } from "./compile_project";
import { ProjectSpreader } from "./spread_project";
import { SidebarProvider } from "./sidebar_provider";

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  const outputChannel = vscode.window.createOutputChannel("Compilador AI");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "compilador-ai-view",
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  context.subscriptions.push(vscode.commands.registerCommand("project.saveConfig", async (config: { ignoreFiles?: string; ignoreFolders?: string; exclude?: string }) => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspace) { return; }
    const historyDir = path.join(workspace, '.compile_history');
    const configPath = path.join(historyDir, '.compiladorai');

    const parseList = (value?: string) => {
      if (!value) { return []; }
      return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    };

    const ignoreFiles = parseList(config.ignoreFiles || config.exclude);
    const ignoreFolders = parseList(config.ignoreFolders || config.exclude);
    const excludeArray = Array.from(new Set([...ignoreFiles, ...ignoreFolders]));

    try {
      await fs.mkdir(historyDir, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ ignoreFiles, ignoreFolders, exclude: excludeArray }, null, 2), 'utf8');
      vscode.window.showInformationMessage("Configuração salva com sucesso.");
    } catch (err: any) {
      vscode.window.showErrorMessage(`Erro ao salvar: ${err.message}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand("project.compileProject", async (params) => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspace) { return ""; }

    const compiler = new ProjectCompiler({
      projectRoot: workspace,
      outputFile: "",
      saveToHistory: params?.versioned
    });

    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Gerando contexto para IA...",
    }, async () => {
      const result = await compiler.run();
      if (params?.logCompiledFiles && result.files.length > 0) {
        outputChannel.appendLine(`[${new Date().toISOString()}] Arquivos compilados (${result.files.length}):`);
        for (const file of result.files) {
          outputChannel.appendLine(`- ${file}`);
        }
        outputChannel.appendLine("");
        outputChannel.show(true);
      }
      return { content: result.content, files: result.files };
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand("project.spreadProject", async (params: { content?: string }) => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspace) { return 0; }

    const spreader = new ProjectSpreader({
      inputFile: "",
      outputDirectory: workspace,
      force: true
    });

    try {
      return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Espalhando arquivos no projeto...",
      }, async () => {
        const count = await spreader.run(params?.content);
        if (count > 0) {
          vscode.window.showInformationMessage(`Sucesso! ${count} arquivos atualizados.`);
        }
        return count;
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Erro: ${err.message}`);
      return 0;
    }
  }));
}