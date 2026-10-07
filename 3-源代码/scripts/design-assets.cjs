// Locally authored vector illustrations based on the supplied V1.1 overview.
// No screenshot backgrounds, remote URLs, or 3D dependencies are used by the app.
const fs = require('node:fs');
const sharp = require('sharp');
const dir = 'mobile/assets/illustrations';
const svg = (body, w = 600, h = 520) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const tree = (x,y,s=1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="18" rx="30" ry="11" fill="#d9e6ed"/><path d="M0-26V17" stroke="#6b9990" stroke-width="7"/><ellipse cy="-35" rx="23" ry="36" fill="#a9cfbd" stroke="#6f9f91" stroke-width="5"/></g>`;
let windows = '';
for (let row=0;row<12;row++) for (let col=0;col<5;col++) {
  const x=186+col*22,y=153+row*20+col*7;
  windows+=`<path d="m${x} ${y} 14 4v12l-14-4Z" fill="#6b9dbb"/>`;
  const rx=310+col*20,ry=181+row*20-col*7;
  windows+=`<path d="m${rx} ${ry} 12-4v12l-12 4Z" fill="#598caa"/>`;
}
const building=svg(`<ellipse cx="299" cy="463" rx="202" ry="31" fill="#dce8f0"/><path d="m130 418 152-46 177 68-152 47Z" fill="#e4eef4"/><path d="m162 120 127-49 135 50-125 49Z" fill="#f9fcff"/><path d="m174 121 115-42 122 44-112 41Z" fill="#c5d8e8"/><path d="M162 120v297l137 51V170Z" fill="#d5e5f0"/><path d="m299 170 125-49v296l-125 51Z" fill="#b7cede"/><path d="M168 122v291l9 4V126ZM286 168v292l9 4V171" fill="#eff7fb"/>${windows}<path d="m286 427 13 5v36l-13-5Z" fill="#5c8cac"/>${tree(109,425)}${tree(468,438,.9)}`);
const backdrop='<rect width="220" height="180" rx="14" fill="#eaf3fa"/><path d="m28 95 60-20 32 12v73l-92-7Z" fill="#cee0ed"/><path d="m117 46 66-24 21 14v120l-87 12Z" fill="#b2cbde"/><path d="m28 153 86-13 90 17-84 20Z" fill="#dce9f1"/>';
const box=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="m0 8 27-8 24 8-26 9Z" fill="#dbc5a7"/><path d="M0 8v31l25 10V17Z" fill="#c9ae8b"/><path d="m25 17 26-9v32L25 49Z" fill="#b99a75"/><path d="m12 4 25 8v11" fill="none" stroke="#efddc2" stroke-width="4"/></g>`;
const pictures={
  building,
  obstruction:svg(backdrop+box(32,105)+box(76,118,.75)+box(46,70,.85),220,180),
  equipment:svg(backdrop+'<path d="M106 38v38" stroke="#668ba8" stroke-width="7"/><path d="m78 77 16-17h26l17 17Z" fill="#769eb8"/><path d="m85 82 43 0-8 32H94Z" fill="#ffdc8f"/><path d="M79 119 66 134M135 119l14 15" stroke="#ddb873" stroke-width="5"/>',220,180),
  electrical:svg(backdrop+'<rect x="72" y="49" width="77" height="99" rx="10" fill="#d3513c"/><rect x="81" y="61" width="59" height="73" rx="5" fill="#fffaf2"/><path d="M97 84v19M123 84v19M103 116h14" stroke="#66849c" stroke-width="6"/>',220,180),
  fire:svg(backdrop+'<rect x="87" y="68" width="53" height="78" rx="8" fill="#d94c36"/><path d="M103 69V45h31v24M135 48h15v50" fill="none" stroke="#44677c" stroke-width="7"/><rect x="95" y="90" width="36" height="28" rx="3" fill="#fff8ef"/>',220,180),
};
async function main(){fs.mkdirSync(dir,{recursive:true});for(const [name,source]of Object.entries(pictures)){await sharp(Buffer.from(source)).png().toFile(`${dir}/${name}.png`)} }
main().catch(e=>{console.error(e);process.exitCode=1});
