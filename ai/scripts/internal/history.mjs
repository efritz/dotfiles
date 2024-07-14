import { readFileSync } from 'fs';
import { createAskerByModel, createAskerByName } from './asker.mjs';

export async function createHistoryFromFile(filename) {
    const { model, system, messages } = JSON.parse(readFileSync(filename, 'utf8'));
    replayMessages(messages);

    const apiMessages = messages
        .filter(message => message.tag === 'interaction')
        .map(message => ({ role: message.role, content: message.content }));

    return createHistoryFromAsker(await createAskerByModel(model, system, apiMessages), messages);
}

function replayMessages(messages) {
    for (const message of messages) {
        if (message.silent) {
            continue;
        }

        let content = message.content;
        if (message.role === 'user') {
            if (content === '')  {
                continue;
            }

            content = '$ ' + content;
        }
        console.log(content);
    }
}

export async function createHistoryFromModel(name, system) {
    return createHistoryFromAsker(await createAskerByName(name, system));
}

function createHistoryFromAsker(asker, messages = []) {
    return {
        ask: async (message, opts) => {
            const { result, newContext } = await asker.ask(message, opts);
            messages.push(...newContext.map(c => ({ ...c, tag: 'interaction', silent: c.role !== 'user' })));
            return result;
        },
        log: (content, opts = {}) => {
            if (!opts.silent) {
                console.log(content);
            }

            messages.push({ content, tag: 'log' })
        },
        pushUserMessage: content => {
            asker.pushMessage(content);
            messages.push({ role: 'user', content, tag: 'interaction', silent: true });
        },
        clearMessages: () => {
            asker.clearMessages();
            messages.splice(0, messages.length);
        },
        serialize: () => ({ model: asker.model, system: asker.system, messages }),
    }
}
