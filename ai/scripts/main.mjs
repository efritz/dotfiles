#!/usr/bin/env zx

import { program } from 'commander';
import { chat } from './commands/chat.mjs';
import { edit } from './commands/edit.mjs';
import { modelNames } from './internal/asker.mjs';

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
        .command('chat')
        .description('Execution-enabled chat interface with the specified model.')
        .option(modelFlags, modelDescription, modelDefault)
        .option('--history <string>', 'File to load chat history from.')
        .action((_, options) => chat(options.model, options.history));

    program
        .command('edit')
        .description('Replaces <TODO /> instruction blocks with completions in the specified file in-place.')
        .option(modelFlags, modelDescription, modelDefault)
        .argument('[<file>]', 'The file to rewrite.')
        .action((filename, options) => edit(options.model, filename));

    // argv = node zx ./main.mjs [...]
    program.parse(process.argv.slice(1));
}

await main();
