// Run with: node apps/web/src/lib/session-policy.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'session-policy.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const policy = {};
vm.runInNewContext(compiled, { exports: policy, Request, URL }, { filename: 'session-policy.ts' });
const { sameOrigin, consoleMutationPath } = policy;
const request = (origin) => new Request('https://app.example/api/session/login', { headers: origin === undefined ? {} : { Origin: origin } });
assert.equal(sameOrigin(request('https://app.example')), true);
for (const origin of [undefined, 'https://evil.example', 'null', 'https://app.example.evil', 'https://app.example:443/', 'http://app.example']) assert.equal(sameOrigin(request(origin)), false, String(origin));
assert.equal(consoleMutationPath(['cases', 'case_1', 'transitions'], 'POST'), 'cases/case_1/transitions');
assert.equal(consoleMutationPath(['showings', 's_1', 'participants', 'c_1'], 'PATCH'), 'showings/s_1/participants/c_1');
for (const parts of [['clients', 'c_1'], ['users'], ['cases', '..', 'transitions'], ['auth', 'login']]) assert.equal(consoleMutationPath(parts, 'POST'), null);
console.log('session policy assertions passed');
