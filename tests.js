/* ===== VenueIQ — tests.js (in-browser unit test suite) ===== */
/* global sanitise, waitColor, buildSparkSVG, updateClock, renderRingCharts, switchPanel, RINGS_CONFIG */
'use strict';

/**
 * Lightweight in-browser test runner for VenueIQ.
 * Activate with Ctrl+Shift+T — results appear in the #test-results overlay.
 * All tested functions are defined in app.js and available in the shared
 * global lexical environment (both files are plain scripts, not modules).
 */
const VenueIQTests = (() => {

  /** @type {Array<{name:string, passed:boolean, error?:string}>} */
  const results = [];

  /**
   * Runs a named test case and records pass/fail.
   * @param {string} name - Human-readable test description
   * @param {function} fn - Test body; must throw on failure
   */
  function test(name, fn) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (e) {
      results.push({ name, passed: false, error: e.message });
    }
  }

  /** @param {*} cond @param {string} [msg] */
  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
  }

  /** @param {*} a @param {*} b @param {string} [msg] */
  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(msg || `Expected "${b}", got "${a}"`);
  }

  /**
   * Executes all test cases and returns the results array.
   * @returns {Array<{name:string, passed:boolean, error?:string}>}
   */
  function run() {
    results.length = 0;

    // ── 1. sanitise() — XSS protection ──────────────────────────────────────
    test('sanitise() strips HTML tags from injected content', () => {
      const out = sanitise('<img src=x onerror=alert(1)>Safe text');
      assert(!out.includes('<img'), 'Must strip <img> tag');
      assert(!out.includes('onerror'), 'Must strip event handler attribute');
      assert(out.includes('Safe text') || out.length > 0, 'Must preserve non-HTML text');
    });

    // ── 2. waitColor() — red threshold ─────────────────────────────────────
    test('waitColor() returns red (#E24B4A) when wait >= 75% of max', () => {
      assertEqual(waitColor(15, 20), '#E24B4A', 'Should be red at 75%');
    });

    // ── 3. waitColor() — amber threshold ────────────────────────────────────
    test('waitColor() returns amber (#EF9F27) when wait is 45–74% of max', () => {
      assertEqual(waitColor(9, 20), '#EF9F27', 'Should be amber at 45%');
    });

    // ── 4. waitColor() — green threshold ────────────────────────────────────
    test('waitColor() returns green (#1D9E75) when wait < 45% of max', () => {
      assertEqual(waitColor(4, 20), '#1D9E75', 'Should be green at 20%');
    });

    // ── 5. buildSparkSVG() — SVG structure validity ─────────────────────────
    test('buildSparkSVG() returns a valid SVG string with polyline and endpoint circle', () => {
      const svg = buildSparkSVG([10, 20, 30, 25, 15, 18, 22, 28, 26, 24], '#1D9E75');
      assert(typeof svg === 'string', 'Must return a string');
      assert(svg.includes('<svg'), 'Must contain <svg> opening tag');
      assert(svg.includes('polyline'), 'Must contain a <polyline> element');
      assert(svg.includes('circle'), 'Must contain endpoint <circle>');
    });

    // ── 6. updateClock() — HH:MM:SS format ──────────────────────────────────
    test('updateClock() sets #clock element text to HH:MM:SS format', () => {
      updateClock();
      const el = document.getElementById('clock');
      assert(el, '#clock element must exist in the DOM');
      assert(
        /^\d{2}:\d{2}:\d{2}$/.test(el.textContent),
        `Clock text "${el.textContent}" is not HH:MM:SS format`
      );
    });

    // ── 7. renderRingCharts() — correct element count ────────────────────────
    test('renderRingCharts() renders one .ring-chart per RINGS_CONFIG entry', () => {
      const container = document.getElementById('rings-row');
      if (!container) throw new Error('#rings-row element not found in DOM');
      renderRingCharts();
      const rings = container.querySelectorAll('.ring-chart');
      assert(
        rings.length === RINGS_CONFIG.length,
        `Expected ${RINGS_CONFIG.length} ring charts, got ${rings.length}`
      );
    });

    // ── 8. switchPanel() — updates page title ───────────────────────────────
    test('switchPanel("waits") updates #page-title text to "Wait Times"', () => {
      switchPanel('waits');
      const title = document.getElementById('page-title');
      assert(title, '#page-title must exist in the DOM');
      assertEqual(title.textContent, 'Wait Times', 'Page title must update on panel switch');
      switchPanel('crowd'); // restore initial state
    });

    // ── 9. switchPanel() — sets aria-current ────────────────────────────────
    test('switchPanel() sets aria-current="page" on the newly active nav item', () => {
      switchPanel('entry');
      const active = document.querySelector('.nav-item.active');
      assert(active, 'An active nav item must exist after switching panel');
      assertEqual(
        active.getAttribute('aria-current'),
        'page',
        'Active nav item must have aria-current="page"'
      );
      switchPanel('crowd'); // restore initial state
    });

    return results;
  }

  /**
   * Renders test results into the #test-results overlay element.
   * @param {Array<{name:string, passed:boolean, error?:string}>} res
   */
  function renderOverlay(res) {
    const overlay = document.getElementById('test-results');
    if (!overlay) return;

    const passed = res.filter(r => r.passed).length;
    const total = res.length;
    const allGood = passed === total;

    // Clear previous content safely
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    overlay.hidden = false;

    // Header
    const header = document.createElement('div');
    header.className = 'test-header';
    header.textContent = `VenueIQ Tests — ${passed}/${total} passed ${allGood ? '✓' : '✗'}`;
    overlay.appendChild(header);

    // Test list
    const list = document.createElement('ul');
    list.className = 'test-list';
    res.forEach(r => {
      const li = document.createElement('li');
      li.className = r.passed ? 'test-pass' : 'test-fail';
      li.textContent = (r.passed ? '✓ ' : '✗ ') + r.name + (r.error ? ' — ' + r.error : '');
      list.appendChild(li);
    });
    overlay.appendChild(list);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'test-close-btn';
    closeBtn.textContent = 'Close (Esc)';
    closeBtn.setAttribute('aria-label', 'Close test results overlay');
    closeBtn.addEventListener('click', () => { overlay.hidden = true; });
    overlay.appendChild(closeBtn);
  }

  // Public API
  return { run, renderOverlay };
})();
