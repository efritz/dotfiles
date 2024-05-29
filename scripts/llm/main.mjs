#!/usr/bin/env zx

import { program } from 'commander';
import { ask } from './commands/ask.mjs';
import { chat } from './commands/chat.mjs';
import { edit } from './commands/edit.mjs';
import { modelNames } from './common/models.mjs';

async function main() {
    program
        .name('llm')
        .description('Personalized LLM utilities.')
        .allowExcessArguments(false)
        .storeOptionsAsProperties();
    
    const modelFlags = '-m, --model <string>';
    const modelDescription = `Model to use. Defaults to gpt-4o. Valid options are ${modelNames.join(', ')}.`;
    const modelDefault = 'gpt-4o';

    program
        .command('ask', { isDefault: true })
        .description('Ask a one-shot question of the specified model. Accepts piped input.')
        .option(modelFlags, modelDescription, modelDefault)
        .argument('<query>', 'The user query.')
        .action((query, options) => ask(query, options.model));

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
        .argument('<file>', 'The file to rewrite.')
        .action((filename, options) => edit(filename, options.model));

    // argv = node zx ./main.mjs [...]
    program.parse(process.argv.slice(1));
}

await main();
