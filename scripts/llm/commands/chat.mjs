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
    let ask = await asker(model, system);

    console.log(`Chatting with ${model}...\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer: (line) => {
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
        },
    });
    const promptUser = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
    const parseYesNo = (input) => input.trim().toLowerCase()[0] === 'y';
    const promptYesNo = async (prompt, defaultValue) =>  parseYesNo(
        (await promptUser(`${prompt} [${defaultValue ? 'Y/n' : 'y/N'}]: `)) ||
        (defaultValue ? 'y' : 'n')
    );

    const progressForSpinner = (spinner, prefix) => {
        let buffer = '';
        const progress = chunk => {
            buffer += chunk;
            spinner.text = formatResponse(prefix, buffer);
        };

        return [progress, () => buffer];
    };

    const formatResponse = (prefix, response) => {
        return prefix + '\n\n> ' + response.trim().replace(/\n/g, '\n> ');
    };

    let lastOutput = '';

    const loadFile = async (path) => {
        const spinner = ora({ text: `Loading ${path} into context...`, discardStdin: false });

        try {
            const contents = await readFile(path);
            lastOutput = `<path>${path}</path><contents>${contents}</contents>\n`;
            spinner.succeed(`Loaded ${path} into context.`);
        } catch (error) {
            spinner.fail(`Failed to load ${path} into context: ${error.message}.`);
        }

        console.log();
    };

    const handleMessage = async (userMessage) => {
        const match = userMessage.match(/^load (.+)$/);
        if (match) {
            const path = match[1];
            await loadFile(path);
            return;
        }

        const message = lastOutput + userMessage;
        lastOutput = '';

        const progressPrefix = 'Generating response...';
        const finishedPrefix = 'Generated response.';

        const spinner = ora({ text: progressPrefix, discardStdin: false });
        const [progress, _] = progressForSpinner(spinner, progressPrefix);

        spinner.start();
        const response = await ask(message, { progress });
        spinner.succeed(formatResponse(finishedPrefix, response));
        console.log();

        await handleCode(response);
    };

    const handleCode = async (response) => {
        const codeMatch = response.match(/```shell([\s\S]*?)```/);
        if (!codeMatch) {
            return;
        }
        const code = codeMatch[1].trim();

        if (!(await promptYesNo('Would you like to run this command?', false))) {
            console.log('No code was executed.');
            console.log('');
            lastOutput = '';
            return;
        }

        const progressPrefix = 'Executing command...';
        const successPrefix = 'Command succeeded.';
        const failurePrefix = 'Command failed.';

        const spinner = ora({ text: progressPrefix, discardStdin: false });
        const [progress, getBuffer] = progressForSpinner(spinner, progressPrefix);
        spinner.start();

        const runCode = new Promise((resolve, reject) => {
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

        try {
            await runCode;

            const buffer = getBuffer();
            spinner.succeed(formatResponse(successPrefix, buffer));
            lastOutput = `Command succeeded.\nOutput:\n${buffer}\n`;
            console.log();
        } catch (error) {
            const buffer = getBuffer();
            spinner.fail(formatResponse(failurePrefix, buffer));
            lastOutput = `Command failed.\nOutput:\n${buffer}\n`;
            console.log();

            if (await promptYesNo('Would you like to debug this command?', true)) {
                return handleMessage('Diagnose the error.');
            }
        }
    };

    loop: while (true) {
        const userMessage = (await promptUser('$ ')).trim();

        switch (userMessage) {
            case '':
                continue loop;

            case 'exit':
                break loop;

            case 'clear':
                lastOutput = '';
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
                await handleMessage(userMessage)
                break;
        }
    }

    rl.close();
}