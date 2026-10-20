const codigoDoEvento = new URLSearchParams(window.location.search).get('evento') || '';
const chaveJaParticipou = `ja-participou-${codigoDoEvento}`;
const perguntasJaRespondidas = [];
let perguntaAtual = null;
let indiceRespondidoCorretamente = null;

const telas = ['tela-carregando', 'tela-mensagem', 'tela-pergunta', 'tela-cadastro'];
function mostrarTela(id) {
  for (const tela of telas) document.getElementById(tela).classList.toggle('escondido', tela !== id);
}

function mostrarMensagem(icone, titulo, texto) {
  document.getElementById('icone-da-mensagem').textContent = icone;
  document.getElementById('titulo-da-mensagem').textContent = titulo;
  document.getElementById('texto-da-mensagem').textContent = texto;
  mostrarTela('tela-mensagem');
}

function lerMemoria(chave) {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function gravarMemoria(chave, valor) {
  try { localStorage.setItem(chave, valor); } catch { /* navegador sem memoria: segue sem lembrar */ }
}

async function iniciar() {
  if (!codigoDoEvento) {
    mostrarMensagem('🔗', 'Link incompleto', 'Aponte a câmera para o QR code do telão novamente.');
    return;
  }

  const { data, error } = await bancoDeDados.rpc('buscar_evento_publico', { p_codigo: codigoDoEvento });
  const evento = data && data[0];
  if (error || !evento) {
    mostrarMensagem('🤔', 'Evento não encontrado', 'Confira se o QR code está certo.');
    return;
  }

  aplicarCorDoEvento(evento.cor_principal);
  document.title = `Sorteio: ${evento.nome}`;
  document.getElementById('nome-do-evento').textContent = evento.nome;
  if (evento.premio) {
    const premio = document.getElementById('premio-do-evento');
    premio.textContent = `🎁 ${evento.premio}`;
    premio.classList.remove('escondido');
  }
  if (evento.logo_url) {
    const logo = document.getElementById('logo-do-evento');
    logo.src = evento.logo_url;
    logo.classList.remove('escondido');
  }
  document.getElementById('cabecalho').classList.remove('escondido');

  if (lerMemoria(chaveJaParticipou)) {
    mostrarMensagem('🎉', 'Você já está participando!', 'Fique de olho no telão na hora do sorteio. Boa sorte!');
    return;
  }
  if (!evento.aberto_para_inscricoes) {
    mostrarMensagem('⏳', 'Inscrições fechadas', 'As inscrições para este sorteio não estão abertas no momento.');
    return;
  }
  if (!evento.total_de_perguntas) {
    mostrarMensagem('🛠️', 'Quase pronto', 'O organizador ainda está preparando as perguntas. Tente de novo em instantes.');
    return;
  }

  await carregarNovaPergunta();
}

async function carregarNovaPergunta() {
  mostrarTela('tela-carregando');
  const { data, error } = await bancoDeDados.rpc('sortear_pergunta', {
    p_codigo: codigoDoEvento,
    p_ja_respondidas: perguntasJaRespondidas,
  });
  perguntaAtual = data && data[0];
  if (error || !perguntaAtual) {
    mostrarMensagem('😕', 'Algo deu errado', 'Não conseguimos carregar a pergunta. Atualize a página.');
    return;
  }

  document.getElementById('enunciado').textContent = perguntaAtual.enunciado;
  document.getElementById('aviso-resposta-errada').classList.add('escondido');
  document.getElementById('botao-outra-pergunta').classList.add('escondido');

  const caixaDeAlternativas = document.getElementById('alternativas');
  caixaDeAlternativas.replaceChildren();
  // mostra as alternativas em ordem aleatoria, mas guarda a posicao original para conferir
  const alternativasComPosicao = perguntaAtual.alternativas.map((texto, posicaoOriginal) => ({ texto, posicaoOriginal }));
  for (const alternativa of embaralhar(alternativasComPosicao)) {
    const botao = document.createElement('button');
    botao.className = 'alternativa';
    botao.type = 'button';
    botao.textContent = alternativa.texto;
    botao.addEventListener('click', () => responder(botao, alternativa.posicaoOriginal));
    caixaDeAlternativas.appendChild(botao);
  }
  mostrarTela('tela-pergunta');
}

async function responder(botaoClicado, posicaoOriginal) {
  const todosOsBotoes = document.querySelectorAll('.alternativa');
  todosOsBotoes.forEach((botao) => { botao.disabled = true; });

  const { data: acertou, error } = await bancoDeDados.rpc('verificar_resposta', {
    p_pergunta_id: perguntaAtual.id,
    p_indice: posicaoOriginal,
  });
  if (error) {
    todosOsBotoes.forEach((botao) => { botao.disabled = false; });
    alert('Sem conexão. Tente de novo.');
    return;
  }

  perguntasJaRespondidas.push(perguntaAtual.id);

  if (acertou) {
    botaoClicado.classList.add('certa');
    indiceRespondidoCorretamente = posicaoOriginal;
    setTimeout(() => {
      mostrarTela('tela-cadastro');
      document.getElementById('campo-nome').focus();
    }, 700);
  } else {
    botaoClicado.classList.add('errada');
    document.getElementById('aviso-resposta-errada').classList.remove('escondido');
    document.getElementById('botao-outra-pergunta').classList.remove('escondido');
  }
}

document.getElementById('botao-outra-pergunta').addEventListener('click', carregarNovaPergunta);

// Mascara do WhatsApp enquanto a pessoa digita: (11) 98765-4321
document.getElementById('campo-whatsapp').addEventListener('input', (evento) => {
  const digitos = evento.target.value.replace(/\D/g, '').slice(0, 11);
  let formatado = digitos;
  if (digitos.length > 2) formatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length > 7) formatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  evento.target.value = formatado;
});

