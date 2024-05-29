import chalk from 'chalk';
import chokidar from 'chokidar';
import readline from 'readline';
import ora from 'ora';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { createAsker, loadAskerFromHistoryFile } from '../common/ask.mjs';

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

export async function chat(model, historyFilename) {
    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.');
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer,
    });

    const { ask, pushMessage, clearMessages, serialize } = historyFilename
        ? await loadAskerFromHistoryFile(historyFilename)
        : await createAsker(model, system);
    const prompter = createPrompter(rl);

    console.log(`Chatting with ${model}...\n`);
    await handler({ ask, pushMessage, clearMessages, serialize, prompter });
    rl.close();
}

async function handler(context) {
    loop: while (true) {
        const userMessage = (await context.prompter.question('$ ')).trim();

        for (const [pattern, handler] of dispatch) {
            const match = userMessage.match(pattern);
            if (!match) {
                continue;
            }

            try {
                await handler(context, userMessage, match);
                continue loop;
            } catch (error) {
                if (error instanceof ExitError) {
                    return;
                }

                throw error;
            }
        }

        throw new Error(`No pattern matched message: ${userMessage}.`);
    }
}

const dispatch = [
    [/^help$/, handleHelp],
    [/^exit$/, handleExit],
    [/^clear$/, handleClear],
    [/^save$/, handleSave],
    [/^load (.+)$/, handleLoad],
    [/^(.*)$/, handleMessage],
];

async function handleHelp() {
    console.log('Commands:');
    console.log('  help - Show this message.');
    console.log('  exit - Exit the chat.');
    console.log('  clear - Clear the chat history.');
    console.log('  save - Save this chat history.');
    console.log('  load <file> - load file contents into the chat context');
    console.log();
}

class ExitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ExitError';
    }
}

async function handleExit() {
    console.log('Goodbye!');
    console.log();

    throw new ExitError('User exited.');
}

async function handleClear(context) {
    context.clearMessages();
    console.log('Chat history cleared.');
    console.log();
}

async function handleSave(context) {
    const filename = `chat-${Math.floor(Date.now() / 1000)}.json`;
    writeFileSync(filename, JSON.stringify(context.serialize(), null, '\t'));
    console.log(`Chat history saved to ${filename}`);
    console.log();
}

async function handleLoad(context, userMessage, match) {
    const path = match[1];

    await withProgress(async () => {
        const contents = readFileSync(path);
        context.pushMessage(`<path>${path}</path><contents>${contents}</contents>\n`);
    }, {
        progress: formatBufferWithPrefix(`Loading ${path} into context...`),
        success: formatBufferWithPrefix(`Loaded ${path} into context.`),
        failure: formatBufferErrorWithPrefix(`Failed to load ${path}.`),
    });
}

async function handleMessage(context, userMessage) {
    if (userMessage === '') {
        return;
    }

    const { ok, response } = await withProgress(progress => context.ask(userMessage, { progress }), {
        progress: formatBufferWithPrefix('Generating response...'),
        success: formatBufferWithPrefix('Generated response.'),
        failure: formatBufferErrorWithPrefix('Failed to generate response.'),
    });

    if (ok) {
        await handleCode(context, response);
    }
}

async function handleCode(context, response) {
    const codeMatch = response.match(/```shell([\s\S]*?)```/);
    if (!codeMatch) {
        return;
    }
    const code = codeMatch[1].trim();

    if ((await context.prompter.options('Would you like to ' + chalk.bold('run') + ' this command?', [
        { name: 'y' },
        { name: 'n', isDefault: true },
    ])) === 'y') {
        return runCode(context, code)
    }

    if ((await context.prompter.options('Would you like to ' + chalk.bold('edit') + ' this command?', [
        { name: 'y' },
        { name: 'n', isDefault: true },
    ])) === 'y') {
        const { ok, response: editedCodeWithFence } = await withProgress(async (progress) => {
            const editedCode = await edit(code);
            const codeWithFence = "```shell\n" + editedCode.trim() + "\n```\n"
            progress(codeWithFence);
            return codeWithFence;
        }, {
            progress: formatBufferWithPrefix('Editing code...'),
            success: formatBufferWithPrefix('Code edited.'),
            failure: (buffer, error) => error instanceof CancelError 
                ? 'Edit canceled.' 
                : formatBufferError('Failed to edit code.', buffer, error),
        });

        if (ok) {
            context.pushMessage(`Edited code to:\n${editedCodeWithFence}`);
            return handleCode(context, editedCodeWithFence);
        }
    }

    console.log(chalk.dim('ℹ') + ' No code was executed.');
    console.log();
    return;
}

