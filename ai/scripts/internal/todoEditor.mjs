import { allMatches } from "./regex.mjs";

const rawTodoPattern = /<todo>([\s\S]*?)<\/todo>/g;
const taggedCompletionPattern = /<completion id="(\d+)">([\s\S]*?)<\/completion>/g;

export async function editString(rawContents, ask) {
    const { contents, placeholders } = prepareInput(rawContents);
    const { result } = await ask(contents);

    let newContents = contents;
    forEachMatch(result, taggedCompletionPattern, match => {
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

    for (const match of allMatches(contents, rawTodoPattern)) {
        i++;
        const todo = `<todo id="${i}">${match[1]}</todo>`;
        placeholders[i] = todo;

        buffer += contents.slice(lastIndex, match.index);
        buffer += todo;
        lastIndex = rawTodoPattern.lastIndex;
    }

    buffer += contents.slice(lastIndex);
    return { contents: buffer, placeholders };
}
