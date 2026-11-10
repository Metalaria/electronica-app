// node --no-warnings --import ./tests/laboratorio11/registrar.mjs tests/laboratorio11/<script>.ts
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);
