// Reference only: the running mini program reads config/index.js.
// Use npm run client:local / client:showcase to select the adapter explicitly.
module.exports = {
  mode: "local", // local API demo data; showcase offline; api production
  apiBaseUrl: "http://127.0.0.1:3000/api", // Computer loopback, not a physical phone address
  requestTimeout: 12000,
  demoAccount: "resident-a",
};
