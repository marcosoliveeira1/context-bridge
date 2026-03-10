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

  // COMANDO SALVAR CONFIG
  context.subscriptions.push(vscode.commands.registerCommand("project.saveConfig", async (config: { exclude: string }) => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspace) { return; }


    const configPath = path.join(workspace, '.compiladorai');
    const excludeArray = config.exclude.split(',').map(s => s.trim()).filter(s => s.length > 0);

    try {
      await fs.writeFile(configPath, JSON.stringify({ exclude: excludeArray }, null, 2), 'utf8');
      vscode.window.showInformationMessage("Configuração salva em .compiladorai");
    } catch (err: any) {
      vscode.window.showErrorMessage(`Erro ao salvar config: ${err.message}`);
    }



  }));

  // COMANDO COMPILE
  context.subscriptions.push(vscode.commands.registerCommand("project.compileProject", async (params) => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspace) { return; }


    let outPath = params?.outputFile || "logs/project_out.txt";

    if (params?.versioned) {
      const ext = path.extname(outPath);
      const base = outPath.replace(ext, "");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      outPath = `${base}_${timestamp}${ext}`;
    }

    const fullOutputPath = path.isAbsolute(outPath) ? outPath : path.join(workspace, outPath);

    const compiler = new ProjectCompiler({
      projectRoot: workspace,
      outputFile: fullOutputPath
    });

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Compilando...",
      cancellable: false
    }, async () => {
      const count = await compiler.run();
      vscode.window.showInformationMessage(`Compilado: ${count} arquivos em ${path.basename(fullOutputPath)}`);
      const doc = await vscode.workspace.openTextDocument(fullOutputPath);
      await vscode.window.showTextDocument(doc);
    });



  }));

  // COMANDO SPREAD
  context.subscriptions.push(vscode.commands.registerCommand("project.spreadProject", async (params) => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspace) { return; }


    const inPath = params?.inputFile || "logs/project_in.txt";
    const fullInputPath = path.isAbsolute(inPath) ? inPath : path.join(workspace, inPath);

    const spreader = new ProjectSpreader({
      inputFile: fullInputPath,
      outputDirectory: workspace,
      force: true
    });

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Espalhando...",
        cancellable: false
      }, async () => {
        const count = await spreader.run();
        vscode.window.showInformationMessage(`Sucesso: ${count} arquivos extraídos.`);
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Erro: ${err.message}`);
    }



  }));
}