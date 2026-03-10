import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { ProjectCompiler } from "./compile_project";
import { ProjectSpreader } from "./spread_project";
import { SidebarProvider } from "./sidebar_provider";

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("compilador-ai-view", sidebarProvider)
  );

  context.subscriptions.push(vscode.commands.registerCommand("project.saveConfig", async (config: { exclude: string }) => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspace) { return; }
    const configPath = path.join(workspace, '.compiladorai');
    const excludeArray = config.exclude.split(',').map(s => s.trim()).filter(s => s.length > 0);

    try {
      await fs.writeFile(configPath, JSON.stringify({ exclude: excludeArray }, null, 2), 'utf8');
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
      return result.content;
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
        // Agora a assinatura do run aceita o parâmetro corretamente
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