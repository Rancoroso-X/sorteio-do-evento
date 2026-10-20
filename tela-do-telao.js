const idDoEvento = new URLSearchParams(window.location.search).get('evento') || '';
const INTERVALO_DE_ATUALIZACAO_EM_MS = 3000;
const MAXIMO_DE_FATIAS_NA_ROLETA = 24;
const DURACAO_DO_GIRO_EM_MS = 7000;

let eventoDoTelao = null;
let idsJaMostrados = new Set();
let sorteioEmAndamento = false;
let anguloAtualDaRoleta = 0;

function mostrarMensagem(titulo, texto) {
  document.getElementById('titulo-da-mensagem').textContent = titulo;
  document.getElementById('texto-da-mensagem').textContent = texto;
  document.getElementById('tela-mensagem').classList.remove('escondido');
  document.getElementById('tela-principal').classList.add('escondido');
}

async function iniciar() {
  const { data: { session: sessao } } = await bancoDeDados.auth.getSession();
  if (!sessao) {
    mostrarMensagem('Abra o telão pelo painel', 'Entre no painel com seu e-mail e senha neste mesmo navegador e clique em "Abrir telão".');
    return;
  }
  const { data: evento, error } = await bancoDeDados.from('eventos').select('*').eq('id', idDoEvento).single();
  if (error || !evento) {
    mostrarMensagem('Evento não encontrado', 'Volte ao painel e clique em "Abrir telão" de novo.');
    return;
  }
  eventoDoTelao = evento;

  aplicarCorDoEvento(evento.cor_principal);
  document.title = `Telão: ${evento.nome}`;
  document.getElementById('nome-do-evento').textContent = evento.nome;
  document.getElementById('premio-do-evento').textContent = evento.premio ? `🎁 Prêmio: ${evento.premio}` : '';
  if (evento.logo_url) {
    const logo = document.getElementById('logo-do-evento');
    logo.src = evento.logo_url;
    logo.classList.remove('escondido');
  }
  document.getElementById('aviso-inscricoes').textContent = evento.aberto_para_inscricoes
    ? '' : '⏸ Inscrições fechadas no painel';

  const qr = qrcode(0, 'M');
  qr.addData(enderecoDaPagina('participar.html', { evento: evento.codigo }));
  qr.make();
  document.getElementById('qr-do-telao').innerHTML = qr.createImgTag(12, 0);

  document.getElementById('tela-mensagem').classList.add('escondido');
  document.getElementById('tela-principal').classList.remove('escondido');

  await atualizarContador();
  setInterval(() => { if (!sorteioEmAndamento) atualizarContador(); }, INTERVALO_DE_ATUALIZACAO_EM_MS);
}

async function atualizarContador() {
  const [{ count: total }, { data: recentes }] = await Promise.all([
    bancoDeDados.from('participantes').select('id', { count: 'exact', head: true }).eq('evento_id', idDoEvento),
    bancoDeDados.from('participantes').select('id, nome_completo').eq('evento_id', idDoEvento)
      .order('criado_em', { ascending: false }).limit(18),
  ]);
  if (typeof total !== 'number') return;

  document.getElementById('contador').textContent = total;
  document.getElementById('legenda-do-contador').textContent = total === 1 ? 'participante' : 'participantes';

  const caixa = document.getElementById('ultimos-participantes');
  caixa.replaceChildren();
  for (const participante of recentes || []) {
    const etiqueta = document.createElement('span');
    etiqueta.textContent = nomeCurto(participante.nome_completo);
    // so anima quem acabou de entrar
    if (idsJaMostrados.has(participante.id)) etiqueta.style.animation = 'none';
    idsJaMostrados.add(participante.id);
    caixa.appendChild(etiqueta);
  }
}

/* ---------- Roleta ---------- */

const coresDasFatias = (quantidade) => Array.from({ length: quantidade }, (_, posicao) =>
  `hsl(${Math.round((posicao * 360) / quantidade + 260) % 360} 70% ${posicao % 2 ? 42 : 52}%)`);

