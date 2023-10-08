# Installing

These steps should be done once on a new machine. Be sure to update these instructions whenever the system changes in a way that can't be cleanly automated with existing infrastructure.

# Install dotfiles

1. Install [homebrew](https://brew.sh/):

```bash
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

2. Install [oh-my-zsh](https://ohmyz.sh/):

```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

Run `./install` to symlink config files from this repo into your home directory and install MacOS packages and VSCode extensions.

This repo must be located in a stable location, otherwise symlinks will break. The install script is idempotent and running it after modification will remove dead links.

# Setup pass store

See [efritz/pass-store](https://github.com/efritz/pass-store) on GitHub.

# Install Google Cloud SDK

TODO
