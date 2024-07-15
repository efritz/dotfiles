#!/usr/bin/env -S NODE_OPTIONS="--no-warnings" zx

import { program } from 'commander';
import { chat } from './commands/chat.mjs';
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

    // argv = node zx ./main.mjs [...]
    program.parse(process.argv.slice(1));
}

await main();
