import chalk from 'chalk';
import * as diffLib from 'diff';
import { readFileSync, existsSync } from 'fs';

export async function showDiff(context, path, newContents) {
    if (!existsSync(path)) {
        console.log(chalk.yellow(`File ${path} does not exist. Creating a new file.`));
        console.log(chalk.green('New file contents:'));
        console.log(newContents);
        return;
    }

    const oldContents = readFileSync(path, 'utf8');

    console.log(chalk.cyan(`Diff for ${path}:`));
    await displayDiffBlocks(context, createDiffBlocks(oldContents, newContents));
}

function createDiffBlocks(oldContents, newContents) {
    const diff = diffLib.diffLines(oldContents, newContents);
    const blocks = [];
    let currentBlock = [];
    let unchangedLines = 0;
    const contextLines = 3;

    diff.forEach((part, index) => {
        const lines = part.value.trim().split('\n');
        
        if (part.added || part.removed) {
            if (unchangedLines > 0) {
                currentBlock.push(...formatUnchangedLines(diff[index - 1].value.trim().split('\n').slice(-contextLines)));
            }
            unchangedLines = 0;
            
            lines.forEach(line => {
                if (part.added) {
                    currentBlock.push(chalk.green(`+ ${line}`));
                } else {
                    currentBlock.push(chalk.red(`- ${line}`));
                }
            });
        } else {
            unchangedLines += lines.length;
            if (unchangedLines > contextLines * 2) {
                if (currentBlock.length > 0) {
                    currentBlock.push(...formatUnchangedLines(lines.slice(0, contextLines)));
                    blocks.push(currentBlock.join('\n'));
                    currentBlock = [];
                }
            } else {
                currentBlock.push(...formatUnchangedLines(lines));
            }
        }
    });

    if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
    }

    return blocks;
}

function formatUnchangedLines(lines) {
    return lines.map(line => chalk.gray(`  ${line}`));
}

async function displayDiffBlocks(context, blocks) {
    let current = 0;
    while (current < blocks.length) {
        console.log(blocks[current]);
        console.log(chalk.yellow(`\nBlock ${current + 1} of ${blocks.length}`));

        const hasPrev = current > 0;
        const hasNext = current < blocks.length - 1;

        const answer = await context.prompter.options('Diff navigation', [
            ...(hasNext ? [{ name: 'n', description: 'Next block', isDefault: true }] : []),
            ...(hasPrev ? [{ name: 'p', description: 'Previous block' }] : []),
            ...[{ name: 'q', description: 'Quit', isDefault: !hasNext }],
        ]);

        if (answer === 'q') {
            break;
        } else if (answer === 'n') {
            current++;
        } else if (answer === 'p') {
            current--;
        }
    }
}
