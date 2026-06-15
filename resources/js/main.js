const MANIFEST_URL = 'https://waterblocks-game.pages.dev/versions.json';

let currentPlatform = '';
let allVersions = {};
let versionKeys = [];
let selectedVersion = '';
let gameDownloadUrl = '';
let gameFileName = '';
let gameDir = '';
let versionDir = '';
let offlineMode = false;
let normalUI, bsodDiv, versionSelect, playBtn, statusDiv;

function getElements() {
    normalUI = document.getElementById('normal-ui');
    bsodDiv = document.getElementById('bsod');
    versionSelect = document.getElementById('version-select');
    playBtn = document.getElementById('play-btn');
    statusDiv = document.getElementById('status');
}

function showBlueScreen(show) {
    if (show) {
        normalUI.style.display = 'none';
        bsodDiv.style.display = 'flex';
    } else {
        normalUI.style.display = 'block';
        bsodDiv.style.display = 'none';
    }
}

function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('linux')) return 'linux';
    if (typeof NL_OS !== 'undefined') {
        if (NL_OS === 'Windows') return 'windows';
        if (NL_OS === 'Linux') return 'linux';
    }
    return null;
}

let gameBaseDir = null;

// Resolve the launcher's data directory from the current user's home folder,
// so this works regardless of Windows username or OS (no more hardcoding).
async function getGameDirectory() {
    if (gameBaseDir) return gameBaseDir;
    const homeVar = currentPlatform === 'windows' ? 'USERPROFILE' : 'HOME';
    let home = await Neutralino.os.getEnv(homeVar);
    home = home.replace(/\\/g, '/').replace(/\/$/, '');
    gameBaseDir = `${home}/WaterBlocks-Launcher`;
    return gameBaseDir;
}

async function ensureDir(dirPath) {
    try {
        await Neutralino.filesystem.getStats(dirPath);
        // already exists
    } catch {
        try {
            await Neutralino.filesystem.createDirectory(dirPath);
        } catch (err) {
            console.warn(`Could not create directory ${dirPath}:`, err.message || err);
        }
    }
}

async function getRemoteFileSize(url) {
    try {
        const result = await Neutralino.os.execCommand(`curl -sIL "${url}"`);
        const matches = [...result.stdout.matchAll(/content-length:\s*(\d+)/gi)];
        if (matches.length) return parseInt(matches[matches.length - 1][1], 10);
    } catch (err) {
        console.warn('Could not determine remote file size:', err);
    }
    return 0;
}

