<?php
// ============================================================
// Q&A Board — PHP backend (v2 — hardened)
// Drop this file next to QA.html / QA.js. Data is stored in
// data.json next to api.php; the accompanying .htaccess blocks
// direct browser access to it (Apache). For nginx, deny *.json
// + *.lock + *.new* in your server block.
// ============================================================

// --- HTTP method gate (must be POST) ---
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  http_response_code(405);
  header('Allow: POST');
  exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// --- CONFIG ---
$MAX_Q_LENGTH            = 500;
$DEFAULT_HALF_LIFE_MIN   = 60;             // balanced-ranking half-life default (must match QA.js)
$MIN_HALF_LIFE_MIN       = 5;              // (must match QA.js)
$MAX_HALF_LIFE_MIN       = 10080;          // 1 week (must match QA.js)
$MAX_NAME_LENGTH    = 40;
$MAX_QUESTIONS      = 1000;            // FIFO cap on stored questions
$MAX_BODY_BYTES     = 32768;           // 32 KB
$ADMIN_SESSION_MS   = 3600000;         // 1 h
$LOGIN_RATE_WINDOW  = 300000;          // 5 min
$LOGIN_RATE_MAX     = 5;               // attempts per window per IP
$REDIRECT_WINDOW_MS = 3600000;         // 60 min — how long a pushed poll redirect stays active
$MAX_URL_LENGTH     = 2048;            // cap on the redirect URL
$DEFAULT_MAX_PER_USER = 3;             // default per-person live-question cap (admin-configurable)
$MIN_MAX_PER_USER   = 1;
$MAX_MAX_PER_USER   = 20;
$DEFAULT_REFRESH_MS = 15000;           // default client poll interval (admin-configurable)
$MIN_REFRESH_MS     = 5000;            // 5s floor — server-protection guard
$MAX_REFRESH_MS     = 120000;          // 2 min ceiling
$DATA_FILE          = __DIR__ . '/data.json';
$LOCK_FILE          = __DIR__ . '/data.lock';

// --- Body size cap (before reading) ---
$declaredLen = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
if ($declaredLen > $MAX_BODY_BYTES) {
  http_response_code(413);
  echo json_encode(['error' => 'body_too_large']);
  exit;
}
$raw = file_get_contents('php://input', false, null, 0, $MAX_BODY_BYTES + 1);
if ($raw === false) $raw = '';
if (strlen($raw) > $MAX_BODY_BYTES) {
  http_response_code(413);
  echo json_encode(['error' => 'body_too_large']);
  exit;
}
$body = json_decode($raw, true);
if (!is_array($body)) $body = [];
$action = isset($body['action']) && is_string($body['action']) ? $body['action'] : 'list';

// --- CSRF Origin check for state-changing actions ---
$STATEFUL = ['submit', 'edit', 'vote', 'delete', 'answer', 'reset', 'set-config', 'set-redirect', 'set-password', 'admin-login', 'admin-logout'];
if (in_array($action, $STATEFUL, true)) {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  $host   = $_SERVER['HTTP_HOST']   ?? '';
  if ($origin !== '' && $host !== '') {
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
          || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
      ? 'https' : 'http';
    $expected = $proto . '://' . $host;
    if ($origin !== $expected) {
      http_response_code(403);
      echo json_encode(['error' => 'bad_origin']);
      exit;
    }
  }
}

// --- Identity from HttpOnly cookie (server-controlled) ---
$uid = $_COOKIE['qa_uid'] ?? '';
if (!is_string($uid) || !preg_match('/^[a-f0-9]{32}$/', $uid)) {
  $uid = bin2hex(random_bytes(16));
  setcookie('qa_uid', $uid, [
    'expires'  => time() + 31536000,    // 1 year
    'path'     => '/',
    'samesite' => 'Lax',
    'httponly' => true,
    'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
  ]);
}

