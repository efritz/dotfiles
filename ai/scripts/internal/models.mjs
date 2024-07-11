import { Anthropic } from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { OpenAI } from "openai";
import { readLocalFile } from "./files.mjs";

export const models = {
    'gpt-4o': { provider: 'OpenAI',    model: 'gpt-4o' },
    'gpt-4':  { provider: 'OpenAI',    model: 'gpt-4'  },
    'haiku':  { provider: 'Anthropic', model: 'claude-3-haiku-20240307'  },
    'sonnet': { provider: 'Anthropic', model: 'claude-3-5-sonnet-20240620' },
    'opus':   { provider: 'Anthropic', model: 'claude-3-opus-20240229'   },
}

export const modelNames = Object.keys(models).sort();

export async function createAsker(name, system) {
    const model = models[name]
    if (!model) {
        throw new Error(`Unknown model: ${name}`);
    }

    return asker(model, system, []);
}

export async function loadAskerFromHistory(serialized) {
    const { model, system, messages } = serialized;
    return asker(model, system, messages);
}

export async function loadAskerFromHistoryFile(filename) {
    return loadAskerFromHistory(JSON.parse(await readFile(filename, 'utf8')));
}

async function asker(model, system, messages) {
    const factory = providerFactories[model.provider];
    if (!factory) {
        throw new Error(`Unknown provider: ${model.provider}`);
    }

    const ask = await factory(model.model, system, messages);
    const pushMessage = userMessage => messages.push({ role: 'user', content: userMessage });
    const clearMessages = () => messages.splice(0, messages.length);
    const serialize = () => ({ model, system, messages });
    return { ask, pushMessage, clearMessages, serialize };
}

const providerFactories = {
    'OpenAI': askOpenAI,
    'Anthropic': askClaude,
};

async function askOpenAI(model, system, messages) {
    const client = new OpenAI({ apiKey: getKey('openai') });

    return async (userMessage, { temperature = 0.0, max_tokens = 4096, progress = () => {} } = {}) => {
        if (messages.length === 0) {
            messages.push({ role: 'system', content: system });
        }

        messages.push({ role: 'user', content: userMessage });

        const params = {
            model,
            temperature,
            max_tokens,
            stream: true,
            messages,
        };

        let result = '';
        const onChunk = text => { progress(text); result += text; }
        for await (const chunk of await client.chat.completions.create(params)) {
            onChunk(chunk.choices[0]?.delta?.content ?? '');
        }

        messages.push({ role: 'assistant', content: result });
        return result;
    };
}

async function askClaude(model, system, messages) {
    const client = new Anthropic({ apiKey: getKey('anthropic') });

    return async (userMessage, { temperature = 0.0, max_tokens = 4096, progress = () => {} } = {}) => {
        messages.push({ role: 'user', content: userMessage });
        collapseMessagesFromSameSpeaker(messages);

        const params = {
            system,
            model,
            temperature,
            max_tokens,
            stream: true,
            messages,
        };

        let result = '';
        const onChunk = text => { progress(text); result += text; }
        await client.messages.stream(params).on('text', onChunk).finalMessage();

        messages.push({ role: 'assistant', content: result });
        return result;
    };
}

function collapseMessagesFromSameSpeaker(messages) {
    let previous = null;
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];

        if (previous !== null && message.role == previous.role) {
            previous.content += '\n' + message.content;

            // Remove the current message from the list and reprocess the
            // current index, which now contains the subsequent message.
            messages.splice(i--, 1);
            continue;
        }

        previous = message;
    }
}

function getKey(name) {
    return readLocalFile(["keys", `${name}.key`]);
}
