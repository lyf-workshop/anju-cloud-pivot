const fs = require("node:fs"),
  sharp = require("sharp");
const shapes = {
  home: '<path d="m6 23 18-15 18 15M11 21v20h26V21M20 41V29h8v12"/>',
  hazard: '<path d="m24 6 20 35H4L24 6Z M24 19v10M24 34v1"/>',
  building:
    '<path d="M10 42V8h28v34M5 42h38M17 16h3m8 0h3M17 24h3m8 0h3M17 32h3m8 0h3M21 42v-5h6v5"/>',
  user: '<circle cx="24" cy="16" r="8"/><path d="M9 42v-4a15 15 0 0 1 30 0v4"/>',
  shield:
    '<path d="M24 5 40 11v13c0 10-10 17-16 20C18 41 8 34 8 24V11L24 5Z M17 24l5 5 10-11"/>',
  report: '<path d="M30 7H10v35h28V18M30 7v11h8L30 7ZM17 24h14M17 31h10"/>',
  drill:
    '<circle cx="29" cy="9" r="4"/><path d="m17 21 9-6 8 9 8 2M26 15l-5 15-9 12M21 30l12 2 2 10M17 21l-8 1"/>',
  phone:
    '<path d="m12 6 7 10-5 5c3 7 7 11 14 14l5-5 10 7c-3 9-9 9-16 5C15 36 8 29 4 17 2 11 6 6 12 6Z"/>',
  device:
    '<rect x="10" y="9" width="28" height="33" rx="5"/><path d="M18 18h12M18 25h12M22 34h4M20 4h8"/>',
  pin: '<path d="M38 20c0 10-14 24-14 24S10 30 10 20a14 14 0 1 1 28 0Z"/><circle cx="24" cy="20" r="5"/>',
  bell: '<path d="M10 33c4-5 4-9 4-15a10 10 0 0 1 20 0c0 6 0 10 4 15H10ZM20 40h8M24 4v3"/>',
  check: '<path d="m10 24 9 9 20-21"/>',
  camera:
    '<path d="M5 15h9l4-6h12l4 6h9v26H5V15Z"/><circle cx="24" cy="27" r="8"/>',
  help: '<circle cx="24" cy="24" r="19"/><path d="M17 18c0-8 14-8 14 0 0 5-7 5-7 10M24 34v1"/>',
  exit: '<path d="M21 8H7v34h14M19 25h23m-8-8 8 8-8 8M12 25h2"/>',
  wrench: '<path d="M30 6a12 12 0 0 0-13 16L5 35a5 5 0 0 0 8 8l13-13A12 12 0 0 0 42 16l-8 8-9-9 8-8Z"/>',
  book: '<path d="M24 12c-6-5-13-5-20-4v29c8-2 14-1 20 4 6-5 12-6 20-4V8c-7-1-14-1-20 4ZM24 12v29"/>',
  calendar: '<rect x="6" y="10" width="36" height="32" rx="4"/><path d="M15 5v10M33 5v10M6 22h36M16 30h2M28 30h2"/>',
  cloud: '<path d="M12 36a10 10 0 0 1-1-20 14 14 0 0 1 26-2 11 11 0 0 1 0 22H12Z"/>',
  cube: '<path d="m24 4 19 11v22L24 47 5 37V15L24 4ZM5 15l19 11 19-11M24 26v21M14 10l20 11"/>',
  settings: '<path d="m18 5 12 0 2 7 6 4 7-1v12l-7 2-4 6 1 7H23l-2-7-6-4-7 1V20l7-2 4-6Z"/><circle cx="26" cy="24" r="7"/>',
};
async function main() {
  fs.mkdirSync("assets/icons", { recursive: true });
  for (const [name, body] of Object.entries(shapes)) {
    for (const active of [false,true,'white']) {
      const color = active === 'white' ? '#FFFFFF' : active
        ? "#D44730"
        : name === "check"
          ? "#268872"
          : "#648CB0";
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="' +
        color +
        '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        body +
        "</g></svg>";
      await sharp(Buffer.from(svg))
        .resize(96, 96)
        .png()
        .toFile("assets/icons/" + name + (active === 'white' ? '-white' : active ? "-active" : "") + ".png");
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
