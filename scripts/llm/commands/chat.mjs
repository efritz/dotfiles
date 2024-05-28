import { spawn } from 'child_process';
import { readdirSync } from 'fs';
import { readFile } from 'fs/promises';
import readline from 'readline';
import ora from 'ora';
import { asker } from '../common/ask.mjs';

const system = `
You are an AI assistant that specializes in helping users with tasks via the terminal.

When the user asks you to perform a task:
- Reply with ONLY a shell script that performs the task, wrapped inside \`\`\`shell code blocks\`\`\`.
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

export async function chat(model) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer,
    });

    const context = {
        ask: await asker(model, system),
        prompter: prompter(rl),
        lastOutput: '',
    };

    console.log(`Chatting with ${model}...\n`);
    await handler(context);
    rl.close();
}

async function handler(context) {
    loop: while (true) {
        const userMessage = (await context.prompter.question('$ ')).trim();

        switch (userMessage) {
            case '':
                continue loop;

            case 'exit':
                break loop;

            case 'clear':
                context.lastOutput = '';
                ask = await asker(model, system);
                console.log('Chat history cleared.');
                console.log();
                break;

            case 'help':
                console.log('Commands:');
                console.log('  exit - Exit the chat.');
                console.log('  clear - Clear the chat history.');
                console.log('  load <file> - load file contents into the chat context');
                console.log('  help - Show this message.');
                console.log();
                break;

            default:
                await handleMessage(context, userMessage)
                break;
        }
    }
}

async function handleMessage(context, userMessage) {
    const match = userMessage.match(/^load (.+)$/);
    if (match) {
        return handleLoad(context, match[1]);
    }

    const message = context.lastOutput + userMessage;
    context.lastOutput = '';
    return handleQuestion(context, message);
}

async function handleQuestion(context, message) {
    const { ok, response } = await withProgress(progress => context.ask(message, { progress }), {
        progress: 'Generating response...',
        success: 'Generated response.',
        failure: 'Failed to generate response.',
    });

    if (ok) {
        await handleCode(context, response);
    }
}

async function handleLoad(context, path) {
    const spinner = ora({ text: `Loading ${path} into context...`, discardStdin: false });

    try {
        const contents = await readFile(path);
        context.lastOutput = `<path>${path}</path><contents>${contents}</contents>\n`;
        spinner.succeed(`Loaded ${path} into context.`);
    } catch (error) {
        spinner.fail(`Failed to load ${path} into context: ${error.message}.`);
    }

    console.log();
}

async function handleCode(context, response) {
    const codeMatch = response.match(/```shell([\s\S]*?)```/);
    if (!codeMatch) {
        return;
    }
    const code = codeMatch[1].trim();

    if (!(await context.prompter.yesOrNo('Would you like to run this command?', false))) {
        console.log('No code was executed.');
        console.log('');
        context.lastOutput = '';
        return;
    }

    const { ok, response: output } = await withProgress(async (progress) => {
        await new Promise((resolve, reject) => {
            const cmd = spawn('zsh', ['-c', code]);
            cmd.stdout.on('data', data => progress(data.toString()));
            cmd.stderr.on('data', data => progress(data.toString()));

            cmd.on('exit', code => {
                if (code === 0) {
                    resolve();
                } else {
                    reject();
                }
            });
        });
    }, {
        progress: 'Executing command...',
        success: 'Command succeeded.',
        failure: 'Command failed.',
    });

    if (ok) {
        context.lastOutput = `Command succeeded.\nOutput:\n${output}\n`;
    } else {
        context.lastOutput = `Command failed.\nOutput:\n${output}\n`;

        if (await context.prompter.yesOrNo('Would you like to debug this command?', true)) {
            return handleMessage('Diagnose the error.');
        }
    }
}

async function withProgress(f, options) {
    let buffer = '';
    const formatBuffer = (prefix) => prefix + '\n\n> ' + buffer.trim().replace(/\n/g, '\n> ');

    const spinner = ora({ text: options.progress, discardStdin: false });
    spinner.start();

    try {
        await f(chunk => {
            buffer += chunk;
            spinner.text = formatBuffer(options.progress, buffer);
        });

        spinner.succeed(formatBuffer(options.success, buffer));
        console.log();

        return { ok: true, response: buffer };
    } catch (error) {
        spinner.fail(formatBuffer(options.failure, buffer));
        console.log();

        return { ok: false, response: buffer };
    }
}

function prompter(rl) {
    const question = async (prompt) => await new Promise((resolve) => {
        rl.question(prompt, resolve);
    });

    const yesOrNo = async (prompt, defaultValue) => {
        const options = defaultValue ? 'Y/n' : 'y/N';
        const value = (await question(`${prompt} [${options}]: `)) || (defaultValue ? 'y' : 'n');
        return value.trim().toLowerCase()[0] === 'y'
    };

    return {
        question,
        yesOrNo,
    };
}

function completer(line) {
    if (!line.startsWith('load ')) {
        return [[], line];
    }

    const prefix = line.slice(5);
    const index = prefix.lastIndexOf('/');
    const dir = index < 0 ? '.' : prefix.substring(0, index + 1);

    return [
        readdirSync(dir)
            .filter(name => name.startsWith(path.basename(prefix)))
            .map(name => 'load ' + (dir == '.' ? '' : dir) + name),
        line,
    ];
}
