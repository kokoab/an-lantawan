/**
 * Sumat intake
 * Receives messages from the Sumat page and stores them in the "Submissions" tab
 * of the spreadsheet this script is attached to. Sends an email alert per message.
 *
 * Deploy as a web app:  Execute as: Me  ·  Who has access: Anyone
 * Run setup() once before the first deploy. See DEPLOY.md.
 */

const SUBMISSIONS = 'Submissions';
const SETTINGS = 'Settings';
const HEADERS = ['ID', 'Received', 'Prompt', 'Message', 'Sent as', 'Name', 'Course and year', 'Status', 'Editor notes'];
const DEFAULT_SETTINGS = [
  ['prompt', 'What do you want to say?', 'The question shown at the top of the Sumat page.'],
  ['accepting', 'TRUE', 'Set to FALSE to close Sumat. The page shows a "closed" message.'],
  ['max_length', '500', 'Maximum characters per message.'],
  ['notify_emails', '', 'Comma-separated emails that get an alert for every new message.'],
  ['notify_include_message', 'TRUE', 'TRUE puts the message text in the alert email. FALSE sends only a notice.'],
  ['dashboard_url', '', 'Paste the dashboard web app URL so alert emails link to it.'],
];
const MAX_PER_MINUTE = 60;
const MIN_SECONDS_ON_PAGE = 3;

/** Run once from the editor: creates the Submissions and Settings tabs. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const subs = ss.getSheetByName(SUBMISSIONS) || ss.insertSheet(SUBMISSIONS);
  if (subs.getLastRow() === 0) {
    subs.appendRow(HEADERS);
    subs.setFrozenRows(1);
    subs.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    subs.setColumnWidth(4, 480);
  }
  const settings = ss.getSheetByName(SETTINGS) || ss.insertSheet(SETTINGS);
  if (settings.getLastRow() === 0) {
    settings.appendRow(['Key', 'Value', 'What it does']);
    settings.getRange(2, 1, DEFAULT_SETTINGS.length, 3).setNumberFormat('@').setValues(DEFAULT_SETTINGS);
    settings.setFrozenRows(1);
    settings.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
}

/** The page reads the prompt and open/closed state from here. */
function doGet() {
  const s = readSettings_();
  return json_({
    ok: true,
    prompt: s.prompt || 'What do you want to say?',
    accepting: isTrue_(s.accepting),
    maxLength: Number(s.max_length) || 500,
  });
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const s = readSettings_();

    if (!isTrue_(s.accepting)) return json_({ ok: false, error: 'closed' });
    if (data.website) return json_({ ok: true }); // honeypot: bots get a fake success
    if (Number(data.elapsedMs) < MIN_SECONDS_ON_PAGE * 1000) return json_({ ok: false, error: 'too_fast' });
    if (!underRateLimit_()) return json_({ ok: false, error: 'busy' });

    const message = clean_(data.message, Number(s.max_length) || 500);
    if (message.length < 2) return json_({ ok: false, error: 'empty' });

    const named = data.identity === 'named';
    const name = named ? clean_(data.name, 80) : '';
    const course = named ? clean_(data.course, 80) : '';
    if (named && !name) return json_({ ok: false, error: 'name_required' });

    const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
    if (secret && !verifyTurnstile_(secret, data.turnstileToken)) return json_({ ok: false, error: 'verification' });

    const id = Utilities.getUuid().slice(0, 8);
    const sentAs = named ? 'With name' : 'Anonymous';
    const prompt = s.prompt || '';
    const row = [id, new Date(), safe_(prompt), safe_(message), sentAs, safe_(name), safe_(course), 'New', ''];

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      SpreadsheetApp.getActive().getSheetByName(SUBMISSIONS).appendRow(row);
    } finally {
      lock.releaseLock();
    }

    notify_(s, { id, prompt, message, sentAs, name, course });
    return json_({ ok: true, id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

function notify_(s, m) {
  const to = String(s.notify_emails || '').split(',').map((x) => x.trim()).filter(Boolean).join(',');
  if (!to) return;
  const lines = [
    'A new message arrived on Sumat.',
    '',
    'Prompt: ' + m.prompt,
    'Sent as: ' + m.sentAs + (m.name ? ' (' + m.name + (m.course ? ', ' + m.course : '') + ')' : ''),
    '',
  ];
  if (isTrue_(s.notify_include_message)) lines.push(m.message, '');
  if (s.dashboard_url) lines.push('Review it in the inbox: ' + s.dashboard_url);
  try {
    MailApp.sendEmail({ to: to, subject: 'New Sumat message (' + m.sentAs + ')', body: lines.join('\n'), name: 'Sumat' });
  } catch (err) {
    console.error('Alert email failed', err);
  }
}

function readSettings_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SETTINGS);
  const out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(([k, v]) => {
    if (k) out[String(k).trim()] = typeof v === 'boolean' ? String(v).toUpperCase() : String(v).trim();
  });
  return out;
}

function underRateLimit_() {
  const cache = CacheService.getScriptCache();
  const key = 'rate-' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n <= MAX_PER_MINUTE;
}

function verifyTurnstile_(secret, token) {
  if (!token) return false;
  const res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true,
  });
  try {
    return JSON.parse(res.getContentText()).success === true;
  } catch (err) {
    return false;
  }
}

/** Strips control characters and trims to a maximum length. */
function clean_(value, max) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

/** Stops Sheets from treating text like "=IMPORTXML(...)" as a formula. */
function safe_(text) {
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function isTrue_(v) {
  return String(v).trim().toUpperCase() === 'TRUE';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
