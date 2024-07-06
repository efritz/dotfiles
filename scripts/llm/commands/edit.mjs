import { readFileSync } from 'fs';
import { readInput } from '../internal/input.mjs';
import { createAsker } from '../internal/models.mjs';
import { editString } from '../internal/todoEditor.mjs';

const system = readFileSync('system_prompts/edit.txt', 'utf-8');

export async function edit(model, filename) {
    const { ask } = await createAsker(model, system);

    if (!process.stdin.setRawMode) {
        const rawContents = await readInput();
        const newContents = await editString(rawContents, ask);
        process.stdout.write(newContents);
        return;
    }

    const rawContents = await readFile(filename, 'utf-8');
    const newContents = await editString(rawContents, ask);
    await fs.writeFile(filename, newContents, 'utf-8');
}
