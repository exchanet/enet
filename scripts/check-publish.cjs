#!/usr/bin/env node
/**
 * prepublishOnly: ensure agent_detector.js exists and all imports use that name.
 * Prevents publishing with wrong import path (agent-detector.js) which breaks on npm install.
 */
const fs = require('fs');
const path = require('path');

const detectorPath = path.join(__dirname, '..', 'src', 'utils', 'agent_detector.js');
if (!fs.existsSync(detectorPath)) {
  console.error('prepublishOnly: Missing src/utils/agent_detector.js');
  process.exit(1);
}

const commandsDir = path.join(__dirname, '..', 'src', 'commands');
const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
for (const file of files) {
  const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
  if (content.includes('agent-detector.js')) {
    console.error(`prepublishOnly: ${file} imports "agent-detector.js" — use "agent_detector.js"`);
    process.exit(1);
  }
}
