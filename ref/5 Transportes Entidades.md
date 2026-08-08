## 5. Transportes

### Entidades

```

Viagem
  ├─ ativo_id → qual VTR ou EMB
  ├─ tipo_uso: 

  ├─ data_saida, hora_saida, hora_chegada (prevista e real)
  ├─ destino: texto  (lista de destinos frequentes para selecionar BNRJ, BACS, Itaguai )
  ├─ missao: descrição  (lista checkboxes Rotina | Mantimento | Armamento | manutencao | Pessoal | Carga | 

  ├─ motorista_id → usuario
  ├─ responsavel_id → usuario (quem autorizou)
  ├─ km_saida, km_chegada → diferença incrementa uso_atual do ativo
  |  combustivel
    observacoes
  └─ status: agendada → em_andamento → concluida | cancelada
```

### Destinos frequentes (VTR EXT)

DCAM, BFNIF, Ilha das Flores (translado pessoal), Hospital Naval Marcílio Dias, Comandos Navais

### Regras

- Embarcações de rotina: viagens diárias recorrentes com horários fixos (ETPM Fátima: ~12 saídas/dia)
- Embarcações de patrulha: modo sobreaviso com período (ex: 18h às 06h)
- Ao concluir viagem: `uso_atual` do ativo incrementa por `(km_chegada - km_saida)` ou horas
- Se ativo atingir intervalo de manutenção durante viagem → alerta ao concluir

### Funcionalidades de suporte

**Quadro de condição de frota**: tabela com resumo do estado de cada viatura/embarcação (disponível, em uso, em manutenção, sobreaviso).

**Formulários oficiais**: Papeleta 6 de Serviço (formulário naval padrão para registro diário de uso de viaturas/embarcações) — gerada ao concluir viagem com todos os dados preenchidos.

**Calculadores operacionais**: EAM
- Consumo de combustível estimado por km/h percorridos
- Estimativa de vida útil de componentes: pneus, filtros, óleo, baterias
- Planejamento de uso: intervalo hora / dia / semana
- Estimativa de custo de operação e manutenção

**Relatórios periódicos**: diário, semanal e mensal — por viatura, motorista e destino.

