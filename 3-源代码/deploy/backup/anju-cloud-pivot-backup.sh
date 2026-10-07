#!/bin/sh
set -eu
umask 077

backup_root=/var/backups/anju-cloud-pivot
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$backup_root/$stamp"
mkdir -p "$target"

BACKUP_TARGET="$target/demo.sqlite" /usr/bin/node --input-type=module -e '
  import { DatabaseSync } from "node:sqlite";
  const source = "/var/lib/anju-cloud-pivot/demo.sqlite";
  const target = process.env.BACKUP_TARGET.replaceAll("\u0027", "\u0027\u0027");
  const db = new DatabaseSync(source, { readOnly: true });
  db.exec(`VACUUM INTO \u0027${target}\u0027`);
  db.close();
'

if [ -d /var/lib/anju-cloud-pivot/demo.sqlite.uploads ]; then
  tar -C /var/lib/anju-cloud-pivot -czf "$target/uploads.tar.gz" demo.sqlite.uploads
fi
sha256sum "$target"/* > "$target/SHA256SUMS"
date -u +%FT%TZ > "$target/COMPLETE"
printf 'backup=%s\n' "$target"
