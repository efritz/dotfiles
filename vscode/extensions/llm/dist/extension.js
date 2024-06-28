"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var import_child_process = require("child_process");
function activate(context) {
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
      editor.edit(
        (editBuilder) => replaceAll(editor, editBuilder, newContents)
      );
    })
  );
}
function deactivate() {
}
var replaceAll = (editor, eb, newContents) => {
  const fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length)
  );
  eb.replace(fullRange, newContents);
};
var executeSubcommand = (command, args, input) => new Promise((resolve, reject) => {
  const subcommand = (0, import_child_process.spawn)(command, args);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
