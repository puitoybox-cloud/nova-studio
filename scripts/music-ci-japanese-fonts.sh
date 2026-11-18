#!/usr/bin/env bash
set -euo pipefail

if [[ "$(fc-match -f '%{family}' 'Noto Sans CJK JP')" != *"Noto Sans CJK JP"* ]]; then
  sources="$(mktemp --suffix=.list)"
  trap 'rm -f "$sources"' EXIT
  chmod 644 "$sources"
  printf '%s\n' 'deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://archive.ubuntu.com/ubuntu noble main' > "$sources"
  apt_source=(-o "Dir::Etc::sourcelist=$sources" -o Dir::Etc::sourceparts=- -o Acquire::Retries=2 -o Acquire::https::Timeout=30)
  # Use only the explicit signed archive, independent of runner mirror configuration.
  sudo apt-get "${apt_source[@]}" update
  sudo timeout 180s apt-get "${apt_source[@]}" install -y fonts-noto-cjk
fi
[[ "$(fc-match -f '%{family}' 'Noto Sans CJK JP')" == *"Noto Sans CJK JP"* ]]
