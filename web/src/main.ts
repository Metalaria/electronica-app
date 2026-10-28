import { mount } from 'svelte';
import './app.css';
import './estilos/lectura.css';
import App from './App.svelte';
import { instalarVistaPrevia } from './lib/vistaPrevia';
import { iniciarRegistro } from './lib/registro';
import { VERSION_APP } from './lib/sincronizacion/version-app';

// First of all: the application log (Diagnóstico → «Registro de la aplicación») catches errors from here on.
iniciarRegistro(VERSION_APP);

const app = mount(App, { target: document.getElementById('app')! });
// Floating previews of the book's references (the card itself is a lazy chunk).
instalarVistaPrevia();

export default app;
