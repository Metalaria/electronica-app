<script lang="ts" module>
  import Menu from '@lucide/svelte/icons/menu';
  import Search from '@lucide/svelte/icons/search';
  import X from '@lucide/svelte/icons/x';
  import Bookmark from '@lucide/svelte/icons/bookmark';
  import NotebookPen from '@lucide/svelte/icons/notebook-pen';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import House from '@lucide/svelte/icons/house';
  import BookA from '@lucide/svelte/icons/book-a';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Type from '@lucide/svelte/icons/type';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Coffee from '@lucide/svelte/icons/coffee';
  import Monitor from '@lucide/svelte/icons/monitor';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash from '@lucide/svelte/icons/trash';
  import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Maximize from '@lucide/svelte/icons/maximize';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import AArrowUp from '@lucide/svelte/icons/a-arrow-up';
  import AArrowDown from '@lucide/svelte/icons/a-arrow-down';
  import Library from '@lucide/svelte/icons/library';
  import Activity from '@lucide/svelte/icons/activity';
  import Atom from '@lucide/svelte/icons/atom';
  import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
  import Gauge from '@lucide/svelte/icons/gauge';
  import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
  import Radio from '@lucide/svelte/icons/radio';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import StepForward from '@lucide/svelte/icons/step-forward';
  import Repeat from '@lucide/svelte/icons/repeat';
  import Calculator from '@lucide/svelte/icons/calculator';
  import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
  import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
  import LocateFixed from '@lucide/svelte/icons/locate-fixed';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import TextSearch from '@lucide/svelte/icons/text-search';

  const ICONOS = {
    menu: Menu,
    buscar: Search,
    x: X,
    marcador: Bookmark,
    'marcador-lleno': Bookmark,
    nota: NotebookPen,
    chevron: ChevronRight,
    'chevron-izq': ChevronLeft,
    atras: ArrowLeft,
    arriba: ArrowUp,
    'zoom-mas': ZoomIn,
    'zoom-menos': ZoomOut,
    inicio: House,
    glosario: BookA,
    libro: BookOpen,
    texto: Type,
    sol: Sun,
    luna: Moon,
    sepia: Coffee,
    sistema: Monitor,
    editar: Pencil,
    borrar: Trash,
    volver: CornerUpLeft,
    restablecer: RotateCcw,
    ampliar: Maximize,
    ver: Eye,
    ocultar: EyeOff,
    copiar: Copy,
    hecho: Check,
    'letra-mas': AArrowUp,
    'letra-menos': AArrowDown,
    tomos: Library,
    simulador: Activity,
    componentes: Atom,
    conceptos: AudioWaveform,
    instrumentos: Gauge,
    consolas: Gamepad2,
    radio: Radio,
    aprender: GraduationCap,
    pista: Lightbulb,
    ejercicios: ListChecks,
    leida: CircleCheck,
    paso: StepForward,
    repaso: Repeat,
    calculadora: Calculator,
    'panel-cerrar': PanelLeftClose,
    'panel-abrir': PanelLeftOpen,
    localizar: LocateFixed,
    mas: Ellipsis,
    'chevron-arriba': ChevronUp,
    'chevron-abajo': ChevronDown,
    filtrar: TextSearch,
  } as const;

  export type NombreIcono = keyof typeof ICONOS;
</script>

<script lang="ts">
  let { nombre, tam = 20, grosor = 1.9 }: { nombre: NombreIcono; tam?: number; grosor?: number } = $props();
  const Componente = $derived(ICONOS[nombre]);
</script>

<Componente
  size={tam}
  strokeWidth={grosor}
  fill={nombre === 'marcador-lleno' ? 'currentColor' : 'none'}
  aria-hidden="true"
  focusable="false"
/>
