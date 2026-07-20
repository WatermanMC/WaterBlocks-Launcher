# WaterBlocks Launcher

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

The official launcher for **WaterBlocks** - a voxel game inspired by Minecraft.  
Instead of downloading 100 MB+ game files manually, this launcher fetches the correct version for your OS (Windows / Linux) and keeps it safely in your user folder.

- **Auto‑updates** - the launcher never needs to be rebuilt; it reads a remote `versions.json` file.
- **Offline support** - once a version is downloaded, you can play it without an internet connection.
- **Multi‑version** - each version is saved in its own subfolder; you can switch between releases (downgrade or upgrade) at any time.
- **Clean UI** - a simple dropdown list of available versions, a PLAY button, and a friendly error screen when nothing is installed and you’re offline.

---

## Downloads

Downloads are available in the [official website](https://waterblocks-game.pages.dev/downloads.html).

No installation required, just run the executable
The launcher stores game files in `%USERPROFILE%/WaterBlocks-Launcher` (Windows) or `~/WaterBlocks-Launcher` (Linux)

---

## Features

- **Auto‑fetch** - reads [versions.json](https://waterblocks-game.pages.dev/versions.json) to get the latest download URLs
- **Cross‑platform** - works on Windows and Linux (x86_64 only).
- **Local caching** - downloaded games remain usable offline.
- **Version selection** - dropdown menu lets you pick any previously downloaded version.
- **BSOD style error** - if you are offline and have **no** local game files, a blue‑screen error appears instead of confusing buttons.
- **Auto‑close** - the launcher hides while the game is running and exits completely when the game closes.

---

## Building from source

You need [Node.js](https://nodejs.org/) and [Neu](https://neutralino.js.org/docs/#/getting-started) (the Neutralinojs CLI).

1. **Clone the repository**
   `git clone https://github.com/WatermanMC/WaterBlocks-Launcher.git
   cd WaterBlocks-Launcher`
2. **Install Neutralino (if not already installed)**
   `npm install -g @neutralinojs/neu`
3. **Build for your OS**
   `neu build --release`

> **Note:** The launcher expects a remote `versions.json` file at https://waterblocks-game.pages.dev/versions.json.

---

## Testing Offline
1. Download any game version while online (click PLAY).
2. Disable your internet connection.
3. Restart the launcher, it will now work offline using the cached files.
4. If no cached files exist, you will see a blue screen with a retry button.

---

## Reporting issues
If you find a bug or have a feature request, please [open an issue](https://github.com/WatermanMC/WaterBlocks-Launcher/issues).
Include:

- The version of the launcher (or commit hash)
- Steps to reproduce the problem
- Any error messages from the launcher (enable inspector in `neutralino.config.json` to see the console)

---

# Contributing
Pull requests are welcome!
Please follow the existing code style and test your changes
No external dependencies beyond Neutralino itself

---

## License
This project is licensed under the GNU GPL v3, see the LICENSE file for details.

---

**Enjoy WaterBlocks!**
[Official website](https://waterblocks-game.pages.dev/) | [Game releases](https://github.com/WatermanMC/WaterBlocks-Releases)
