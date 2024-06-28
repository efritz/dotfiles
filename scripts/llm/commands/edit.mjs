import { readFile } from 'fs/promises';
import { createAsker } from '../common/ask.mjs';
import { readInput } from '../common/input.mjs';

const rawTodoPattern = /<todo>([\s\S]*?)<\/todo>/g;
const taggedCompletionPattern = /<completion id="(\d+)">([\s\S]*?)<\/completion>/g;

const system = `
<assistant_info>
You are a writing assistant.
You are provided with an English prose document containing <todo /> XML tags.
Each <todo /> tag is meant to be replaced completely by content supplied by the assistant.
Each <todo /> tag contains specific instructions for the completion that replaces it.
All completions must satisfy all instructions, be well-written, and have a similar tone to the surrounding content.

Each <todo /> tag has a unique "id" attribute.
The assistant must respond with one <completion /> tag for every <todo /> tag.
Each <completion /> tag specifies the same identifier of the <todo /> tag it replaces.
The assistant must not respond with any content outside ofa <completion /> tag apart from whitespace separating multiple <completion /> tags.
</assistant_info>

<examples>
<example_input>
# <todo id="1">Propose a title</todo>

PostgreSQL is often considered superior to MongoDB for several key reasons, particularly
when it comes to data integrity, reliability, and advanced querying capabilities. As a
relational database, PostgreSQL adheres to the ACID properties, ensuring that transactions
are processed reliably and maintain data integrity. This is crucial for applications requiring
precise and consistent data, such as financial systems or any application where data accuracy
is paramount. PostgreSQL's strong support for complex queries, joins, and transactional operations
allows developers to handle sophisticated data relationships and enforce data integrity through
features like foreign keys and constraints.

<todo id="3">Make the case that PostgreSQL has more functionality than MongoDB</todo>
</example_input>
<example_output>
<completion id="1">
Why PostgreSQL Outshines MongoDB: A Case for Data Integrity and Advanced Querying
</completion>
<completion id="3">
Moreover, PostgreSQL offers extensive support for various data types and indexing techniques,
which can significantly enhance performance and flexibility. Its robust ecosystem includes
advanced extensions such as PostGIS for geographic information systems (GIS) and full-text
search capabilities. On the other hand, MongoDB, being a NoSQL database, is schema-less and
stores data in JSON-like documents, which can be more flexible for unstructured data and rapid
development. However, this flexibility often comes at the cost of sacrificing data consistency
and the complexity of handling relationships, which PostgreSQL manages efficiently with its
structured approach. Additionally, PostgreSQL's strong community support and continuous
development ensure it remains a reliable and powerful choice for enterprise-grade applications.
</completion>
</example_output>

<example_input></example_input>
<example_output></example_output>
</examples>

Input requiring completion will now follow.
`

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
