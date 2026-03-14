import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class SidebarProvider implements vscode.WebviewViewProvider {
	constructor(private readonly _extensionUri: vscode.Uri) { }

	public resolveWebviewView(webviewView: vscode.WebviewView) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

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
					const result = await vscode.commands.executeCommand<{ content: string; files: string[] }>("project.compileProject", {
						versioned: data.versioned,
						logCompiledFiles: data.logCompiledFiles
					});
					if (result) {
						webviewView.webview.postMessage({ type: 'compileResult', value: result.content, files: result.files });
					}
					break;
				case "onSpread":
					const count = await vscode.commands.executeCommand<number>("project.spreadProject", { content: data.content });
					if (count && count > 0) {
						webviewView.webview.postMessage({ type: 'spreadSuccess' });
					}
					break;
				case "onSaveConfig":
					vscode.commands.executeCommand("project.saveConfig", { exclude: data.exclude });
					break;
			}
		});
	}

	private _getHtmlForWebview(excludes: string) {
		return `<!DOCTYPE html>


<html lang="pt-pt">
<head>
<meta charset="UTF-8">
<style>
body { font-family: var(--vscode-font-family); padding: 12px; color: var(--vscode-foreground); display: flex; flex-direction: column; gap: 15px; }
.section { display: flex; flex-direction: column; gap: 8px; }
label { font-size: 11px; font-weight: 600; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }
textarea {
width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground);
border: 1px solid var(--vscode-input-border); font-family: var(--vscode-editor-font-family);
font-size: 12px; min-height: 120px; resize: vertical; box-sizing: border-box; padding: 8px;
}
textarea:focus { outline: 1px solid var(--vscode-focusBorder); border-color: transparent; }
button {
cursor: pointer; padding: 10px; border: none; width: 100%; font-weight: bold;
background: var(--vscode-button-background); color: var(--vscode-button-foreground);
transition: opacity 0.2s;
}
button:hover { background: var(--vscode-button-hoverBackground); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
hr { border: 0; border-top: 1px solid var(--vscode-divider); margin: 5px 0; }
#status { font-size: 10px; color: var(--vscode-charts-green); font-style: italic; display: none; }
</style>
</head>
<body>
<div class="section">
<label>1. Entrada (AI Spread)</label>
<textarea id="inputSpread" placeholder="Cole aqui a resposta da IA..."></textarea>
<button id="btnSpread" onclick="spread()">📂 Espalhar no Projeto</button>
</div>

<hr />

<div class="section">
	<label>2. Saída (Project Context)</label>
	<div class="row">
		<input type="checkbox" id="versioned" checked>
		<label for="versioned" style="text-transform: none; font-weight: normal; opacity: 1;">Salvar em .compile_history</label>
	</div>
	<div class="row">
		<input type="checkbox" id="logCompiledFiles">
		<label for="logCompiledFiles" style="text-transform: none; font-weight: normal; opacity: 1;">Logar nomes dos arquivos compilados</label>
	</div>
	<button id="btnCompile" onclick="compile()">🚀 Gerar Contexto (Compile)</button>
	<textarea id="outputCompile" readonly placeholder="O resultado da compilação aparecerá aqui..."></textarea>
	<button class="secondary" onclick="copyOutput()">📋 Copiar Contexto</button>
</div>

<hr />

<div class="section">
	<label>Configurações (Ignore List)</label>
	<textarea id="excludeList" style="min-height: 50px;" placeholder="Ex: temp, backup, logs...">${excludes}</textarea>
	<button class="secondary" onclick="saveConfig()">💾 Guardar .compiladorai</button>
</div>

<script>
	const vscode = acquireVsCodeApi();
	const oldState = vscode.getState() || { input: '', output: '', excludes: '${excludes.replace(/'/g, "\\'")}' };
	
	const inputSpread = document.getElementById('inputSpread');
	const outputCompile = document.getElementById('outputCompile');
	const excludeList = document.getElementById('excludeList');
	const btnCompile = document.getElementById('btnCompile');
	const btnSpread = document.getElementById('btnSpread');

	// Restaurar estado
	inputSpread.value = oldState.input || '';
	outputCompile.value = oldState.output || '';
	if(oldState.excludes) excludeList.value = oldState.excludes;

	function updateState() {
		vscode.setState({
			input: inputSpread.value,
			output: outputCompile.value,
			excludes: excludeList.value
		});
	}

	inputSpread.addEventListener('input', updateState);
	outputCompile.addEventListener('input', updateState);
	excludeList.addEventListener('input', updateState);

	function compile() {
		const versioned = document.getElementById('versioned').checked;
		const logCompiledFiles = document.getElementById('logCompiledFiles').checked;
		btnCompile.disabled = true;
		btnCompile.innerText = "A processar...";
		vscode.postMessage({ type: 'onCompile', versioned, logCompiledFiles });
	}

	function spread() {
		if(!inputSpread.value.trim()) return;
		btnSpread.disabled = true;
		vscode.postMessage({ type: 'onSpread', content: inputSpread.value });
	}

	function copyOutput() {
		outputCompile.select();
		document.execCommand('copy');
		outputCompile.value = '';
		updateState();
	}

	function saveConfig() {
		vscode.postMessage({ type: 'onSaveConfig', exclude: excludeList.value });
	}

	window.addEventListener('message', event => {
		const m = event.data;
		if (m.type === 'compileResult') {
			outputCompile.value = m.value;
			btnCompile.disabled = false;
			btnCompile.innerText = "🚀 Gerar Contexto (Compile)";
			updateState();
		}
		if (m.type === 'spreadSuccess') {
			inputSpread.value = '';
			btnSpread.disabled = false;
			updateState();
		}
	});
</script>


</body>
</html>`;
	}
}