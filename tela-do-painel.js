let usuarioLogado = null;
let eventoAberto = null;
let participantesDoEvento = [];
let ganhadoresDoEvento = [];

const QUANTIDADE_DE_ALTERNATIVAS = 4;

function mostrarTela(id) {
  for (const tela of ['tela-entrar', 'tela-lista-de-eventos', 'tela-do-evento']) {
    document.getElementById(tela).classList.toggle('escondido', tela !== id);
  }
  window.scrollTo(0, 0);
}

function mostrarAviso(idDoAviso, texto, tipo = 'erro') {
  const aviso = document.getElementById(idDoAviso);
  aviso.textContent = texto;
  aviso.className = `aviso aviso-${tipo}`;
  if (tipo === 'sucesso') setTimeout(() => aviso.classList.add('escondido'), 2500);
}

function criarCodigoDoEvento(nome) {
  const base = nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'evento';
  const sufixo = Math.random().toString(36).slice(2, 6);
  return `${base}-${sufixo}`;
}

function desenharQrCode(elemento, texto, tamanhoDaCelula = 6) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  elemento.innerHTML = qr.createImgTag(tamanhoDaCelula, 0);
}

/* ---------- Entrar e sair ---------- */

document.getElementById('formulario-de-entrada').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const email = document.getElementById('campo-email').value.trim();
  const senha = document.getElementById('campo-senha').value;
  const { error } = await bancoDeDados.auth.signInWithPassword({ email, password: senha });
  if (error) mostrarAviso('aviso-de-entrada', 'E-mail ou senha incorretos (ou conta ainda não confirmada no e-mail).');
});

document.getElementById('botao-criar-conta').addEventListener('click', async () => {
  const email = document.getElementById('campo-email').value.trim();
  const senha = document.getElementById('campo-senha').value;
  if (!email || senha.length < 6) {
    mostrarAviso('aviso-de-entrada', 'Preencha o e-mail e uma senha com pelo menos 6 caracteres.');
    return;
  }
  const { data, error } = await bancoDeDados.auth.signUp({ email, password: senha });
  if (error) {
    mostrarAviso('aviso-de-entrada', `Não foi possível criar a conta: ${error.message}`);
  } else if (!data.session) {
    mostrarAviso('aviso-de-entrada', 'Conta criada! Abra seu e-mail e clique no link de confirmação, depois volte aqui e clique em Entrar.', 'sucesso');
  }
});

document.getElementById('botao-sair').addEventListener('click', () => bancoDeDados.auth.signOut());

bancoDeDados.auth.onAuthStateChange((_situacao, sessao) => {
  const usuarioAnterior = usuarioLogado?.id;
  usuarioLogado = sessao?.user || null;
  if (!usuarioLogado) { mostrarTela('tela-entrar'); return; }
  if (usuarioAnterior === usuarioLogado.id) return;
  document.getElementById('email-de-quem-entrou').textContent = usuarioLogado.email;
  // espera o login terminar antes de buscar dados
  setTimeout(abrirListaDeEventos, 0);
});

/* ---------- Lista de eventos ---------- */

async function abrirListaDeEventos() {
  eventoAberto = null;
  history.replaceState(null, '', enderecoDaPagina('painel.html'));
  mostrarTela('tela-lista-de-eventos');
  const { data: eventos, error } = await bancoDeDados
    .from('eventos').select('*').order('criado_em', { ascending: false });
  if (error) { alert('Não foi possível carregar seus eventos.'); return; }

  const grade = document.getElementById('grade-de-eventos');
  grade.replaceChildren();
  document.getElementById('aviso-sem-eventos').classList.toggle('escondido', eventos.length > 0);
  for (const evento of eventos) {
    const cartao = document.createElement('div');
    cartao.className = 'cartao cartao-de-evento';
    cartao.style.setProperty('--cor-do-cartao', evento.cor_principal);
    const titulo = document.createElement('h3');
    titulo.textContent = evento.nome;
    const premio = document.createElement('p');
    premio.className = 'texto-suave';
    premio.style.margin = '0 0 10px';
    premio.textContent = evento.premio ? `🎁 ${evento.premio}` : 'Sem prêmio definido';
    const selo = document.createElement('span');
    selo.className = evento.aberto_para_inscricoes ? 'selo selo-aberto' : 'selo';
    selo.textContent = evento.aberto_para_inscricoes ? 'Inscrições abertas' : 'Inscrições fechadas';
    cartao.append(titulo, premio, selo);
    cartao.addEventListener('click', () => abrirEvento(evento.id));
    grade.appendChild(cartao);
  }

  const idPedidoNoEndereco = new URLSearchParams(window.location.search).get('evento');
  if (idPedidoNoEndereco && eventos.some((evento) => evento.id === idPedidoNoEndereco)) abrirEvento(idPedidoNoEndereco);
}

