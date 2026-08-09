// PMOC Elétrica — infraestrutura elétrica do CMASM.
// Portado do app legado eletrica.html (localStorage) para o padrão pmoc.
// Toda a lógica está em shared/modulo-manutencao.js; aqui fica só a
// configuração do módulo — tabelas com prefixo `elet_`.

import { iniciarModulo } from '../shared/modulo-manutencao.js'

const TIPOS = {
  GERADOR:    { nome: 'Gerador',          emoji: '⚡' },
  QGBT:       { nome: 'QGBT / Painel',    emoji: '🧰' },
  NOBREAK:    { nome: 'Nobreak / UPS',    emoji: '🔋' },
  ILUMINACAO: { nome: 'Iluminação',       emoji: '💡' },
}

iniciarModulo({
  prefixo: 'elet',
  nome: 'Elétrica',
  icone: '⚡',
  accent: '#c9a84c',
  descricao: 'Geradores, quadros, nobreaks e iluminação — manutenção por horas de operação',
  unidadeUso: 'h',
  tipos: TIPOS,
})