// --- Acquire lock on a separate lock file (so rename of data.json is safe) ---
$lockFp = @fopen($LOCK_FILE, 'c');
if (!$lockFp) {
  http_response_code(500);
  echo json_encode(['error' => 'lock_unavailable']);
  exit;
}
if (!flock($lockFp, LOCK_EX)) {
  fclose($lockFp);
  http_response_code(500);
  echo json_encode(['error' => 'lock_failed']);
  exit;
}

// --- Read data.json fresh under lock ---
$dataRaw = @file_get_contents($DATA_FILE);
if ($dataRaw === false || $dataRaw === '') {
  $data = [];
} else {
  $data = json_decode($dataRaw, true);
  if (!is_array($data)) {
    // Corrupt non-empty file: refuse to clobber it, fail loud
    flock($lockFp, LOCK_UN);
    fclose($lockFp);
    http_response_code(500);
    echo json_encode(['error' => 'data_corrupt']);
    exit;
  }
}
if (!isset($data['questions']))     $data['questions']     = [];
if (!isset($data['adminSessions'])) $data['adminSessions'] = [];
if (!isset($data['loginAttempts'])) $data['loginAttempts'] = [];
if (!isset($data['adminPasswordHash']) || !is_string($data['adminPasswordHash'])) $data['adminPasswordHash'] = '';
if (!isset($data['redirectUrl']) || !is_string($data['redirectUrl'])) $data['redirectUrl'] = '';
if (!isset($data['redirectUntil'])) $data['redirectUntil'] = 0;
$data['redirectUntil'] = (int) $data['redirectUntil'];
$hl = isset($data['halfLifeMin']) ? (int) $data['halfLifeMin'] : $DEFAULT_HALF_LIFE_MIN;
if ($hl < $MIN_HALF_LIFE_MIN || $hl > $MAX_HALF_LIFE_MIN) $hl = $DEFAULT_HALF_LIFE_MIN;
$data['halfLifeMin'] = $hl;

$mp = isset($data['maxPerUser']) ? (int) $data['maxPerUser'] : $DEFAULT_MAX_PER_USER;
if ($mp < $MIN_MAX_PER_USER) $mp = $MIN_MAX_PER_USER;
if ($mp > $MAX_MAX_PER_USER) $mp = $MAX_MAX_PER_USER;
$data['maxPerUser'] = $mp;

$rm = isset($data['refreshMs']) ? (int) $data['refreshMs'] : $DEFAULT_REFRESH_MS;
if ($rm < $MIN_REFRESH_MS) $rm = $MIN_REFRESH_MS;
if ($rm > $MAX_REFRESH_MS) $rm = $MAX_REFRESH_MS;
$data['refreshMs'] = $rm;

$now   = (int) round(microtime(true) * 1000);
$dirty = false;
$ip    = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

// --- Prune expired sessions / attempts ---
foreach ($data['adminSessions'] as $tok => $expiry) {
  if ((int) $expiry < $now) { unset($data['adminSessions'][$tok]); $dirty = true; }
}
foreach ($data['loginAttempts'] as $ipKey => $stamps) {
  if (!is_array($stamps)) { unset($data['loginAttempts'][$ipKey]); $dirty = true; continue; }
  $kept = array_values(array_filter($stamps, function ($t) use ($now, $LOGIN_RATE_WINDOW) {
    return is_numeric($t) && ($now - (int) $t) < $LOGIN_RATE_WINDOW;
  }));
  if (count($kept) !== count($stamps)) $dirty = true;
  if (empty($kept)) unset($data['loginAttempts'][$ipKey]);
  else              $data['loginAttempts'][$ipKey] = $kept;
}

// --- Admin auth: validate session token (NOT password) ---
$adminToken = isset($body['adminToken']) && is_string($body['adminToken']) ? $body['adminToken'] : '';
$isAdmin = false;
if ($adminToken !== '' && isset($data['adminSessions'][$adminToken])) {
  $expiry = (int) $data['adminSessions'][$adminToken];
  if ($expiry >= $now) $isAdmin = true;
}

