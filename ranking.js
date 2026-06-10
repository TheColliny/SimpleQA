// ranking.js — pure, framework-free ranking + freshness helpers for the Q&A board.
// No dependencies. Browser: attaches to window.QARanking (load BEFORE QA.js).
// Node (tests): require('./ranking.js').
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QARanking = api;
})(typeof self !== "undefined" ? self : this, function () {
  var LN2 = Math.LN2;

  // Balanced score: ln(votes+1) - (ageMin/halfLifeMin)*ln2
  // (log form of (votes+1) * 0.5^(ageMin/halfLifeMin); same ordering, no underflow).
  // Guard: a non-positive/missing halfLifeMin would make the decay term NaN/Infinity and
  // silently corrupt the comparator, so fall back to votes-only (no time decay).
  function balancedScore(q, now, halfLifeMin) {
    var votes = (q.upvotes && q.upvotes.length) || 0;
    if (!(halfLifeMin > 0)) return Math.log(votes + 1);
    var ageMin = (now - q.timestamp) / 60000;
    return Math.log(votes + 1) - (ageMin / halfLifeMin) * LN2;
  }

  // Freshness in [0,1]: 1.0 at post time, linearly to 0.0 at windowMin minutes old.
  // Guard: a non-positive/missing windowMin returns 0 (nothing is treated as "new").
  function freshness(q, now, windowMin) {
    if (!(windowMin > 0)) return 0;
    var ageMin = (now - q.timestamp) / 60000;
    var f = 1 - ageMin / windowMin;
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }

  // Tie-breaker; assumes string ids (the app's question ids are strings).
  function idTie(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }

  function byVotes(a, b) {
    var diff = ((b.upvotes && b.upvotes.length) || 0) - ((a.upvotes && a.upvotes.length) || 0);
    if (diff !== 0) return diff;
    var t = b.timestamp - a.timestamp;
    return t !== 0 ? t : idTie(a, b);
  }

  function byNewest(a, b) {
    var t = b.timestamp - a.timestamp;
    return t !== 0 ? t : idTie(a, b);
  }

  function byBalanced(a, b, now, halfLifeMin) {
    var d = balancedScore(b, now, halfLifeMin) - balancedScore(a, now, halfLifeMin);
    if (d !== 0) return d;
    var t = b.timestamp - a.timestamp;
    return t !== 0 ? t : idTie(a, b);
  }

  // mode: "balanced" | "votes" | "newest" (any other value uses balanced, the default).
  // opts: { now, halfLifeMin } (used by balanced only). Does not mutate the input array.
  function sortQuestions(questions, mode, opts) {
    opts = opts || {};
    var now = opts.now, halfLifeMin = opts.halfLifeMin, cmp;
    if (mode === "votes") cmp = byVotes;
    else if (mode === "newest") cmp = byNewest;
    else cmp = function (a, b) { return byBalanced(a, b, now, halfLifeMin); };
    var unanswered = questions.filter(function (q) { return !q.answered; });
    var answered = questions.filter(function (q) { return q.answered; });
    unanswered.sort(cmp);
    answered.sort(cmp);
    return unanswered.concat(answered);
  }

  return { balancedScore: balancedScore, sortQuestions: sortQuestions, freshness: freshness };
});
