// Defense in depth for public exports. Always review the outgoing diff as well.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const errors = [];
for (const file of files) {
  if (/^(sources|wiki|inbox)\//.test(file) || /(^|\/)(bridge-config\.json|connection\.json|\.env(?:\..+)?)$/.test(file) && !file.endsWith('.env.example')) errors.push(`${file}: private runtime path`);
  if (/\.(png|jpg|jpeg|gif|ttf|woff2?|pdf|ico)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  const secrets = [/gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /(?:AKIA|ASIA)[A-Z0-9]{16}/];
  if (secrets.some(pattern => pattern.test(text))) errors.push(`${file}: possible credential`);
  if (/\/Users\/[a-zA-Z][^/\s]+\//.test(text) && !file.startsWith('scripts/')) errors.push(`${file}: personal machine path`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${files.length} tracked files: no blocked paths or recognized credentials.`);
