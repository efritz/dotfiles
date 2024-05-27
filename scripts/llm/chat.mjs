#!/usr/bin/env zx

import { program } from 'commander';
import readline from 'readline';
import { asker, models } from './ask.mjs';

const system = `
You are a terminal-based assistant used for quick questions and research.
`

async function main() {
    const { model } = parseArgs();
    const ask = await asker(model, system);

    console.log(`Chatting with ${model}...\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
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
    program
        .name('chat')
        .description('LLM chat on the command line.')
        .allowExcessArguments(false)
        .option(
            '-m, --model <string>',
            `Model to use for chatbot. Defaults to gpt-4o. Valid options are ${Object.keys(models).sort().join(', ')}.`,
            'gpt-4o',
        );

    // argv = node zx ./chat.mjs [...]
    program.parse(process.argv.slice(1));
    const options = program.opts();

    return { ...options };
}

await main();
