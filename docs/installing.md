# Installing

These steps should be done once on a new machine. Be sure to update these instructions whenever the system changes in a way that can't be cleanly automated with existing infrastructure.

# Install MacOS applications

When provisioning a new machine, download the following applications.

- [Chrome](https://dl.google.com/chrome/mac/universal/stable/GGRO/googlechrome.dmg)
- [Firefox](https://download-installer.cdn.mozilla.net/pub/firefox/releases/96.0.1/mac/en-US/Firefox%2096.0.1.dmg)
- [iTerm2](https://iterm2.com/downloads/stable/iTerm2-3_4_15.zip)
- [Slack](https://downloads.slack-edge.com/releases/macos/4.23.0/prod/universal/Slack-4.23.0-macOS.dmg)
- [Spotify](https://download.scdn.co/SpotifyInstaller.zip)
- [VLC](https://mirror.clarkson.edu/videolan/vlc/3.0.16/macosx/vlc-3.0.16-intel64.dmg)
- [VSCode](https://az764295.vo.msecnd.net/stable/899d46d82c4c95423fb7e10e68eba52050e30ba3/VSCode-darwin-universal.zip)
- [Zoom](https://cdn.zoom.us/prod/5.9.1.3506/Zoom.pkg)

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
