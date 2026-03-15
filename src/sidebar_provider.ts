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

		let existingIgnoreFiles = "";
		let existingIgnoreFolders = "";
		let existingLogEnabled = false;
		const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (workspace) {
			const configCandidates = [
				path.join(workspace, '.compile_history', '.compiladorai'),
				path.join(workspace, '.compiladorai')
			];
			const configPath = configCandidates.find(candidate => fs.existsSync(candidate));
			if (configPath) {
				try {
					const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
					if (Array.isArray(config.ignoreFiles)) {
						existingIgnoreFiles = config.ignoreFiles.join(', ');
					}
					if (Array.isArray(config.ignoreFolders)) {
						existingIgnoreFolders = config.ignoreFolders.join(', ');
					}
					if (Array.isArray(config.exclude)) {
						if (!existingIgnoreFiles) { existingIgnoreFiles = config.exclude.join(', '); }
						if (!existingIgnoreFolders) { existingIgnoreFolders = config.exclude.join(', '); }
					}
					if (typeof config.logEnabled === 'boolean') {
						existingLogEnabled = config.logEnabled;
					}
				} catch (e) { }
			}
		}

		webviewView.webview.html = this._getHtmlForWebview(existingIgnoreFiles, existingIgnoreFolders, existingLogEnabled);

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case "onCompile":
					const result = await vscode.commands.executeCommand<{ content: string; files: string[] }>("project.compileProject", {
						versioned: data.versioned,
						logEnabled: data.logEnabled
					});
					if (result) {
						webviewView.webview.postMessage({ type: 'compileResult', value: result.content, files: result.files });
					}
					break;
				case "onListLargeFiles":
					const largeFilesResult = await vscode.commands.executeCommand<{ content: string; files: Array<{ path: string; lines: number }> }>("project.listLargeFiles", {
						minLines: data.minLines,
						relativeRoot: data.relativeRoot,
						logEnabled: data.logEnabled
					});
					if (largeFilesResult) {
						webviewView.webview.postMessage({ type: 'largeFilesResult', value: largeFilesResult.content, files: largeFilesResult.files });
					}
					break;
				case "onSpread":
					const count = await vscode.commands.executeCommand<number>("project.spreadProject", {
						content: data.content,
						logEnabled: data.logEnabled
					});
					webviewView.webview.postMessage({ type: 'spreadFinished', count: count || 0 });
					break;
				case "onSaveConfig":
					vscode.commands.executeCommand("project.saveConfig", {
						ignoreFiles: data.ignoreFiles,
						ignoreFolders: data.ignoreFolders,
						logEnabled: data.logEnabled
					});
					break;
			}
		});
	}

	private _getHtmlForWebview(ignoreFiles: string, ignoreFolders: string, logEnabled: boolean) {
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
input[type="text"], input[type="number"] {
background: var(--vscode-input-background);
color: var(--vscode-input-foreground);
border: 1px solid var(--vscode-input-border);
padding: 4px 6px;
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
details {
border: 1px solid var(--vscode-panel-border);
border-radius: 4px;
padding: 6px;
}
summary {
cursor: pointer;
font-weight: 600;
font-size: 12px;
outline: none;
}
.content { margin-top: 10px; }
</style>
</head>
<body>
<details open>
	<summary>1. Entrada</summary>
	<div class="section content">
		<textarea id="inputSpread" placeholder="Cole aqui a resposta da IA..."></textarea>
		<button id="btnSpread" onclick="spread()">📂 Espalhar no Projeto</button>
	</div>
</details>

<details open>
	<summary>2. Saída</summary>
	<div class="section content">
		<div class="row">
			<input type="checkbox" id="versioned" checked>
			<label for="versioned" style="text-transform: none; font-weight: normal; opacity: 1;">Salvar em .compile_history</label>
		</div>
		<button id="btnCompile" onclick="compile()">🚀 Gerar Contexto (Compile)</button>
		<textarea id="outputCompile" readonly placeholder="O resultado da compilação aparecerá aqui..."></textarea>
		<button class="secondary" onclick="copyCompileOutput()">📋 Copiar Contexto</button>
	</div>
</details>

<details>
	<summary>3. Arquivos Longos</summary>
	<div class="section content">
		<div class="row">
			<label for="largeFilesRoot" style="text-transform: none; font-weight: normal; opacity: 1; min-width: 56px;">Pasta</label>
			<input id="largeFilesRoot" type="text" value="src" style="flex: 1;" />
		</div>
		<div class="row">
			<label for="largeFilesMinLines" style="text-transform: none; font-weight: normal; opacity: 1; min-width: 56px;">Mín. linhas</label>
			<input id="largeFilesMinLines" type="number" min="1" value="100" style="width: 120px;" />
		</div>
		<button id="btnLargeFiles" class="secondary" onclick="listLargeFiles()">📏 Listar arquivos longos</button>
		<textarea id="outputLargeFiles" readonly placeholder="A lista de arquivos longos aparecerá aqui..."></textarea>
		<button class="secondary" onclick="copyLargeFilesOutput()">📋 Copiar Lista</button>
	</div>
</details>

<details>
	<summary>4. Configs Gerais</summary>
	<div class="section content">
		<div class="row">
			<input type="checkbox" id="logEnabled">
			<label for="logEnabled" style="text-transform: none; font-weight: normal; opacity: 1;">Ativar logs (Compile, Spread e Arquivos Longos)</label>
		</div>
		<label style="text-transform: none; font-weight: normal; opacity: 1;">Arquivos para ignorar</label>
		<textarea id="ignoreFilesList" style="min-height: 50px;" placeholder="Ex: .env, package-lock.json, src/types/generated.ts">${ignoreFiles}</textarea>
		<label style="text-transform: none; font-weight: normal; opacity: 1;">Pastas para ignorar</label>
		<textarea id="ignoreFoldersList" style="min-height: 50px;" placeholder="Ex: dist, src/db/generated/prisma">${ignoreFolders}</textarea>
		<button class="secondary" onclick="saveConfig()">💾 Guardar em .compile_history/.compiladorai</button>
	</div>
</details>

<script>
	const vscode = acquireVsCodeApi();
	const oldState = vscode.getState() || {
		input: '',
		outputCompile: '',
		outputLargeFiles: '',
		ignoreFiles: '${ignoreFiles.replace(/'/g, "\\'")}',
		ignoreFolders: '${ignoreFolders.replace(/'/g, "\\'")}',
		largeFilesRoot: 'src',
		largeFilesMinLines: '100',
		logEnabled: ${logEnabled ? 'true' : 'false'}
	};
	
	const inputSpread = document.getElementById('inputSpread');
	const outputCompile = document.getElementById('outputCompile');
	const outputLargeFiles = document.getElementById('outputLargeFiles');
	const ignoreFilesList = document.getElementById('ignoreFilesList');
	const ignoreFoldersList = document.getElementById('ignoreFoldersList');
	const largeFilesRoot = document.getElementById('largeFilesRoot');
	const largeFilesMinLines = document.getElementById('largeFilesMinLines');
	const logEnabled = document.getElementById('logEnabled');
	const btnCompile = document.getElementById('btnCompile');
	const btnSpread = document.getElementById('btnSpread');
	const btnLargeFiles = document.getElementById('btnLargeFiles');

	// Restaurar estado
	inputSpread.value = oldState.input || '';
	outputCompile.value = oldState.outputCompile || oldState.output || '';
	outputLargeFiles.value = oldState.outputLargeFiles || '';
	if(oldState.ignoreFiles) ignoreFilesList.value = oldState.ignoreFiles;
	if(oldState.ignoreFolders) ignoreFoldersList.value = oldState.ignoreFolders;
	if(oldState.largeFilesRoot) largeFilesRoot.value = oldState.largeFilesRoot;
	if(oldState.largeFilesMinLines) largeFilesMinLines.value = oldState.largeFilesMinLines;
	logEnabled.checked = Boolean(oldState.logEnabled);

	function updateState() {
		vscode.setState({
			input: inputSpread.value,
			outputCompile: outputCompile.value,
			outputLargeFiles: outputLargeFiles.value,
			ignoreFiles: ignoreFilesList.value,
			ignoreFolders: ignoreFoldersList.value,
			largeFilesRoot: largeFilesRoot.value,
			largeFilesMinLines: largeFilesMinLines.value,
			logEnabled: logEnabled.checked
		});
	}

	inputSpread.addEventListener('input', updateState);
	outputCompile.addEventListener('input', updateState);
	outputLargeFiles.addEventListener('input', updateState);
	ignoreFilesList.addEventListener('input', updateState);
	ignoreFoldersList.addEventListener('input', updateState);
	largeFilesRoot.addEventListener('input', updateState);
	largeFilesMinLines.addEventListener('input', updateState);
	logEnabled.addEventListener('change', updateState);

	function compile() {
		const versioned = document.getElementById('versioned').checked;
		const logsEnabled = logEnabled.checked;
		btnCompile.disabled = true;
		btnCompile.innerText = "A processar...";
		vscode.postMessage({ type: 'onCompile', versioned, logEnabled: logsEnabled });
	}

	function listLargeFiles() {
		const relativeRoot = (largeFilesRoot.value || 'src').trim();
		const minLines = Number.parseInt(largeFilesMinLines.value || '100', 10);
		const logsEnabled = logEnabled.checked;
		btnLargeFiles.disabled = true;
		btnLargeFiles.innerText = "A processar...";
		vscode.postMessage({ type: 'onListLargeFiles', relativeRoot, minLines, logEnabled: logsEnabled });
	}

	function spread() {
		if(!inputSpread.value.trim()) return;
		const logsEnabled = logEnabled.checked;
		btnSpread.disabled = true;
		vscode.postMessage({ type: 'onSpread', content: inputSpread.value, logEnabled: logsEnabled });
	}

	function copyCompileOutput() {
		outputCompile.select();
		document.execCommand('copy');
		outputCompile.value = '';
		updateState();
	}

	function copyLargeFilesOutput() {
		outputLargeFiles.select();
		document.execCommand('copy');
		outputLargeFiles.value = '';
		updateState();
	}

	function saveConfig() {
		vscode.postMessage({
			type: 'onSaveConfig',
			ignoreFiles: ignoreFilesList.value,
			ignoreFolders: ignoreFoldersList.value,
			logEnabled: logEnabled.checked
		});
	}

	window.addEventListener('message', event => {
		const m = event.data;
		if (m.type === 'compileResult') {
			outputCompile.value = m.value;
			btnCompile.disabled = false;
			btnCompile.innerText = "🚀 Gerar Contexto (Compile)";
			updateState();
		}
		if (m.type === 'largeFilesResult') {
			outputLargeFiles.value = m.value;
			btnLargeFiles.disabled = false;
			btnLargeFiles.innerText = "📏 Listar arquivos longos";
			updateState();
		}
		if (m.type === 'spreadFinished') {
			if (m.count > 0) {
				inputSpread.value = '';
			}
			btnSpread.disabled = false;
			updateState();
		}
	});
</script>
</body>
</html>`;
	}
}