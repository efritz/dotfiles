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

    return async (userMessage, { progress = () => {} } = {}) => {
        const { newContext, push } = teeArray(messages);

        if (messages.length === 0) {
            push({ role: 'system', content: system });
        }
        push({ role: 'user', content: userMessage });

        let result = '';
        const onChunk = text => { progress(text); result += text; }
        const params = { model, messages, stream: true, temperature, max_tokens: maxTokens };
        for await (const chunk of await client.chat.completions.create(params)) {
            onChunk(chunk.choices[0]?.delta?.content ?? '');
        }
        push({ role: 'assistant', content: result });

        return { result, newContext };
    };
}

async function askClaude(model, system, messages, { temperature = 0.0, maxTokens = 4096, extraHeaders = {} }) {
    const client = new Anthropic({ apiKey: getKey('anthropic'), defaultHeaders: extraHeaders });

    return async (userMessage, { progress = () => {} } = {}) => {
        const { newContext, push } = teeArray(messages);

        push({ role: 'user', content: userMessage });
        collapseMessagesFromSameSpeaker(messages);

        let result = '';
        const onChunk = text => { progress(text); result += text; }
        const params = { system, model, messages,stream: true, temperature, max_tokens: maxTokens };
        await client.messages.stream(params).on('text', onChunk).finalMessage();
        push({ role: 'assistant', content: result });

        return { result, newContext };
    };
}

async function askOllama(model, system, messages, { temperature = 0.0, maxTokens = 4096 }) {
    return async (userMessage, { progress = () => {} } = {}) => {
        const { newContext, push } = teeArray(messages);

        if (messages.length === 0) {
            push({ role: 'system', content: system });
        }
        push({ role: 'user', content: userMessage });

        let result = '';
        const onChunk = text => { progress(text); result += text; }
        const params = { model, messages, stream: true, options: { temperature, num_predict: maxTokens }};
        for await (const chunk of await ollama.chat(params)) {
            onChunk(chunk.message.content);
        }
        push({ role: 'assistant', content: result });

        return { result, newContext };
    };
}

async function askGroq(model, system, messages, { temperature = 0.0, maxTokens = 4096 }) {
    const client = new Groq({ apiKey: getKey('groq') });

    return async (userMessage, { progress = () => {} } = {}) => {
        const { newContext, push } = teeArray(messages);

        if (messages.length === 0) {
            push({ role: 'system', content: system });
        }
        push({ role: 'user', content: userMessage });

        let result = '';
        const onChunk = text => { progress(text); result += text; }
        const params = { model, messages, stream: true, temperature, max_tokens: maxTokens };
        for await (const chunk of await client.chat.completions.create(params)) {
            onChunk(chunk.choices[0]?.delta?.content ?? '');
        }
        push({ role: 'assistant', content: result });

        return { result, newContext };
    };
}

function getKey(name) {
    return readLocalFile(["keys", `${name}.key`]);
}

function teeArray(context) {
    const newContext = [];
    return { newContext, push: entry => {
        context.push(entry);
        newContext.push(entry);
    }};
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
