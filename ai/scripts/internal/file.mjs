import { lstatSync, readFileSync } from 'fs';
import { glob } from 'glob';
import { homedir } from 'os';

export function completeFilePaths(line) {
    const parts = line.split(' ');
    if (parts[0] !== 'load') {
        return [[], line];
    }

    // Only complete the last part of the line
    const lastEntry = parts[parts.length - 1];

    let pathPrefix = lastEntry;
    if (pathPrefix.startsWith('~')) {
        pathPrefix = homedir() + lastEntry.slice(1);
    }
    if (!pathPrefix.startsWith('/') && !pathPrefix.startsWith('./') && !pathPrefix.startsWith('../')) {
        pathPrefix = `./${pathPrefix}`;
    }

    // Explicit glob - expand directly
    if (pathPrefix.includes('*')) {
        const entries = glob.sync(pathPrefix).filter(path => !isDir(path));
        if (entries.length === 0) {
            return [[], lastEntry];
        }

        // Return as a single completion to expand the user input into actual file paths.
        // Since this is a single element array, we'll end up adding it directly to the
        // user's input line.
        return [[entries.join(' ') + ' '], lastEntry];
    }

    if (isDir(pathPrefix)) {
        // Ensure directories end in a slash before globbing below
        pathPrefix = pathPrefix.endsWith('/') ? pathPrefix : pathPrefix + '/';
    }

    // Use glob to expand paths by prefix in a single layer in the directory tree
    const completions = glob.sync(pathPrefix + '*')
        // Add a trailing slash to directories
        .map(path => `${path}${isDir(path) ? '/' : ''}`)
        // Do not complete directories to themselves
        .filter(path => !(path.endsWith('/') && path === pathPrefix));

    return [completions, lastEntry];
}

function isDir(path) {
    try {
        return lstatSync(path).isDirectory();
    } catch (e) {
        return false;
    }
}

export function readLocalFile(segments) {
    return readFileSync(path.join(...[os.homedir(), ".dotfiles", "ai", "scripts", ...segments]), "utf8").trim();
}
