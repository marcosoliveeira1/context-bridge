import * as fs from 'fs/promises';
import * as path from 'path';

export interface CompileConfig {
  projectRoot: string;
  outputFile: string;
  fileExtension?: string;
  saveToHistory?: boolean;
}

export class ProjectCompiler {
  private defaultDirs = new Set([
    "node_modules", "vendor", ".git", "dist", "build", "out", "target", "logs", ".vscode", ".compile_history"
  ]);

  private defaultFiles = new Set([
    "package-lock.json", "pnpm-lock.yaml", ".env", "bun.lockb", "composer.lock"
  ]);

  private readonly BINARY_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.zip', '.exe', '.pdf', '.woff', '.woff2',
    '.ico', '.svg', '.eot', '.ttf', '.mp4', '.mp3', '.obj', '.dll', '.so', '.dylib'
  ]);

  private ignoreFolderNames = new Set<string>();
  private ignoreFolderPaths = new Set<string>();
  private ignoreFileNames = new Set<string>();
  private ignoreFilePaths = new Set<string>();

  constructor(private config: CompileConfig) { }

  private configLoaded = false;

  private normalizePattern(value: string): string {
    return value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  }

  private addFolderPattern(value: string) {
    const normalized = this.normalizePattern(value);
    if (!normalized) { return; }

    if (normalized.includes('/')) {
      this.ignoreFolderPaths.add(normalized);
      return;
    }

    this.ignoreFolderNames.add(normalized);
  }

  private addFilePattern(value: string) {
    const normalized = this.normalizePattern(value);
    if (!normalized) { return; }

    if (normalized.includes('/')) {
      this.ignoreFilePaths.add(normalized);
      return;
    }

    this.ignoreFileNames.add(normalized.toLowerCase());
  }

  private shouldIgnoreDirectory(entryName: string, relPath: string): boolean {
    if (this.defaultDirs.has(entryName) || this.ignoreFolderNames.has(entryName)) {
      return true;
    }

    for (const pattern of this.ignoreFolderPaths) {
      if (relPath === pattern || relPath.startsWith(`${pattern}/`)) {
        return true;
      }
    }

    return false;
  }

  private shouldIgnoreFile(fileName: string, relPath: string): boolean {
    const lowerFileName = fileName.toLowerCase();

    if (this.defaultFiles.has(lowerFileName) || this.ignoreFileNames.has(lowerFileName)) {
      return true;
    }

    for (const pattern of this.ignoreFilePaths) {
      if (relPath === pattern) {
        return true;
      }
    }

    return false;
  }

  private async loadProjectConfig() {
    if (this.configLoaded) {
      return;
    }

    const configCandidates = [
      path.join(this.config.projectRoot, '.compile_history', '.compiladorai'),
      path.join(this.config.projectRoot, '.compiladorai')
    ];

    for (const configPath of configCandidates) {
      try {
        const content = await fs.readFile(configPath, 'utf8');
        const projectConfig = JSON.parse(content);

        if (projectConfig.ignoreFolders && Array.isArray(projectConfig.ignoreFolders)) {
          projectConfig.ignoreFolders.forEach((item: string) => {
            this.addFolderPattern(item);
          });
        }

        if (projectConfig.ignoreFiles && Array.isArray(projectConfig.ignoreFiles)) {
          projectConfig.ignoreFiles.forEach((item: string) => {
            this.addFilePattern(item);
          });
        }

        if (projectConfig.exclude && Array.isArray(projectConfig.exclude)) {
          projectConfig.exclude.forEach((item: string) => {
            this.addFolderPattern(item);
            this.addFilePattern(item);
          });
        }

        this.configLoaded = true;
        return;
      } catch (e) { }
    }

    this.configLoaded = true;


  }

  private async *iterEligibleFiles(scanRoot: string, targetExt?: string): AsyncIterable<{ filePath: string; relPath: string }> {
    for await (const filePath of this.walk(scanRoot)) {
      const relPath = path.relative(this.config.projectRoot, filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const normalizedRelPath = this.normalizePattern(relPath);

      if (this.shouldIgnoreFile(fileName, normalizedRelPath)) { continue; }
      if (targetExt && ext !== targetExt) { continue; }
      if (this.BINARY_EXTS.has(ext)) { continue; }

      yield { filePath, relPath };
    }
  }

  private countLines(content: string): number {
    if (!content) {
      return 0;
    }

    return content.split(/\r?\n/).length;
  }

  async listFilesByMinLines(minLines: number, relativeRoot?: string): Promise<Array<{ path: string; lines: number }>> {
    await this.loadProjectConfig();

    const root = path.resolve(this.config.projectRoot);
    const scanRoot = relativeRoot ? path.resolve(root, relativeRoot) : root;

    if (!scanRoot.startsWith(root)) {
      return [];
    }

    let stats;
    try {
      stats = await fs.stat(scanRoot);
    } catch {
      return [];
    }

    if (!stats.isDirectory()) {
      return [];
    }

    const matches: Array<{ path: string; lines: number }> = [];

    for await (const { filePath, relPath } of this.iterEligibleFiles(scanRoot)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = this.countLines(content);
        if (lines > minLines) {
          matches.push({ path: relPath, lines });
        }
      } catch (e) {
        console.error(`Erro ao ler ${relPath}: `, e);
      }
    }

    matches.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
    return matches;
  }

  private async *walk(dir: string): AsyncIterable<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const res = path.resolve(dir, entry.name);
      const relPath = this.normalizePattern(path.relative(this.config.projectRoot, res));
      if (this.shouldIgnoreDirectory(entry.name, relPath)) { continue; }

      if (entry.isDirectory()) {
        yield* this.walk(res);
      } else {
        yield res;
      }
    }


  }

  async run(): Promise<{ content: string; count: number; files: string[] }> {
    await this.loadProjectConfig();
    const root = path.resolve(this.config.projectRoot);
    const targetExt = this.config.fileExtension?.toLowerCase();

    const parts: string[] = [];
    let count = 0;
    const files: string[] = [];

    for await (const { filePath, relPath } of this.iterEligibleFiles(root, targetExt)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        parts.push(
          `--- START: ${relPath} ---\n${content}\n--- END: ${relPath} ---\n`
        );
        files.push(relPath);
        count++;
        console.log(`Adicionado: ${relPath}`);
      } catch (e) {
        console.error(`Erro ao ler ${relPath}: `, e);
      }
    }

    const finalContent = parts.join("\n");

    if (this.config.saveToHistory && finalContent) {
      const historyDir = path.join(this.config.projectRoot, '.compile_history');
      await fs.mkdir(historyDir, { recursive: true });
      const gitignorePath = path.join(historyDir, '.gitignore');
      try {
        await fs.writeFile(gitignorePath, 'project_**.txt', 'utf8');
      } catch (e) { }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const historyPath = path.join(historyDir, `project_${timestamp}.txt`);
      await fs.writeFile(historyPath, finalContent, 'utf8');
    }

    return { content: finalContent, count, files };


  }
}