# Formatos de exportação do BB Study Planner

Versão atual do schema: `5`.

## Backup completo

Schema: `bb-study-planner-backup`. O backup restaura configurações, sessões,
assignments e histórico de replanejamentos.

```json
{
  "schema": "bb-study-planner-backup",
  "schemaVersion": 5,
  "plannerVersion": "2.0.0",
  "exportedAt": "2026-09-20T12:00:00.000Z",
  "stateVersion": 4,
  "state": {
    "items": {},
    "sessions": [],
    "mockExams": [],
    "planAssignments": [],
    "rescheduleHistory": [],
    "settings": {}
  },
  "config": {}
}
```

Antes da restauração, o arquivo é validado e passa pelas migrações do estado.

## Intercâmbio StudyTrack

Schema: `bb-study-planner-interchange`.

```json
{
  "schema": "bb-study-planner-interchange",
  "schemaVersion": 5,
  "source": "BB Study Planner",
  "plannerVersion": "2.0.0",
  "exportedAt": "...",
  "exportId": "...",
  "exam": {},
  "subjects": [],
  "topics": [],
  "studySessions": [],
  "mockExams": [],
  "planning": {
    "assignments": [],
    "rescheduleHistory": [],
    "dailyAvailability": {},
    "preferences": {},
    "summary": {
      "adherencePct": 82,
      "currentDebtMinutes": 90,
      "plannedAssignments": 42,
      "completedAssignments": 30
    }
  },
  "reviews": {
    "intervalsDays": [1, 3, 7, 16, 35],
    "estimatedMinutes": 30,
    "schedule": [],
    "overdue": []
  },
  "progress": {}
}
```

### Unidades e identificadores

- Durações são expressas em minutos, salvo campos legados chamados `totalHours`.
- Datas civis usam `YYYY-MM-DD`; instantes usam ISO 8601.
- `planAssignmentId` liga uma sessão à atividade planejada.
- `sourceAssignmentId` liga uma recuperação ao assignment que originou a dívida.
- `exportId` identifica uma exportação, sem substituir os IDs dos registros.

### Compatibilidade

Este é o contrato de intercâmbio produzido pelo Planner. A importação direta no
StudyTrack depende de o StudyTrack implementar ou mapear este schema. Até que o
contrato oficial seja conhecido e validado, o arquivo não confirma compatibilidade
nativa com o produto.
