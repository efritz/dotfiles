#!/usr/bin/env bash

# Allow aliases to be used with sudo
alias sudo="sudo "

# Easier navigation
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias ~="cd ~"
alias -- -="cd -"
alias cdp='cd `pwd -P`'

# Sane default flags
alias rm='rm -i'
alias mv='mv -i'
alias cp='cp -i'
alias ls='ls -GFh'
alias grep='grep --color=auto'

# Filesize
alias fs="stat -f \"%z bytes\""

# Stopwatch
alias timer='echo "Timer started. Stop with Ctrl-D." && date && time cat && date'

# IP addresses
alias ip="dig +short myip.opendns.com @resolver1.opendns.com"
alias localip="ipconfig getifaddr en0"

# Remove DS_Store files
alias cleanup="find . -type f -name '*.DS_Store' -ls -delete"
