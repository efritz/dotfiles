import ora from 'ora';

export async function withProgress(f, options) {
    let buffer = '';
    const spinner = ora({ text: options.progress(''), discardStdin: false });
    spinner.start();

    if (options.log) {
        const wrap = (f, prefix) => (...args) => {
            const formatted = f(...args);
            options.log(prefix + ' ' + formatted + '\n', { silent: true });
            return formatted;
        };

        options.success = wrap(options.success, chalk.green('✔'));
        options.failure = wrap(options.failure, chalk.red('✖'));
    }

    try {
        await f(chunk => {
            buffer += chunk;
            spinner.text = options.progress(buffer);
        });

        spinner.succeed(options.success(buffer));
        return { ok: true, response: buffer };
    } catch (error) {
        spinner.fail(options.failure(buffer, error));
        return { ok: false, response: buffer };
    } finally {
        console.log();
    }
}
