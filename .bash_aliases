# Custom paths
export PATH=~/bin:~/go/bin:$PATH

export GOPATH=~/go

# Custom (colored) prompt
export PS1="\[\033[36m\]\u\[\033[m\]@\[\e[36;1m\]\h:\[\e[32;1m\]\w$ \[\e[0m\]"

# Simple aliases
alias ..='cd ..'
alias rm='rm -i'
alias mv='mv -i'
alias cp='cp -i'
alias ls='ls -GFh'

alias o='open -a Finder .'
alias s='open -a "Sublime Text" .'
alias c='open -a "Google Chrome"'

alias sudo='sudo '
alias grep='grep --color=auto'

# Recursively delete .DS_Store files
alias cleanup="find . -type f -name '*.DS_Store' -ls -delete"
