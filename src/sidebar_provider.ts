import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class SidebarProvider implements vscode.WebviewViewProvider {
	constructor(private readonly _extensionUri: vscode.Uri) { }


	public resolveWebviewView(webviewView: vscode.WebviewView) {
		webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };

		// Tenta carregar config existente para preencher o campo
		let existingExcludes = "";
		const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (workspace) {
			const configPath = path.join(workspace, '.compiladorai');
			if (fs.existsSync(configPath)) {
				try {
					const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
					if (config.exclude) { existingExcludes = config.exclude.join(', '); }
				} catch (e) { }
			}
		}

		webviewView.webview.html = this._getHtmlForWebview(existingExcludes);

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case "onCompile":
					vscode.commands.executeCommand("project.compileProject", data.params);
					break;
				case "onSpread":
					vscode.commands.executeCommand("project.spreadProject", data.params);
					break;
				case "onSaveConfig":
					vscode.commands.executeCommand("project.saveConfig", { exclude: data.exclude });
					break;
			}
		});
	}

	private _getHtmlForWebview(existingExcludes: string) {
		return `<!DOCTYPE html>



<html lang="pt-br">
<head>
<meta charset="UTF-8">
<style>
body { font-family: var(--vscode-font-family); padding: 15px; display: flex; flex-direction: column; gap: 12px; color: var(--vscode-foreground); }
.field { display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; }
label { font-size: 10px; font-weight: bold; text-transform: uppercase; opacity: 0.8; }
input[type="text"], textarea { padding: 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); font-family: inherit; }
textarea { resize: vertical; min-height: 40px; }
button { cursor: pointer; padding: 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; margin-top: 5px; }
button:hover { background: var(--vscode-button-hoverBackground); }
.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.save-btn { font-size: 10px; padding: 4px; margin-top: 2px; }
hr { border: 0; border-top: 1px solid var(--vscode-settings-dropdownBorder); margin: 5px 0; }
</style>
</head>
<body>
<div class="field">
<label>Ignorar (Pastas/Arquivos)</label>
<textarea id="excludeList" placeholder="temp, coverage, .cache">${existingExcludes}</textarea>
<button class="secondary save-btn" onclick="saveConfig()">💾 Salvar no Projeto</button>
</div>


<hr />

<div class="field">
	<label>Arquivo de Saída (Compile)</label>
	<input type="text" id="outputFile" value="logs/project_out.txt">
</div>

<div class="row">
	<input type="checkbox" id="versioned">
	<label for="versioned" style="cursor:pointer">Versionar Output (Timestamp)</label>
</div>

<button onclick="run('onCompile')">🚀 Compilar para IA</button>

<hr />

<div class="field">
	<label>Arquivo de Entrada (Spread)</label>
	<input type="text" id="inputFile" value="logs/project_in.txt">
</div>
<button class="secondary" onclick="run('onSpread')">📂 Espalhar no Projeto</button>

<script>
	const vscode = acquireVsCodeApi();
	function run(type) {
		vscode.postMessage({ 
			type, 
			params: {
				outputFile: document.getElementById('outputFile').value,
				inputFile: document.getElementById('inputFile').value,
				versioned: document.getElementById('versioned').checked
			}
		});
	}
	function saveConfig() {
		vscode.postMessage({
			type: 'onSaveConfig',
			exclude: document.getElementById('excludeList').value
		});
	}
</script>



</body>
</html>`;
	}
}