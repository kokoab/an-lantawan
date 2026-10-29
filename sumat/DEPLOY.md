# Launching Sumat

Three pieces, about 20 minutes in total. Do everything while signed in to the **An Lantawan LNU Google account**.

| Piece | What it is | Where it lives |
|---|---|---|
| Inbox | A Google Sheet that stores every message | Google Drive (private) |
| Intake | A small script that receives messages, saves them, and emails editors | Attached to the Sheet |
| Page | The Sumat page students see | Cloudflare Pages (free) |
| Dashboard | A private review page for editors | Google Apps Script |

---

## 1. Create the inbox and the intake script

1. In Google Drive, create a new Google Sheet named **Sumat Inbox**. Do not share it publicly.
2. In the Sheet, open **Extensions → Apps Script**. Rename the project to **Sumat intake**.
3. Delete everything in `Code.gs` and paste in the contents of `apps-script/intake/Code.gs`. Save.
4. In the function menu at the top, choose **setup** and click **Run**. Approve the permissions when asked (choose the An Lantawan account, then **Allow**).
5. Back in the Sheet you now have two tabs: **Submissions** and **Settings**. In **Settings**, fill in:
   - `prompt`: the question students see.
   - `notify_emails`: editors who should get an email for each message, separated by commas.
6. In Apps Script, click **Deploy → New deployment**. Click the gear icon and choose **Web app**, then set:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`). Open it in a browser. You should see something like `{"ok":true,"prompt":"What do you want to say?",...}`.

> **If "Anyone" is missing from the access list**, LNU's Google Workspace admin has blocked public web apps. Either ask LNU ICT to allow Apps Script web apps for this account, or make the Sheet and script under a separate Gmail account owned by the publication and share the Sheet with the editors' LNU accounts.

> **When you change the script later**, use **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. This keeps the same URL. "New deployment" would create a new URL and break the page.

## 2. Put the page online

1. Open `site/index.html` in a text editor and fill in the `CONFIG` block near the bottom:
   ```js
   const CONFIG = {
     endpoint: "https://script.google.com/macros/s/.../exec",   // from step 1.7
     facebookUrl: "https://www.facebook.com/<An Lantawan page>",
     turnstileSiteKey: "",                                      // optional, see section 5
   };
   ```
   While `endpoint` is empty, the page shows a "Demo mode" notice and saves nothing.
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com), sign up free, then **Workers & Pages → Create → Pages → Upload assets**.
3. Name the project `anlantawan-sumat` and upload the **`site`** folder. Your page is live at `https://anlantawan-sumat.pages.dev` (or the closest available name).
4. To update the page later, upload the `site` folder again as a new deployment in the same project.

*No Cloudflare account?* [app.netlify.com/drop](https://app.netlify.com/drop) also works: drag the `site` folder in, then rename the site to get `anlantawan-sumat.netlify.app`.

## 3. Set up the editors' dashboard

1. Go to [script.google.com](https://script.google.com) → **New project**. Name it **Sumat dashboard**.
2. Paste `apps-script/dashboard/Code.gs` into `Code.gs`.
3. Click **+ → HTML**, name the file **Index** (exactly), and paste `apps-script/dashboard/Index.html`.
4. In `Code.gs`, replace `PASTE_SPREADSHEET_ID_HERE` with the Sheet's ID: the long code in its URL between `/d/` and `/edit`.
5. **Deploy → New deployment → Web app**:
   - Execute as: **User accessing the web app**
   - Who has access: **Anyone within Leyte Normal University**
6. Copy the dashboard URL and paste it into `dashboard_url` in the Sheet's **Settings** tab, so alert emails link to it.
7. **Share the Sumat Inbox Sheet** (Editor access) with each editor who should review messages. Access to the Sheet is what unlocks the dashboard. Anyone else at LNU who opens the dashboard sees "You can't open the Sumat inbox."
8. Each editor opens the dashboard once and approves the permissions.

In the dashboard, editors can filter by status (New, Shortlisted, Published, Archived), search, add private notes, and copy a message's text. Every change is written back to the Sheet.

## 4. Test before announcing

- [ ] Send an anonymous message. A row appears in **Submissions** with status **New**.
- [ ] Send one **With my name**. The name and course appear in the row.
- [ ] The alert email arrives at every address in `notify_emails`.
- [ ] The dashboard shows both messages. Changing a status updates the Sheet.
- [ ] Set `accepting` to `FALSE`. The page says Sumat is closed. Set it back to `TRUE`.
- [ ] Open the page on a phone over mobile data, not only on campus Wi-Fi.

## 5. Optional: spam protection with Turnstile

The page already has a hidden spam trap, a minimum time on page, and a 60-messages-per-minute limit. If junk still gets through:

1. Cloudflare dashboard → **Turnstile → Add widget**. Add the page's domain (e.g. `anlantawan-sumat.pages.dev`), mode **Managed**.
2. Put the **site key** in `CONFIG.turnstileSiteKey` in `site/index.html` and upload the site again.
3. In the intake Apps Script: **Project Settings → Script properties → Add**: name `TURNSTILE_SECRET`, value = the **secret key**. Then redeploy a new version (see the note in section 1).

## Everyday use

- **Change the weekly prompt:** edit `prompt` in the Settings tab. The page picks it up on the next visit.
- **Pause Sumat:** set `accepting` to `FALSE`.
- **Add or remove a reviewer:** share or unshare the Sumat Inbox Sheet.

## Later: your own address

When LNU ICT is ready, in Cloudflare Pages open the project → **Custom domains → Set up a domain** and enter e.g. `sumat.lnu.edu.ph`. Cloudflare shows the one DNS record (a CNAME to `anlantawan-sumat.pages.dev`) that ICT needs to add. Nothing else changes.

## What is and isn't private

- The page never asks who someone is unless they choose **With my name**. The Sheet stores no email, account, or device information.
- Only people the Sheet is shared with can read messages, in the Sheet or the dashboard.
- Like any website, the hosting provider keeps standard server logs. So say "anonymous" and "read only by the editorial team", but don't promise that a message is impossible to trace.
