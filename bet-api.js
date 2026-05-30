/**
 * Shared API client for Bet Wizard (admin + user pages).
 * All shared data goes through the server — not localStorage.
 */
var BetAPI = (function () {
  // When HTML is opened by double-click (file://), API calls must go to the server.
  // Override anytime: localStorage.setItem('betWizardApiUrl', 'http://your-host:3000')
  var DEFAULT_SERVER = 'http://localhost:3000';

  function getBase() {
    if (typeof window.BET_WIZARD_API === 'string' && window.BET_WIZARD_API) {
      return window.BET_WIZARD_API.replace(/\/$/, '');
    }
    try {
      var saved = localStorage.getItem('betWizardApiUrl');
      if (saved) return saved.replace(/\/$/, '');
    } catch (e) {}
    if (window.location.protocol === 'file:') return DEFAULT_SERVER;
    // Node serves pages + API together on port 3000
    if (window.location.port === '3000') return '';
    // Laragon (wc26.test), XAMPP, etc. — HTML on :80, API on Node :3000
    // If .htaccess proxy is active, same-origin /api works (port 80 → keep '')
    // Otherwise fall back to localhost:3000
    return DEFAULT_SERVER;
  }

  function getAdminToken() {
    return sessionStorage.getItem('bwAdminToken') || '';
  }

  function request(method, url, body, admin) {
    var base = getBase();
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (admin && getAdminToken()) {
      opts.headers['Authorization'] = 'Bearer ' + getAdminToken();
    }
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    return fetch(base + url, opts)
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
          return data;
        });
      })
      .catch(function (err) {
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
          throw new Error(
            'Cannot reach API at ' + (base || window.location.origin) +
            '. Start the Node server: open a terminal in this folder and run "npm start".' +
            ' Health check: http://localhost:3000/api/health'
          );
        }
        throw err;
      });
  }

  return {
    getMatches: function () {
      return request('GET', '/api/matches');
    },
    saveMatches: function (matches) {
      return request('PUT', '/api/matches', matches, true);
    },
    getSettings: function () {
      return request('GET', '/api/settings');
    },
    saveSettings: function (settings) {
      return request('PUT', '/api/settings', settings, true);
    },
    submitPrediction: function (payload) {
      return request('POST', '/api/predictions', payload);
    },
    getPredictions: function () {
      return request('GET', '/api/predictions', undefined, true);
    },
    deletePrediction: function (id) {
      return request('DELETE', '/api/predictions/' + encodeURIComponent(id), undefined, true);
    },
    getResults: function () {
      return request('GET', '/api/results', undefined, true);
    },
    saveResults: function (results) {
      return request('PUT', '/api/results', results, true);
    },
    getLeaderboard: function () {
      return request('GET', '/api/leaderboard');
    },
  };
})();
