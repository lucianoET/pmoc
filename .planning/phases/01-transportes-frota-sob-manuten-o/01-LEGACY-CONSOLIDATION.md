# Consolidação da pasta `ref/` — Fase 1 (Transportes)

**Data:** 2026-08-08
**Fontes analisadas:** todos os arquivos de `ref/` relevantes a transportes, cruzados com o módulo `transportes/` já em produção.

## 1. Inventário da pasta

### Transportes (esta fase)

| Arquivo | O que é | Veredito |
|---|---|---|
| `ref/transportes (2).html` | App legado completo (localStorage, chave `cmasm_shared`): Frota, Agendamento avançado (solicitante, pax, carga, prioridade, sugestão motorista/patrão), Manutenção, Motoristas/Habilitações, Relatórios | **Fonte principal de features** — versão única |
| `ref/transportes (3).html` | md5 idêntico ao (2) | Duplicata — ignorar |
| `ref/transportes.html` | Stub de redirect (189 bytes) | Ignorar |
| `ref/Mapa de VTR e EMB ATU 20FEV26.csv` (+ PDF) | Programação real de viaturas/embarcações de 30JAN (MUNK, S-10, Doblô, Ambulância, Constellation, XCMG, ETPM Fátima CMASM-08, Lancha Natal CMASM-05, Sargento Freitas CMASM-10) | **Já importado** — origem dos 9 ativos + 23 viagens do seed `11_transportes_seed.sql` |
| `ref/5 Transportes Entidades.md` | Modelo de domínio: Viagem (km_saida/chegada → incrementa uso_atual), destinos frequentes, regras de sobreaviso, Papeleta 6, quadro de condição, calculadores, relatórios | **Espec de referência** p/ evolução do módulo |
| `ref/5 Ativos Entidades.md` | Modelo de ativos genérico | Referência secundária |

### Outros módulos / fora desta fase

| Arquivo | Destino |
|---|---|
| `ref/eletrica.html` | Fase 3 (Elétrica) |
| `ref/CMASM_backup_2026-08-07.json` | Máquinas — já importado (script 09, 28 unidades) |
| `ref/pmoc_maq-agricola_dados.csv` | Máquinas — já coberto |
| `ref/cftv.html`, `paiol.html`, `predial.html`, `seguranca.html`, `xgrama.html`, `xcmasm-govbr-portal.html` | Fora do ciclo atual (backlog) |
| `ref/cmasm-mapa-v2.html`, `cmasm-elementos.geojson`, `arvore_locais_cmasm*` | Referência de locais — útil p/ campo `local` |
| `ref/Normas_Tecnicas*.md`, `Regras de Negócio e Fluxos.md`, `Plano Estratégico…md`, `MODULOS_EXTERNOS.md` | Docs de domínio — referência geral |

## 2. Estado atual do módulo `transportes/` (produção)

- `transportes/index.html` + `app.js` (791 linhas), Supabase via `shared/supabase-config.js`
- Migrações **10_transportes_schema.sql** e **11_transportes_seed.sql** aplicadas
- Tabelas: `transp_ativos` (9 rows), `transp_viagens` (23 rows), `transp_manutencoes` (0 rows)
- Schema `transp_ativos`: codigo, tipo (viatura/embarcacao), unidade_uso (km/h), uso_atual, capacidades, status, prox_manutencao (date), tipo_modelo
- Schema `transp_viagens`: classificação, tipo_uso, origem/destino, missão, uso_saida/uso_chegada, motorista/patrão/MO/responsável (texto), pax, carga, status agendada→…
- UI: Painel, Frota, Viagens, Manutenção, Relatórios — funcionando em produção

## 3. Gaps — legado/roadmap vs módulo atual

| Requisito | Estado | Gap |
|---|---|---|
| TRANSP-01 cadastro viaturas+embarcações | ✅ entregue | — |
| TRANSP-09 import legado (mapa VTR/EMB) | ✅ parcial | Conferência formal pendente (relatório de contagens + amostra vs mapa) |
| INTEG-02 rota `/transportes` | ✅ entregue | — |
| INTEG-03 login por cargo | ⚠️ verificar | Sessão "Gestor" abriu sem tela de login no teste — validar fluxo/RLS |
| TRANSP-02 planos por `tipo_modelo` | ❌ | Não há tabela de planos; `prox_manutencao` é só uma data manual |
| TRANSP-04 detecção vencida por uso | ❌ | Sem plano não há comparação uso_atual × intervalo; viagem incrementa uso mas nada dispara |
| TRANSP-03 OS com peças + baixa | ❌ | `transp_manutencoes` é registro simples, sem vínculo a plano/peças |
| TRANSP-07 estoque + lista compras CSV | ❌ | Não existe `transp_materiais`/movimentos |
| INTEG-04 não quebrar produção | ✅ até agora | Migrações 10/11 aditivas |

### Features do legado ainda não portadas (avaliar no plano)

- Agendamento avançado: solicitante/setor, prioridade, sugestão de motorista/patrão por habilitação
- Cadastro de motoristas com habilitações (entidade condutor)
- Papeleta 6 de Serviço (formulário naval impresso ao concluir viagem)
- Quadro de condição da frota (existe parcial no Painel)
- Calculadores (consumo estimado, vida útil, custo/km) — abastecimento é TRANSP-05 (Fase 2)

## 4. Estratégia de consolidação (decisões da discussão aplicadas)

- **Versão única do legado** — (2)≡(3); não há divergência a reconciliar
- **Seed**: inventário + programação já importados; histórico de manutenção legado inexistente (0 registros) — nada a migrar
- **Conferência pós-import**: gerar relatório (contagens por tipo + amostra) p/ validação do usuário — pendência da fase
