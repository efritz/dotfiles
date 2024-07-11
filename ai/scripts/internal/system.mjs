import { readLocalFile } from "./file.mjs";

export async function getPrompt(name) {
    return readLocalFile(["prompts", `${name}.prompt`]);
}
