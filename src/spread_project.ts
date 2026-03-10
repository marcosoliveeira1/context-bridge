import * as fs from 'fs/promises';
import * as path from 'path';

export interface SpreadConfig {
  inputFile: string;
  outputDirectory: string;
  force?: boolean;
}

export class ProjectSpreader {
  constructor(private config: SpreadConfig) { }

  async run(directContent?: string): Promise<number> {
    const outDir = path.resolve(this.config.outputDirectory);

    let content = "";
    if (directContent !== undefined && directContent !== null) {
      content = directContent;
    } else if (this.config.inputFile) {
      const inputPath = path.resolve(this.config.inputFile);
      content = await fs.readFile(inputPath, 'utf8');
    }

    if (!content) {
      return 0;
    }

    const regex = /--- START: (.*?) ---\r?\n([\s\S]*?)\r?\n--- END: \1 ---/gm;
    let match;
    let created = 0;

    while ((match = regex.exec(content)) !== null) {
      const relPath = match[1].trim();
      let fileContent = match[2];

      // Sanitização: remove blocos de código markdown apenas se envolverem o conteúdo total
      fileContent = fileContent.replace(/^(\s*```[a-zA-Z]*\r?\n)/, "").replace(/(\r?\n\s*```\s*)$/, "").replaceAll("```", ""); // Remove blocos de código markdown

      const targetPath = path.resolve(outDir, relPath);

      if (!targetPath.startsWith(outDir)) {
        console.warn(`[Security] Bloqueada tentativa de escrita fora do workspace: ${relPath}`);
        continue;
      }

      try {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, fileContent, 'utf8');
        created++;
      } catch (err) {
        console.error(`Erro ao gravar ficheiro ${relPath}:`, err);
      }
    }

    return created;


  }
}