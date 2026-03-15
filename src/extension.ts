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

  context.subscriptions.push(vscode.commands.registerCommand("project.saveConfig", async (config: { ignoreFiles?: string; ignoreFolders?: string; exclude?: string; logEnabled?: boolean }) => {
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
    const logEnabled = Boolean(config.logEnabled);

    try {
      await fs.mkdir(historyDir, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ ignoreFiles, ignoreFolders, exclude: excludeArray, logEnabled }, null, 2), 'utf8');
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
      const shouldLog = Boolean(params?.logEnabled ?? params?.logCompiledFiles);
      if (shouldLog && result.files.length > 0) {
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

  context.subscriptions.push(vscode.commands.registerCommand("project.listLargeFiles", async (params?: { minLines?: number; relativeRoot?: string; logEnabled?: boolean }) => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspace) { return { content: "", files: [] }; }

    const compiler = new ProjectCompiler({
      projectRoot: workspace,
      outputFile: ""
    });

    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Listando arquivos longos...",
    }, async () => {
      const rawMinLines = Number.isFinite(params?.minLines as number) ? Number(params?.minLines) : 100;
      const minLines = Math.max(1, Math.floor(rawMinLines));
      const relativeRoot = (params?.relativeRoot || "src").trim() || "src";
      const files = await compiler.listFilesByMinLines(minLines, relativeRoot);
      const content = files.map(file => `${file.lines} ${file.path}`).join("\n");
      const shouldLog = Boolean(params?.logEnabled);

      if (shouldLog && files.length > 0) {
        outputChannel.appendLine(`[${new Date().toISOString()}] Arquivos com mais de ${minLines} linhas em ${relativeRoot} (${files.length}):`);
        for (const file of files) {
          outputChannel.appendLine(`${file.lines} ${file.path}`);
        }
        outputChannel.appendLine("");
        outputChannel.show(true);
      }

      return { content, files };
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand("project.spreadProject", async (params: { content?: string; logEnabled?: boolean }) => {
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
        if (params?.logEnabled) {
          outputChannel.appendLine(`[${new Date().toISOString()}] Spread executado: ${count} arquivo(s) atualizados.`);
          outputChannel.appendLine("");
          outputChannel.show(true);
        }
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