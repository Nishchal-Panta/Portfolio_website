/* TEMPORARY reader - print a byte-accurate line range of a file.
   My shell/`read`/`grep` readers disagreed on line numbers earlier, so from here
   every quoted line goes through Node, which cannot misnumber. */
import { readFileSync } from 'node:fs';

const [, , file, from, to] = process.argv;
const lines = readFileSync(file, 'utf8').split(/\r\n|\r|\n/);
const a = Math.max(1, Number(from));
const b = Math.min(lines.length, Number(to));
for (let i = a; i <= b; i++) console.log(String(i).padStart(4) + '| ' + lines[i - 1]);
