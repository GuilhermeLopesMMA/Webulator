# Cartucheira

Site com emuladores de 12 consolas retro a correr no browser: Game Boy Advance, Game Boy / Color, Nintendo DS, NES, Super Nintendo, Nintendo 64, Mega Drive, Master System, Game Gear, PlayStation, PC Engine e Atari 2600.

Carregas uma ROM (botão ou arrastar para a página), o sistema é detetado pela extensão e o jogo abre logo. As ROMs ficam numa biblioteca guardada no browser (IndexedDB), por isso continuam lá da próxima vez. Nada é enviado para servidor nenhum.

## Ficheiros

| Ficheiro | O que tem |
|---|---|
| `index.html` | Estrutura da página |
| `estilo.css` | Visual (tema claro e escuro automáticos) |
| `sistemas.js` | Lista de sistemas, versão do EmulatorJS e caminhos para o CDN |
| `app.js` | Biblioteca, deteção de sistema e leitor |

Não há build nem dependências. São ficheiros estáticos.

## Correr localmente

Precisa de um servidor (abrir o `index.html` com duplo clique não funciona bem por causa do `file://`):

```bash
npx serve .
# ou
python -m http.server 8000
```

Depois abre `http://localhost:8000` (ou a porta que o `serve` mostrar).

## Publicar no GitHub Pages

1. Cria um repositório e faz push destes 4 ficheiros para a raiz.
2. No repositório: **Settings → Pages → Build and deployment → Deploy from a branch**, escolhe `main` e `/ (root)`.
3. Ao fim de um minuto fica em `https://<utilizador>.github.io/<repositório>/`.

## Como funciona

- **Emulação**: [EmulatorJS](https://emulatorjs.org) 4.2.3, que é uma interface web para os cores do RetroArch compilados para WebAssembly (mGBA, Snes9x, Genesis Plus GX, etc.).
- **De onde vem**: dos pacotes `@emulatorjs/*` do npm, servidos pelo jsDelivr. O `sistemas.js` monta o `EJS_paths` para cada core vir do seu pacote e junta os scripts do EmulatorJS num só pedido com o `/combine/` do jsDelivr.
- **Um iframe por jogo**: o EmulatorJS não foi feito para arrancar dois jogos na mesma página. Cada jogo corre num iframe novo e fechar o jogo é remover o iframe.
- **Saves**: o EmulatorJS guarda os saves (SRAM) e os save states no IndexedDB, associados ao nome do ficheiro da ROM. Ao sair, a página pede ao emulador para gravar antes de fechar o iframe. Se removeres um jogo da biblioteca, os saves ficam e voltam se carregares a mesma ROM.
- **Controlos**: teclado e comando (Gamepad API) configuram-se no menu do próprio emulador. No telemóvel aparece um comando no ecrã.

## Formatos

| Sistema | Extensões |
|---|---|
| Game Boy Advance | `.gba` |
| Game Boy / Color | `.gb` `.gbc` |
| Nintendo DS | `.nds` |
| NES | `.nes` |
| Super Nintendo | `.sfc` `.smc` |
| Nintendo 64 | `.n64` `.z64` `.v64` |
| Mega Drive | `.md` `.gen` `.smd` `.bin` |
| Master System | `.sms` |
| Game Gear | `.gg` |
| PlayStation | `.chd` `.pbp` `.cue` `.iso` |
| PC Engine | `.pce` |
| Atari 2600 | `.a26` `.bin` |

Para `.bin`, `.zip` e `.7z` a página pergunta qual é o sistema. Clicar num cartucho da secção Sistemas força esse sistema.

Jogos de PlayStation em `.bin` + `.cue` (vários ficheiros): mete-os todos num `.zip` e carrega o zip.

## O que foi testado

Testado em Chromium com duas ROMs homebrew feitas para o efeito (GBA e NES): carregar, jogar, sair, voltar com o botão "anterior" do browser, biblioteca a persistir depois de recarregar, diálogo de sistema para `.bin`, tema escuro e largura de telemóvel.

Os outros 10 sistemas usam exatamente o mesmo caminho de código, mas não foram testados com jogos. Se algum core der problemas, o menu do EmulatorJS deixa trocar de core (por exemplo `desmume` na DS ou `nestopia` no NES), e esses cores alternativos também estão mapeados.

## Adicionar um sistema

Junta uma entrada ao array `SISTEMAS` em `sistemas.js`:

```js
{ id: "lynx", nome: "Atari Lynx", curto: "LYNX", fab: "Atari", ano: 1989,
  res: [160, 102], cpu: "65SC02 · 4 MHz", ext: ["lnx"], cores: ["handy"] },
```

O `id` tem de ser um dos sistemas do EmulatorJS e `cores` os cores desse sistema, pela ordem que o EmulatorJS usa (o primeiro é o predefinido). A lista de sistemas e cores está na [documentação do EmulatorJS](https://emulatorjs.org/docs). O pacote do core tem de existir no npm como `@emulatorjs/core-<nome>`.

Se adicionares sistemas, atualiza o "12 sistemas" no `index.html`.

## BIOS

Nenhum dos sistemas incluídos precisa de BIOS para arrancar a maioria dos jogos (o mGBA e o PCSX ReARMed têm BIOS emulada). Para usares uma BIOS real, acrescenta em `arrancarEmulador()` no `app.js`:

```js
w.EJS_biosUrl = "bios/scph5501.bin"; // exemplo para PS1
```

e põe o ficheiro na pasta `bios/` do site. Não metas BIOS num repositório público.

## Alojar o EmulatorJS tu próprio

Para não depender do jsDelivr, descarrega a release do EmulatorJS (que já traz os ficheiros minificados e os cores), põe a pasta `data/` no site, faz o `pastaDadosEJS()` em `sistemas.js` devolver `"data/"` e apaga a linha do `EJS_paths` em `app.js`.

## Licença e ROMs

O EmulatorJS e os cores do RetroArch são GPL-3.0. Usa ROMs de jogos que tens ou homebrew; não ponhas ROMs comerciais no repositório.