function desenharRoleta(nomes, angulo) {
  const tela = document.getElementById('roleta');
  const pincel = tela.getContext('2d');
  const centro = tela.width / 2;
  const raio = centro - 20;
  const tamanhoDaFatia = (Math.PI * 2) / nomes.length;
  const cores = coresDasFatias(nomes.length);

  pincel.clearRect(0, 0, tela.width, tela.height);
  pincel.save();
  pincel.translate(centro, centro);
  pincel.rotate(angulo);

  nomes.forEach((nome, posicao) => {
    const inicio = posicao * tamanhoDaFatia;
    pincel.beginPath();
    pincel.moveTo(0, 0);
    pincel.arc(0, 0, raio, inicio, inicio + tamanhoDaFatia);
    pincel.closePath();
    pincel.fillStyle = cores[posicao];
    pincel.fill();
    pincel.strokeStyle = 'rgba(0,0,0,.25)';
    pincel.lineWidth = 3;
    pincel.stroke();

    pincel.save();
    pincel.rotate(inicio + tamanhoDaFatia / 2);
    pincel.textAlign = 'right';
    pincel.textBaseline = 'middle';
    pincel.fillStyle = '#fff';
    const tamanhoDaLetra = Math.max(18, Math.min(44, 900 / nomes.length));
    pincel.font = `700 ${tamanhoDaLetra}px Inter, system-ui, sans-serif`;
    const texto = nome.length > 16 ? `${nome.slice(0, 15)}…` : nome;
    pincel.fillText(texto, raio - 30, 0);
    pincel.restore();
  });
  pincel.restore();

  // miolo
  pincel.beginPath();
  pincel.arc(centro, centro, 70, 0, Math.PI * 2);
  pincel.fillStyle = '#0b0b10';
  pincel.fill();
  pincel.lineWidth = 8;
  pincel.strokeStyle = '#fff';
  pincel.stroke();
  // borda
  pincel.beginPath();
  pincel.arc(centro, centro, raio, 0, Math.PI * 2);
  pincel.lineWidth = 14;
  pincel.strokeStyle = '#fff';
  pincel.stroke();
}

let audio = null;
function tocarClique() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const oscilador = audio.createOscillator();
    const volume = audio.createGain();
    oscilador.frequency.value = 1200;
    volume.gain.setValueAtTime(0.08, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.05);
    oscilador.connect(volume).connect(audio.destination);
    oscilador.start();
    oscilador.stop(audio.currentTime + 0.05);
  } catch { /* sem som, segue normal */ }
}

