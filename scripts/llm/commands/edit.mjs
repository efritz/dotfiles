import { readFile } from 'fs/promises';
import { createAsker } from '../common/ask.mjs';

const todoPattern = /<TODO>([\s\S]*?)<\/TODO>/g;
const completionPattern = /<COMPLETION>([\s\S]*?)<\/COMPLETION>/g;

const system = `
You are a WRITING ASSISTANT. You are provided with a file containing directives formatted
as <TODO/> XML tags containing specific instructions. Your TASK is to provide content that
satisfies the instructions, inside a <COMPLETION/> XML tag. All completions MUST satisfy
all of the given instructions, be well-written, and match the tone of the given context.

## EXAMPLE QUERY:

<DRAFT>
# <TODO>Propose a title</TODO>

PostgreSQL is often considered superior to MongoDB for several key reasons, particularly
when it comes to data integrity, reliability, and advanced querying capabilities. As a
relational database, PostgreSQL adheres to the ACID properties, ensuring that transactions
are processed reliably and maintain data integrity. This is crucial for applications requiring
precise and consistent data, such as financial systems or any application where data accuracy
is paramount. PostgreSQL's strong support for complex queries, joins, and transactional operations
allows developers to handle sophisticated data relationships and enforce data integrity through
features like foreign keys and constraints.

<TODO>Make the case that PostgreSQL has more functionality than MongoDB</TODO>
</DRAFT>

## CORRECT RESPONSE:

<COMPLETION>
Why PostgreSQL Outshines MongoDB: A Case for Data Integrity and Advanced Querying
</COMPLETION>
<COMPLETION>
Moreover, PostgreSQL offers extensive support for various data types and indexing techniques,
which can significantly enhance performance and flexibility. Its robust ecosystem includes
advanced extensions such as PostGIS for geographic information systems (GIS) and full-text
search capabilities. On the other hand, MongoDB, being a NoSQL database, is schema-less and
stores data in JSON-like documents, which can be more flexible for unstructured data and rapid
development. However, this flexibility often comes at the cost of sacrificing data consistency
and the complexity of handling relationships, which PostgreSQL manages efficiently with its
structured approach. Additionally, PostgreSQL's strong community support and continuous
development ensure it remains a reliable and powerful choice for enterprise-grade applications.
</COMPLETION>

## IMPORTANT:

- There should be one <COMPLETION/> response for every <TODO/> block.
- Answer ONLY with the <COMPLETION/> blocks, separated by a single newline.
- Do NOT include any content outside of a <COMPLETION/> block.
`

export async function edit(file, model) {
    const { ask } = await createAsker(model, system);
    const contents = await readFile(file, 'utf-8');

    const response = await ask(`<DRAFT>${contents}</DRAFT>`);
    const draftChunks = splitBlocks(contents, todoPattern);
    const completions = splitBlocks(response, completionPattern);

    if (draftChunks.length !== completions.length) {
        console.error('Mismatch between draft and completion blocks:');
        console.log(response);
        process.exit(1);
    }

    let newContents = '';
    for (let i = 0; i < draftChunks.length; i++) {
        if (i % 2 === 0) {
            newContents += draftChunks[i];
        } else {
            newContents += completions[i].trim();
        }
    }

    await fs.writeFile(file, newContents, 'utf-8');
}

function splitBlocks(content, pattern) {
    let match;
    let lastIndex = 0;

    const result = [];
    while ((match = pattern.exec(content)) !== null) {
        result.push(content.slice(lastIndex, match.index));
        result.push(match[1]);
        lastIndex = pattern.lastIndex;
    }

    result.push(content.slice(lastIndex));
    return result;
}
