#!/usr/bin/env bash

cd "$(dirname "${BASH_SOURCE}")";

git pull origin master;

function doIt() {
    # Everything in bash and git go directly into
    # $HOME with a dot prefixed to the basename.
    for file in bash/** git/**; do
        cp $file ~/.$(basename $file)
    done;
    
    # Merge binaries
    rsync -avh --no-perms bin ~/

    # Apply settings immediately
    source ~/.bash_profile;
}

if [ "$1" == "--force" -o "$1" == "-f" ]; then
    doIt;
else
    read -p "This may overwrite existing files in your home directory. Are you sure? (y/n) " -n 1;
    echo "";
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        doIt;
    fi;
fi;

unset doIt;
