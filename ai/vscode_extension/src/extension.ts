import * as vscode from "vscode";
import { spawn } from "child_process";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("llm.edit", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          "Cannot edit file, expected an active text editor."
        );
        return;
      }

      const oldContents = editor.document.getText();
      if (oldContents === "") {
        vscode.window.showErrorMessage(
          "Cannot edit file, expected a non-empty file."
        );
        return;
      }

      const newContents = await executeSubcommand("llm", ["edit"], oldContents);

      editor.edit((editBuilder) =>
        replaceAll(editor, editBuilder, newContents)
      );
    })
  );
}

export function deactivate() {}

const replaceAll = (
  editor: vscode.TextEditor,
  eb: vscode.TextEditorEdit,
  newContents: string
): void => {
  const fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length)
  );

  eb.replace(fullRange, newContents);
};

const executeSubcommand = (
  command: string,
  args: string[],
  input: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    const subcommand = spawn(command, args);

    let stdoutData = "";
    subcommand.stdout.on("data", (data) => {
      stdoutData += data;
    });

    let stderrData = "";
    subcommand.stderr.on("data", (data) => {
      stderrData += data;
    });

    subcommand.on("close", (code) => {
      if (code === 0) {
        resolve(stdoutData);
        return;
      }

      reject(
        new Error(`Subcommand process exited with code ${code}: ${stderrData}`)
      );
    });

    subcommand.stdin.write(input);
    subcommand.stdin.end();
  });
