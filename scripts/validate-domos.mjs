import fs from 'node:fs';

const fail = msg => {
  console.error(`ERROR: ${msg}`);
  process.exitCode = 1;
};

const read = path =>
  fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');

const html = read('src/index.html');
const main = read('src/main.js');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const tauri = JSON.parse(read('src-tauri/tauri.conf.json'));
const cargo = read('src-tauri/Cargo.toml');

const tag = '<script type="module" src="/main.js"></script>';

if ((html.split(tag).length - 1) !== 1)
  fail('Updater script must appear exactly once');

const marker = html.indexOf('DOM.OS Pop-Out');
const start = html.lastIndexOf('win.document.write(`', marker);
const end = html.indexOf('`);win.document.close();', marker);

if (marker < 0 || start < 0 || end < 0) {
  fail('Could not locate widget pop-out template');
} else if (html.slice(start, end).includes('<script')) {
  fail('Script tag found inside widget pop-out template');
}

if (!html.includes('function showPage(n)'))
  fail('Navigation code missing');

if (!html.includes('function renderDashboard()'))
  fail('Dashboard code missing');

if (!html.includes('function renderCalendar()'))
  fail('Calendar code missing');

if (!html.includes('renderAll();'))
  fail('DOM.OS startup render missing');

if (!main.includes("@tauri-apps/plugin-updater"))
  fail('Updater import missing');

if (!main.includes('downloadAndInstall'))
  fail('Updater installation logic missing');

if (tauri?.app?.windows?.[0]?.dragDropEnabled !== false)
  fail('dragDropEnabled must be false');

const cargoVersion =
  cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

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
  console.log('Updater: OK');
  console.log('Drag/drop: OK');
  console.log('Versions: OK');
}
