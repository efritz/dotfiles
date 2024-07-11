import { readLocalFile } from "./files.mjs";

export function getPrompt(name) {
    return readLocalFile(["prompts", `${name}.prompt`]);
}
