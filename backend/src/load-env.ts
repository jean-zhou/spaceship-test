import 'dotenv/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

export function loadEnv() {
  config({
    path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local'),
    override: true,
  });
}
