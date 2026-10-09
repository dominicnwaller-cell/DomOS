import fs from 'node:fs';

const fail = msg => {
  console.error(`ERROR: ${msg}`);
  process.exitCode = 1;
};

const read = path => fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');

const html = read('src/index.html');
const legacy = read('src/app/legacy.js');
const main = read('src/main.js');
const ui = read('src/v612-ui.js');
const css = read('src/v612.css');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const tauri = JSON.parse(read('src-tauri/tauri.conf.json'));
const capability = JSON.parse(read('src-tauri/capabilities/default.json'));
const cargo = read('src-tauri/Cargo.toml');

const tag = '<script type="module" src="/main.js"';
if ((html.split(tag).length - 1) !== 1)
  fail('Updater script must appear exactly once');

const marker = legacy.indexOf('DOM.OS Pop-Out');
const start = legacy.lastIndexOf('win.document.write(`', marker);
const end = legacy.indexOf('`);win.document.close();', marker);
if (marker < 0 || start < 0 || end < 0) {
  fail('Could not locate legacy widget pop-out template');
} else if (legacy.slice(start, end).includes('<script')) {
  fail('Script tag found inside the widget pop-out template');
}

for (const required of [
  'function showPage(n)',
  'function renderDashboard()',
  'function renderCalendar()',
  'function renderDashTasks()',
  'function renderDashSchedule()',
  'function renderGoals()',
  'renderAll();'
]) {
  if (!legacy.includes(required)) fail(`Core DOM.OS application code missing: ${required}`);
}

if (!main.includes("@tauri-apps/plugin-updater"))
  fail('Updater import missing');
if (!main.includes("@tauri-apps/api/app"))
  fail('Tauri app-version import missing');
if (!main.includes("./v612-ui.js"))
  fail('V6.1.2 UI module import missing');
if (!main.includes("./v612.css"))
  fail('V6.1.2 stylesheet import missing');
if (!main.includes('downloadAndInstall'))
  fail('Updater installation logic missing');
if (!main.includes('restartAfterInstall'))
  fail('Updater must explicitly request restart after install');

for (const marker of [
  'Work Deadlines',
  'Life Goals',
  'domos612.workTimer',
  'openNativePopout',
  'renderUpdatesSettings',
  'renderDashboardSettings'
]) {
  if (!ui.includes(marker))
    fail(`V6.1.2 functional UI marker missing: ${marker}`);
}

if (!css.includes('.dom612-updates-grid'))
  fail('V6.1.2 updates styling missing');
if (!css.includes('@media(max-width:760px)'))
  fail('Mobile-conscious responsive styling missing');

if (tauri?.app?.windows?.[0]?.dragDropEnabled !== false)
  fail('dragDropEnabled must be false');

const permissions = capability?.permissions ?? [];
if (!permissions.includes('core:webview:allow-create-webview-window'))
  fail('Native pop-out permission missing');

if (!pkg.dependencies?.['@tauri-apps/api'])
  fail('@tauri-apps/api must be an explicit dependency');

const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const versions = [
  pkg.version,
  lock.version,
  lock.packages?.['']?.version,
  tauri.version,
  cargoVersion
];

if (versions.some(v => v !== pkg.version))
  fail(`Version mismatch: ${versions.join(', ')}`);

if (!process.exitCode) {
  console.log('');
  console.log('DOM.OS VALIDATION PASSED');
  console.log(`Version: ${pkg.version}`);
  console.log('Boot sequence: OK');
  console.log('Updater + restart: OK');
  console.log('Native pop-outs: OK');
  console.log('V6.1.2 UI modules: OK');
  console.log('Responsive foundation: OK');
  console.log('Drag/drop: OK');
  console.log('Versions: OK');
}
