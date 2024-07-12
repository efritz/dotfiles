import { readFileSync } from 'fs';
import { createAskerByModel, createAskerByName } from './asker.mjs';

export async function createHistoryFromFile(filename) {
    const { model, system, messages } = JSON.parse(readFileSync(filename, 'utf8'));

    const apiMessages = messages
        .filter(message => message.tag === 'interaction')
        .map(message => ({ role: message.role, content: message.content }));

    return createHistoryFromAsker(await createAskerByModel(model, system, apiMessages), messages);
}

export async function createHistoryFromModel(name, system) {
    return createHistoryFromAsker(await createAskerByName(name, system));
}

function createHistoryFromAsker(asker, messages = []) {
    return {
        ask: async (userMessage, opts) => {
            const { result, newContext } = await asker.ask(userMessage, opts);
            messages.push(...newContext.map(c => ({ ...c, tag: 'interaction' })));
            return result;
        },
        pushUserMessage: userMessage => {
            asker.pushMessage(userMessage);
            messages.push({ role: 'user', content: userMessage, tag: 'interaction' });
        },
        clearMessages: () => {
            asker.clearMessages();
            messages.splice(0, messages.length);
        },
        serialize: () => ({ model: asker.model, system: asker.system, messages }),
    }
}
