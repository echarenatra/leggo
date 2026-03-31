(function () {
  function toHex(buffer) {
    var bytes = new Uint8Array(buffer);
    return Array.prototype.map.call(bytes, function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  async function sha256Hex(input) {
    var encoded = new TextEncoder().encode(input);
    var digest = await crypto.subtle.digest('SHA-256', encoded);
    return toHex(digest);
  }

  function createGateUI(title) {
    var overlay = document.createElement('div');
    overlay.className = 'password-gate-overlay';
    overlay.innerHTML = ''
      + '<div class="password-gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">'
      + '  <h2 id="gate-title">Protected trip</h2>'
      + '  <p>' + title + '</p>'
      + '  <form id="trip-password-form">'
      + '    <label for="trip-password-input">Password</label>'
      + '    <input id="trip-password-input" name="trip-password" type="password" autocomplete="current-password" required />'
      + '    <div style="display:flex;gap:8px;flex-wrap:wrap;">'
      + '      <button type="submit" class="btn btn--primary">Unlock trip</button>'
      + '      <button type="button" class="btn btn--ghost" id="trip-password-back">Go back</button>'
      + '    </div>'
      + '    <p class="password-gate__error" id="trip-password-error" aria-live="polite"></p>'
      + '  </form>'
      + '</div>';
    return overlay;
  }

  async function applyTripPasswordGate(config) {
    if (!config || !config.enabled) return true;
    if (!config.passwordHash) return true;

    var sessionKey = 'leggo-unlocked:' + (config.pageId || window.location.pathname);
    if (sessionStorage.getItem(sessionKey) === '1') return true;

    document.body.classList.add('leggo-locked');
    var overlay = createGateUI(config.title || 'Enter password to view this trip.');
    document.body.appendChild(overlay);

    var form = overlay.querySelector('#trip-password-form');
    var input = overlay.querySelector('#trip-password-input');
    var errorEl = overlay.querySelector('#trip-password-error');
    var backBtn = overlay.querySelector('#trip-password-back');

    input.focus();

    backBtn.addEventListener('click', function () {
      if (config.backUrl) {
        window.location.href = config.backUrl;
        return;
      }
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = 'index.html';
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      errorEl.textContent = '';
      var entered = input.value || '';
      var enteredHash = await sha256Hex(entered);

      if (enteredHash === config.passwordHash.toLowerCase()) {
        sessionStorage.setItem(sessionKey, '1');
        document.body.classList.remove('leggo-locked');
        overlay.remove();
        return;
      }

      input.value = '';
      errorEl.textContent = 'Incorrect password. Please try again.';
      input.focus();
    });

    return false;
  }

  window.LeggoTripSecurity = {
    applyTripPasswordGate: applyTripPasswordGate,
    sha256Hex: sha256Hex
  };
})();
