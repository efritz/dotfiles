import { allMatches } from "./regex.mjs";

const rawTodoPattern = /<todo>([\s\S]*?)<\/todo>/g;
const taggedCompletionPattern = /<AI:COMPLETION id="(\d+)">([\s\S]*?)<\/AI:COMPLETION>/g;

export function prepareTodoPlaceholders(contents) {
    let i = 0;
    let lastIndex = 0;
    let buffer = '';
    const placeholders = {};

    for (const match of allMatches(contents, rawTodoPattern)) {
        i++;
        const todo = `<AI:TODO id="${i}">${match[1]}</AI:TODO>`;
        placeholders[i] = todo;

        buffer += contents.slice(lastIndex, match.index);
        buffer += todo;
        lastIndex = rawTodoPattern.lastIndex;
    }

    buffer += contents.slice(lastIndex);
    return { contents: buffer, placeholders };
}

export function replaceTodoPlaceholders(preparedContents, placeholders, responseWithCompletions) {
    let newContents = preparedContents;
    allMatches(responseWithCompletions, taggedCompletionPattern).forEach(match => {
        const id = parseInt(match[1]);
        const replacementText = match[2].trim();
        newContents = newContents.replace(placeholders[id], replacementText);
    })

    return newContents;
}
