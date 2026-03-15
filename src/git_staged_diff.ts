import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function getGitStagedDiff(projectRoot: string): Promise<string> {
    try {
        const { stdout } = await execFileAsync('git', ['diff', '--staged'], {
            cwd: projectRoot,
            maxBuffer: 10 * 1024 * 1024
        });

        if (!stdout || !stdout.trim()) {
            return '';
        }

        return stdout;
    } catch {
        return '';
    }
}