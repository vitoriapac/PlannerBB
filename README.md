# PlannerBB

Planejador adaptativo de estudos para o concurso do Banco do Brasil, desenvolvido
para ser usado em conjunto com o StudyTrack (Extrato de Estudos).

O PlannerBB transforma o edital, a disponibilidade semanal, o desempenho e as
revisões pendentes em um plano executável. O planejamento é mantido no navegador
e pode ser exportado em JSON para integração ou backup.

## Funcionalidades

- planejamento diário, semanal e para as próximas semanas;
- edital completo organizado por disciplinas, tópicos e subtópicos;
- disponibilidade configurável por dia da semana;
- priorização adaptativa por peso, incidência e desempenho;
- aderência entre o que foi planejado e o que foi executado;
- débito de estudo e replanejamento explicável;
- repetição espaçada e controle de revisões vencidas;
- simulados e evolução de desempenho;
- análise de viabilidade com buffer configurável;
- temas claro e escuro inspirados no design system do StudyTrack;
- armazenamento local, backup completo e exportação versionada.

## Como executar

Não há etapa de compilação. Clone o projeto e abra [index.html](index.html) em um
navegador moderno.

```powershell
git clone https://github.com/vitoriapac/PlannerBB.git
cd PlannerBB
start index.html
```

Os dados ficam no `localStorage` do navegador. Use a opção **Baixar backup
completo** antes de limpar os dados ou trocar de navegador.

## Estrutura do projeto

```text
index.html            Interface e comportamento da aplicação
styles.css            Design tokens, layout, componentes e temas
edital-data.js         Disciplinas, tópicos e subtópicos do edital
planner-core.js        Métricas, dívida, viabilidade e replanejamento
planner-storage.js     Persistência e migração do estado
planner-export.js      Backup e intercâmbio JSON versionado
stress-fixtures.js     Cenários determinísticos de carga e estresse
tests/                 Testes automatizados
docs/                  Contrato de exportação, visão geral e capturas
```

## Testes

Requer Node.js instalado:

```powershell
npm test
```

A suíte cobre aderência, dívida, replanejamento, limites de capacidade,
persistência, exportação, fluxo de aceitação e cenários de estresse.

## Integração com StudyTrack

A exportação usa o schema `bb-study-planner-interchange`, atualmente na versão
5. Ela inclui sessões, assignments, progresso, resumo do planejamento, estados de
revisão e histórico de replanejamentos.

Consulte [docs/export-schema.md](docs/export-schema.md) para o contrato completo.
A importação direta depende de validação ou mapeamento pelo StudyTrack; o projeto
não presume compatibilidade nativa sem um contrato oficial do produto.

## Capturas

### Tema claro

![PlannerBB em tema claro](docs/screenshots/planner-light.png)

### Tema escuro

![PlannerBB em tema escuro](docs/screenshots/planner-dark.png)

## Privacidade

O PlannerBB funciona localmente e não envia automaticamente os registros de
estudo para servidores externos. Arquivos exportados só saem do navegador por
ação do usuário.