function girarRoleta(nomes, posicaoDoGanhador) {
  return new Promise((terminou) => {
    const tamanhoDaFatia = (Math.PI * 2) / nomes.length;
    const centroDaFatiaDoGanhador = (posicaoDoGanhador + 0.5) * tamanhoDaFatia;
    const desvio = (Math.random() - 0.5) * tamanhoDaFatia * 0.6;
    // o ponteiro fica no topo (-90 graus)
    const anguloFinalBase = -Math.PI / 2 - centroDaFatiaDoGanhador + desvio;
    const voltasCompletas = 6;
    const voltasNecessarias = Math.ceil((anguloAtualDaRoleta + voltasCompletas * Math.PI * 2 - anguloFinalBase) / (Math.PI * 2));
    const anguloFinal = anguloFinalBase + voltasNecessarias * Math.PI * 2;
    const anguloInicial = anguloAtualDaRoleta;
    const inicio = performance.now();
    let ultimaFatia = -1;

    function quadro(agora) {
      const progresso = Math.min(1, (agora - inicio) / DURACAO_DO_GIRO_EM_MS);
      const suavizado = 1 - Math.pow(1 - progresso, 4);
      anguloAtualDaRoleta = anguloInicial + (anguloFinal - anguloInicial) * suavizado;
      desenharRoleta(nomes, anguloAtualDaRoleta);

      const fatiaNoPonteiro = Math.floor((((-Math.PI / 2 - anguloAtualDaRoleta) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / tamanhoDaFatia);
      if (fatiaNoPonteiro !== ultimaFatia) { ultimaFatia = fatiaNoPonteiro; tocarClique(); }

      if (progresso < 1) requestAnimationFrame(quadro);
      else terminou();
    }
    requestAnimationFrame(quadro);
  });
}

async function sortear() {
  if (sorteioEmAndamento) return;
  sorteioEmAndamento = true;
  const botao = document.getElementById('botao-sortear');
  botao.disabled = true;

  const naoRepetir = document.getElementById('campo-nao-repetir').checked;
  // o banco escolhe o ganhador (de forma aleatoria e registrada); a roleta so mostra o resultado
  const { data, error } = await bancoDeDados.rpc('realizar_sorteio', {
    p_evento_id: idDoEvento,
    p_excluir_quem_ja_ganhou: naoRepetir,
  });
  const ganhador = data && data[0];

  if (error || !ganhador) {
    sorteioEmAndamento = false;
    botao.disabled = false;
    alert(error ? 'Não foi possível sortear. Confira a internet.' : 'Não há participantes disponíveis para sortear.');
    return;
  }

  const { data: outros } = await bancoDeDados.from('participantes').select('id, nome_completo')
    .eq('evento_id', idDoEvento).neq('id', ganhador.id).limit(1000);
  const nomesDosOutros = embaralhar((outros || []).map((participante) => nomeCurto(participante.nome_completo)))
    .slice(0, MAXIMO_DE_FATIAS_NA_ROLETA - 1);
  const nomesNaRoleta = embaralhar([...nomesDosOutros, '★']);
  const posicaoDoGanhador = nomesNaRoleta.indexOf('★');
  nomesNaRoleta[posicaoDoGanhador] = nomeCurto(ganhador.nome_completo);

  document.getElementById('ganhador').classList.add('escondido');
  document.getElementById('area-da-roleta').classList.remove('escondido');
  document.getElementById('sobreposicao-do-sorteio').classList.remove('escondido');
  desenharRoleta(nomesNaRoleta, anguloAtualDaRoleta);

  await girarRoleta(nomesNaRoleta, posicaoDoGanhador);
  await new Promise((pausa) => setTimeout(pausa, 700));

  document.getElementById('nome-do-ganhador').textContent = ganhador.nome_completo;
  document.getElementById('whatsapp-do-ganhador').textContent = `WhatsApp ${esconderWhatsapp(ganhador.whatsapp)}`;
  document.getElementById('area-da-roleta').classList.add('escondido');
  document.getElementById('ganhador').classList.remove('escondido');
  soltarConfete();

  sorteioEmAndamento = false;
  botao.disabled = false;
}

function fecharSorteio() {
  if (sorteioEmAndamento) return;
  document.getElementById('sobreposicao-do-sorteio').classList.add('escondido');
  atualizarContador();
}

/* ---------- Confete ---------- */

function soltarConfete() {
  const tela = document.getElementById('confete');
  const pincel = tela.getContext('2d');
  tela.width = window.innerWidth;
  tela.height = window.innerHeight;
  const cores = ['#facc15', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#ffffff', getComputedStyle(document.documentElement).getPropertyValue('--cor-do-evento').trim()];
  const pedacos = Array.from({ length: 260 }, () => ({
    x: Math.random() * tela.width,
    y: -20 - Math.random() * tela.height * 0.5,
    largura: 8 + Math.random() * 8,
    altura: 10 + Math.random() * 12,
    velocidadeY: 3 + Math.random() * 5,
    velocidadeX: (Math.random() - 0.5) * 3,
    giro: Math.random() * Math.PI,
    velocidadeDoGiro: (Math.random() - 0.5) * 0.3,
    cor: cores[Math.floor(Math.random() * cores.length)],
  }));
  const inicio = performance.now();
  function quadro(agora) {
    pincel.clearRect(0, 0, tela.width, tela.height);
    for (const pedaco of pedacos) {
      pedaco.y += pedaco.velocidadeY;
      pedaco.x += pedaco.velocidadeX;
      pedaco.giro += pedaco.velocidadeDoGiro;
      pincel.save();
      pincel.translate(pedaco.x, pedaco.y);
      pincel.rotate(pedaco.giro);
      pincel.fillStyle = pedaco.cor;
      pincel.fillRect(-pedaco.largura / 2, -pedaco.altura / 2, pedaco.largura, pedaco.altura);
      pincel.restore();
    }
    if (agora - inicio < 5000) requestAnimationFrame(quadro);
    else pincel.clearRect(0, 0, tela.width, tela.height);
  }
  requestAnimationFrame(quadro);
}

/* ---------- Botoes e teclado ---------- */

document.getElementById('botao-sortear').addEventListener('click', sortear);
document.getElementById('botao-sortear-de-novo').addEventListener('click', sortear);
document.getElementById('botao-fechar-sorteio').addEventListener('click', fecharSorteio);
document.getElementById('botao-tela-cheia').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') fecharSorteio();
});

iniciar();
