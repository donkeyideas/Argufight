import re, glob

SKIP = {'node_modules', '.next', 'dist', '.git'}

def bump(content):
    def repl(m):
        sz = int(m.group(1))
        return 'text-[' + str(sz + 2) + 'px]'
    return re.sub(r'text-\[(\d+)px\]', repl, content)

changed = 0
for ext in ['**/*.tsx', '**/*.ts']:
    for path in glob.glob(ext, recursive=True):
        parts = set(path.replace('\\', '/').split('/'))
        if parts & SKIP:
            continue
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            orig = f.read()
        updated = bump(orig)
        if updated != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(updated)
            changed += 1
            print(path)

print(str(changed) + ' files updated')
