import * as fs from 'fs/promises';
import * as path from 'path';

export interface CompileConfig {
  projectRoot: string;
  outputFile: string;
  customExcludedItems?: string[];
  fileExtension?: string;
}

export class ProjectCompiler {
  private defaultDirs = new Set([
    "node_modules", "vendor", ".git", "dist", "build", "out", "target", "logs", ".vscode"
  ]);

  private defaultFiles = new Set([
    "package-lock.json", "pnpm-lock.yaml", ".env", "input.txt", "bun.lockb"
  ]);

  private readonly BINARY_EXTS = new Set(['.png', '.jpg', '.zip', '.exe', '.pdf', '.woff2', '.ico']);

  constructor(private config: CompileConfig) { }

  private async loadProjectConfig() {
    const configPath = path.join(this.config.projectRoot, '.compiladorai');
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const projectConfig = JSON.parse(content);


      if (projectConfig.exclude && Array.isArray(projectConfig.exclude)) {
        projectConfig.exclude.forEach((item: string) => {
          this.defaultDirs.add(item);
          this.defaultFiles.add(item);
        });
      }
    } catch (e) {
      // Arquivo opcional, se não existir segue com o padrão
    }



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

  async run(): Promise<number> {
    await this.loadProjectConfig(); // Carrega configs customizadas antes de rodar


    const root = path.resolve(this.config.projectRoot);
    const output = path.resolve(this.config.outputFile);
    const targetExt = this.config.fileExtension?.toLowerCase();

    let combined = "";
    let count = 0;

    await fs.mkdir(path.dirname(output), { recursive: true });

    for await (const filePath of this.walk(root)) {
      if (filePath === output) { continue; }

      const relPath = path.relative(root, filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (this.defaultFiles.has(fileName.toLowerCase())) { continue; }
      if (targetExt && ext !== targetExt) { continue; }
      if (this.BINARY_EXTS.has(ext)) { continue; }

      try {
        const content = await fs.readFile(filePath, 'utf8');
        combined += `--- START: ${relPath} ---\n${content}\n--- END: ${relPath} ---\n\n`;
        count++;
      } catch (e) {
        console.error(`Erro ao ler ${relPath}: `, e);
      }
    }

    await fs.writeFile(output, combined.trimEnd(), 'utf8');
    return count;



  }
}