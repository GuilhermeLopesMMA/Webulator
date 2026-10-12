/*
 * Cartucheira — biblioteca de ROMs (IndexedDB) e leitor com EmulatorJS.
 *
 * Cada jogo corre num iframe próprio: o EmulatorJS não foi feito para
 * arrancar dois jogos na mesma página, e assim fechar o jogo é só
 * deitar o iframe fora.
 */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const PORSIS = new Map(SISTEMAS.map((s) => [s.id, s]));
  const ESCALA = 0.25; // píxeis CSS por píxel nativo nos ecrãs dos cartuchos

  const estado = {
    db: null,
    jogos: [],
    iframe: null,
    filtro: "",
  };

  /* ---------------- IndexedDB ---------------- */

  function abrirDB() {
    return new Promise((resolve, reject) => {
      let pedido;
      try {
        pedido = indexedDB.open("cartucheira", 1);
      } catch (erro) {
        reject(erro);
        return;
      }
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        if (!db.objectStoreNames.contains("jogos")) {
          db.createObjectStore("jogos", { keyPath: "id" });
        }
      };
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
  }

  function transacao(modo, operacao) {
    return new Promise((resolve, reject) => {
      const tx = estado.db.transaction("jogos", modo);
      const pedido = operacao(tx.objectStore("jogos"));
      tx.oncomplete = () => resolve(pedido ? pedido.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function guardar(jogo) {
    if (!estado.db) return;
    await transacao("readwrite", (st) => st.put(jogo));
  }

  async function apagar(id) {
    if (!estado.db) return;
    await transacao("readwrite", (st) => st.delete(id));
  }

  function mensagemErroGuardar(erro) {
    if (erro && erro.name === "QuotaExceededError") {
      return "Não há espaço no browser para guardar este jogo. Remove outros da biblioteca.";
    }
    return "Não deu para guardar o jogo na biblioteca. Vai funcionar só até fechares a página.";
  }

  /* ---------------- utilitários ---------------- */

  const extensao = (nome) => (nome.includes(".") ? nome.split(".").pop().toLowerCase() : "");
  const semExtensao = (nome) => nome.replace(/\.[^.]+$/, "");
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const novoId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const fmtNumero = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });
  function tamanho(bytes) {
    if (bytes >= 1024 * 1024) return `${fmtNumero.format(bytes / 1024 / 1024)} MB`;
    return `${fmtNumero.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
  }

  const fmtRelativo = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });
  function quando(ts) {
    const seg = Math.round((ts - Date.now()) / 1000);
    const passos = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [unidade, s] of passos) {
      if (Math.abs(seg) >= s) return fmtRelativo.format(Math.round(seg / s), unidade);
    }
    return "agora mesmo";
  }

  function candidatos(ext) {
    if (EXT_ARQUIVO.includes(ext)) return SISTEMAS.map((s) => s.id);
    return SISTEMAS.filter((s) => s.ext.includes(ext)).map((s) => s.id);
  }

  function corToken(nome) {
    return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || "#a02a5e";
  }

  let temporizadorToast;
  function toast(texto) {
    const el = $("#toast");
    el.textContent = texto;
    el.classList.add("visivel");
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => el.classList.remove("visivel"), 4200);
  }

  /* ---------------- desenhar ---------------- */

  function criarEcras(sistema) {
    const [w, h] = sistema.res;
    const caixa = document.createElement("span");
    caixa.className = "ecras";
    for (let i = 0; i < (sistema.ecras || 1); i++) {
      const lcd = document.createElement("span");
      lcd.className = "lcd";
      lcd.style.width = `${Math.round(w * ESCALA)}px`;
      lcd.style.height = `${Math.round(h * ESCALA)}px`;
      caixa.append(lcd);
    }
    return caixa;
  }

  function renderizarSistemas() {
    const grelha = $("#grelha-sistemas");
    grelha.replaceChildren();
    for (const s of SISTEMAS) {
      const cart = document.createElement("button");
      cart.type = "button";
      cart.className = "cart";
      cart.dataset.sistema = s.id;
      cart.setAttribute("aria-label", `Carregar ROM de ${s.nome}`);

      const rotulo = document.createElement("span");
      rotulo.className = "cart-rotulo";
      rotulo.append(criarEcras(s));

      const nome = document.createElement("span");
      nome.className = "cart-nome";
      nome.textContent = s.nome;

      const meta = document.createElement("span");
      meta.className = "cart-meta";
      meta.textContent = `${s.fab} · ${s.ano}`;

      const spec = document.createElement("span");
      spec.className = "cart-spec";
      spec.textContent = `${s.res[0]}×${s.res[1]}${s.ecras ? ` ×${s.ecras}` : ""} · ${s.cpu}`;

      const rodape = document.createElement("span");
      rodape.className = "cart-rodape";
      const ext = document.createElement("span");
      ext.className = "cart-ext";
      s.ext.forEach((e, i) => {
        const b = document.createElement("b");
        b.textContent = `.${e}`;
        ext.append(b);
        if (i < s.ext.length - 1) ext.append(" ");
      });
      const jogos = document.createElement("span");
      jogos.className = "cart-jogos";
      jogos.dataset.contador = s.id;
      rodape.append(ext, jogos);

      cart.append(rotulo, nome, meta, spec, rodape);
      cart.addEventListener("click", () => escolherFicheiros(s.id));
      grelha.append(cart);
    }
  }

  function renderizarBiblioteca() {
    const lista = $("#lista-jogos");
    const termo = estado.filtro.trim().toLowerCase();
    const ordenados = [...estado.jogos].sort(
      (a, b) => (b.jogadoEm || 0) - (a.jogadoEm || 0) || b.adicionado - a.adicionado
    );
    const visiveis = termo ? ordenados.filter((j) => j.nome.toLowerCase().includes(termo)) : ordenados;

    lista.replaceChildren();
    for (const jogo of visiveis) {
      const s = PORSIS.get(jogo.sistema);
      if (!s) continue;
      const li = document.createElement("li");
      li.className = "jogo";

      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = s.curto;
      chip.title = s.nome;

      const info = document.createElement("div");
      info.className = "jogo-info";
      const nome = document.createElement("span");
      nome.className = "jogo-nome";
      nome.textContent = semExtensao(jogo.nome);
      nome.title = jogo.nome;
      const meta = document.createElement("span");
      meta.className = "jogo-meta";
      meta.textContent = [
        tamanho(jogo.tamanho),
        jogo.jogadoEm ? `jogado ${quando(jogo.jogadoEm)}` : "ainda não jogado",
      ].join(" · ");
      info.append(nome, meta);

      const jogar = document.createElement("button");
      jogar.type = "button";
      jogar.className = "btn primario";
      jogar.textContent = "Jogar";
      jogar.addEventListener("click", () => abrirJogo(jogo));

      const remover = document.createElement("button");
      remover.type = "button";
      remover.className = "btn icone";
      remover.setAttribute("aria-label", `Remover ${semExtensao(jogo.nome)}`);
      remover.innerHTML =
        '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10" /></svg>';
      remover.addEventListener("click", () => confirmarRemocao(jogo));

      li.append(chip, info, jogar, remover);
      lista.append(li);
    }

    const total = estado.jogos.length;
    $("#bib-contagem").textContent = total === 1 ? "1 jogo" : `${total} jogos`;
    $("#bib-vazia").hidden = total > 0;
    $("#sem-resultados").hidden = !(total > 0 && visiveis.length === 0);
    lista.hidden = visiveis.length === 0;

    for (const s of SISTEMAS) {
      const n = estado.jogos.filter((j) => j.sistema === s.id).length;
      const el = document.querySelector(`[data-contador="${s.id}"]`);
      if (el) el.textContent = n === 0 ? "" : n === 1 ? "1 jogo" : `${n} jogos`;
    }
  }

  /* ---------------- adicionar ROMs ---------------- */

  let sistemaForcado = null;

  function escolherFicheiros(sistemaId) {
    sistemaForcado = sistemaId || null;
    const input = $("#input-rom");
    const exts = sistemaId
      ? [...PORSIS.get(sistemaId).ext, ...EXT_ARQUIVO]
      : [...new Set([...SISTEMAS.flatMap((s) => s.ext), ...EXT_ARQUIVO])];
    input.accept = exts.map((e) => `.${e}`).join(",");
    input.value = "";
    input.click();
  }

  function perguntarSistema(nomeFicheiro, ids) {
    const dlg = $("#dlg-sistema");
    const opcoes = $("#opcoes-sistema");
    $("#dlg-sistema-ficheiro").textContent = nomeFicheiro;
    opcoes.replaceChildren();
    for (const id of ids) {
      const s = PORSIS.get(id);
      const b = document.createElement("button");
      b.type = "submit";
      b.value = id;
      b.className = "opcao-sistema";
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = s.curto;
      b.append(chip, s.nome);
      opcoes.append(b);
    }
    return new Promise((resolve) => {
      dlg.addEventListener("close", () => resolve(dlg.returnValue || null), { once: true });
      dlg.returnValue = "";
      dlg.showModal();
    });
  }

  async function adicionarFicheiros(lista, forcado) {
    const adicionados = [];
    for (const f of [...lista]) {
      const ext = extensao(f.name);
      let sistemaId = forcado;
      if (!sistemaId) {
        const ids = candidatos(ext);
        if (ids.length === 0) {
          toast(`${f.name}: o formato .${ext || "?"} não é suportado.`);
          continue;
        }
        sistemaId = ids.length === 1 ? ids[0] : await perguntarSistema(f.name, ids);
        if (!sistemaId) continue;
      }

      const repetido = estado.jogos.find(
        (j) => j.nome === f.name && j.tamanho === f.size && j.sistema === sistemaId
      );
      if (repetido) {
        adicionados.push(repetido);
        continue;
      }

      const jogo = {
        id: novoId(),
        nome: f.name,
        sistema: sistemaId,
        tamanho: f.size,
        adicionado: Date.now(),
        jogadoEm: 0,
        ficheiro: f,
      };
      try {
        await guardar(jogo);
      } catch (erro) {
        console.warn(erro);
        toast(mensagemErroGuardar(erro));
      }
      estado.jogos.push(jogo);
      adicionados.push(jogo);
    }

    renderizarBiblioteca();
    if (adicionados.length === 1) abrirJogo(adicionados[0]);
    else if (adicionados.length > 1) toast(`${adicionados.length} jogos na biblioteca.`);
  }

  function confirmarRemocao(jogo) {
    const dlg = $("#dlg-remover");
    $("#dlg-remover-texto").textContent =
      `${semExtensao(jogo.nome)} sai da biblioteca. Os saves ficam guardados no browser e voltam se carregares a mesma ROM.`;
    dlg.returnValue = "";
    dlg.addEventListener(
      "close",
      async () => {
        if (dlg.returnValue !== "sim") return;
        try {
          await apagar(jogo.id);
        } catch (erro) {
          console.warn(erro);
        }
        estado.jogos = estado.jogos.filter((j) => j.id !== jogo.id);
        renderizarBiblioteca();
        toast(`${semExtensao(jogo.nome)} removido.`);
      },
      { once: true }
    );
    dlg.showModal();
  }

  /* ---------------- leitor ---------------- */

  const PAGINA_JOGO = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#jogo{width:100%;height:100%}</style>
</head><body><div id="jogo"></div></body></html>`;

  function abrirJogo(jogo) {
    const s = PORSIS.get(jogo.sistema);
    if (!s) return;
    retirarIframe();

    $("#leitor-sistema").textContent = s.curto;
    $("#leitor-sistema").title = s.nome;
    $("#leitor-nome").textContent = semExtensao(jogo.nome);

    const iframe = document.createElement("iframe");
    iframe.title = `${s.nome}: ${semExtensao(jogo.nome)}`;
    iframe.allow = "fullscreen; gamepad; autoplay";
    iframe.setAttribute("allowfullscreen", "");
    iframe.addEventListener("load", () => arrancarEmulador(iframe, jogo, s), { once: true });
    iframe.srcdoc = PAGINA_JOGO;
    $("#palco").append(iframe);
    estado.iframe = iframe;

    $("#leitor").hidden = false;
    document.body.classList.add("a-jogar");
    if (!(history.state && history.state.leitor)) history.pushState({ leitor: true }, "");

    jogo.jogadoEm = Date.now();
    guardar(jogo).catch((erro) => console.warn(erro));
  }

  function arrancarEmulador(iframe, jogo, sistema) {
    const w = iframe.contentWindow;
    if (!w) return;
    const dados = pastaDadosEJS();

    // O File tem de ser do "realm" do iframe, porque o EmulatorJS
    // verifica `gameUrl instanceof File`.
    w.EJS_player = "#jogo";
    w.EJS_core = sistema.id;
    w.EJS_gameName = semExtensao(jogo.nome);
    w.EJS_gameUrl = new w.File([jogo.ficheiro], jogo.nome);
    w.EJS_pathtodata = dados;
    w.EJS_paths = caminhosEJS(sistema);
    w.EJS_language = "pt-BR";
    w.EJS_color = corToken("--acento");
    w.EJS_backgroundColor = "#000000";

    const script = w.document.createElement("script");
    script.src = `${dados}loader.js`;
    script.onerror = () =>
      toast("Não foi possível descarregar o EmulatorJS. Confirma a ligação à internet.");
    w.document.body.append(script);
    iframe.focus();
  }

  // Pede ao EmulatorJS para gravar os saves antes de deitar o iframe fora.
  function retirarIframe() {
    const iframe = estado.iframe;
    if (!iframe) return;
    estado.iframe = null;
    let esperaMs = 0;
    try {
      const emu = iframe.contentWindow && iframe.contentWindow.EJS_emulator;
      if (emu && emu.started) {
        emu.callEvent("exit");
        esperaMs = 1500;
      }
    } catch (erro) {
      console.warn(erro);
    }
    iframe.classList.add("a-sair");
    esperar(esperaMs).then(() => iframe.remove());
  }

  function fecharLeitor() {
    retirarIframe();
    $("#leitor").hidden = true;
    document.body.classList.remove("a-jogar");
    renderizarBiblioteca();
    $("#btn-carregar").focus({ preventScroll: true });
  }

  /* ---------------- eventos ---------------- */

  function ligarEventos() {
    $("#btn-carregar").addEventListener("click", () => escolherFicheiros(null));
    $("#input-rom").addEventListener("change", (e) => {
      const ficheiros = e.target.files;
      if (ficheiros && ficheiros.length) adicionarFicheiros(ficheiros, sistemaForcado);
    });

    $("#pesquisa").addEventListener("input", (e) => {
      estado.filtro = e.target.value;
      renderizarBiblioteca();
    });

    $("#btn-sair").addEventListener("click", () => {
      if (history.state && history.state.leitor) history.back();
      else fecharLeitor();
    });
    window.addEventListener("popstate", () => {
      if (!$("#leitor").hidden) fecharLeitor();
    });

    // Largar ficheiros em qualquer sítio da página.
    let profundidade = 0;
    const temFicheiros = (e) => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    window.addEventListener("dragenter", (e) => {
      if (!temFicheiros(e) || !$("#leitor").hidden) return;
      e.preventDefault();
      profundidade++;
      document.body.classList.add("a-arrastar");
    });
    window.addEventListener("dragover", (e) => {
      if (temFicheiros(e)) e.preventDefault();
    });
    window.addEventListener("dragleave", () => {
      profundidade = Math.max(0, profundidade - 1);
      if (profundidade === 0) document.body.classList.remove("a-arrastar");
    });
    window.addEventListener("drop", (e) => {
      if (!temFicheiros(e)) return;
      e.preventDefault();
      profundidade = 0;
      document.body.classList.remove("a-arrastar");
      if (!$("#leitor").hidden) return;
      adicionarFicheiros(e.dataTransfer.files, null);
    });
  }

  /* ---------------- arranque ---------------- */

  async function iniciar() {
    $("#versao-ejs").textContent = EJS_VERSAO;
    renderizarSistemas();
    ligarEventos();
    try {
      estado.db = await abrirDB();
      estado.jogos = (await transacao("readonly", (st) => st.getAll())) || [];
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (erro) {
      console.warn(erro);
      estado.db = null;
      toast("Este browser não deixa guardar a biblioteca. Os jogos ficam só até fechares a página.");
    }
    renderizarBiblioteca();
  }

  iniciar();
})();
