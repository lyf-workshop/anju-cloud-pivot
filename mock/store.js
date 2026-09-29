// One small in-memory store, shared by all pages during this run.
const fixtures = require("./data");
const clone = (value) => JSON.parse(JSON.stringify(value));
let state;
function reset() {
  state = {
    user: clone(fixtures.user),
    reports: clone(fixtures.reports),
    drills: clone(fixtures.drills),
    nextId: 1,
  };
  return state;
}
function get() {
  return state || reset();
}
function id(kind) {
  const data = get();
  return `demo-${kind}-${Date.now().toString(36)}-${data.nextId++}`;
}
module.exports = { get, reset, id, clone };
