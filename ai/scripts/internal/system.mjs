import { readLocalFile } from "./file.mjs";

export function getPrompt(name) {
    return readLocalFile(["prompts", `${name}.prompt`]);
}
