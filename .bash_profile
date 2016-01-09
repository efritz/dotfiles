load_dotfiles() {
    declare -a files=(
        $HOME/.shell/bash_aliases
        $HOME/.shell/bash_paths
        $HOME/.shell/bash_exports
        $HOME/.shell/bash_prompt
    )

    for index in ${!files[*]}
    do
        if [[ -r ${files[$index]} ]]; then
            source ${files[$index]}
        fi
    done
}

load_dotfiles
unset load_dotfiles
