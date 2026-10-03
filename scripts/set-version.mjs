import fs from 'node:fs';

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/set-version.mjs 6.1.2');
  process.exit(1);
}

function updateJson(path, update) {
  const data = JSON.parse(
    fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  );

  update(data);

  fs.writeFileSync(
    path,
    JSON.stringify(data, null, 2) + '\n',
    'utf8'
  );
}

updateJson('package.json', data => {
  data.version = version;
});

updateJson('package-lock.json', data => {
  data.version = version;

  if (data.packages?.['']) {
    data.packages[''].version = version;
  }
});

updateJson('src-tauri/tauri.conf.json', data => {
  data.version = version;
});

const cargoPath = 'src-tauri/Cargo.toml';

let cargo = fs
  .readFileSync(cargoPath, 'utf8')
  .replace(/^\uFEFF/, '');

cargo = cargo.replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${version}"`
);

fs.writeFileSync(cargoPath, cargo, 'utf8');

console.log(`DOM.OS version set to ${version}`);