document.getElementById('botao-novo-evento').addEventListener('click', async () => {
  const nome = prompt('Qual o nome do evento?');
  if (!nome || !nome.trim()) return;
  const { data, error } = await bancoDeDados
    .from('eventos')
    .insert({ nome: nome.trim(), codigo: criarCodigoDoEvento(nome) })
    .select().single();
  if (error) { alert('Não foi possível criar o evento.'); return; }
  abrirEvento(data.id);
});

document.getElementById('botao-voltar').addEventListener('click', abrirListaDeEventos);

/* ---------- Um evento ---------- */

async function abrirEvento(idDoEvento) {
  const { data: evento, error } = await bancoDeDados.from('eventos').select('*').eq('id', idDoEvento).single();
  if (error) { alert('Não foi possível abrir o evento.'); return; }
  eventoAberto = evento;
  history.replaceState(null, '', enderecoDaPagina('painel.html', { evento: evento.id }));
  aplicarCorDoEvento(evento.cor_principal);

  document.getElementById('campo-nome-do-evento').value = evento.nome;
  document.getElementById('campo-premio').value = evento.premio;
  document.getElementById('campo-cor').value = evento.cor_principal;
  document.getElementById('campo-aberto').checked = evento.aberto_para_inscricoes;
  document.getElementById('campo-logo').value = '';
  const logoAtual = document.getElementById('logo-atual');
  logoAtual.classList.toggle('escondido', !evento.logo_url);
  if (evento.logo_url) logoAtual.src = evento.logo_url;

  const linkDoParticipante = enderecoDaPagina('participar.html', { evento: evento.codigo });
  document.getElementById('link-do-participante').textContent = linkDoParticipante;
  document.getElementById('botao-testar-como-participante').href = linkDoParticipante;
  document.getElementById('botao-abrir-telao').href = enderecoDaPagina('telao.html', { evento: evento.id });
  desenharQrCode(document.getElementById('qr-do-painel'), linkDoParticipante);

  montarAlternativasEditaveis();
  mostrarTela('tela-do-evento');
  await Promise.all([carregarPerguntas(), carregarParticipantesEGanhadores()]);
}

document.getElementById('formulario-do-evento').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const botao = document.getElementById('botao-salvar-evento');
  botao.disabled = true;

  const alteracoes = {
    nome: document.getElementById('campo-nome-do-evento').value.trim(),
    premio: document.getElementById('campo-premio').value.trim(),
    cor_principal: document.getElementById('campo-cor').value,
    aberto_para_inscricoes: document.getElementById('campo-aberto').checked,
  };

  const arquivoDaLogo = document.getElementById('campo-logo').files[0];
  if (arquivoDaLogo) {
    if (arquivoDaLogo.size > 2 * 1024 * 1024) {
      botao.disabled = false;
      mostrarAviso('aviso-do-evento', 'A logo precisa ter no máximo 2 MB.');
      return;
    }
    const extensao = (arquivoDaLogo.name.split('.').pop() || 'png').toLowerCase();
    const caminho = `${usuarioLogado.id}/${eventoAberto.id}-${Date.now()}.${extensao}`;
    const { error: erroDoEnvio } = await bancoDeDados.storage.from('logos').upload(caminho, arquivoDaLogo, { contentType: arquivoDaLogo.type });
    if (erroDoEnvio) {
      botao.disabled = false;
      mostrarAviso('aviso-do-evento', 'Não foi possível enviar a logo.');
      return;
    }
    alteracoes.logo_url = bancoDeDados.storage.from('logos').getPublicUrl(caminho).data.publicUrl;
  }

  const { error } = await bancoDeDados.from('eventos').update(alteracoes).eq('id', eventoAberto.id);
  botao.disabled = false;
  if (error) { mostrarAviso('aviso-do-evento', 'Não foi possível salvar.'); return; }
  mostrarAviso('aviso-do-evento', 'Salvo!', 'sucesso');
  abrirEvento(eventoAberto.id);
});

