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

  constructor(private config: CompileConfig) { }

  private async isBinary(filePath: string): Promise<boolean> {
    let fileHandle;
    try {
      fileHandle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(512);
      const { bytesRead } = await fileHandle.read(buffer, 0, 512, 0);
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) { return true; }
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      if (fileHandle) { await fileHandle.close(); }
    }
  }

  private async loadProjectConfig() {
    const configPath = path.join(this.config.projectRoot, '.compiladorai');
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const projectConfig = JSON.parse(content);

      if (projectConfig.exclude && Array.isArray(projectConfig.exclude)) {
        projectConfig.exclude.forEach((item: string) => {
          this.defaultDirs.add(item.trim());
          this.defaultFiles.add(item.trim());
        });
      }
    } catch (e) { }


  }

  private async *walk(dir: string): AsyncIterable<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const res = path.resolve(dir, entry.name);
      if (this.defaultDirs.has(entry.name)) { continue; }

      if (entry.isDirectory()) {
        yield* this.walk(res);
      } else {
        yield res;
      }
    }


  }

  async run(): Promise<{ content: string; count: number }> {
    await this.loadProjectConfig();
    const root = path.resolve(this.config.projectRoot);
    const targetExt = this.config.fileExtension?.toLowerCase();

    let combined = "";
    let count = 0;

    for await (const filePath of this.walk(root)) {
      const relPath = path.relative(root, filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (this.defaultFiles.has(fileName.toLowerCase())) { continue; }
      if (targetExt && ext !== targetExt) { continue; }
      if (this.BINARY_EXTS.has(ext)) { continue; }

      if (await this.isBinary(filePath)) { continue; }

      try {
        const content = await fs.readFile(filePath, 'utf8');
        combined += `--- START: ${relPath} ---\n${content}\n--- END: ${relPath} ---\n\n`;
        count++;
      } catch (e) {
        console.error(`Erro ao ler ${relPath}: `, e);
      }
    }

    const finalContent = combined.trimEnd();

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

    return { content: finalContent, count };


  }
}