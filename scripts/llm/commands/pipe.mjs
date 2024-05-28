import readline from 'readline';
import { createAsker } from '../common/ask.mjs';

export async function pipe(model, system) {
    const { ask } = await createAsker(model, system);
    const message = await readInput();

    await ask(message, { progress: text => process.stdout.write(text) });
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
