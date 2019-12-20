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

Run `brew bundle` in this directory to install OS-level packags.

Run `./install` to symlink config files from this repo into your home directory. This requires that this repo is in a stable location (otherwise symlinks will break). Running the install script a second time will remove dead links.