function formatBytes(bytes) {
    if (bytes >= 1024 ** 3) return (bytes / (1024 ** 3)).toFixed(2) + ' GB';
    if (bytes >= 1024 ** 2) return (bytes / (1024 ** 2)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return `${bytes} B`;
}

function showProgressUI() {
    statusDiv.innerHTML = `
        <div id="dl-label">Starting download...</div>
        <progress id="dl-progress" max="100" style="width: 100%;"></progress>
    `;
}

function updateProgressUI(currentBytes, totalBytes) {
    const progressEl = document.getElementById('dl-progress');
    const labelEl = document.getElementById('dl-label');
    if (!progressEl || !labelEl) return;
    if (totalBytes > 0) {
        const percent = Math.min(100, Math.floor((currentBytes / totalBytes) * 100));
        progressEl.value = percent;
        labelEl.textContent = `Downloading... ${percent}% (${formatBytes(currentBytes)} / ${formatBytes(totalBytes)})`;
    } else {
        progressEl.removeAttribute('value'); // indeterminate animation
        labelEl.textContent = `Downloading... ${formatBytes(currentBytes)}`;
    }
}

async function downloadFileShell(url, destPath) {
    const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
    await ensureDir(destDir);
    const dest = currentPlatform === 'windows' ? destPath.replace(/\//g, '\\') : destPath;
    let command = '';
    if (currentPlatform === 'windows') {
        command = `curl -L -o "${dest}" "${url}"`;
    } else {
        command = `curl -L -o "${dest}" "${url}" || wget -O "${dest}" "${url}"`;
    }

    // Best-effort: find out the total size up front so we can show a real percent
    const totalSize = await getRemoteFileSize(url);
    showProgressUI();

    // Kick off the download in the background...
    let downloading = true;
    const downloadPromise = Neutralino.os.execCommand(command).finally(() => {
        downloading = false;
    });

    // ...and poll the partial file's size on disk while it runs.
    while (downloading) {
        let currentSize = 0;
        try {
            const stats = await Neutralino.filesystem.getStats(destPath);
            currentSize = stats.size;
        } catch {
            // file not created yet, still 0
        }
        updateProgressUI(currentSize, totalSize);
        await new Promise(r => setTimeout(r, 400));
    }

    const result = await downloadPromise;
    if (result.exitCode !== 0) throw new Error(`Download failed (exit ${result.exitCode})`);

    try {
        const stats = await Neutralino.filesystem.getStats(destPath);
        if (!stats || stats.size === 0) throw new Error('Downloaded file is empty');
        updateProgressUI(stats.size, totalSize || stats.size);
    } catch (err) {
        throw new Error('Downloaded file missing');
    }
    statusDiv.innerHTML = 'Download complete.';
}

async function scanLocalVersions() {
    const baseDir = await getGameDirectory();
    const versionsBase = `${baseDir}/versions`;
    statusDiv.innerText = 'Checking for locally installed versions...';
    let entries = [];
    try {
        entries = await Neutralino.filesystem.readDirectory(versionsBase);
    } catch (err) {
        console.warn(`No local versions folder at ${versionsBase}:`, err.message || err);
        return [];
    }
    const folders = entries
        .filter(e => e.type === 'DIRECTORY' && e.entry !== '.' && e.entry !== '..')
        .map(e => e.entry);
    return folders.sort().reverse();
}

async function populateDropdown(versionsList, isOffline = false) {
    versionSelect.innerHTML = '';
    for (const ver of versionsList) {
        const option = document.createElement('option');
        option.value = ver;
        option.textContent = ver;
        versionSelect.appendChild(option);
    }
    if (versionsList.length) {
        selectedVersion = versionsList[0];
        versionSelect.value = selectedVersion;
        playBtn.disabled = false;
        showBlueScreen(false);
    } else {
        versionSelect.innerHTML = '<option value="">No versions available</option>';
        selectedVersion = '';
        playBtn.disabled = true;
        if (isOffline) showBlueScreen(true);
        else showBlueScreen(false);
    }
    if (isOffline && versionsList.length) {
        statusDiv.innerHTML = `⚠️ Offline, using local files.<br>${versionsList.length} version(s) available. Click PLAY.`;
    } else if (!isOffline) {
        statusDiv.innerHTML = `Ready. Select version and click PLAY.`;
    }
}

async function fetchManifest() {
    statusDiv.innerText = 'Fetching version info...';
    try {
        const response = await fetch(MANIFEST_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const manifest = await response.json();
        allVersions = manifest.versions;
        versionKeys = Object.keys(allVersions).sort().reverse();
        offlineMode = false;
        await populateDropdown(versionKeys, false);
    } catch (err) {
        console.warn('Manifest fetch failed:', err.message);
        offlineMode = true;
        const localVersions = await scanLocalVersions();
        if (localVersions.length > 0) {
            await populateDropdown(localVersions, true);
            statusDiv.innerHTML = `No internet. Using local files: ${localVersions.join(', ')}. Click PLAY.`;
        } else {
            await populateDropdown([], true);
        }
    }
}

async function resolveSelectedVersion() {
    const baseDir = await getGameDirectory();
    gameDir = baseDir;
    versionDir = `${baseDir}/versions/${selectedVersion}`;
    if (offlineMode) {
        let entries = [];
        try {
            entries = await Neutralino.filesystem.readDirectory(versionDir);
        } catch (err) {
            throw new Error(`Could not read ${versionDir}: ${err.message || err}`);
        }
        const exeFile = entries.find(e => e.type === 'FILE' && e.entry.toLowerCase().endsWith('.exe'));
        if (!exeFile) throw new Error(`No .exe found in ${versionDir}`);
        gameFileName = exeFile.entry;
    } else {
        const versionInfo = allVersions[selectedVersion];
        if (!versionInfo) throw new Error(`Version ${selectedVersion} not in manifest`);
        if (currentPlatform === 'windows') {
            gameDownloadUrl = versionInfo.windows;
            if (!gameDownloadUrl) throw new Error('No Windows URL');
        } else {
            gameDownloadUrl = versionInfo.linux;
            if (!gameDownloadUrl) throw new Error('No Linux URL');
        }
        const urlParts = gameDownloadUrl.split('/');
        gameFileName = decodeURIComponent(urlParts.pop());
    }
}

function getLocalGamePath() {
    return `${versionDir}/${gameFileName}`;
}

async function isGameDownloaded() {
    const dest = getLocalGamePath();
    try {
        await Neutralino.filesystem.getStats(dest);
        return true;
    } catch (err) {
        return false;
    }
}

async function downloadGame() {
    if (offlineMode) throw new Error('Cannot download while offline');
    await ensureDir(versionDir);
    await downloadFileShell(gameDownloadUrl, getLocalGamePath());
}

async function launchGame() {
    const localPath = getLocalGamePath();
    statusDiv.innerText = `Launching ${selectedVersion}...`;

    // Hide the launcher window while the game runs
    try {
        await Neutralino.window.hide();
    } catch (err) {
        console.warn('Could not hide window:', err);
    }

    try {
        if (currentPlatform === 'windows') {
            const absPath = localPath.replace(/\//g, '\\');
            const psPath = absPath.replace(/'/g, "''"); // escape single quotes for PowerShell
            // Start-Process -Wait blocks until the game process exits
            const command = `powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '${psPath}' -Wait"`;
            await Neutralino.os.execCommand(command);
        } else {
            // On Linux, running the binary directly blocks until it exits
            await Neutralino.os.execCommand(`"${localPath}"`);
        }
    } catch (err) {
        console.error('Error while running game:', err);
        try {
            await Neutralino.window.show();
        } catch {}
        statusDiv.innerHTML = `Error: ${err.message}<br><button id="retry-btn">Retry</button>`;
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) retryBtn.addEventListener('click', () => playBtn.click());
        return;
    }

    // Game has closed - close the launcher
    Neutralino.app.exit();
}

function setupEventListeners() {
    if (playBtn) {
        playBtn.addEventListener('click', async () => {
            playBtn.disabled = true;
            try {
                selectedVersion = versionSelect.value;
                if (!selectedVersion) throw new Error('No version selected');
                await resolveSelectedVersion();
                if (await isGameDownloaded()) {
                    statusDiv.innerText = `Version ${selectedVersion} found. Launching...`;
                    await launchGame();
                } else {
                    if (offlineMode) throw new Error('Version not downloaded locally');
                    statusDiv.innerText = `Downloading ${selectedVersion}...`;
                    await downloadGame();
                    statusDiv.innerText = 'Launching...';
                    await launchGame();
                }
            } catch (err) {
                console.error(err);
                statusDiv.innerHTML = `Error: ${err.message}<br><button id="retry-btn">Retry</button>`;
                const retryBtn = document.getElementById('retry-btn');
                if (retryBtn) retryBtn.addEventListener('click', () => playBtn.click());
            } finally {
                playBtn.disabled = false;
            }
        });
    }
    if (versionSelect) {
        versionSelect.addEventListener('change', (e) => {
            selectedVersion = e.target.value;
            statusDiv.innerHTML = offlineMode
                ? `Offline, ready to play ${selectedVersion}. Click PLAY.`
                : `Ready to play ${selectedVersion}. Click PLAY.`;
        });
    }
    const bsodRetry = document.getElementById('bsod-retry-btn');
    if (bsodRetry) {
        bsodRetry.addEventListener('click', () => window.location.reload());
    }
}

async function init() {
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    getElements();
    statusDiv.innerText = 'Initializing...';
    try {
        await Neutralino.init();
        currentPlatform = detectPlatform();
        if (!currentPlatform) throw new Error('Unsupported OS');
        await fetchManifest();
        setupEventListeners();
    } catch (err) {
        console.error(err);
        statusDiv.innerText = `Init error: ${err.message}`;
    }
}

init();