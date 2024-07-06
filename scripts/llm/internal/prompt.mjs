import chalk from 'chalk';

export function createPrompter(rl) {
    const question = async (prompt) => {
        return new Promise((resolve) => rl.question(prompt, resolve));
    };

    const options = async (prompt, options) => {
        const help = { name: '?', description: 'print help' };
        const name = o => o.isDefault ? o.name.toUpperCase() : o.name.toLowerCase();
        const optionNames = [...options, help].map(o => name(o)).join('/');
        const helpText = [...options, help].map(o => `${name(o)} - ${o.description}`).join('\n');

        while (true) {
            const value = await question(chalk.cyanBright(`${prompt} [${optionNames}]? `));

            const option = options.find(o =>
                (value === '' && o.isDefault) ||
                (value !== '' && o.name.toLowerCase() === value[0].toLowerCase())
            );
            if (option) {
                return option.name;
            }

            console.log(chalk.bold.red(helpText));
        }
    }

    return {
        question,
        options,
    };
}
