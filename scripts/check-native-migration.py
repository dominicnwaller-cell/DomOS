"""Read-only verification of an isolated native migration against its source backup."""
import argparse
import json
from pathlib import Path
import re
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('database', type=Path)
parser.add_argument('backup', type=Path)
parser.add_argument('profile_name')
args = parser.parse_args()
original_bytes = args.backup.read_bytes()
original = json.loads(original_bytes)['data']
connection = sqlite3.connect(args.database.resolve().as_uri() + '?mode=ro', uri=True)
connection.execute('BEGIN')
profiles = connection.execute('SELECT id FROM profiles WHERE name=?', (args.profile_name,)).fetchall()
assert len(profiles) == 1, 'Expected one migrated test profile'
profile_id = profiles[0][0]
schema_source = (Path(__file__).resolve().parent.parent / 'src-tauri/src/database.rs').read_text(encoding='utf-8')
collection_block = schema_source.split('pub const COLLECTIONS:')[1].split('];')[0]
tables = dict(re.findall(r'\("([A-Za-z]+)","([a-z_]+)"\)', collection_block))
checked = 0
for name, table in tables.items():
    key = 'lifeos4.' + name
    if key not in original:
        continue
    actual = [json.loads(row[0]) for row in connection.execute(f'SELECT data FROM {table} WHERE profile_id=? ORDER BY rowid', (profile_id,))]
    assert actual == json.loads(original[key]), f'Collection differs: {key}'
    checked += len(actual)
receipts = connection.execute('SELECT backup_path FROM legacy_imports WHERE profile_id=?', (profile_id,)).fetchall()
assert len(receipts) == 1, 'Missing verified migration receipt'
assert json.loads(Path(receipts[0][0]).read_text(encoding='utf-8'))['data'] == original, 'Pre-migration backup differs'
connection.close()
assert args.backup.read_bytes() == original_bytes, 'Source backup changed'
print(f'PASS native SQLite migration: {checked} records match source; verified backup retains all {len(original)} raw keys; source unchanged')
