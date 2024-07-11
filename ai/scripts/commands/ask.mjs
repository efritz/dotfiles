import { readInput } from '../internal/input.mjs';
import { createAsker } from '../internal/models.mjs';
import { getPrompt } from '../internal/system.mjs';

const system = getPrompt('ask');

export async function ask(prompt, model) {
    const { ask, pushMessage } = await createAsker(model, system);

    if (!process.stdin.setRawMode) {
        const message = await readInput();
        pushMessage(`<context>${message}</context>`);
    }

    await ask(prompt, { progress: streamOutput });
    console.log('\n');
}

function streamOutput(text) {
    process.stdout.write(text);
}
