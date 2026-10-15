# FocusFlow

FocusFlow is a Chrome Manifest V3 reading extension with on-page bionic highlighting, article insights, multi-word RSVP with a configurable optical recognition point, and a visual chunk pacer. The reader also offers optional Web Audio hum, metronome ticks, pink noise, margin guides, and a count-along exercise. These are reading-practice aids and cannot guarantee that subvocalization will stop.

## Requirements

- Node.js 18.17 or newer
- npm
- Google Chrome

## Build

Install dependencies and build the Chrome extension package:

```bash
npm install
npm run build
```

The finished, self-contained extension is written to `out/`. The build first exports the popup and reader pages, then renames Next.js's underscore-prefixed asset paths to Chrome-compatible names, bundles the content script and service worker, and copies the manifest and icons into that directory.

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this project's `out/` directory.
4. Pin FocusFlow from the Extensions menu for quick access.
5. Open a regular webpage, then use the FocusFlow popup to toggle bionic highlighting or open the focused reader.

The `Alt+B` shortcut toggles bionic highlighting on the active page. Chrome does not allow extensions to run on some internal pages, the Chrome Web Store, or other restricted pages.

## Reading practice tools

- **RSVP Max:** choose 1–4 words per flash and align the red optical recognition point to the 3rd or 4th character. Adjust reading speed with the WPM slider.
- **Visual pacer:** move a highlight through 3–4 word chunks. The optional tunnel dims surrounding text, the moving underline guides the eye, and margin guides help contain the reading field.
- **Background sound:** start a quiet low hum, 60–120 BPM metronome, or generated pink noise. Sound is off until explicitly started and is generated locally in the browser.
- **Rhythm practice:** tap the on-screen 1–4 counter or focus its panel and press Space while following the paced words.

These features are optional reading exercises, not a guaranteed treatment or a promise to eliminate subvocalization. Stop or adjust them if they feel uncomfortable.

## Development and checks

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

The popup and reader are statically exported for Chrome; the `out/` directory is generated during the build and should not be edited directly.
