#!/bin/bash

# Sanitize
rm -r ~/bin ~/.shell

# Update shell
cp -r bin ~/bin
cp -r bash ~/.shell
mv ~/.shell/bash_profile ~/.bash_profile

# Update Sublime settings
cp Sublime/User/* ~/Library/Application\ Support/Sublime\ Text\ 3/Packages/User/

# Reload current shell
source ~/.bash_profile
