# Arquitetura do PlannerBB 2.0

O PlannerBB é uma aplicação estática. A interface usa módulos JavaScript clássicos
para funcionar diretamente pelo navegador e CommonJS para os testes em Node.js.

```text
index.html
├── edital-data.js
├── planner-core.js                 fachada estável
├── planner/
│   ├── planner-metrics.js          aderência, dívida e estabilidade
│   ├── planner-capacity.js         calendário e capacidade
│   ├── planner-replanner.js        proposta, aplicação e custo de mudança
│   ├── planner-reviews.js          chaves e pendências de revisão
│   └── planner-feasibility.js      risco, buffer e sugestões
├── planner-storage.js
└── planner-export.js
```

## Princípios

- `planner-core.js` mantém compatibilidade com integrações existentes.
- Módulos de domínio expõem contratos menores e testáveis.
- O Replanner cria assignments; ele não apaga o planejamento anterior.
- Correções retroativas cancelam recoveries desnecessários com justificativa.
- Alterações seletivas nunca aumentam a capacidade comprometida.
- Backup e intercâmbio permanecem versionados separadamente do estado interno.

## Fluxo adaptativo

```text
Sessões reais → métricas e dívida → capacidade futura → proposta
      ↑                                                  ↓
      └──── histórico auditável ← aplicação confirmada ──┘
```

O `changeCost` penaliza distância, mudança de semana e fragmentação. A estabilidade
mede quantas atividades continuam na data original sem replanejamento.
