import fs from "node:fs";
import path from "node:path";
import { settings } from "./config.js";
import { Store } from "./db.js";
const cfg = settings();
if (process.argv[2] === "reset-demo") {
  const allowed = path.resolve("server/data/demo.sqlite");
  if (
    cfg.mode !== "demo" ||
    cfg.production ||
    cfg.dbPath !== allowed ||
    !process.argv.includes("--confirm")
  )
    throw new Error(
      "Reset allowed only for default local demo database with --confirm; stop server first",
    );
  // Verified exact default database and upload paths; no user-supplied recursive deletion.
  for (const suffix of ["", "-wal", "-shm"])
    fs.rmSync(`${allowed}${suffix}`, { force: true });
  fs.rmSync(`${allowed}.uploads`, { recursive: true, force: true });
}
const store = new Store(cfg);
store.close();
console.log(
  `Database initialized (${cfg.mode}); existing business rows preserved unless explicit reset requested.`,
);
