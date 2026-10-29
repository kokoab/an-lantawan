# An Lantawan — project guide

An Lantawan is the official student publication of Leyte Normal University (LNU), Tacloban City. Its site currently runs on WordPress and will be rebranded later. The first piece being built is **Sumat** ("to tell"): an NGL-style page where students send the newsroom a message, anonymously or with their name.

Owner: Francis Angelo Batiancela, Creatives and Multimedia Director. He approves every design before it is built.

## Current scope

Only Sumat. The rest of the site's sections (Home, About, Editorial Board, News, Sports, Feature Articles, Newsletters, Special Publication, Videos) are out of scope until Francis says otherwise.

## Repository

```
sumat/
  site/index.html               The Sumat page: one self-contained file (HTML, CSS, JS inline)
  apps-script/intake/Code.gs    Web app bound to the "Sumat Inbox" Google Sheet: doGet (settings), doPost (save + email alert)
  apps-script/dashboard/        Private editor inbox web app (Code.gs + Index.html)
  DEPLOY.md                     Launch guide written for student editors
```

- Hosting: Cloudflare Pages free tier (`*.pages.dev`) until LNU ICT grants a subdomain such as `sumat.lnu.edu.ph`.
- Data: Google Sheet in the publication's LNU Google Workspace account. Submissions tab columns: ID, Received, Prompt, Message, Sent as, Name, Course and year, Status, Editor notes. Statuses: New, Shortlisted, Published, Archived.
- Editors change the prompt and open/closed state in the Sheet's Settings tab. Keep it that way: no code changes for routine use.
- No build step and no framework. Student staff rotate yearly, so anything added must be maintainable by a non-developer following DEPLOY.md.

## Approved design (do not redesign without being asked)

Francis approved the v0 mobile screens: a single compose card and a "Sent." confirmation. `sumat/site/index.html` implements them. Match it exactly when extending.

- Colors: white `#FFFFFF` base; ink `#0A0A0A`; greys `#FAFAFA`, `#F3F3F1`, `#D6D6D3` (strokes), `#6B6B68` (secondary text); yellow `#FFE400` with a slight gradient to `#FFC700` ("sunrise", top to bottom).
- Yellow is a fill with black text on it, never text on white (fails contrast).
- Type: Helvetica Now Display for UI (Inter fallback on the web); Tungsten Condensed Bold for big display words like "SENT." (Anton fallback). Both brand fonts are licensed and installed on Francis's Mac but are not web-licensed, so the page uses `local()` with fallbacks.
- Shape: rounded. Cards 20px radius, inputs 12 to 14px, buttons and toggles fully rounded pills. 1px grey strokes.
- Logo: a faceted yellow torch with white seams on a grey shadow plane. Vector paths are inline in `index.html` (viewBox `0 0 1015 1630`).

## Working with Francis

- Design happens in Figma first, in **Francis's own account** through the Figma plugin MCP (`mcp__plugin_figma_figma__*`, 2300563@lnu.edu.ph), not the claude.ai Figma connector (that one is a different account). Working file: https://www.figma.com/design/cHl3u8XKxPAssIgy7nLGZm
- Discuss before building when he asks to discuss. Present one recommendation, not a survey.
- He rejected several explorations as generic or forced: decorative suns, stamps, tilted planes, vertical spine wordmarks, giant mastheads, stock photography. Don't add imagery or motifs to make a page "feel designed". Start from the approved screens and change only what is asked.
- Load the `frontend-design` skill before design work and avoid template tells (tracked ALL-CAPS eyebrows everywhere, `A · B` meta strings, `01/02/03` on non-sequences, one highlighted word per headline).
- Copy: plain, sentence case, says what happens. Don't promise more privacy than the system gives: "anonymous" and "read only by the editorial team" are accurate. "Untraceable" is not.

## Checks before handing work back

- `node --check` on the inline page script and both `.gs` files.
- Headless Chrome screenshot at 390px and desktop width. Review compose, "With my name", and sent states.
- For intake changes, run the logic against mocked Apps Script services (SpreadsheetApp, ContentService, MailApp, etc.) before asking anyone to redeploy.
