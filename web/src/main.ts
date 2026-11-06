import { mount } from 'svelte';
import './app.css';
import './estilos/lectura.css';
import App from './App.svelte';
import { instalarVistaPrevia } from './lib/vistaPrevia';
import { iniciarRegistro } from './lib/registro';
import { iniciarInforme, miga, rutaSegura } from './lib/informe-fallos';
import { VERSION_APP } from './lib/sincronizacion/version-app';

// First of all: the application log (Diagnóstico → «Registro de la aplicación») catches errors from here on.
iniciarRegistro(VERSION_APP);
// 1.0: and the local «Informe de fallos» (errors with their breadcrumbs, a page that died while in use).
iniciarInforme(VERSION_APP);
miga(`inicio ${VERSION_APP} en ${rutaSegura(location.hash || '#/')}`);

const app = mount(App, { target: document.getElementById('app')! });
// Floating previews of the book's references (the card itself is a lazy chunk).
instalarVistaPrevia();

export default app;
