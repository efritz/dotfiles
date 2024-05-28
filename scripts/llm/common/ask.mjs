import { Anthropic } from '@anthropic-ai/sdk';
import { OpenAI } from "openai";
import { models } from './models.mjs';

export async function asker(name, system) {
    const model = models[name]
    if (!model) {
        throw new Error(`Unknown model: ${name}`);
    }

    switch (model.provider) {
        case 'OpenAI':
            return askOpenAI(model.model, system);
        case 'Anthropic':
            return askClaude(model.model, system);
        default:
            throw new Error(`Unknown provider: ${model.provider}`);
    }
}

async function askOpenAI(model, system) {
    const client = new OpenAI({ apiKey: await getKey('openai') });
    const messages = [];
    messages.push({ role: 'system', content: system })

    return async (userMessage, { temperature = 0.0, max_tokens = 4096, progress = () => {} }) => {
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

async function askClaude(model, system) {
    const client = new Anthropic({ apiKey: await getKey('anthropic') });
    const messages = [];

    return async (userMessage, { temperature = 0.0, max_tokens = 4096, progress = () => {} }) => {
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