document.getElementById('botao-apagar-evento').addEventListener('click', async () => {
  const confirmacao = prompt(`Isso apaga o evento, as perguntas, os participantes e os ganhadores. Para confirmar, digite APAGAR`);
  if (confirmacao !== 'APAGAR') return;
  const { error } = await bancoDeDados.from('eventos').delete().eq('id', eventoAberto.id);
  if (error) { alert('Não foi possível apagar.'); return; }
  abrirListaDeEventos();
});

/* ---------- Perguntas ---------- */

function montarAlternativasEditaveis() {
  const caixa = document.getElementById('alternativas-editaveis');
  caixa.replaceChildren();
  for (let posicao = 0; posicao < QUANTIDADE_DE_ALTERNATIVAS; posicao++) {
    const linha = document.createElement('div');
    linha.className = 'alternativa-editavel';
    const marcador = document.createElement('input');
    marcador.type = 'radio';
    marcador.name = 'alternativa-certa';
    marcador.value = String(posicao);
    marcador.title = 'Marcar como resposta certa';
    if (posicao === 0) marcador.checked = true;
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.className = 'campo-alternativa';
    campo.placeholder = posicao < 2 ? `Alternativa ${posicao + 1}` : `Alternativa ${posicao + 1} (opcional)`;
    linha.append(marcador, campo);
    caixa.appendChild(linha);
  }
}

async function carregarPerguntas() {
  const { data: perguntas } = await bancoDeDados
    .from('perguntas').select('*').eq('evento_id', eventoAberto.id).order('criado_em');
  const lista = document.getElementById('lista-de-perguntas');
  lista.replaceChildren();
  if (!perguntas || perguntas.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'texto-suave';
    vazio.textContent = 'Nenhuma pergunta ainda. Sem perguntas, o público não consegue participar.';
    lista.appendChild(vazio);
    return;
  }
  for (const pergunta of perguntas) {
    const item = document.createElement('div');
    item.className = 'item-de-pergunta';
    const conteudo = document.createElement('div');
    const enunciado = document.createElement('strong');
    enunciado.textContent = pergunta.enunciado;
    const alternativas = document.createElement('ol');
    alternativas.type = 'A';
    pergunta.alternativas.forEach((texto, posicao) => {
      const alternativa = document.createElement('li');
      alternativa.textContent = posicao === pergunta.indice_da_correta ? `${texto} ✓` : texto;
      if (posicao === pergunta.indice_da_correta) alternativa.className = 'certa';
      alternativas.appendChild(alternativa);
    });
    conteudo.append(enunciado, alternativas);
    const botaoApagar = document.createElement('button');
    botaoApagar.className = 'botao botao-perigo';
    botaoApagar.textContent = 'Apagar';
    botaoApagar.addEventListener('click', async () => {
      if (!confirm('Apagar esta pergunta?')) return;
      await bancoDeDados.from('perguntas').delete().eq('id', pergunta.id);
      carregarPerguntas();
    });
    item.append(conteudo, botaoApagar);
    lista.appendChild(item);
  }
}

document.getElementById('formulario-de-pergunta').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const enunciado = document.getElementById('campo-enunciado').value.trim();
  const posicaoMarcada = Number(document.querySelector('input[name="alternativa-certa"]:checked').value);

  // junta so as alternativas preenchidas, lembrando qual delas e a certa
  const alternativas = [];
  let indiceDaCorreta = -1;
  document.querySelectorAll('.campo-alternativa').forEach((campo, posicao) => {
    const texto = campo.value.trim();
    if (!texto) return;
    if (posicao === posicaoMarcada) indiceDaCorreta = alternativas.length;
    alternativas.push(texto);
  });

  if (!enunciado) return mostrarAviso('aviso-da-pergunta', 'Escreva a pergunta.');
  if (alternativas.length < 2) return mostrarAviso('aviso-da-pergunta', 'Preencha pelo menos 2 alternativas.');
  if (indiceDaCorreta === -1) return mostrarAviso('aviso-da-pergunta', 'Marque a bolinha ao lado de uma alternativa preenchida para indicar a resposta certa.');

  const { error } = await bancoDeDados.from('perguntas').insert({
    evento_id: eventoAberto.id,
    enunciado,
    alternativas,
    indice_da_correta: indiceDaCorreta,
  });
  if (error) return mostrarAviso('aviso-da-pergunta', 'Não foi possível salvar a pergunta.');

  document.getElementById('campo-enunciado').value = '';
  montarAlternativasEditaveis();
  mostrarAviso('aviso-da-pergunta', 'Pergunta adicionada!', 'sucesso');
  carregarPerguntas();
});

