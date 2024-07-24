import Groq from "groq-sdk";
import ollama from "ollama";
import { Anthropic } from '@anthropic-ai/sdk';
import { OpenAI } from "openai";
import { readLocalFile } from "./files.mjs";

const sonnetOptions = {
    maxTokens: 8192,
    extraHeaders: { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' },
};

export const models = {
    'gpt-4o':     { provider: 'OpenAI',    model: 'gpt-4o' },
    'gpt-4':      { provider: 'OpenAI',    model: 'gpt-4' },
    'haiku':      { provider: 'Anthropic', model: 'claude-3-haiku-20240307' },
    'sonnet':     { provider: 'Anthropic', model: 'claude-3-5-sonnet-20240620', options: sonnetOptions },
    'opus':       { provider: 'Anthropic', model: 'claude-3-opus-20240229' },
    'llama3':     { provider: 'Ollama',    model: 'llama3' },
    'llama3-70b': { provider: 'Groq',      model: 'llama3-8b-8192' },
}

export const modelNames = Object.keys(models).sort();

export async function createAskerByName(name, system, messages = []) {
    const model = models[name]
    if (!model) {
        throw new Error(`Unknown model: ${name} `);
    }

    return createAskerByModel(model, system, messages);
}

export async function createAskerByModel(model, system, messages = []) {
    const factory = providerFactories[model.provider];
    if (!factory) {
        throw new Error(`Unknown provider: ${model.provider}`);
    }

    const ask = await factory(model.model, system, messages, model.options || {});
    const pushMessage = userMessage => messages.push({ role: 'user', content: userMessage });
    const clearMessages = () => messages.splice(0, messages.length);
    return { model, system, ask, pushMessage, clearMessages };
}

const providerFactories = {
    'OpenAI': askOpenAI,
    'Anthropic': askClaude,
    'Ollama': askOllama,
    'Groq': askGroq,
};

async function askOpenAI(model, system, messages, { temperature = 0.0, maxTokens = 4096 }) {
    const client = new OpenAI({ apiKey: getKey('openai') });

    return createAskerFunc(messages, system, async (messages, progress) => {
        const stream = client.chat.completions.create({
            model,
            messages,
            stream: true,
            temperature,
            max_tokens: maxTokens,
        });

        return readStream(stream, chunk => chunk.choices[0]?.delta?.content ?? '', progress);
    });
}

async function askClaude(model, system, messages, { temperature = 0.0, maxTokens = 4096, extraHeaders = {} }) {
    const client = new Anthropic({ apiKey: getKey('anthropic'), defaultHeaders: extraHeaders });

    return createAskerFunc(messages, '', async (messages, progress) => {
        const stream = client.messages.stream({
            system,
            model,
            messages,
            stream: true,
            temperature,
            max_tokens: maxTokens,
        });

        stream.on('text', progress);
        return (await stream.finalMessage()).content;
    });
}

async function askOllama(model, system, messages, { temperature = 0.0, maxTokens = 4096 }) {
    return createAskerFunc(messages, system, async (messages, progress) => {
        const stream = ollama.chat({
            model,
            messages,
            stream: true,
            options: {
                temperature,
                num_predict: maxTokens,
            },
        });

        return await readStream(stream, chunk => chunk.message.content, progress);
    });
}

async function askGroq(model, system, messages, { temperature = 0.0, maxTokens = 4096 }) {
    const client = new Groq({ apiKey: getKey('groq') });

    return createAskerFunc(messages, system, async (messages, progress) => {
        const stream = client.chat.completions.create({
            model,
            messages,
            stream: true,
            temperature,
            max_tokens: maxTokens,
        });

        return await readStream(stream, chunk => chunk.choices[0]?.delta?.content ?? '', progress);
    });
}

function getKey(name) {
    return readLocalFile(["keys", `${name}.key`]);
}

async function createAskerFunc(messages, system, f) {
    return async (userMessage, { progress = () => {} } = {}) => {
        const newMessages = [];
        const push = entry => {
            messages.push(entry);
            newMessages.push(entry);
        }

        if (messages.length === 0 && system !== '') {
            push({ role: 'system', content: system });
        }
        push({ role: 'user', content: userMessage });

        const collapsedMessages = messages.reduce((acc, message) => {
            const lastMessage = acc[acc.length - 1];

            if (lastMessage && lastMessage.role === message.role) {
                lastMessage.content += '\n' + message.content;
            } else {
                acc.push({ ...message });
            }

            return acc;
        }, []);

        const result = await f(collapsedMessages, progress);
        push({ role: 'assistant', content: result });
        return { result, newContext: newMessages };
    };
}

async function readStream(stream, mapFn, progress) {
    let result = '';
    for await (const chunk of await stream) {
        const text = mapFn(chunk);
        progress(text);
        result += text;
    }

    return result;
}
