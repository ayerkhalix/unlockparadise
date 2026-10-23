"""Read-only MySQL dump parser. Never execute SQL or deserialize PHP objects.

Only INSERT statements with explicit column lists are consumed. Invalid tuples
fail closed. Logs must contain counts and source IDs, never customer fields.
"""
from pathlib import Path
import re

ESCAPES = {'0': '\0', 'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'Z': '\x1a'}

def load_sql(path):
    raw = Path(path).read_text(encoding='utf-8-sig')
    tables = {name: [] for name in re.findall(r'CREATE TABLE `([^`]+)`', raw)}
    pattern = re.compile(r'^INSERT INTO `([^`]+)`\s*\(([^;]+?)\)\s*VALUES\s*', re.M)
    for match in pattern.finditer(raw):
        table, columns = match[1], re.findall(r'`([^`]+)`', match[2])
        pos = match.end()
        while True:
            while raw[pos].isspace() or raw[pos] == ',': pos += 1
            if raw[pos] == ';': break
            if raw[pos] != '(': raise ValueError('Invalid tuple in ' + table)
            pos += 1; values = []
            while True:
                while raw[pos].isspace(): pos += 1
                if raw[pos] == "'":
                    pos += 1; chars = []
                    while True:
                        ch = raw[pos]; pos += 1
                        if ch == '\\':
                            ch = raw[pos]; pos += 1; chars.append(ESCAPES.get(ch, ch))
                        elif ch == "'":
                            if raw[pos] == "'": chars.append("'"); pos += 1
                            else: break
                        else: chars.append(ch)
                    value = ''.join(chars)
                else:
                    start = pos
                    while raw[pos] not in ',)': pos += 1
                    token = raw[start:pos].strip()
                    if token == 'NULL': value = None
                    elif re.fullmatch(r'-?\d+', token): value = int(token)
                    elif re.fullmatch(r'-?\d+\.\d+', token): value = float(token)
                    else: raise ValueError('Unsupported literal in ' + table)
                values.append(value)
                while raw[pos].isspace(): pos += 1
                if raw[pos] == ')': pos += 1; break
                if raw[pos] != ',': raise ValueError('Invalid delimiter in ' + table)
                pos += 1
            if len(values) != len(columns): raise ValueError('Column count in ' + table)
            tables.setdefault(table, []).append(dict(zip(columns, values)))
    return tables

def php(value):
    """Restricted PHP scalar/array parser; UTF-8 byte lengths, no object support."""
    if not isinstance(value, str) or not re.match(r'^(?:[asbid]:|N;)', value): return value
    data = value.encode('utf-8'); pos = 0
    def parse():
        nonlocal pos
        kind = chr(data[pos]); pos += 1
        if kind == 'N':
            if data[pos:pos+1] != b';': raise ValueError('Invalid null')
            pos += 1; return None
        if data[pos:pos+1] != b':': raise ValueError('Invalid PHP separator')
        pos += 1
        end = data.index(b':', pos) if kind in ('s','a') else data.index(b';', pos)
        size = int(data[pos:end]) if kind in ('s','a') else None
        if kind == 's':
            pos = end + 2; result = data[pos:pos+size].decode('utf-8'); pos += size
            if data[pos:pos+2] != b'";': raise ValueError('Invalid PHP string length')
            pos += 2; return result
        if kind == 'a':
            pos = end + 2; result = {}
            for _ in range(size):
                key = parse(); result[key] = parse()
            if data[pos:pos+1] != b'}': raise ValueError('Invalid PHP array')
            pos += 1
            return list(result.values()) if list(result) == list(range(len(result))) else result
        token = data[pos:end].decode(); pos = end + 1
        if kind == 'i': return int(token)
        if kind == 'd': return float(token)
        if kind == 'b': return token == '1'
        raise ValueError('Unsupported PHP type')
    result = parse()
    if pos != len(data): raise ValueError('Trailing PHP data')
    return result

def index_meta(rows, id_key):
    result = {}
    for row in rows: result.setdefault(int(row[id_key]), {})[row['meta_key']] = row['meta_value']
    return result
