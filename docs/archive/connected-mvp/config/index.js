// Client configuration is non-secret. Invalid/missing config must fail explicitly.
const defaults = {
  mode: "demo",
  apiBaseUrl: "http://127.0.0.1:3000/api",
  requestTimeout: 12000,
};
const local = require("./local");
module.exports = Object.assign({}, defaults, local);
