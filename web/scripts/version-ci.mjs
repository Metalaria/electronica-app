#!/usr/bin/env node
// Prints the application version and exposes it to GitHub Actions as the step output "version".
// On a tag push (vX.Y.Z) the version is taken from the tag and written into
// src-tauri/tauri.conf.json of the CI checkout, so the installers and the Android versionCode
// match the tag without editing the file by hand. Any other build keeps the version of the file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const confFile = path.join(web, '..', 'src-tauri', 'tauri.conf.json');
const conf = JSON.parse(fs.readFileSync(confFile, 'utf8'));
let version = conf.version;

const { GITHUB_REF_TYPE, GITHUB_REF_NAME, GITHUB_OUTPUT } = process.env;
if (GITHUB_REF_TYPE === 'tag' && GITHUB_REF_NAME?.startsWith('v')) {
  const fromTag = GITHUB_REF_NAME.slice(1);
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(fromTag);
  // The MSI format limits major and minor to 255 and patch to 65535.
  if (!m || Number(m[1]) > 255 || Number(m[2]) > 255 || Number(m[3]) > 65535) {
    console.error(
      `version-ci: ERROR: la etiqueta «${GITHUB_REF_NAME}» no tiene la forma vX.Y.Z ` +
        '(X e Y hasta 255, Z hasta 65535), por ejemplo v0.2.0.',
    );
    process.exit(1);
  }
  version = fromTag;
  if (conf.version !== version) {
    conf.version = version;
    fs.writeFileSync(confFile, JSON.stringify(conf, null, 2) + '\n');
  }
}

console.log(`version-ci: versión ${version}`);
if (GITHUB_OUTPUT) fs.appendFileSync(GITHUB_OUTPUT, `version=${version}\n`);
