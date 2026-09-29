// Register once. The visible page owns the platform-required consent button.
let pending = null;
let activePage = null;
let registered = false;
function register(page) {
  if (!wx.onNeedPrivacyAuthorization) return;
  activePage = page;
  if(registered)return;
  registered = true;
  wx.onNeedPrivacyAuthorization((resolve) => {
    if(!activePage){resolve({event:'disagree'});return;}
    pending = resolve;
    activePage.setData({ showPrivacy: true });
  });
}
function settle(page, agree) {
  if (pending) {
    pending(
      agree
        ? { event: "agree", buttonId: "privacy-agree" }
        : { event: "disagree" },
    );
    pending = null;
  }
  page.setData({ showPrivacy: false });
}
function unregister(page) {
  if(activePage!==page)return;
  if (pending) settle(page, false);
  activePage = null;
}
module.exports = { register, settle, unregister };
