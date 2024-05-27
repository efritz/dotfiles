#!/usr/bin/env zx

import { program } from 'commander';
import { asker, models } from './common.mjs';
const readline = require('readline');

async function main() {
    const { system, model } = parseArgs();
    let ask = await asker(model, system);

    const message = await readInput();
    await ask(message, { progress: text => { process.stdout.write(text); }});
    console.log('\n');
}

function parseArgs() {
    program
        .name('paipe')
        .description('Ask LLM questions about piped content.')
        .allowExcessArguments(false)
        .requiredOption(
            '-s, --system <string>',
            'The system prompt to use.',
        )
        .option(
            '-m, --model <string>',
            `Model to use for chatbot. Defaults to gpt-4o. Valid options are ${Object.keys(models).sort().join(', ')}.`,
            'gpt-4o',
        );

    // argv = node zx ./paipe.mjs [...]
    program.parse(process.argv.slice(1));
    const options = program.opts();

    if (process.stdin.setRawMode) {
        console.log('error: no stdin input provided.\n')
        program.help({ error: true });
    }

    return { ...options };
}

async function readInput() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    let message = '';
    await new Promise((resolve) => {
        rl.on('line', (line) => { message += line; });
        rl.once('close', resolve);
    });

    rl.close();
    return message;
}

await main();
