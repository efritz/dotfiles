import readline from 'readline';
import { createAsker } from '../common/ask.mjs';

const system = `
You are an AI assistant.
`;

export async function ask(prompt, model) {
    const { ask, pushMessage } = await createAsker(model, system);

    if (!process.stdin.setRawMode) {
        const message = await readInput();
        pushMessage(`<context>${message}</context>`);
    }

    await ask(prompt, { progress: streamOutput });
    console.log('\n');
}

async function readInput() {
    let message = '';
    await streamInput(text => { message += text });
    return message;
}

async function streamInput(progress) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });

    await new Promise((resolve) => { rl.on('line', progress); rl.once('close', resolve); });
    rl.close();
}

function streamOutput(text) {
    process.stdout.write(text);
}