/* ---------- Participantes e ganhadores ---------- */

// o banco entrega no maximo 1000 linhas por vez, entao busca em lotes
async function buscarTodosOsParticipantes() {
  const tamanhoDoLote = 1000;
  const todos = [];
  for (let inicio = 0; ; inicio += tamanhoDoLote) {
    const { data, error } = await bancoDeDados.from('participantes').select('*')
      .eq('evento_id', eventoAberto.id).order('criado_em', { ascending: false })
      .range(inicio, inicio + tamanhoDoLote - 1);
    if (error || !data) break;
    todos.push(...data);
    if (data.length < tamanhoDoLote) break;
  }
  return todos;
}

async function carregarParticipantesEGanhadores() {
  const [participantes, ganhadores] = await Promise.all([
    buscarTodosOsParticipantes(),
    bancoDeDados.from('sorteios').select('*').eq('evento_id', eventoAberto.id).order('sorteado_em', { ascending: false }),
  ]);
  participantesDoEvento = participantes;
  ganhadoresDoEvento = ganhadores.data || [];

  document.getElementById('total-de-participantes').textContent =
    `${participantesDoEvento.length} participante${participantesDoEvento.length === 1 ? '' : 's'}`;

  const tabela = document.getElementById('tabela-de-participantes');
  tabela.replaceChildren();
  for (const participante of participantesDoEvento) {
    const linha = document.createElement('tr');
    const botaoRemover = document.createElement('button');
    botaoRemover.className = 'botao botao-perigo';
    botaoRemover.style.padding = '4px 10px';
    botaoRemover.textContent = 'Remover';
    botaoRemover.addEventListener('click', async () => {
      if (!confirm(`Remover ${participante.nome_completo} do sorteio?`)) return;
      await bancoDeDados.from('participantes').delete().eq('id', participante.id);
      carregarParticipantesEGanhadores();
    });
    const celulas = [
      participante.nome_completo,
      formatarWhatsapp(participante.whatsapp),
      new Date(participante.criado_em).toLocaleString('pt-BR'),
    ].map((texto) => { const celula = document.createElement('td'); celula.textContent = texto; return celula; });
    const celulaDoBotao = document.createElement('td');
    celulaDoBotao.appendChild(botaoRemover);
    linha.append(...celulas, celulaDoBotao);
    tabela.appendChild(linha);
  }

  const tabelaDeGanhadores = document.getElementById('tabela-de-ganhadores');
  tabelaDeGanhadores.replaceChildren();
  document.getElementById('aviso-sem-ganhadores').classList.toggle('escondido', ganhadoresDoEvento.length > 0);
  for (const ganhador of ganhadoresDoEvento) {
    const linha = document.createElement('tr');
    for (const texto of [ganhador.nome_do_ganhador, formatarWhatsapp(ganhador.whatsapp_do_ganhador), new Date(ganhador.sorteado_em).toLocaleString('pt-BR')]) {
      const celula = document.createElement('td');
      celula.textContent = texto;
      linha.appendChild(celula);
    }
    tabelaDeGanhadores.appendChild(linha);
  }
}

document.getElementById('botao-atualizar-participantes').addEventListener('click', carregarParticipantesEGanhadores);

document.getElementById('botao-baixar-planilha').addEventListener('click', async () => {
  await carregarParticipantesEGanhadores();
  const idsDosGanhadores = new Set(ganhadoresDoEvento.map((ganhador) => ganhador.participante_id));
  const protegerCelula = (valor) => `"${String(valor).replace(/"/g, '""')}"`;
  const linhas = [['Nome completo', 'WhatsApp', 'Entrou em', 'Ganhou?']];
  for (const participante of [...participantesDoEvento].reverse()) {
    linhas.push([
      participante.nome_completo,
      formatarWhatsapp(participante.whatsapp),
      new Date(participante.criado_em).toLocaleString('pt-BR'),
      idsDosGanhadores.has(participante.id) ? 'Sim' : 'Não',
    ]);
  }
  // ponto e virgula e o separador que o Excel em portugues entende
  const conteudo = '﻿' + linhas.map((linha) => linha.map(protegerCelula).join(';')).join('\r\n');
  const arquivo = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = `participantes-${eventoAberto.codigo}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById('botao-copiar-link').addEventListener('click', async () => {
  const link = document.getElementById('link-do-participante').textContent;
  try {
    await navigator.clipboard.writeText(link);
    alert('Link copiado!');
  } catch {
    prompt('Copie o link:', link);
  }
});
