export const models = {
    'gpt-4o': { provider: 'OpenAI',    model: 'gpt-4o' },
    'gpt-4':  { provider: 'OpenAI',    model: 'gpt-4'  },
    'haiku':  { provider: 'Anthropic', model: 'claude-3-haiku-20240307'  },
    'sonnet': { provider: 'Anthropic', model: 'claude-3-5-sonnet-20240620' },
    'opus':   { provider: 'Anthropic', model: 'claude-3-opus-20240229'   },
}

export const modelNames = Object.keys(models).sort();
