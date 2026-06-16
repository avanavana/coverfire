import fs from 'node:fs';
import path from 'node:path';

import { config } from 'dotenv';

const envFilePaths = [
  '.env.local',
  '.env'
];

for (const envFilePath of envFilePaths) {
  const resolvedEnvFilePath = path.resolve(process.cwd(), envFilePath);

  if (!fs.existsSync(resolvedEnvFilePath)) {
    continue;
  }

  config({
    override: false,
    path: resolvedEnvFilePath
  });
}
