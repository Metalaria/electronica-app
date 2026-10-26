import { mount } from 'svelte';
import './app.css';
import './estilos/lectura.css';
import App from './App.svelte';
import { instalarVistaPrevia } from './lib/vistaPrevia';

const app = mount(App, { target: document.getElementById('app')! });
// Floating previews of the book's references (the card itself is a lazy chunk).
instalarVistaPrevia();

export default app;
