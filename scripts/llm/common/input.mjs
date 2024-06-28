import readline from 'readline';

export async function readInput() {
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
