const { define } = require("../../utils/page");

define({
  goHome() {
    wx.switchTab({ url: "/pages/index/index" });
  },
  goEdit() {
    wx.redirectTo({ url: "/pages/register/register?mode=edit" });
  },
});
