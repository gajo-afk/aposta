/**
 * Bet Wizard — shared backend
 * Serves HTML pages and persists matches, settings, predictions, and results as JSON files.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// SHA-256 hash of 'admin123' — same as bet_admin.html
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN ||
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

const FILES = {
  matches: path.join(DATA_DIR, 'matches.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  predictions: path.join(DATA_DIR, 'predictions.json'),
  results: path.join(DATA_DIR, 'results.json'),
};

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token === ADMIN_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized — admin login required' });
}

function computeLeaderboard(matches, predictions, results) {
  const scored = predictions.map(function (p) {
    let pts = 0;
    let correct = 0;
    let wrong = 0;
    const predMap = {};
    (p.predictions || []).forEach(function (pr) {
      predMap[pr.matchId] = (pr.prediction || '').toLowerCase();
    });

    matches.forEach(function (m) {
      const result = results[m.id];
      const pred = predMap[m.id] || '';
      if (!result || !pred) return;
      if (pred === result) {
        pts += 3;
        correct++;
      } else {
        pts += 1;
        wrong++;
      }
    });

    const predsOrdered = matches.map(function (m) {
      return predMap[m.id] || '';
    });

    return {
      id: p.id,
      name: p.name || '—',
      email: p.email || '',
      phone: p.phone || '',
      bet: p.betAmount ? '$' + p.betAmount + ' USD' : p.bet || '',
      betAmount: p.betAmount || '',
      pts,
      correct,
      wrong,
      preds: predsOrdered,
      submittedAt: p.submittedAt || '',
      profilePic: p.profilePic || '',
    };
  });

  scored.sort(function (a, b) {
    return b.pts - a.pts || a.name.localeCompare(b.name);
  });

  return scored;
}

app.use(express.json({ limit: '15mb' }));

// Allow API calls from file:// pages and other origins during local dev
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(__dirname));

app.get('/', function (_req, res) {
  res.redirect('/bet_user.html');
});

app.get('/api/health', function (_req, res) {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── Public read endpoints ──

app.get('/api/matches', function (_req, res) {
  res.json(readJson(FILES.matches, []));
});

app.get('/api/settings', function (_req, res) {
  res.json(readJson(FILES.settings, {}));
});

app.get('/api/leaderboard', function (_req, res) {
  const matches = readJson(FILES.matches, []);
  const predictions = readJson(FILES.predictions, []);
  const results = readJson(FILES.results, {});
  const settings = readJson(FILES.settings, {});
  const rankings = computeLeaderboard(matches, predictions, results);

  res.json({
    settings: {
      name: settings.name || 'Soccer Betting Wizard',
      logo: settings.logo || '',
    },
    matches,
    results,
    rankings,
    updatedAt: new Date().toISOString(),
  });
});

// ── User submission ──

app.post('/api/predictions', function (req, res) {
  const body = req.body || {};
  if (!body.name || !body.email || !Array.isArray(body.predictions)) {
    return res.status(400).json({ error: 'Missing required fields: name, email, predictions' });
  }

  const predictions = readJson(FILES.predictions, []);
  const entry = {
    id: body.id || 'BW-' + Date.now().toString(36).toUpperCase(),
    submittedAt: body.submittedAt || new Date().toISOString(),
    name: String(body.name).trim(),
    email: String(body.email).trim(),
    phone: body.phone || '',
    identity: body.identity || '',
    address: body.address || '',
    betAmount: String(body.betAmount || ''),
    profilePic: body.profilePic || '',
    predictions: body.predictions.map(function (pr) {
      return {
        matchId: pr.matchId,
        prediction: String(pr.prediction || '').toLowerCase(),
      };
    }),
  };

  const existingIdx = predictions.findIndex(function (p) {
    return p.id === entry.id || p.email.toLowerCase() === entry.email.toLowerCase();
  });
  if (existingIdx >= 0) {
    predictions[existingIdx] = entry;
  } else {
    predictions.push(entry);
  }

  writeJson(FILES.predictions, predictions);
  res.status(201).json({ ok: true, id: entry.id });
});

// ── Admin write endpoints ──

app.put('/api/matches', requireAdmin, function (req, res) {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array of matches' });
  }
  writeJson(FILES.matches, req.body);
  res.json({ ok: true, count: req.body.length });
});

app.put('/api/settings', requireAdmin, function (req, res) {
  writeJson(FILES.settings, req.body || {});
  res.json({ ok: true });
});

app.get('/api/predictions', requireAdmin, function (_req, res) {
  res.json(readJson(FILES.predictions, []));
});

app.delete('/api/predictions/:id', requireAdmin, function (req, res) {
  const predictions = readJson(FILES.predictions, []);
  const filtered = predictions.filter(function (p) {
    return p.id !== req.params.id;
  });
  writeJson(FILES.predictions, filtered);
  res.json({ ok: true, count: filtered.length });
});

app.get('/api/results', requireAdmin, function (_req, res) {
  res.json(readJson(FILES.results, {}));
});

app.put('/api/results', requireAdmin, function (req, res) {
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an object of matchId → result' });
  }
  writeJson(FILES.results, req.body);
  res.json({ ok: true });
});

app.listen(PORT, function () {
  console.log('Bet Wizard running at http://localhost:' + PORT);
  console.log('  User form:    /bet_user.html');
  console.log('  Admin panel:  /bet_admin.html');
  console.log('  Leaderboard:  /bet_leaderboard.html');
});
