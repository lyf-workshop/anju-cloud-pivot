#!/usr/bin/env bash
set -euo pipefail

download_root=/srv/anju-cloud-pivot-downloads/judge-downloads
password_file=/etc/anju-cloud-pivot/judge-download-password
auth_fragment=/etc/caddy/anju-download.caddy
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

install -d -o root -g caddy -m 0750 /srv/anju-cloud-pivot-downloads "$download_root"
install -d -o root -g root -m 0700 /srv/anju-cloud-pivot-downloads/archive
for previous in Anju-CloudPivot-Windows-1.3.0-Setup.exe Anju-CloudPivot-Android-1.3.0.apk Anju-CloudPivot-Windows-1.2.0-Setup.exe Anju-CloudPivot-Android-1.2.0.apk; do
  if [[ -f "$download_root/$previous" ]]; then
    mv "$download_root/$previous" "/srv/anju-cloud-pivot-downloads/archive/${stamp}-${previous}"
  fi
done
install -o root -g caddy -m 0640 /tmp/Anju-CloudPivot-Windows-1.4.0-Setup.exe "$download_root/"
install -o root -g caddy -m 0640 /tmp/Anju-CloudPivot-Android-1.4.0.apk "$download_root/"
install -o root -g caddy -m 0640 /tmp/anju-judge-download-index.html "$download_root/index.html"
install -o root -g caddy -m 0640 /tmp/anju-judge-SHA256SUMS.txt "$download_root/SHA256SUMS.txt"

(cd "$download_root" && sha256sum --check SHA256SUMS.txt)

if [[ ! -s "$password_file" ]]; then
  password_tmp="$(mktemp /etc/anju-cloud-pivot/judge-download-password.XXXXXX)"
  openssl rand -base64 32 | tr -d '\n' > "$password_tmp"
  chown root:root "$password_tmp"
  chmod 0600 "$password_tmp"
  mv -f "$password_tmp" "$password_file"
fi

password="$(<"$password_file")"
password_hash="$(caddy hash-password --plaintext "$password")"
fragment_tmp="$(mktemp /etc/caddy/anju-download.caddy.XXXXXX)"
cat > "$fragment_tmp" <<EOF
handle /judge-downloads/* {
  basic_auth {
    reviewer $password_hash
  }
  header Cache-Control "private, no-store"
  header X-Robots-Tag "noindex, nofollow, noarchive"
  root * /srv/anju-cloud-pivot-downloads
  file_server
}
EOF
chown root:caddy "$fragment_tmp"
chmod 0640 "$fragment_tmp"
mv -f "$fragment_tmp" "$auth_fragment"

caddy validate --config /tmp/Caddyfile.anju-judge --adapter caddyfile
backup_path="/etc/caddy/Caddyfile.anju-pre-judge-$stamp"
cp -a /etc/caddy/Caddyfile "$backup_path"
install -o root -g root -m 0644 /tmp/Caddyfile.anju-judge /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy

unauthorized_status="$(curl -sS -o /dev/null -w '%{http_code}' https://xn--9kqy92aeqav77a.com/judge-downloads/)"
authorized_status="$(curl -sS -u "reviewer:$password" -o /dev/null -w '%{http_code}' https://xn--9kqy92aeqav77a.com/judge-downloads/)"
windows_status="$(curl -sS -u "reviewer:$password" -r 0-0 -o /dev/null -w '%{http_code}' https://xn--9kqy92aeqav77a.com/judge-downloads/Anju-CloudPivot-Windows-1.4.0-Setup.exe)"
android_status="$(curl -sS -u "reviewer:$password" -r 0-0 -o /dev/null -w '%{http_code}' https://xn--9kqy92aeqav77a.com/judge-downloads/Anju-CloudPivot-Android-1.4.0.apk)"

printf 'caddy_backup=%s\n' "$backup_path"
printf 'unauthorized_status=%s\n' "$unauthorized_status"
printf 'authorized_status=%s\n' "$authorized_status"
printf 'windows_range_status=%s\n' "$windows_status"
printf 'android_range_status=%s\n' "$android_status"
test "$unauthorized_status" = 401
test "$authorized_status" = 200
case "$windows_status" in 200|206) ;; *) exit 1 ;; esac
case "$android_status" in 200|206) ;; *) exit 1 ;; esac
