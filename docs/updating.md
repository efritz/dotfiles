# Updating

Be sure to update dotfiles whenever an operating system package, application extension, or global (multi-machine) setting changes.

## Brew packages

After installing a new package via brew, run the following commands to update the Brewfile.

```bash
brew bundle dump --force
```

## Gitignore

The global gitignore file is generted via `gibo`. To add additional files from GitHub's [gitignore repo](https://github.com/github/gitignore), modify the following command.

```bash
gibo dump macOS VisualStudioCode JetBrains TeX > git/gitignore_global
```

## VSCode extensions

After installing a Visual Studio Code extension, run the following command to update the extensions list.

```bash
code --list-extensions > vscode/extensions
```