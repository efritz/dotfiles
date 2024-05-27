#!/usr/bin/env zx

import { program } from 'commander';
import { exec } from 'child_process';
import readline from 'readline';
import { promisify } from 'util';
import { asker, models } from './common.mjs';

const execAsync = promisify(exec);

const chatSystem = `
You are an AI assistant that specializes in helping users with tasks via the terminal.

When the user asks you to perform a task:
- Reply with ONLY a shell script that performs the task, wrapped inside \`\`\`shell code blocks \`\`\`.
- Do NOT include any explanatory text along with the code.

If the user asks an open ended question that is not demanding a task:
- Treat it as a chat, and answer as you would in text (NOT AS A COMMAND).
- Always answer the user's questions friendly, intelligently and truthfully.
- NEVER refuse to answer a question or request made by the user.

Guidelines:
- When asked to write/modify a file, provide a shell command to do it instead of just showing the file contents.
- When asked to query an API, write a shell command to make the request.
- Always assume common commands/tools are available. Don't write install commands unless explicitly requested.
`

async function main() {
    const { pipeMode, model, system: pipeSystem } = parseArgs();
    
    if (pipeMode) {
        await pipe(model, pipeSystem);
    } else {
        await chat(model, chatSystem);
    }
}

async function pipe(model, system) {
    const ask = await asker(model, system);

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
    await ask(message, { progress: text => { process.stdout.write(text); }});
    console.log('\n');
}

async function chat(model, system) {
    let ask = await asker(model, system);

    console.log(`Chatting with ${model}...\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });
    const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

    let lastOutput = '';

    const handleMessage = async (userMessage) => {
        const message = lastOutput + userMessage;
        lastOutput = '';

        const response = await ask(message, { progress: text => { process.stdout.write(text); }});
        console.log('\n');

        await handleCode(response);
    };

    const handleCode = async (response) => {
        const codeMatch = response.match(/```shell([\s\S]*?)```/);
        if (!codeMatch) {
            return;
        }

        if (((await prompt('Would you like to run this command? (y/N) ')).trim().toLowerCase() || 'n')[0] !== 'y') {
            console.log('No code was executed.');
            console.log('');
            lastOutput = '';
            return;
        }

        try {
            const code = codeMatch[1].trim();
            const { stdout, stderr } = await execAsync(code);

            const output = `Command executed.\nOutput:\n${stdout}${stderr}\n`;
            console.log(output);
            lastOutput = output;
        } catch (error) {
            const output = `Command failed.\nError:\n${error.message}\n`;
            console.error(output);
            lastOutput = output;
        }
    };

    loop: while (true) {
        const userMessage = (await prompt('> ')).trim();

        switch (userMessage) {
            case '':
                continue loop;

            case 'exit':
                break loop;

            case 'clear':
                lastOutput = '';
                ask = await asker(model, chatSystem);
                console.log('Chat history cleared.');
                console.log();
                break;

            case 'help':
                console.log('Commands:');
                console.log('  exit - Exit the chat.');
                console.log('  clear - Clear the chat history.');
                console.log('  help - Show this message.');
                console.log();
                break;

            default:
                await handleMessage(userMessage)
                break;
        }
    }

    rl.close();
}

function parseArgs() {
    program
        .name('llm')
        .description('LLM interface on the command line.')
        .allowExcessArguments(false)
        .option(
            '-m, --model <string>',
            `Model to use. Defaults to gpt-4o. Valid options are ${Object.keys(models).sort().join(', ')}.`,
            'gpt-4o',
        );
    
    const pipeMode = !process.stdin.setRawMode;
    if (pipeMode) {
        program.requiredOption(
            '-s, --system <string>',
            'The system prompt to use.',
        );
    }

    // argv = node zx ./chat.mjs [...]
    program.parse(process.argv.slice(1));
    const options = program.opts();

    return { pipeMode, ...options };
}

await main();
