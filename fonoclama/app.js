// PMOC Fonoclama — sistema de sonorização PA 70V do CMASM.
// Portado do app legado fonoclama.html (localStorage) para o padrão pmoc.
// Toda a lógica está em shared/modulo-manutencao.js; aqui fica só a
// configuração do módulo — tabelas com prefixo `fono_`.

import { iniciarModulo } from '../shared/modulo-manutencao.js'

const TIPOS = {
  AMPLIFICADOR: { nome: 'Amplificador',            emoji: '🔊' },
  CONSOLE:      { nome: 'Console / microfone',     emoji: '🎙️' },
  ALTO_FALANTE: { nome: 'Alto-falante / corneta',  emoji: '📣' },
  LINHA_70V:    { nome: 'Linha 70V / distribuição', emoji: '🧵' },
  SIRENE:       { nome: 'Sirene / aviso sonoro',   emoji: '🚨' },
}

iniciarModulo({
  prefixo: 'fono',
  nome: 'Fonoclama',
  icone: '📢',
  iconeAba: 'som',   // nome do conjunto comum; `icone` acima segue sendo o emoji da tela de login
  versao: '1.0',
  accent: '#4a7fa0',
  descricao: 'Amplificação, consoles, zonas de alto-falantes e linhas 70V — testes por horas de operação',
  unidadeUso: 'h',
  tipos: TIPOS,
})
