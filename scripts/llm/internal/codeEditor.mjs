import chokidar from 'chokidar';
import { randomBytes } from 'crypto';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { CancelError } from './errors.mjs';
import { setSigintHandler, clearSigintHandler } from './sigint.mjs';

export async function edit(content) {
    const suffix = randomBytes(16).toString('hex');
    const tempPath = `/tmp/llm-code-${suffix}`;
    writeFileSync(tempPath, content);

    const watcher = chokidar.watch(tempPath, {
        persistent: true,
        ignoreInitial: true,
    });

    try {
        return await new Promise((resolve, reject) => {
            setSigintHandler(() => {
                reject(new CancelError('User canceled edit'));
            });

            watcher.on('change', () => {
                const newContent = readFileSync(tempPath, 'utf-8');
                if (newContent !== content) {
                    resolve(newContent);
                }
            });

            const editor = $`e ${tempPath}`;
            editor.catch((error) => reject(new Error(`Failed to open editor: ${error.message}`)));
        });
    } finally {
        watcher.close();
        unlinkSync(tempPath);
        clearSigintHandler();
    }
}
