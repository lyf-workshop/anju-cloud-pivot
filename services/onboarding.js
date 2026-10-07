const config = require("../config/index");
const session = require("./session");

function key() {
  return session.privateKey("onboarding-complete:v1");
}

function required(user) {
  if (!user || !user.household) return true;
  if (config.mode === "showcase") return false;
  if (config.loginMode !== "demo-session") return false;
  return wx.getStorageSync(key()) !== true;
}

function complete() {
  if (config.mode === "showcase") return;
  wx.setStorageSync(key(), true);
}

module.exports = { required, complete };
