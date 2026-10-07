#!/usr/bin/env bash
set -euo pipefail

password_file=/etc/anju-cloud-pivot/judge-download-password
password="$(sudo cat "$password_file")"

printf 'secret_permissions='
sudo stat -c '%U:%G:%a' "$password_file"
printf 'authorized_index_status='
curl -sS -u "reviewer:$password" -o /dev/null -w '%{http_code}\n' https://xn--9kqy92aeqav77a.com/judge-downloads/
index_html="$(curl -fsS -u "reviewer:$password" https://xn--9kqy92aeqav77a.com/judge-downloads/)"
grep -q 'Anju-CloudPivot-Windows-1.3.0-Setup.exe' <<<"$index_html"
grep -q 'Anju-CloudPivot-Android-1.3.0.apk' <<<"$index_html"
printf 'windows_range_status='
curl -sS -u "reviewer:$password" -r 0-0 -o /dev/null -w '%{http_code} %{size_download}\n' \
  https://xn--9kqy92aeqav77a.com/judge-downloads/Anju-CloudPivot-Windows-1.3.0-Setup.exe
printf 'android_range_status='
curl -sS -u "reviewer:$password" -r 0-0 -o /dev/null -w '%{http_code} %{size_download}\n' \
  https://xn--9kqy92aeqav77a.com/judge-downloads/Anju-CloudPivot-Android-1.3.0.apk
printf 'remote_checksums='
curl -fsS -u "reviewer:$password" https://xn--9kqy92aeqav77a.com/judge-downloads/SHA256SUMS.txt
printf '%s\n' 'download_headers:'
curl -fsSI -u "reviewer:$password" https://xn--9kqy92aeqav77a.com/judge-downloads/ \
  | grep -Ei 'HTTP/|content-type:|cache-control:|x-robots-tag:'
printf 'api_health='
curl -fsS https://xn--9kqy92aeqav77a.com/api/health
printf '\noriginal_site_status='
curl -sS -o /dev/null -w '%{http_code}' https://codetether.org/
printf '\nservices='
systemctl is-active anju-cloud-pivot caddy anju-cloud-pivot-backup.timer | paste -sd, -
printf 'current_release='
readlink -f /opt/anju-cloud-pivot/current
