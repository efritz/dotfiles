import readline from 'readline';
import { asker } from '../common/ask.mjs';

export async function pipe(model, system) {
    const ask = await asker(model, system);
    const message = await readInput();
    await ask(message, { progress: streamOutput });
    console.log('\n');
}

async function readInput() {
    let message = '';
    const progress = text => { message += text };

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    await new Promise((resolve) => { rl.on('line', progress); rl.once('close', resolve); });
    rl.close();

    return message;
}

function streamOutput(text) {
    process.stdout.write(text);
}
