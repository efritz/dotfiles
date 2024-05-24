#!/usr/bin/env zx

import readline from 'readline';
import { asker } from './ask.mjs';

const system = `
You are a terminal-based assistant used for quick questions and research.
`

async function main() {
    const { model } = parseArgs();
    const ask = await asker(model, system);
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
    });
    const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

    while (true) {
        const userMessage = (await prompt('> ')).trim();

        if (userMessage === 'exit') {
            rl.close();
            break;
        }

        await ask(userMessage, { progress: text => { process.stdout.write(text); }});
        console.log('\n');
    }
}

function parseArgs() {
    // argv = node zx ./chat.mjs [...]
    const model = process.argv[3] || 'gpt-4o'
    return { model }
}

await main();
