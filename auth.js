// auth.js — pure, framework-free auth-state helper for the Q&A board.
// Decides whether the admin area shows the first-run "set password" form
// or the normal login. No dependencies. Browser: attaches to window.QAAuth
// (load BEFORE QA.js). Node (tests): require('./auth.js').
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QAAuth = api;
})(typeof self !== "undefined" ? self : this, function () {
  // payload.needsSetup is sent by api.php when no admin password hash exists yet.
  function setupState(payload) {
    return payload && payload.needsSetup ? "setup" : "login";
  }

  return { setupState: setupState };
});
