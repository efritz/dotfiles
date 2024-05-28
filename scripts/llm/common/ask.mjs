import { Anthropic } from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { OpenAI } from "openai";
import { models } from './models.mjs';

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
    const client = new OpenAI({ apiKey: await getKey('openai') });

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
    const client = new Anthropic({ apiKey: await getKey('anthropic') });

    return async (userMessage, { temperature = 0.0, max_tokens = 4096, progress = () => {} } = {}) => {
        messages.push({ role: 'user', content: userMessage });

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

async function getKey(name) {
    const keyPath = path.join(
        os.homedir(),
        ".dotfiles", "scripts", "llm", "keys",
        `${name}.key`,
    );

    return (await fs.readFile(keyPath, "utf8")).trim();
}
