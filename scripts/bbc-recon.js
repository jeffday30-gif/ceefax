// One-off inspector for BBC Sport __INITIAL_DATA__ shape.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || '/tmp/bbc-wc.html', 'utf8');

// __INITIAL_DATA__ is assigned as a JSON-encoded string ("..."), so the
// content is a JSON string whose value is itself another JSON string.
const m = html.match(/window\.__INITIAL_DATA__\s*=\s*"((?:[^"\\]|\\.)*)"/s);
if (!m) {
  console.error('no __INITIAL_DATA__ match');
  process.exit(1);
}

let outer;
try {
  outer = JSON.parse('"' + m[1] + '"');
} catch (e) {
  console.error('outer parse failed:', e.message);
  process.exit(1);
}
console.log('outer decoded length:', outer.length);

let data;
try {
  data = JSON.parse(outer);
} catch (e) {
  console.error('inner parse failed:', e.message);
  process.exit(1);
}

console.log('top-level keys:', Object.keys(data).slice(0, 20).join(', '));

function findArrays(node, path, depth, results) {
  if (depth > 14 || node == null) return;
  if (Array.isArray(node)) {
    if (node.length && node[0] && typeof node[0] === 'object') {
      const keys = Object.keys(node[0]);
      const looksLikeFixture = keys.some((k) => /home|away|score|kickOff|status|minute/i.test(k));
      if (looksLikeFixture) {
        results.push({ path, len: node.length, sampleKeys: keys.slice(0, 20) });
        if (results.length === 1) {
          console.log('\nSAMPLE FIXTURE OBJECT at', path);
          console.log(JSON.stringify(node[0], null, 2).slice(0, 3000));
        }
      }
    }
    node.forEach((v, i) => findArrays(v, path + '[' + i + ']', depth + 1, results));
    return;
  }
  if (typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    findArrays(node[k], path + '.' + k, depth + 1, results);
  }
}

const found = [];
findArrays(data, '$', 0, found);
console.log('\nFixture-like arrays found:', found.length);
for (const f of found.slice(0, 10)) {
  console.log(`  ${f.path}  (len=${f.len})  keys: ${f.sampleKeys.join(', ')}`);
}
