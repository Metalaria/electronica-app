// Types of the Emscripten factory extracted by scripts/ngspice.mjs (only what the app uses).

export interface ModuloNgspice {
  FS: {
    writeFile(ruta: string, datos: string | Uint8Array): void;
    readFile(ruta: string): Uint8Array;
    mkdir(ruta: string): void;
    readdir(ruta: string): string[];
    unlink(ruta: string): void;
  };
  Asyncify: { handleAsync(fn: () => Promise<void>): unknown };
  setGetInput(fn: () => string): void;
  setHandleThings(fn: () => void): void;
  runThings(...args: string[]): void;
}

export interface OpcionesModulo {
  noInitialRun?: boolean;
  print?: (texto?: string) => void;
  printErr?: (texto?: string) => void;
  instantiateWasm?: (
    imports: WebAssembly.Imports,
    listo: (instancia: WebAssembly.Instance) => void,
  ) => Record<string, never>;
  onAbort?: (motivo: unknown) => void;
  onExit?: (codigo: number) => void;
}

declare function crearModulo(opciones?: OpcionesModulo): Promise<ModuloNgspice>;
export default crearModulo;
