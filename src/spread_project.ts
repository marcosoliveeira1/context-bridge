import * as fs from 'fs/promises';
import * as path from 'path';

export interface SpreadConfig {
  inputFile: string;
  outputDirectory: string;
  force?: boolean;
}

export class ProjectSpreader {
  constructor(private config: SpreadConfig) { }

  async run(): Promise<number> {
    const inputPath = path.resolve(this.config.inputFile);
    const outDir = path.resolve(this.config.outputDirectory);


    try {
      const stats = await fs.stat(outDir);
      if (stats.isDirectory()) {
        const files = await fs.readdir(outDir);
        if (files.length > 0 && !this.config.force) {
          throw new Error("Diretório de saída não está vazio. Use force: true.");
        }
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') { throw e; }
    }

    await fs.mkdir(outDir, { recursive: true });
    const content = await fs.readFile(inputPath, 'utf8');

    // Regex ajustada para capturar o conteúdo entre os marcadores corretamente
    const regex = /--- START: (.*?) ---\r?\n([\s\S]*?)\r?\n--- END: \1 ---/gm;
    let match;
    let created = 0;

    while ((match = regex.exec(content)) !== null) {
      const relPath = match[1].trim();
      let fileContent = match[2];

      // Sanitização básica: remove blocos de código markdown que a IA possa ter inserido por vício
      fileContent = fileContent.replace(/\r\n/g, "\n").replaceAll("```", "").trimEnd();

      const targetPath = path.resolve(outDir, relPath);

      // Segurança: impede que o arquivo seja escrito fora do diretório do projeto
      if (!targetPath.startsWith(outDir)) {
        console.warn(`Tentativa de path traversal bloqueada: ${relPath}`);
        continue;
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, fileContent, 'utf8');
      created++;
    }

    return created;

  }
}