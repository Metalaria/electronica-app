// Node: `node --experimental-transform-types --import ./tests/motor-real/registrar.mjs <script>.ts` (see arnes.ts).
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);
