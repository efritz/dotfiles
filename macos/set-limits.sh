#!/bin/bash -e

cd "$(dirname "${BASH_SOURCE[0]}")"/..

for basename in 'maxfiles' 'maxproc'; do
    cp "./macos/limit.${basename}.plist" /Library/LaunchDaemons
    chown root:wheel "/Library/LaunchDaemons/limit.${basename}.plist"
    launchctl load -w "/Library/LaunchDaemons/limit.${basename}.plist"
done
