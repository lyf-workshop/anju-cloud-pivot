// A UI-only login flag. There is no real identity or business token in the showcase.
let current = null;
module.exports = {
  get: () => current,
  set: (value) => {
    current = value;
  },
  clear() {
    current = null;
    if (typeof getCurrentPages === "function")
      getCurrentPages().forEach((p) => {
        if (p.resetPrivateView) p.resetPrivateView();
      });
  },
};
