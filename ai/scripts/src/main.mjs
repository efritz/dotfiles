#!/usr/bin/env -S NODE_OPTIONS="--no-warnings" zx

import { program } from 'commander';
import readline from 'readline';
import { handle } from './chat.mjs';
import { completer } from './completions.mjs';
import { ExitError } from './errors.mjs';
import { createHistoryFromFile, createHistoryFromModel } from './history.mjs';
import { getPrompt } from './system.mjs';
import { createPrompter } from './prompt.mjs';
import { handleSigint } from './sigint.mjs';
import { modelNames } from './asker.mjs';

const system = getPrompt('chat');

const metadata = async () => `
<system>
    <os>${(await $`uname`).stdout.trim()}</os>
    <shell>${(await $`$SHELL --version`).stdout.trim()}</shell>
</system>
`;

async function main() {
    program
        .name('llm')
        .description('Personalized LLM utilities.')
        .showHelpAfterError(true)
        .allowExcessArguments(false)
        .storeOptionsAsProperties();
    
    const modelFlags = '-m, --model <string>';
    const modelDescription = `Model to use. Defaults to sonnet. Valid options are ${modelNames.join(', ')}.`;
    const modelDefault = 'sonnet';

    program
        .option(modelFlags, modelDescription, modelDefault)
        .option('--history <string>', 'File to load chat history from.')
        .action((options) => chat(options.model, options.history));

    // argv = node zx ./main.mjs [...]
    program.parse(process.argv.slice(1));
}

async function chat(model, historyFilename) {
    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.');
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer,
    });

    rl.on('SIGINT', () => {
        if (!handleSigint()) {
            rl.pause();
        }
    });

    const askerContext = historyFilename
        ? await createHistoryFromFile(historyFilename)
        : await createHistoryFromModel(model, system + '\n' + await metadata());

    const prompter = createPrompter(rl);

    askerContext.log(`Beginning session with ${model}...\n`);
    await handler({ ...askerContext, prompter });
    rl.close();
}

async function handler(context) {
    while (true) {
        const message = (await context.prompter.question('$ ')).trim();

        try {
            await handle(context, message);
        } catch (error) {
            if (error instanceof ExitError) {
                return;
            }

            throw error;
        }
    }
}

await main();
