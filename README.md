# CardCapture → Google Sheets

A mobile-friendly business-card scanner. Users take a photo, Claude Vision extracts contact fields, the user reviews the results, and the approved record is sent to Google Sheets through a Google Apps Script web app.

## What is included

- `dist/index.html` — one-page mobile web app, including camera capture and automatic image compression.
- `api/extract.js` — secure Vercel serverless endpoint that sends the image to Claude Vision.
- `vercel.json` — Vercel configuration.

## Deploy to Vercel

1. Create a new GitHub repository and upload this entire folder.
2. Import the repository in Vercel.
3. In **Project Settings → Environment Variables**, add:

   `ANTHROPIC_API_KEY` = your Anthropic/Claude API key

4. Deploy. Do not add the API key to `index.html`, GitHub, or any frontend variable.

Vercel will serve the web app and expose `POST /api/extract` automatically.

## Google Sheets

The user interface includes a configured Google Apps Script endpoint. To use a different Google Sheet, deploy an Apps Script web app and paste its `/exec` URL under **Google Sheets connection** in the app.

Your Apps Script `doPost` must accept JSON and append a row. Example:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  SpreadsheetApp.openById('YOUR_SHEET_ID').getSheetByName('Sheet1').appendRow([
    new Date(), data.name || '', data.title || '', data.company || '',
    data.phone || '', data.email || '', data.website || '', data.address || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Deploy the Apps Script as a web app that executes as the sheet owner and is accessible to anyone who needs to submit records.

## Local test

Install the Vercel CLI and run:

```bash
npm install -g vercel
vercel dev
```

Set `ANTHROPIC_API_KEY` in `.env.local` before testing locally.
