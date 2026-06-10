// redirect.js — pure, framework-free redirect-decision helper for the Q&A board.
// No dependencies. Browser: attaches to window.QARedirect (load BEFORE QA.js).
// Node (tests): require('./redirect.js').
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QARedirect = api;
})(typeof self !== "undefined" ? self : this, function () {
  // Decide what a client should do about an active redirect.
  // data: { redirectUrl } — server already blanks redirectUrl once the 60-min window lapses,
  //        so any non-empty value here means "active".
  // opts: { isAdmin, dismissedUrl }
  // returns: "none" (render board) | "overlay" (show 5s countdown overlay)
  function action(data, opts) {
    data = data || {};
    opts = opts || {};
    var url = data.redirectUrl || "";
    if (opts.isAdmin) return "none";              // admins keep control of the board
    if (!url) return "none";                      // no active redirect
    if (opts.dismissedUrl === url) return "none"; // user chose "stay" for this exact URL
    return "overlay";
  }

  return { action: action };
});
