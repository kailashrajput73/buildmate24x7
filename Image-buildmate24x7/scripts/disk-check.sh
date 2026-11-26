#!/usr/bin/env bash
set -euo pipefail
PATH_TO_CHECK="${1:-/var/lib/buildmate-image-cloud}"
WARN="${DISK_WARN_PERCENT:-80}"
CRIT="${DISK_CRIT_PERCENT:-90}"
USED="$(df -P "$PATH_TO_CHECK" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
INODES="$(df -Pi "$PATH_TO_CHECK" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
printf 'disk_used_percent=%s inode_used_percent=%s path=%s\n' "$USED" "$INODES" "$PATH_TO_CHECK"
if (( USED >= CRIT || INODES >= CRIT )); then exit 2; fi
if (( USED >= WARN || INODES >= WARN )); then exit 1; fi
