const path = require("node:path");

const websiteRoot = "website";
const mobileRoot = "mobile";

function mobile(file = "") {
  return file ? path.posix.join(mobileRoot, file.replaceAll("\\", "/")) : mobileRoot;
}

module.exports = { websiteRoot, mobileRoot, mobile };
