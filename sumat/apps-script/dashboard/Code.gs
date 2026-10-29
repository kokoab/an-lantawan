/**
 * Sumat dashboard
 * A private inbox for the editorial board. It reads and updates the "Submissions"
 * tab of the Sumat Inbox spreadsheet using the permissions of whoever opens it,
 * so only people the spreadsheet is shared with can see any messages.
 *
 * Deploy as a web app:  Execute as: User accessing the web app
 *                       Who has access: Anyone within Leyte Normal University
 * See DEPLOY.md.
 */

// Paste the ID of the Sumat Inbox spreadsheet (the long code in its URL, between /d/ and /edit).
const SPREADSHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';

const SUBMISSIONS = 'Submissions';
const STATUSES = ['New', 'Shortlisted', 'Published', 'Archived'];
const COL = { id: 1, received: 2, prompt: 3, message: 4, sentAs: 5, name: 6, course: 7, status: 8, notes: 9 };

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sumat inbox')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SUBMISSIONS);
}

/** Returns every submission, newest first. Throws if the viewer can't open the spreadsheet. */
function getSubmissions() {
  const sheet = sheet_();
  const last = sheet.getLastRow();
  const items = last < 2 ? [] : sheet.getRange(2, 1, last - 1, 9).getValues().map((r) => ({
    id: String(r[0]),
    received: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
    prompt: String(r[2]),
    message: String(r[3]),
    sentAs: String(r[4]),
    name: String(r[5]),
    course: String(r[6]),
    status: STATUSES.indexOf(String(r[7])) >= 0 ? String(r[7]) : 'New',
    notes: String(r[8]),
  })).filter((x) => x.id);
  items.reverse();
  return { viewer: Session.getActiveUser().getEmail(), statuses: STATUSES, items: items };
}

/** Updates the status and/or editor notes of one submission. */
function updateSubmission(id, changes) {
  const sheet = sheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ids = sheet.getRange(2, COL.id, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    const index = ids.findIndex((r) => String(r[0]) === String(id));
    if (index < 0) throw new Error('That message no longer exists.');
    const row = index + 2;
    if (changes.status !== undefined) {
      if (STATUSES.indexOf(changes.status) < 0) throw new Error('Unknown status.');
      sheet.getRange(row, COL.status).setValue(changes.status);
    }
    if (changes.notes !== undefined) {
      const notes = String(changes.notes).slice(0, 1000);
      sheet.getRange(row, COL.notes).setValue(/^[=+\-@]/.test(notes) ? "'" + notes : notes);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}
