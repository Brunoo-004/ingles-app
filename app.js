// ================== Dados salvos no aparelho ==================
// Tudo fica no localStorage do celular, numa chave só:
// {
//   dias: { "2026-11-23": { frase: { en, pt }, criadas: [{ texto, modo }], concluido: true } },
//   usadas: ["I'm on my way...", ...]   // frases que já saíram (para não repetir tão cedo)
// }

const CHAVE = "ingles-app";

function carregar() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE));
    if (dados && dados.dias) {
      // Versão antiga guardava só o número da frase: converte.
      for (const dia of Object.values(dados.dias)) {
        if (typeof dia.frase === "number") dia.frase = null;
      }
      dados.usadas = (dados.usadas || []).filter((u) => typeof u === "string");
      return dados;
    }
  } catch (e) {}
  return { dias: {}, usadas: [] };
}

function salvar() {
  localStorage.setItem(CHAVE, JSON.stringify(dados));
}

const dados = carregar();

// Data local no formato "2026-11-23".
function chaveDoDia(data = new Date()) {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

const HOJE = chaveDoDia();

// ================== Frase do dia ==================

// Sorteia uma frase que ainda não saiu. Retorna { en, pt }.
function sortearFrase(evitar) {
  let livres = FRASES.filter(([en]) => !dados.usadas.includes(en) && en !== evitar);
  if (livres.length === 0) {
    // Já saíram todas: recomeça o ciclo.
    dados.usadas = [];
    livres = FRASES.filter(([en]) => en !== evitar);
  }
  const [en, pt] = livres[Math.floor(Math.random() * livres.length)];
  dados.usadas.push(en);
  return { en, pt };
}

function diaDeHoje() {
  if (!dados.dias[HOJE]) {
    dados.dias[HOJE] = { frase: null, criadas: [], concluido: false };
  }
  if (!dados.dias[HOJE].frase) {
    dados.dias[HOJE].frase = sortearFrase();
    salvar();
  }
  return dados.dias[HOJE];
}

function fraseDeHoje() {
  return diaDeHoje().frase;
}

// ================== Voz do app (ouvir a frase) ==================

let vozIngles = null;

function escolherVoz() {
  const vozes = speechSynthesis.getVoices();
  const ingles = vozes.filter((v) => v.lang.toLowerCase().startsWith("en"));
  vozIngles =
    ingles.find((v) => /en[-_]us/i.test(v.lang) && /google|natural|samantha/i.test(v.name)) ||
    ingles.find((v) => /en[-_]us/i.test(v.lang)) ||
    ingles[0] ||
    null;
}

if ("speechSynthesis" in window) {
  escolherVoz();
  speechSynthesis.onvoiceschanged = escolherVoz;
}

function falar(texto, velocidade = 0.95) {
  if (!("speechSynthesis" in window)) {
    alert("Este navegador não consegue reproduzir voz.");
    return;
  }
  speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "en-US";
  if (vozIngles) fala.voice = vozIngles;
  fala.rate = velocidade;
  speechSynthesis.speak(fala);
}

// ================== Navegação entre os 5 minutos ==================

let etapaAtual = 1;
let vezesOuvidas = 0;

const etapas = document.querySelectorAll(".etapa");
const listaPassos = document.getElementById("passos");
for (let i = 1; i <= 5; i++) listaPassos.appendChild(document.createElement("li"));

function mostrarEtapa(n) {
  etapaAtual = n;
  etapas.forEach((el) => el.classList.toggle("escondido", Number(el.dataset.etapa) !== n));
  [...listaPassos.children].forEach((li, i) => {
    li.className = i + 1 < n ? "feito" : i + 1 === n ? "atual" : "";
  });
  document.getElementById("botao-voltar").disabled = n === 1;
  document.getElementById("botao-avancar").classList.toggle("escondido", n === 5);
  if (n === 5) desenharCriadas();
  window.scrollTo(0, 0);
}

document.getElementById("botao-voltar").addEventListener("click", () => {
  if (etapaAtual > 1) mostrarEtapa(etapaAtual - 1);
});
document.getElementById("botao-avancar").addEventListener("click", () => {
  if (etapaAtual < 5) mostrarEtapa(etapaAtual + 1);
});

// ================== Minuto 1 e 2 ==================

function desenharFrase() {
  const frase = fraseDeHoje();
  document.getElementById("frase-do-dia").textContent = frase.en;
  document.querySelectorAll(".frase-repetir").forEach((el) => (el.textContent = frase.en));
  const traducao = document.getElementById("traducao");
  traducao.textContent = frase.pt;
  traducao.classList.add("escondido");
  document.getElementById("botao-traducao").textContent = "Ver tradução";
  vezesOuvidas = 0;
  document.getElementById("contador-escuta").textContent = "";
}

function ouvirFrase(velocidade) {
  falar(fraseDeHoje().en, velocidade);
  vezesOuvidas++;
  document.getElementById("contador-escuta").textContent =
    `Você ouviu ${vezesOuvidas} ${vezesOuvidas === 1 ? "vez" : "vezes"}.`;
}

document.getElementById("botao-ouvir").addEventListener("click", () => ouvirFrase(0.95));
document.getElementById("botao-devagar").addEventListener("click", () => ouvirFrase(0.65));
document.querySelectorAll(".botao-ouvir-de-novo").forEach((b) =>
  b.addEventListener("click", () => falar(fraseDeHoje().en))
);

document.getElementById("botao-traducao").addEventListener("click", (e) => {
  const traducao = document.getElementById("traducao");
  const escondida = traducao.classList.toggle("escondido");
  e.target.textContent = escondida ? "Ver tradução" : "Esconder tradução";
});

document.getElementById("botao-trocar").addEventListener("click", () => {
  const dia = diaDeHoje();
  dia.frase = sortearFrase(dia.frase.en);
  salvar();
  desenharFrase();
  limparGravadores();
});

document.querySelectorAll(".bolinha").forEach((b) =>
  b.addEventListener("click", () => b.classList.toggle("feita"))
);

// ================== Validação da frase falada ==================

// Deixa o texto "comparável": minúsculas, sem acento, sem pontuação,
// e abre contrações (I'm → i am) para "I'm" e "I am" contarem igual.
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\bcan't\b/g, "can not")
    .replace(/\bcannot\b/g, "can not")
    .replace(/\bwon't\b/g, "will not")
    .replace(/n't\b/g, " not")
    .replace(/'m\b/g, " am")
    .replace(/'re\b/g, " are")
    .replace(/'ve\b/g, " have")
    .replace(/'ll\b/g, " will")
    .replace(/'d\b/g, " would")
    .replace(/'s\b/g, " is")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Quanto da frase original "sobrou" na frase falada (0 a 1).
function semelhanca(falada, original) {
  const restantes = normalizar(falada).split(" ");
  const palavras = normalizar(original).split(" ");
  let encontradas = 0;
  for (const p of palavras) {
    const i = restantes.indexOf(p);
    if (i >= 0) {
      encontradas++;
      restantes.splice(i, 1);
    }
  }
  return encontradas / palavras.length;
}

// Tipos de "erro" do verificador que NÃO contam (maiúsculas, pontuação,
// ortografia de nomes, estilo...). Só erros de gramática de verdade.
const CATEGORIAS_IGNORADAS = [
  "CASING", "PUNCTUATION", "TYPOGRAPHY", "TYPOS", "STYLE", "REDUNDANCY",
  "PLAIN_ENGLISH", "WIKIPEDIA", "GENDER_NEUTRALITY", "REPETITIONS_STYLE", "CREATIVE_WRITING",
];
const TIPOS_IGNORADOS = ["misspelling", "typographical", "style", "whitespace", "locale-violation", "register"];

async function checarGramatica(texto) {
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 8000);
  try {
    const corpo = new URLSearchParams({ text: texto, language: "en-US" });
    const resposta = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      body: corpo,
      signal: controle.signal,
    });
    if (!resposta.ok) throw new Error("falhou");
    const json = await resposta.json();
    return json.matches.filter(
      (m) =>
        !CATEGORIAS_IGNORADAS.includes(m.rule.category.id) &&
        !TIPOS_IGNORADOS.includes(m.rule.issueType)
    );
  } finally {
    clearTimeout(limite);
  }
}

// Prepara o que foi falado para o verificador: primeira letra maiúscula
// e pontuação no final (o reconhecimento de voz não coloca).
function prepararTexto(falado, original) {
  let t = falado.trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += original.trim().endsWith("?") ? "?" : ".";
  return t;
}

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// Retorna { tipo: "certo" | "errado" | "aviso", html, aceitar }
async function validar(falado, modo) {
  const original = fraseDeHoje().en;
  const jaCriadas = diaDeHoje().criadas.map((c) => normalizar(c.texto));

  if (normalizar(falado) === normalizar(original)) {
    return {
      tipo: "aviso",
      html: `<span class="icone">🔁</span>Essa é igual à frase original. ${
        modo === "trocar" ? "Troque pelo menos uma palavra!" : "Mude para algo da sua vida!"
      }`,
    };
  }

  if (jaCriadas.includes(normalizar(falado))) {
    return { tipo: "aviso", html: `<span class="icone">🔁</span>Essa você já falou. Tente uma nova!` };
  }

  const minimo = modo === "trocar" ? 0.5 : 0.3;
  if (semelhanca(falado, original) < minimo) {
    return {
      tipo: "errado",
      html:
        `<span class="icone">✗</span><strong>Ficou muito diferente da original.</strong><br>` +
        `<span class="detalhe">${
          modo === "trocar"
            ? "Mantenha a frase e troque só uma parte dela."
            : "Pode mudar o assunto, mas mantenha a mesma estrutura da frase."
        }</span>`,
    };
  }

  const texto = prepararTexto(falado, original);
  let erros;
  try {
    erros = await checarGramatica(texto);
  } catch (e) {
    return {
      tipo: "aviso",
      aceitar: true,
      html:
        `<span class="icone">✓?</span>A estrutura parece boa, mas não consegui checar a gramática ` +
        `(sem internet?). Guardei mesmo assim.`,
    };
  }

  if (erros.length === 0) {
    return { tipo: "certo", aceitar: true, html: `<span class="icone">✓</span><strong>Perfeito!</strong> Grave outra se quiser.` };
  }

  // Mostra o primeiro erro, de forma simples.
  const e = erros[0];
  const antes = escapar(texto.slice(0, e.offset));
  const trecho = escapar(texto.slice(e.offset, e.offset + e.length));
  const depois = escapar(texto.slice(e.offset + e.length));
  const sugestao = e.replacements && e.replacements.length
    ? `<br>Talvez: <strong>${escapar(e.replacements.slice(0, 2).map((r) => r.value).join(" / "))}</strong>`
    : "";
  return {
    tipo: "errado",
    html:
      `<span class="icone">✗</span><strong>Quase! Tem algo errado aqui:</strong><br>` +
      `${antes}<mark>${trecho}</mark>${depois}${sugestao}` +
      `<br><span class="detalhe">${escapar(e.message)}</span>` +
      `<br><span class="detalhe">Tente de novo 🙂</span>`,
  };
}

// ================== Gravador (minutos 3 e 4) ==================

const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
const gravadores = [];

function criarGravador(caixa) {
  const modo = caixa.dataset.modo;
  caixa.appendChild(document.getElementById("modelo-gravador").content.cloneNode(true));
  const botao = caixa.querySelector(".botao-gravar");
  const ouvi = caixa.querySelector(".ouvi");
  const resultado = caixa.querySelector(".resultado");
  const lista = caixa.querySelector(".aceitas");

  function mostrarResultado(r) {
    resultado.className = `resultado ${r.tipo}`;
    resultado.innerHTML = r.html;
  }

  function desenharAceitas() {
    lista.innerHTML = "";
    diaDeHoje()
      .criadas.filter((c) => c.modo === modo)
      .forEach((c) => lista.appendChild(itemFrase(c.texto)));
  }

  function limpar() {
    ouvi.classList.add("escondido");
    resultado.classList.add("escondido");
    desenharAceitas();
  }

  if (!Reconhecimento) {
    botao.disabled = true;
    botao.textContent = "🎤 Gravação indisponível";
    mostrarResultado({
      tipo: "aviso",
      html: "Este navegador não reconhece voz. Abra o app no <strong>Google Chrome</strong>.",
    });
    return { limpar: desenharAceitas };
  }

  let gravando = false;
  let rec = null;

  botao.addEventListener("click", () => {
    if (gravando) {
      rec.stop();
      return;
    }
    speechSynthesis.cancel();
    rec = new Reconhecimento();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let textoFinal = "";

    rec.onstart = () => {
      gravando = true;
      botao.classList.add("gravando");
      botao.textContent = "⏺ Ouvindo... (toque para parar)";
      ouvi.classList.remove("escondido");
      ouvi.textContent = "…";
      resultado.classList.add("escondido");
    };

    rec.onresult = (ev) => {
      textoFinal = [...ev.results].map((r) => r[0].transcript).join(" ");
      ouvi.innerHTML = `Ouvi: <strong>“${escapar(textoFinal)}”</strong>`;
    };

    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        mostrarResultado({ tipo: "aviso", html: "O app precisa de permissão para usar o microfone. Libere nas configurações do navegador." });
      } else if (ev.error === "no-speech") {
        mostrarResultado({ tipo: "aviso", html: "Não ouvi nada. Toque e fale de novo." });
      } else if (ev.error === "network") {
        mostrarResultado({ tipo: "aviso", html: "O reconhecimento de voz precisa de internet." });
      }
    };

    rec.onend = async () => {
      gravando = false;
      botao.classList.remove("gravando");
      botao.textContent = "🎤 Toque para falar";
      if (!textoFinal.trim()) {
        if (resultado.classList.contains("escondido")) {
          ouvi.classList.add("escondido");
          mostrarResultado({ tipo: "aviso", html: "Não ouvi nada. Toque e fale de novo." });
        }
        return;
      }
      botao.disabled = true;
      mostrarResultado({ tipo: "aviso", html: "Verificando…" });
      const r = await validar(textoFinal, modo);
      botao.disabled = false;
      mostrarResultado(r);
      if (r.aceitar) {
        diaDeHoje().criadas.push({ texto: prepararTexto(textoFinal, fraseDeHoje().en), modo });
        salvar();
        desenharAceitas();
      }
    };

    rec.start();
  });

  desenharAceitas();
  return { limpar };
}

function itemFrase(texto) {
  const li = document.createElement("li");
  const span = document.createElement("span");
  span.textContent = texto;
  const botao = document.createElement("button");
  botao.type = "button";
  botao.textContent = "🔊";
  botao.setAttribute("aria-label", "Ouvir");
  botao.addEventListener("click", () => falar(texto));
  li.append(span, botao);
  return li;
}

function limparGravadores() {
  gravadores.forEach((g) => g.limpar());
}

document.querySelectorAll(".gravador").forEach((caixa) => gravadores.push(criarGravador(caixa)));

// ================== Minuto 5 e conclusão ==================

function desenharCriadas() {
  const lista = document.getElementById("frases-criadas");
  lista.innerHTML = "";
  const criadas = diaDeHoje().criadas;
  if (criadas.length === 0) {
    const li = document.createElement("li");
    li.className = "vazio";
    li.textContent = "Nenhuma frase gravada hoje. Escreva a frase original ou uma que você criou de cabeça.";
    lista.appendChild(li);
  } else {
    criadas.forEach((c) => lista.appendChild(itemFrase(c.texto)));
  }
}

function desenharStatus() {
  const feito = diaDeHoje().concluido;
  const status = document.getElementById("status-hoje");
  status.textContent = feito ? "✓ Exercício de hoje concluído!" : "Seu exercício de hoje";
  status.classList.toggle("feito", feito);
  const botao = document.getElementById("botao-concluir");
  botao.textContent = feito ? "✓ Concluído hoje (toque para desfazer)" : "✓ Concluir o dia";
  botao.classList.toggle("feito", feito);
}

document.getElementById("botao-concluir").addEventListener("click", () => {
  const dia = diaDeHoje();
  if (dia.concluido && !confirm("Desmarcar o dia de hoje como concluído?")) return;
  dia.concluido = !dia.concluido;
  salvar();
  desenharStatus();
});

// ================== Calendário ==================

let mesVisivel = new Date();
mesVisivel.setDate(1);

function sequenciaAtual() {
  const d = new Date();
  if (!dados.dias[chaveDoDia(d)]?.concluido) d.setDate(d.getDate() - 1);
  let n = 0;
  while (dados.dias[chaveDoDia(d)]?.concluido) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function desenharCalendario() {
  document.getElementById("sequencia").textContent = sequenciaAtual();
  document.getElementById("total-dias").textContent = Object.values(dados.dias).filter((d) => d.concluido).length;
  document.getElementById("titulo-mes").textContent = mesVisivel.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const grade = document.getElementById("calendario-grade");
  grade.innerHTML = "";
  const ano = mesVisivel.getFullYear();
  const mes = mesVisivel.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement("button");
    vazio.className = "vazio";
    vazio.tabIndex = -1;
    grade.appendChild(vazio);
  }
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const chave = chaveDoDia(new Date(ano, mes, dia));
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = dia;
    if (dados.dias[chave]?.concluido) botao.classList.add("feito");
    if (chave === HOJE) botao.classList.add("hoje");
    botao.addEventListener("click", () => mostrarDetalhe(chave));
    grade.appendChild(botao);
  }
  document.getElementById("detalhe-dia").classList.add("escondido");
}

function mostrarDetalhe(chave) {
  const caixa = document.getElementById("detalhe-dia");
  const dia = dados.dias[chave];
  const [a, m, d] = chave.split("-");
  caixa.innerHTML = "";
  const titulo = document.createElement("p");
  titulo.className = "rotulo";
  titulo.textContent = `${d}/${m}/${a}${dia?.concluido ? " · ✓ concluído" : ""}`;
  caixa.appendChild(titulo);
  if (!dia) {
    const p = document.createElement("p");
    p.className = "dica";
    p.textContent = "Nenhum exercício neste dia.";
    caixa.appendChild(p);
  } else {
    const frase = document.createElement("p");
    if (dia.frase) {
      frase.innerHTML = `<strong>${escapar(dia.frase.en)}</strong>`;
      caixa.appendChild(frase);
    }
    dia.criadas.forEach((c) => {
      const p = document.createElement("p");
      p.className = "dica";
      p.textContent = "• " + c.texto;
      caixa.appendChild(p);
    });
  }
  caixa.classList.remove("escondido");
}

document.getElementById("mes-anterior").addEventListener("click", () => {
  mesVisivel.setMonth(mesVisivel.getMonth() - 1);
  desenharCalendario();
});
document.getElementById("mes-seguinte").addEventListener("click", () => {
  mesVisivel.setMonth(mesVisivel.getMonth() + 1);
  desenharCalendario();
});

// ================== Abas ==================

document.querySelectorAll(".abas button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".abas button").forEach((x) => x.classList.toggle("ativa", x === b));
    const aba = b.dataset.aba;
    document.getElementById("tela-hoje").classList.toggle("escondido", aba !== "hoje");
    document.getElementById("tela-calendario").classList.toggle("escondido", aba !== "calendario");
    if (aba === "calendario") desenharCalendario();
    window.scrollTo(0, 0);
  })
);

// ================== Início ==================

desenharFrase();
desenharStatus();
mostrarEtapa(1);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