async function runCode(context, code) {
    const { ok, response } = await withProgress(async (progress) => {
        await new Promise((resolve, reject) => {
            const cmd = spawn('zsh', ['-c', code]);
            cmd.stdout.on('data', data => progress(data.toString()));
            cmd.stderr.on('data', data => progress(data.toString()));

            cmd.on('exit', exitCode => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`exit code ${exitCode}`));
                }
            });
        });
    }, {
        progress: formatBufferWithPrefix('Executing command...'),
        success: formatBufferWithPrefix('Command succeeded.'),
        failure: formatBufferErrorWithPrefix('Command failed.'),
    });

    context.pushMessage(`Command ${ok ? 'succeeded' : 'failed'}.\nOutput:\n${response}\n`);

    if (!ok) {
        if ((await context.prompter.options('Would you like to diagnose the error?', [
            { name: 'y', isDefault: true },
            { name: 'n'},
        ])) === 'y') {
            return handleMessage(context, 'Diagnose the error.');
        } else {
            console.log();
        }
    }
}

async function withProgress(f, options) {
    let buffer = '';
    const spinner = ora({ text: options.progress(''), discardStdin: false });
    spinner.start();

    try {
        await f(chunk => {
            buffer += chunk;
            spinner.text = options.progress(buffer);
        });

        spinner.succeed(options.success(buffer));
        console.log();

        return { ok: true, response: buffer };
    } catch (error) {
        spinner.fail(options.failure(buffer, error));
        console.log();

        return { ok: false, response: buffer };
    }
}

function formatBufferWithPrefix(prefix) {
    return buffer => formatBuffer(prefix, buffer);
}

function formatBufferErrorWithPrefix(prefix) {
    return (buffer, error) => formatBufferError(prefix, buffer, error);
}

function formatBuffer(prefix, buffer) {
    const context = chalk.cyan(buffer.trim().replace(/(```shell)([\s\S]*?)(```|$)/g, (_, left, code, right) => {
        return left + chalk.bold.magenta(code) + right;
    }));

    if (context === '') {
        return prefix;
    }

    return prefix + '\n\n' + context;
}

function formatBufferError(prefix, buffer, error) {
    let context = '';
    if (error && error.message) {
        context = chalk.bold.red(`error: ${error.message}`);
    }

    const trimmedBuffer = buffer.trim();
    if (trimmedBuffer !== '') {
        if (context !== '') {
            context += '\n\n';
        }

        context += chalk.red(trimmedBuffer);
    }

    if (context === '') {
        return prefix;
    }

    return prefix + '\n\n' + context;
}

function createPrompter(rl) {
    const question = (prompt, initialValue) => {
        const p = new Promise((resolve) => rl.question(prompt, resolve));

        if (initialValue !== '') {
            rl.write(initialValue);
        }

        return p;
    }

    const options = async (prompt, options) => {
        const optionNames = options.map(o => o.isDefault
            ? o.name.toUpperCase()
            : o.name.toLowerCase()
        ).join('/');

        while (true) {
            const value = await question(`${prompt} [${optionNames}]: `);

            const option = options.find(o =>
                (value === '' && o.isDefault) ||
                (value !== '' && o.name.toLowerCase() === value[0].toLowerCase())
            );

            if (option) {
                return option.name;
            }
        }
    }

    return {
        question,
        options,
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

class CancelError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CancelError';
    }
}

function edit(content) {
    const suffix = randomBytes(16).toString('hex');
    const tempPath = `/tmp/llm-chat-code-${suffix}`;
    writeFileSync(tempPath, content);

    const watcher = chokidar.watch(tempPath, {
        persistent: true,
        ignoreInitial: true,
    });

    return new Promise((resolve, reject) => {
        process.on('SIGINT', () => reject(new CancelError('User canceled edit')));
        watcher.on('change', () => {
            const newContent = readFileSync(tempPath, 'utf-8');
            if (newContent !== content) {
                resolve(newContent);
            }
        });

        const editor = $`e ${tempPath}`;
        editor.catch((error) => reject(new Error(`Failed to open editor: ${error.message}`)));
    }).finally(() => {
        watcher.close();
        unlinkSync(tempPath);
    });
}
