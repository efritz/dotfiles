import { readFileSync } from 'fs';
import { createAsker } from '../common/ask.mjs';
import { readInput } from '../common/input.mjs';

const rawTodoPattern = /<todo>([\s\S]*?)<\/todo>/g;
const taggedCompletionPattern = /<completion id="(\d+)">([\s\S]*?)<\/completion>/g;

const system = readFileSync('system_prompts/edit.txt', 'utf-8');

export async function edit(model, filename) {
    if (!process.stdin.setRawMode) {
        const rawContents = await readInput();
        const newContents = await editString(rawContents, model);
        process.stdout.write(newContents);
        return;
    }

    const rawContents = await readFile(filename, 'utf-8');
    const newContents = await editString(rawContents, model)
    await fs.writeFile(filename, newContents, 'utf-8');
}

async function editString(rawContents, model) {
    const { ask } = await createAsker(model, system);
    const { contents, placeholders } = prepareInput(rawContents);
    const response = await ask(contents);

    let newContents = contents;
    forEachMatch(response, taggedCompletionPattern, match => {
        const id = parseInt(match[1]);
        const replacementText = match[2].trim();
        newContents = newContents.replace(placeholders[id], replacementText);
    });

    return newContents;
}

function prepareInput(contents) {
    let i = 0;
    let lastIndex = 0;
    let buffer = '';
    const placeholders = {};

    forEachMatch(contents, rawTodoPattern, match => {
        i++;
        const todo = `<todo id="${i}">${match[1]}</todo>`;
        placeholders[i] = todo;

        buffer += contents.slice(lastIndex, match.index);
        buffer += todo;
        lastIndex = rawTodoPattern.lastIndex;
    });

    buffer += contents.slice(lastIndex);
    return { contents: buffer, placeholders };
}

function forEachMatch(text, pattern, f) {
    let match;

    while ((match = pattern.exec(text)) !== null) {
        f(match)
    }
}
