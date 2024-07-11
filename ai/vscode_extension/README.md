# LLM commands in-editor

This is a VSCode extension that runs `~/.dotfiles/bin/llm` commands in-editor.

## Commands

> Edit with LLM scripts

This will call `llm edit` with the contents of the active editor window and replace its contents.

## Building

To create a new version:

```bash
pnpm package
pnpm package-vsix
```

## Installing

To install a new version, open the command palette:

> Extensions: Install from VSIX

And select the new `llm-0.0.1.vsix` file in this directory.
