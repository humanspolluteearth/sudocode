# Product decisions for v1 (PROPOSED defaults: edit before milestone 3)

These fill the product gaps that were still open, so unattended milestones don't stall. Every line is a default
Claude will build unless you change it here. Visual design reference: `reference/prototype/design/` (open the
`.dc.html` files from your original export to view them; in the repo they are markup to read, not to run).

## Layout (from the prototype)
- Desktop (`Main.dc.html`): menu bar, file tabs, editor with line numbers and a breakpoint gutter, a right-hand panel
  with tabs **Debugger** (Variables, Call stack, Breakpoints, trace table) and **Quick reference** (the language
  guide), a bottom **Console** and **Problems** area, and a status bar.
- Tablet (`Tablet.dc.html`): same panels stacked; keyword key bar above the keyboard.
- Mobile (`Mobile.dc.html`): one view at a time with bottom tabs **Code / Console / Debug / Guide**; keyword key bar.
- Light and dark themes; zoom 100-150%; IBM Plex Mono for code.

## Simple mode vs Advanced mode
| Feature | Simple | Advanced |
|---|---|---|
| Editor, Run, Stop, Console, input box | Yes | Yes |
| Error and warning underlines + Problems list | Yes | Yes |
| Quick reference guide | Yes | Yes |
| Examples menu | Yes | Yes |
| Breakpoints, Step over | Yes | Yes |
| Step into / Step out, Call stack | No | Yes |
| Variables panel | Yes | Yes |
| Trace table | Yes | Yes |
| Files panel (virtual file system) | No | Yes |
| Converter ("Convert to Python") | No | Yes |
| Settings beyond theme and zoom | No | Yes |
Every feature can also be switched off individually in Settings (brief: "every tool can be disabled").
Default for new users: Simple.

## Files and saving
- Web: projects saved in the browser (IndexedDB); open/save to disk with the browser's file picker. Desktop: real files.
- Extensions: `.epc` (Edexcel), `.cpc` (Cambridge), `.py` (Python), as in the prototype.

## Not in v1
Accounts, sharing links, publishing, telemetry, AI help, `turtle`, Edexcel records, CIE pointers and sets,
converter directions other than pseudocode -> Python.

## Privacy
No accounts, no tracking, no network calls after load except fetching the app itself.

## Offline
The web app is installable and works offline after the first visit (a service worker caches the app).

## Supported platforms (v1)
Latest two versions of Chrome, Edge, Firefox and Safari; Windows 10+, macOS 12+, Ubuntu 22.04+ for desktop;
Android 8+ for the mobile app.
