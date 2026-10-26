"""Adapt the pinned Moira sources (copied into a build folder) for the trace generators.

  - MoiraConfig.h: precise timing (sync before every bus access), address errors emulated, no Musashi mimicry.
Bus order taken from SingleStepTests 680x0 (generated with Clock Signal's microcode-level 68000):
  - RTE: reads the stacked PC high word, then SR, then the PC low word; Moira read SR first.
  - JSR: fetches the first word at the target before pushing the return address, the second one after it;
    Moira pushed first.
  - ADD/SUB Dn,<ea>, ADDI/SUBI and ADDQ/SUBQ to memory, long size: the low word is written first (as Moira
    already does for AND/OR/EOR when it does not mimic Musashi).
Usage: python3 parchear_moira.py <folder with Moira's files>   (edits them in place, refuses unknown versions)
"""
import os
import sys


def cambiar(ruta, viejo, nuevo):
    texto = open(ruta, encoding='utf-8').read()
    if texto.count(viejo) != 1:
        raise SystemExit('%s: no se encuentra el texto a cambiar (¿otra versión de Moira?): %r' % (ruta, viejo[:60]))
    open(ruta, 'w', encoding='utf-8').write(texto.replace(viejo, nuevo))


def cambiar_en(ruta, funcion, viejo, nuevo):
    texto = open(ruta, encoding='utf-8').read()
    a = texto.index(funcion)
    b = texto.index('FINALIZE', a)
    trozo = texto[a:b]
    if trozo.count(viejo) != 1:
        raise SystemExit('%s: %s no tiene el texto a cambiar (¿otra versión de Moira?)' % (ruta, funcion))
    open(ruta, 'w', encoding='utf-8').write(texto[:a] + trozo.replace(viejo, nuevo) + texto[b:])


def main(d):
    cfg = os.path.join(d, 'MoiraConfig.h')
    cambiar(cfg, '#define MOIRA_PRECISE_TIMING false', '#define MOIRA_PRECISE_TIMING true')
    cambiar(cfg, '#define MOIRA_EMULATE_ADDRESS_ERROR false', '#define MOIRA_EMULATE_ADDRESS_ERROR true')
    cambiar(cfg, '#define MOIRA_MIMIC_MUSASHI true', '#define MOIRA_MIMIC_MUSASHI false')
    ex = os.path.join(d, 'MoiraExec_cpp.h')
    cambiar(ex, '''        case Core::C68000:
        {
            // Status register
            newsr = (u16)pop<C, Word>();

            // Program counter
            newpc = pop<C, Long>();
            break;
        }''', '''        case Core::C68000:
        {
            // Order of SingleStepTests 680x0: PC high, SR, PC low
            u32 hi = read<C, AddrSpace::DATA, Word>(reg.sp + 2);
            newsr = (u16)read<C, AddrSpace::DATA, Word>(reg.sp + 0);
            u32 lo = read<C, AddrSpace::DATA, Word>(reg.sp + 4);
            reg.sp += 6;
            newpc = hi << 16 | lo;
            break;
        }''')
    cambiar(ex, '''            // Save return address on stack
            push<C, Long>(reg.pc);

            // Jump to new address
            reg.pc = ea;

            queue.irc = (u16)read<C, AddrSpace::PROG, Word>(ea);
            prefetch<C, POLL>();
            break;''', '''            {
                // Order of SingleStepTests 680x0: first word at the target, push the return address, second word
                u32 ret = reg.pc;
                u16 w = (u16)read<C, AddrSpace::PROG, Word>(ea);
                push<C, Long>(ret);
                reg.pc = ea;
                queue.irc = w;
                prefetch<C, POLL>();
            }
            break;''')
    cambiar_en(ex, 'Moira::execAddRgEa(u16 opcode)', 'writeM<C, M, S>(ea, result);', 'writeM<C, M, S, REVERSE>(ea, result);')
    cambiar_en(ex, 'Moira::execAddiEa(u16 opcode)', 'writeOp<C, M, S, POLL>(dst, ea, result);', 'writeOp<C, M, S, POLL | REVERSE>(dst, ea, result);')
    cambiar_en(ex, 'Moira::execAddqEa(u16 opcode)', 'writeOp<C, M, S>(dst, ea, result);', 'writeOp<C, M, S, REVERSE>(dst, ea, result);')
    print('parchear_moira: configuración y orden de bus de RTE, JSR y ADD/SUB.l en memoria del 68000')


if __name__ == '__main__':
    main(sys.argv[1])
