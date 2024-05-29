import readline from 'readline';
import { createAsker } from '../common/ask.mjs';

export async function ask(system, model) {
    const { ask } = await createAsker(model, system);
    const message = await readInput();
    await ask(message, { progress: streamOutput });
    console.log('\n');
}

async function readInput() {
    if (process.stdin.setRawMode) {
        return '';
    }

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