// --- Build the public payload returned by most actions ---
$publicPayload = function () use (&$data, &$uid, &$now) {
  $redirectActive = $data['redirectUrl'] !== '' && $now < (int) $data['redirectUntil'];
  return [
    'questions'   => array_values($data['questions']),
    'identity'    => $uid,
    'halfLifeMin' => (int) $data['halfLifeMin'],
    'maxPerUser'  => (int) $data['maxPerUser'],
    'refreshMs'   => (int) $data['refreshMs'],
    'redirectUrl' => $redirectActive ? $data['redirectUrl'] : '',
    'needsSetup'  => $data['adminPasswordHash'] === '', // deliberately public: client shows setup vs login form
    'serverTime'  => $now,
  ];
};

$out = null;

switch ($action) {
  case 'list':
    $out = $publicPayload();
    break;

  case 'admin-login': {
    if ($data['adminPasswordHash'] === '') {
      $out = ['ok' => false, 'error' => 'needs_setup'];
      break;
    }
    $attempts = isset($data['loginAttempts'][$ip]) ? $data['loginAttempts'][$ip] : [];
    if (count($attempts) >= $LOGIN_RATE_MAX) {
      $out = ['ok' => false, 'error' => 'rate_limited'];
      break;
    }
    $pw = isset($body['password']) && is_string($body['password']) ? $body['password'] : '';
    if (!password_verify($pw, $data['adminPasswordHash'])) {
      $attempts[] = $now;
      $data['loginAttempts'][$ip] = $attempts;
      $dirty = true;
      $out = ['ok' => false];
      break;
    }
    unset($data['loginAttempts'][$ip]);
    $token = bin2hex(random_bytes(24));
    $data['adminSessions'][$token] = $now + $ADMIN_SESSION_MS;
    $dirty = true;
    $out = ['ok' => true, 'adminToken' => $token, 'expiresAt' => $now + $ADMIN_SESSION_MS];
    break;
  }

  case 'admin-logout':
    if ($adminToken !== '' && isset($data['adminSessions'][$adminToken])) {
      unset($data['adminSessions'][$adminToken]);
      $dirty = true;
    }
    $out = ['ok' => true];
    break;

  case 'submit': {
    $text = isset($body['text'])       && is_string($body['text'])       ? trim($body['text'])       : '';
    $name = isset($body['authorName']) && is_string($body['authorName']) ? trim($body['authorName']) : '';
    if ($text === '' || $name === '')     { $out = ['error' => 'missing_fields']; break; }
    if (mb_strlen($text) > $MAX_Q_LENGTH) { $out = ['error' => 'too_long'];        break; }
    $myCount = 0;
    foreach ($data['questions'] as $q) {
      if (($q['authorUid'] ?? '') === $uid) $myCount++;
    }
    if ($myCount >= $data['maxPerUser']) {
      $resp = $publicPayload();
      $resp['error'] = 'limit_reached';
      $out = $resp;
      break;
    }
    $newQ = [
      'id'         => base_convert((string) $now, 10, 36) . bin2hex(random_bytes(4)),
      'text'       => mb_substr($text, 0, $MAX_Q_LENGTH),
      'authorName' => mb_substr($name, 0, $MAX_NAME_LENGTH),
      'authorUid'  => $uid,
      'timestamp'  => $now,
      'upvotes'    => [],
    ];
    array_unshift($data['questions'], $newQ);
    if (count($data['questions']) > $MAX_QUESTIONS) {
      $data['questions'] = array_slice($data['questions'], 0, $MAX_QUESTIONS);
    }
    $dirty = true;
    $out = $publicPayload();
    break;
  }

  case 'edit': {
    $qid  = isset($body['questionId']) && is_string($body['questionId']) ? $body['questionId'] : '';
    $text = isset($body['text'])       && is_string($body['text'])       ? trim($body['text'])  : '';
    if ($qid === '' || $text === '')      { $out = ['error' => 'missing_fields']; break; }
    if (mb_strlen($text) > $MAX_Q_LENGTH) { $out = ['error' => 'too_long'];        break; }
    $found = false;
    foreach ($data['questions'] as &$q) {
      if (($q['id'] ?? '') !== $qid) continue;
      $found = true;
      if (($q['authorUid'] ?? '') !== $uid) { $out = ['error' => 'not_allowed']; break; }
      $voteCount = (isset($q['upvotes']) && is_array($q['upvotes'])) ? count($q['upvotes']) : 0;
      if ($voteCount > 0) { $out = ['error' => 'already_voted']; break; }
      $q['text']     = mb_substr($text, 0, $MAX_Q_LENGTH);
      $q['editedAt'] = $now;
      $dirty = true;
      break;
    }
    unset($q);
    if (!$found) { $out = ['error' => 'not_found']; break; }
    if ($out === null) $out = $publicPayload();
    break;
  }

  case 'set-config': {
    if (!$isAdmin) { $out = ['error' => 'unauthorized']; break; }
    $changed = false;
    if (isset($body['halfLifeMin']) && is_numeric($body['halfLifeMin'])) {
      $hl = (int) $body['halfLifeMin'];
      if ($hl < $MIN_HALF_LIFE_MIN) $hl = $MIN_HALF_LIFE_MIN;
      if ($hl > $MAX_HALF_LIFE_MIN) $hl = $MAX_HALF_LIFE_MIN;
      $data['halfLifeMin'] = $hl; $changed = true;
    }
    if (isset($body['maxPerUser']) && is_numeric($body['maxPerUser'])) {
      $mp = (int) $body['maxPerUser'];
      if ($mp < $MIN_MAX_PER_USER) $mp = $MIN_MAX_PER_USER;
      if ($mp > $MAX_MAX_PER_USER) $mp = $MAX_MAX_PER_USER;
      $data['maxPerUser'] = $mp; $changed = true;
    }
    if (isset($body['refreshMs']) && is_numeric($body['refreshMs'])) {
      $rmv = (int) $body['refreshMs'];
      if ($rmv < $MIN_REFRESH_MS) $rmv = $MIN_REFRESH_MS;
      if ($rmv > $MAX_REFRESH_MS) $rmv = $MAX_REFRESH_MS;
      $data['refreshMs'] = $rmv; $changed = true;
    }
    if (!$changed) { $out = ['error' => 'invalid']; break; }
    $dirty = true;
    $out = $publicPayload();
    break;
  }

  case 'set-password': {
    $pw = isset($body['password']) && is_string($body['password']) ? $body['password'] : '';
    if (strlen($pw) < 8 || strlen($pw) > 200) {
      $out = ['ok' => false, 'error' => 'weak_password'];
      break;
    }
    $hasHash = $data['adminPasswordHash'] !== '';
    if ($hasHash && !$isAdmin) {
      $out = ['ok' => false, 'error' => 'unauthorized'];
      break;
    }
    // First-run setup is unauthenticated, so throttle it per IP exactly like
    // admin-login. bcrypt hashing is deliberately expensive, so an open,
    // unthrottled endpoint would be a DoS vector. (The flock already serialises
    // the actual claim — only the first request can win — so this just caps
    // wasted hashing before the hash exists.)
    if (!$hasHash) {
      $attempts = isset($data['loginAttempts'][$ip]) ? $data['loginAttempts'][$ip] : [];
      if (count($attempts) >= $LOGIN_RATE_MAX) {
        $out = ['ok' => false, 'error' => 'rate_limited'];
        break;
      }
      $attempts[] = $now;
      $data['loginAttempts'][$ip] = $attempts;
      $dirty = true;
    }
    $data['adminPasswordHash'] = password_hash($pw, PASSWORD_DEFAULT);
    $dirty = true;
    if ($hasHash) {
      // Change: invalidate every OTHER admin session, keep the caller's token.
      foreach ($data['adminSessions'] as $tok => $exp) {
        if ($tok !== $adminToken) unset($data['adminSessions'][$tok]);
      }
      $out = ['ok' => true];
    } else {
      // First-run claim: clear the throttle and log the setter in immediately.
      unset($data['loginAttempts'][$ip]);
      $token = bin2hex(random_bytes(24));
      $data['adminSessions'][$token] = $now + $ADMIN_SESSION_MS;
      $out = ['ok' => true, 'adminToken' => $token, 'expiresAt' => $now + $ADMIN_SESSION_MS];
    }
    break;
  }

  case 'set-redirect': {
    if (!$isAdmin) { $out = ['error' => 'unauthorized']; break; }
    $url = isset($body['url']) && is_string($body['url']) ? trim($body['url']) : '';
    if ($url === '') {
      // Empty = clear the redirect.
      $data['redirectUrl']   = '';
      $data['redirectUntil'] = 0;
      $dirty = true;
      $out = $publicPayload();
      break;
    }
    if (strlen($url) > $MAX_URL_LENGTH) { $out = ['error' => 'invalid_url']; break; }
    $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
    if (!filter_var($url, FILTER_VALIDATE_URL) || ($scheme !== 'http' && $scheme !== 'https')) {
      $out = ['error' => 'invalid_url']; break;
    }
    $data['redirectUrl']   = $url;
    $data['redirectUntil'] = $now + $REDIRECT_WINDOW_MS;
    $dirty = true;
    $out = $publicPayload();
    break;
  }

  case 'vote': {
    $qid = isset($body['questionId']) && is_string($body['questionId']) ? $body['questionId'] : '';
    if ($qid === '') { $out = ['error' => 'missing_fields']; break; }
    $found = false;
    foreach ($data['questions'] as &$q) {
      if (($q['id'] ?? '') !== $qid) continue;
      $found = true;
      if (($q['authorUid'] ?? '') === $uid) break; // cannot vote on own
      if (!isset($q['upvotes']) || !is_array($q['upvotes'])) $q['upvotes'] = [];
      $idx = array_search($uid, $q['upvotes'], true);
      if ($idx === false) {
        $q['upvotes'][] = $uid;
      } else {
        array_splice($q['upvotes'], $idx, 1);
        $q['upvotes'] = array_values($q['upvotes']);
      }
      $dirty = true;
      break;
    }
    unset($q);
    $out = $publicPayload();
    if (!$found) $out['error'] = 'not_found';
    break;
  }

  case 'delete': {
    $qid = isset($body['questionId']) && is_string($body['questionId']) ? $body['questionId'] : '';
    if ($qid === '') { $out = ['error' => 'missing_fields']; break; }
    $deleted = false;
    $next = [];
    foreach ($data['questions'] as $q) {
      if (($q['id'] ?? '') === $qid) {
        $isOwner = ($q['authorUid'] ?? '') === $uid;
        if ($isOwner || $isAdmin) { $dirty = true; $deleted = true; continue; }
      }
      $next[] = $q;
    }
    $data['questions'] = $next;
    $out = $publicPayload();
    if (!$deleted) $out['error'] = 'not_allowed';
    break;
  }

  case 'answer': {
    if (!$isAdmin) { $out = ['error' => 'unauthorized']; break; }
    $qid = isset($body['questionId']) && is_string($body['questionId']) ? $body['questionId'] : '';
    foreach ($data['questions'] as &$q) {
      if (($q['id'] ?? '') === $qid) {
        $q['answered'] = !($q['answered'] ?? false);
        $dirty = true;
        break;
      }
    }
    unset($q);
    $out = $publicPayload();
    break;
  }

  case 'reset':
    if (!$isAdmin) { $out = ['error' => 'unauthorized']; break; }
    $data['questions'] = [];
    $dirty = true;
    $out = $publicPayload();
    break;

  default:
    $out = ['error' => 'unknown_action'];
}

// --- Atomic write: encode first, then temp file + rename ---
if ($dirty) {
  $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($payload !== false) {
    $tmp = $DATA_FILE . '.new.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $payload) !== false) {
      // POSIX: atomic. Windows: MoveFileEx replaces existing.
      if (!@rename($tmp, $DATA_FILE)) {
        @unlink($tmp);
      }
    } else {
      @unlink($tmp);
    }
  }
  // If encode/write fails the original file is left untouched.
}

flock($lockFp, LOCK_UN);
fclose($lockFp);

echo json_encode($out);
