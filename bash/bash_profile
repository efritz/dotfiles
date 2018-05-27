#!/usr/bin/env bash

# Load the shell dotfiles, and then some:
for file in ~/.bash_{aliases,exports,paths,prompt}; do
    [ -r "$file" ] && [ -f "$file" ] && source "$file";
done;

unset file;

# Case-insensitive globbing (used in pathname expansion)
shopt -s nocaseglob;

# Append to the Bash history file, rather than overwriting it
shopt -s histappend;

# Autocorrect typos in path names when using `cd`
shopt -s cdspell;

if [ -f ~/.bash_local ]; then
	source ~/.bash_local
fi;
