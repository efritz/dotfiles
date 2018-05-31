- defaults:
    link:
      create: true
      relink: true

- clean: ['~']

- link:
    ~/.dotfiles: ''

    # Bash
    ~/.hushlogin: bash/hushlogin
    ~/.bash_aliases: bash/bash_aliases
    ~/.bash_exports: bash/bash_exports
    ~/.bash_functions: bash/bash_functions
    ~/.bash_paths: bash/bash_paths
    ~/.bash_profile: bash/bash_profile
    ~/.bash_prompt: bash/bash_prompt

    # Git
    ~/.gitconfig: git/gitconfig
    ~/.gitignore_global: git/gitignore_global