const mensagensDoCadastro = {
  nome_invalido: 'Escreva seu nome completo (nome e sobrenome).',
  whatsapp_invalido: 'Confira o WhatsApp: precisa ter DDD e número, ex: (11) 98765-4321.',
  resposta_errada: 'Algo deu errado com a sua resposta. Atualize a página e tente de novo.',
  evento_fechado: 'As inscrições foram encerradas.',
};

document.getElementById('formulario-de-cadastro').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const aviso = document.getElementById('aviso-do-cadastro');
  const nome = document.getElementById('campo-nome').value.trim();
  const whatsapp = document.getElementById('campo-whatsapp').value;
  aviso.classList.add('escondido');

  const mostrarAviso = (texto) => { aviso.textContent = texto; aviso.classList.remove('escondido'); };
  if (nome.split(/\s+/).length < 2) return mostrarAviso(mensagensDoCadastro.nome_invalido);
  const digitos = whatsapp.replace(/\D/g, '');
  if (digitos.length < 10) return mostrarAviso(mensagensDoCadastro.whatsapp_invalido);
  if (!document.getElementById('campo-consentimento').checked) return mostrarAviso('Marque a caixinha de aceite para participar.');

  const botao = document.getElementById('botao-inscrever');
  botao.disabled = true;
  botao.textContent = 'Enviando...';

  const { data: resultado, error } = await bancoDeDados.rpc('cadastrar_participante', {
    p_codigo: codigoDoEvento,
    p_pergunta_id: perguntaAtual.id,
    p_indice: indiceRespondidoCorretamente,
    p_nome: nome,
    p_whatsapp: digitos,
  });

  botao.disabled = false;
  botao.textContent = 'Quero participar';

  if (error) return mostrarAviso('Sem conexão. Tente de novo.');
  if (resultado === 'ok') {
    gravarMemoria(chaveJaParticipou, '1');
    mostrarMensagem('🎉', 'Você está no sorteio!', 'Fique de olho no telão na hora do sorteio. Boa sorte!');
    return;
  }
  if (resultado === 'ja_cadastrado') {
    gravarMemoria(chaveJaParticipou, '1');
    mostrarMensagem('✅', 'Esse WhatsApp já está participando', 'Cada pessoa participa uma vez. Boa sorte!');
    return;
  }
  mostrarAviso(mensagensDoCadastro[resultado] || 'Não foi possível concluir. Tente de novo.');
});

iniciar();
