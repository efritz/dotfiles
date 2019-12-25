# Dotfiles

Dotfiles uses [dotbot](https://github.com/anishathalye/dotbot) for installation.

### Prerequisites

1. Install [homebrew](https://brew.sh/):

```bash
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

2. Install [oh-my-zsh](https://ohmyz.sh/):

```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### Installation

Run `./install` to symlink config files from this repo into your home directory and install MacOS packages and VSCode extensions.

This repo must be located in a stable location, otherwise symlinks will break. The install script is idempotent and running it after modification will remove dead links.

### Updating

The global gitignore file is generted via `gibo`. To add additional files from GitHub's [gitignore repo](https://github.com/github/gitignore), modify the following command.

```bash
gibo dump macOS VisualStudioCode JetBrains TeX > git/gitignore_global
```

After installing a Visual Studio Code extension, run the following command to update the extensions list.

```bash
code --list-extensions > vscode/extensions
```
