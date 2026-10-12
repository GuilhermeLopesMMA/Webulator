/*
 * Cartucheira — definição dos sistemas e de onde vem o EmulatorJS.
 *
 * Para adicionar um sistema: junta uma entrada a SISTEMAS com o `id` que o
 * EmulatorJS usa (EJS_core) e a lista de `cores` desse sistema, pela mesma
 * ordem que o EmulatorJS (o primeiro é o predefinido).
 */

// Versão do EmulatorJS e dos cores (pacotes @emulatorjs/* no npm).
const EJS_VERSAO = "4.2.3";

// O jsDelivr serve os pacotes do npm. Troca isto se alojares tudo tu.
const CDN_JSDELIVR = "https://cdn.jsdelivr.net";

// res: resolução nativa em píxeis; ecras: nº de ecrãs (a DS tem dois).
const SISTEMAS = [
  { id: "gba", nome: "Game Boy Advance", curto: "GBA", fab: "Nintendo", ano: 2001,
    res: [240, 160], cpu: "ARM7TDMI · 16,78 MHz", ext: ["gba"], cores: ["mgba"] },
  { id: "gb", nome: "Game Boy / Color", curto: "GB", fab: "Nintendo", ano: 1989,
    res: [160, 144], cpu: "Sharp LR35902 · 4,19 MHz", ext: ["gb", "gbc"], cores: ["gambatte"] },
  { id: "nds", nome: "Nintendo DS", curto: "DS", fab: "Nintendo", ano: 2004,
    res: [256, 192], ecras: 2, cpu: "ARM946E-S · 67 MHz", ext: ["nds"], cores: ["melonds", "desmume", "desmume2015"] },
  { id: "nes", nome: "NES / Famicom", curto: "NES", fab: "Nintendo", ano: 1983,
    res: [256, 240], cpu: "Ricoh 2A03 · 1,79 MHz", ext: ["nes"], cores: ["fceumm", "nestopia"] },
  { id: "snes", nome: "Super Nintendo", curto: "SNES", fab: "Nintendo", ano: 1990,
    res: [256, 224], cpu: "Ricoh 5A22 · 3,58 MHz", ext: ["sfc", "smc"], cores: ["snes9x"] },
  { id: "n64", nome: "Nintendo 64", curto: "N64", fab: "Nintendo", ano: 1996,
    res: [320, 240], cpu: "NEC VR4300 · 93,75 MHz", ext: ["n64", "z64", "v64"], cores: ["mupen64plus_next", "parallel_n64"] },
  { id: "segaMD", nome: "Mega Drive", curto: "MD", fab: "Sega", ano: 1988,
    res: [320, 224], cpu: "Motorola 68000 · 7,67 MHz", ext: ["md", "gen", "smd", "bin"], cores: ["genesis_plus_gx", "picodrive"] },
  { id: "segaMS", nome: "Master System", curto: "SMS", fab: "Sega", ano: 1986,
    res: [256, 192], cpu: "Zilog Z80 · 3,58 MHz", ext: ["sms"], cores: ["smsplus", "genesis_plus_gx", "picodrive"] },
  { id: "segaGG", nome: "Game Gear", curto: "GG", fab: "Sega", ano: 1990,
    res: [160, 144], cpu: "Zilog Z80 · 3,58 MHz", ext: ["gg"], cores: ["genesis_plus_gx"] },
  { id: "psx", nome: "PlayStation", curto: "PS1", fab: "Sony", ano: 1994,
    res: [320, 240], cpu: "MIPS R3000A · 33,87 MHz", ext: ["chd", "pbp", "cue", "iso"], cores: ["pcsx_rearmed", "mednafen_psx_hw"] },
  { id: "pce", nome: "PC Engine", curto: "PCE", fab: "NEC", ano: 1987,
    res: [256, 239], cpu: "HuC6280 · 7,16 MHz", ext: ["pce"], cores: ["mednafen_pce"] },
  { id: "atari2600", nome: "Atari 2600", curto: "2600", fab: "Atari", ano: 1977,
    res: [160, 192], cpu: "MOS 6507 · 1,19 MHz", ext: ["a26", "bin"], cores: ["stella2014"] },
];

// Extensões que podem ser de qualquer sistema: pergunta-se qual é.
const EXT_ARQUIVO = ["zip", "7z"];

// Ficheiros que o loader.js do EmulatorJS carrega, pela ordem dele.
const EJS_SCRIPTS = [
  "emulator", "nipplejs", "shaders", "storage",
  "gamepad", "GameManager", "socket.io.min", "compression",
];

/*
 * O pacote do npm não traz o emulator.min.js, por isso junta-se os scripts
 * originais num só pedido (/combine/ do jsDelivr). Os cores vêm cada um do
 * seu pacote @emulatorjs/core-<nome>; o EJS_paths diz ao EmulatorJS onde.
 */
function caminhosEJS(sistema) {
  const pkg = `npm/@emulatorjs/emulatorjs@${EJS_VERSAO}/data/`;
  const caminhos = {
    "emulator.min.js": `${CDN_JSDELIVR}/combine/` +
      EJS_SCRIPTS.map((f) => `${pkg}src/${f}.js`).join(","),
    "emulator.min.css": `${CDN_JSDELIVR}/${pkg}emulator.css`,
  };
  for (const core of sistema.cores) {
    const base = `${CDN_JSDELIVR}/npm/@emulatorjs/core-${core}@${EJS_VERSAO}/`;
    for (const thread of ["", "-thread"]) {
      for (const legacy of ["", "-legacy"]) {
        const ficheiro = `${core}${thread}${legacy}-wasm.data`;
        caminhos[ficheiro] = base + ficheiro;
      }
    }
    caminhos[`${core}.json`] = `${base}reports/${core}.json`;
  }
  return caminhos;
}

function pastaDadosEJS() {
  return `${CDN_JSDELIVR}/npm/@emulatorjs/emulatorjs@${EJS_VERSAO}/data/`;
}
