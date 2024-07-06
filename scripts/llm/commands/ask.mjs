import { readFileSync } from 'fs';
import { createAsker } from '../common/ask.mjs';
import { readInput } from '../common/input.mjs';

const system = readFileSync('system_prompts/ask.txt', 'utf-8');

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
