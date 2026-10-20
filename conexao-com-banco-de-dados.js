// Endereco e chave publica do Supabase (essa chave e feita para ficar visivel no site;
// a protecao dos dados fica nas regras do banco).
const ENDERECO_DO_SUPABASE = 'https://huwfekoeyibxpvtrdxah.supabase.co';
const CHAVE_PUBLICA_DO_SUPABASE = 'sb_publishable_udI_WbHwZuOXN6NgCvQBaw_noSkydHd';

const bancoDeDados = window.supabase.createClient(ENDERECO_DO_SUPABASE, CHAVE_PUBLICA_DO_SUPABASE);

function enderecoDaPagina(arquivo, parametros = {}) {
  const endereco = new URL(arquivo, window.location.href);
  endereco.search = '';
  endereco.hash = '';
  for (const [nome, valor] of Object.entries(parametros)) endereco.searchParams.set(nome, valor);
  return endereco.toString();
}

function aplicarCorDoEvento(cor) {
  if (/^#[0-9a-fA-F]{6}$/.test(cor || '')) {
    document.documentElement.style.setProperty('--cor-do-evento', cor);
  }
}

function formatarWhatsapp(digitos) {
  const numero = String(digitos || '').replace(/\D/g, '');
  if (numero.length === 11) return `(${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}`;
  if (numero.length === 10) return `(${numero.slice(0, 2)}) ${numero.slice(2, 6)}-${numero.slice(6)}`;
  return numero;
}

function esconderWhatsapp(digitos) {
  const numero = String(digitos || '').replace(/\D/g, '');
  return `(${numero.slice(0, 2)}) •••••-${numero.slice(-4)}`;
}

// "Maria Fernanda Souza" vira "Maria S." para mostrar no telao sem expor o nome todo
function nomeCurto(nomeCompleto) {
  const partes = String(nomeCompleto || '').trim().split(/\s+/);
  if (partes.length < 2) return partes[0] || '';
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
