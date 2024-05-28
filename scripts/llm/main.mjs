#!/usr/bin/env zx

import { program } from 'commander';
import { chat } from './commands/chat.mjs';
import { edit } from './commands/edit.mjs';
import { pipe } from './commands/pipe.mjs';
import { modelNames } from './common/models.mjs';

async function main() {
    program
        .name('llm')
        .description('Personalized LLM utilities.')
        .allowExcessArguments(false)
        .storeOptionsAsProperties();
    setupCommands(program);

    // argv = node zx ./main.mjs [...]
    program.parse(process.argv.slice(1));
}

function setupCommands(program) {
    const modelFlags = '-m, --model <string>';
    const modelDescription = `Model to use. Defaults to gpt-4o. Valid options are ${modelNames.join(', ')}.`;
    const modelDefault = 'gpt-4o';

    if (!process.stdin.setRawMode) {
        program
            .command('pipe', { isDefault: true })
            .description('Pipe stdin to the specified model.')
            .option(modelFlags, modelDescription, modelDefault)
            .requiredOption('-s, --system <string>', 'The system prompt to use.')
            .action((_, options) => pipe(options.model, options.system));
        return;
    }

    program
        .command('chat', { isDefault: true })
        .description('Execution-enabled chat interface with the specified model.')
        .option(modelFlags, modelDescription, modelDefault)
        .option('--history <string>', 'File to load chat history from.')
        .action((_, options) => chat(options.model, options.history));

    program
        .command('edit')
        .description('Replaces <TODO /> instruction blocks with completions in the specified file in-place.')
        .option(modelFlags, modelDescription, modelDefault)
        .argument('<file>', 'The file to edit.')
        .action((filename, options) => edit(filename, options.model));
}

await main();
