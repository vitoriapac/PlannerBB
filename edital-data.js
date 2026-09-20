(function(root){
  "use strict";
/* =========================================================================
   DATA — Disciplina -> Tópico -> Subtópico, extraída do edital fornecido.
   IDs são fixos (não usar o nome como identificador); "weight" é um peso
   ESTRATÉGICO manual (0–100, uso interno do planejador para priorizar a
   distribuição do cronograma) — não representa quantidade de questões nem
   o peso oficial da banca na prova.
   ========================================================================= */
  const subjectGroups = [
  {id:"basicos", name:"Conhecimentos Básicos", subjectIds:["port","ing","mat","atu"]},
  {id:"especificos", name:"Conhecimentos Específicos", subjectIds:["matfin","banc","info","vendas"]},
  {id:"redacao_grupo", name:"Redação", subjectIds:["redacao"]}
];

  const subjects = [
  {id:"port", name:"Língua Portuguesa", weight:10, topics:[
    {id:"port-1", name:"Compreensão de textos", estimatedMinutes:75, subtopics:[]},
    {id:"port-2", name:"Ortografia oficial", subtopics:[]},
    {id:"port-3", name:"Classe e emprego de palavras", subtopics:[]},
    {id:"port-4", name:"Emprego do acento indicativo de crase", subtopics:[]},
    {id:"port-5", name:"Sintaxe da oração e do período", subtopics:[]},
    {id:"port-6", name:"Emprego dos sinais de pontuação", subtopics:[]},
    {id:"port-7", name:"Concordância verbal e nominal", subtopics:[]},
    {id:"port-8", name:"Regência verbal e nominal", subtopics:[]},
    {id:"port-9", name:"Colocação dos pronomes oblíquos átonos (próclise, mesóclise e ênclise)", subtopics:[]}
  ]},
  {id:"ing", name:"Língua Inglesa", weight:5, topics:[
    {id:"ing-1", name:"Vocabulário fundamental e aspectos gramaticais básicos para compreensão de textos", subtopics:[]}
  ]},
  {id:"mat", name:"Matemática", weight:5, topics:[
    {id:"mat-1", name:"Números inteiros, racionais e reais", subtopics:[]},
    {id:"mat-2", name:"Sistema legal de medidas", subtopics:[]},
    {id:"mat-3", name:"Razões e proporções", subtopics:[]},
    {id:"mat-4", name:"Lógica proposicional", subtopics:[]},
    {id:"mat-5", name:"Noções de conjuntos", subtopics:[]},
    {id:"mat-6", name:"Relações e funções", subtopics:[]}
  ]},
  {id:"atu", name:"Atualidades do Mercado Financeiro", weight:20, topics:[
    {id:"atu-1", name:"Os bancos na Era Digital", estimatedMinutes:110, subtopics:[
      {id:"atu-1-1", name:"Atualidade, tendências e desafios"},
      {id:"atu-1-2", name:"Internet Banking"},
      {id:"atu-1-3", name:"Mobile Banking"},
      {id:"atu-1-4", name:"Open Finance"},
      {id:"atu-1-5", name:"Novos modelos de negócios (fintechs, startups, big techs e shadow banking)"}
    ]},
    {id:"atu-2", name:"Funções da moeda", subtopics:[
      {id:"atu-2-1", name:"O dinheiro na era digital (Blockchain, Bitcoin e criptomoedas)"}
    ]},
    {id:"atu-3", name:"Marketplace", subtopics:[]},
    {id:"atu-4", name:"Correspondentes bancários", subtopics:[]},
    {id:"atu-5", name:"Arranjos de pagamentos", subtopics:[
      {id:"atu-5-1", name:"Sistema de pagamentos instantâneos (PIX)"}
    ]},
    {id:"atu-6", name:"Segmentação e interações digitais", subtopics:[]},
    {id:"atu-7", name:"Transformação digital no Sistema Financeiro", subtopics:[]}
  ]},
  {id:"matfin", name:"Matemática Financeira", weight:5, topics:[
    {id:"matfin-1", name:"Conceitos gerais", subtopics:[
      {id:"matfin-1-1", name:"Valor do dinheiro no tempo"},
      {id:"matfin-1-2", name:"Capitalização"},
      {id:"matfin-1-3", name:"Equivalência financeira"}
    ]},
    {id:"matfin-2", name:"Juros simples", subtopics:[]},
    {id:"matfin-3", name:"Juros compostos", estimatedMinutes:60, subtopics:[]},
    {id:"matfin-4", name:"Sistemas de amortização", subtopics:[
      {id:"matfin-4-1", name:"Sistema Price"},
      {id:"matfin-4-2", name:"Sistema de Amortização Constante (SAC)"}
    ]}
  ]},
  {id:"banc", name:"Conhecimentos Bancários", weight:25, topics:[
    {id:"banc-1", name:"Sistema Financeiro Nacional", estimatedMinutes:120, subtopics:[
      {id:"banc-1-1", name:"Estrutura do Sistema Financeiro Nacional"},
      {id:"banc-1-2", name:"Órgãos normativos e instituições supervisoras, executoras e operadoras"}
    ]},
    {id:"banc-2", name:"Mercado financeiro e seus desdobramentos", subtopics:[
      {id:"banc-2-1", name:"Mercados monetário, de crédito, de capitais e cambial"}
    ]},
    {id:"banc-3", name:"Moeda e política monetária", subtopics:[
      {id:"banc-3-1", name:"Políticas monetárias convencionais e não convencionais (Quantitative easing)"},
      {id:"banc-3-2", name:"Taxa SELIC e operações compromissadas"},
      {id:"banc-3-3", name:"Depósitos remunerados dos bancos comerciais no Banco Central do Brasil"}
    ]},
    {id:"banc-4", name:"Orçamento público", subtopics:[
      {id:"banc-4-1", name:"Títulos do Tesouro Nacional e dívida pública"}
    ]},
    {id:"banc-5", name:"Produtos Bancários", subtopics:[
      {id:"banc-5-1", name:"Cartões de crédito e débito"},
      {id:"banc-5-2", name:"Crédito direto ao consumidor"},
      {id:"banc-5-3", name:"Crédito rural"},
      {id:"banc-5-4", name:"Poupança"},
      {id:"banc-5-5", name:"Capitalização"},
      {id:"banc-5-6", name:"Previdência"},
      {id:"banc-5-7", name:"Consórcio"},
      {id:"banc-5-8", name:"Investimentos"}
    ]},
    {id:"banc-6", name:"Noções de mercado de capitais", subtopics:[]},
    {id:"banc-7", name:"Noções de mercado de câmbio", subtopics:[
      {id:"banc-7-1", name:"Instituições autorizadas a operar"},
      {id:"banc-7-2", name:"Operações básicas"},
      {id:"banc-7-3", name:"Regimes de taxas de câmbio (fixas, flutuantes e intermediárias)"},
      {id:"banc-7-4", name:"Taxas de câmbio nominais e reais"},
      {id:"banc-7-5", name:"Impactos das taxas de câmbio sobre exportações e importações"},
      {id:"banc-7-6", name:"Diferencial de juros interno e externo"},
      {id:"banc-7-7", name:"Dinâmica do mercado interbancário"}
    ]},
    {id:"banc-8", name:"Mercado bancário", subtopics:[
      {id:"banc-8-1", name:"Operações de tesouraria"},
      {id:"banc-8-2", name:"Varejo bancário"},
      {id:"banc-8-3", name:"Recuperação de crédito"},
      {id:"banc-8-4", name:"Taxas de juros (curto prazo, curva de juros, nominais e reais)"}
    ]},
    {id:"banc-9", name:"Garantias do Sistema Financeiro Nacional", subtopics:[]},
    {id:"banc-10", name:"Crime de lavagem de dinheiro (Lei nº 9.613/98 e atualizações)", subtopics:[]},
    {id:"banc-11", name:"Autorregulação bancária e Normativos SARB", subtopics:[]},
    {id:"banc-12", name:"Sigilo bancário (Lei Complementar nº 105/2001)", subtopics:[]},
    {id:"banc-13", name:"Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018)", subtopics:[]},
    {id:"banc-14", name:"Legislação anticorrupção (Lei nº 12.846/2013)", subtopics:[]},
    {id:"banc-15", name:"Segurança cibernética (Resolução CMN nº 4.893/2021)", subtopics:[]},
    {id:"banc-16", name:"Ética aplicada", subtopics:[
      {id:"banc-16-1", name:"Ética, moral, valores e virtudes"},
      {id:"banc-16-2", name:"Ética empresarial e profissional"},
      {id:"banc-16-3", name:"Gestão da ética nas empresas públicas e privadas"},
      {id:"banc-16-4", name:"Código de Ética do Banco do Brasil"}
    ]},
    {id:"banc-17", name:"Política de Responsabilidade Socioambiental do Banco do Brasil", subtopics:[
      {id:"banc-17-1", name:"ASG (Ambiental, Social e Governança)"},
      {id:"banc-17-2", name:"Economia sustentável"}
    ]},
    {id:"banc-18", name:"Financiamentos", subtopics:[]},
    {id:"banc-19", name:"Mercado PJ", subtopics:[]},
    {id:"banc-20", name:"Abertura e movimentação de contas", subtopics:[]}
  ]},
  {id:"info", name:"Conhecimentos de Informática", weight:5, topics:[
    {id:"info-1", name:"Noções de sistemas operacionais", subtopics:[
      {id:"info-1-1", name:"Windows 10 (32-64 bits)"},
      {id:"info-1-2", name:"Ambiente Linux (SUSE SLES 15 SP2)"}
    ]},
    {id:"info-2", name:"Edição de textos, planilhas e apresentações", subtopics:[
      {id:"info-2-1", name:"Ambientes Microsoft Office: Word, Excel e PowerPoint (O365)"}
    ]},
    {id:"info-3", name:"Segurança da informação", estimatedMinutes:100, subtopics:[
      {id:"info-3-1", name:"Fundamentos, conceitos e mecanismos de segurança"},
      {id:"info-3-2", name:"Proteção de estações de trabalho"},
      {id:"info-3-3", name:"Controle de dispositivos USB"},
      {id:"info-3-4", name:"Hardening"},
      {id:"info-3-5", name:"Antimalware"},
      {id:"info-3-6", name:"Firewall pessoal"}
    ]},
    {id:"info-4", name:"Conceitos de organização e gerenciamento de informações", subtopics:[
      {id:"info-4-1", name:"Arquivos, pastas e programas"}
    ]},
    {id:"info-5", name:"Redes de computadores", subtopics:[
      {id:"info-5-1", name:"Conceitos básicos"}
    ]},
    {id:"info-6", name:"Ferramentas, aplicativos e procedimentos de internet e intranet", subtopics:[
      {id:"info-6-1", name:"Navegadores Web (Microsoft Edge 91 e Mozilla Firefox 78 ESR)"},
      {id:"info-6-2", name:"Busca e pesquisa na web"},
      {id:"info-6-3", name:"Correio eletrônico, grupos de discussão, fóruns e wikis"},
      {id:"info-6-4", name:"Redes sociais (Twitter, Facebook, LinkedIn, WhatsApp, YouTube, Instagram e Telegram)"}
    ]},
    {id:"info-7", name:"Sistemas de suporte à decisão e inteligência de negócio", subtopics:[
      {id:"info-7-1", name:"Fundamentos sobre análise de dados"}
    ]},
    {id:"info-8", name:"Conceitos de educação a distância", subtopics:[]},
    {id:"info-9", name:"Conceitos de tecnologias e ferramentas multimídia", subtopics:[
      {id:"info-9-1", name:"Reprodução de áudio e vídeo"}
    ]},
    {id:"info-10", name:"Ferramentas de produtividade e trabalho a distância", subtopics:[
      {id:"info-10-1", name:"Microsoft Teams"},
      {id:"info-10-2", name:"Cisco Webex"},
      {id:"info-10-3", name:"Google Hangout"},
      {id:"info-10-4", name:"Google Drive"},
      {id:"info-10-5", name:"Skype"}
    ]}
  ]},
  {id:"vendas", name:"Vendas e Negociação", weight:20, topics:[
    {id:"vendas-1", name:"Noções de estratégia empresarial", subtopics:[]},
    {id:"vendas-2", name:"Análise de mercado", subtopics:[
      {id:"vendas-2-1", name:"Forças competitivas"}
    ]},
    {id:"vendas-3", name:"Imagem institucional", subtopics:[
      {id:"vendas-3-1", name:"Identidade e posicionamento"}
    ]},
    {id:"vendas-4", name:"Segmentação de mercado", subtopics:[]},
    {id:"vendas-5", name:"Ações para aumentar o valor percebido pelo cliente", subtopics:[]},
    {id:"vendas-6", name:"Gestão da experiência do cliente", subtopics:[]},
    {id:"vendas-7", name:"Aprendizagem e sustentabilidade organizacional", subtopics:[]},
    {id:"vendas-8", name:"Características dos serviços", subtopics:[
      {id:"vendas-8-1", name:"Intangibilidade, inseparabilidade, variabilidade e perecibilidade"}
    ]},
    {id:"vendas-9", name:"Gestão da qualidade em serviços", subtopics:[]},
    {id:"vendas-10", name:"Técnicas de vendas (da pré-abordagem ao pós-vendas)", subtopics:[]},
    {id:"vendas-11", name:"Noções de marketing digital", estimatedMinutes:60, subtopics:[
      {id:"vendas-11-1", name:"Geração de leads"},
      {id:"vendas-11-2", name:"Técnica de copywriting"},
      {id:"vendas-11-3", name:"Gatilhos mentais"},
      {id:"vendas-11-4", name:"Inbound marketing"}
    ]},
    {id:"vendas-12", name:"Ética e conduta profissional em vendas", subtopics:[]},
    {id:"vendas-13", name:"Padrões de qualidade no atendimento aos clientes", subtopics:[]},
    {id:"vendas-14", name:"Utilização de canais remotos para vendas", subtopics:[]},
    {id:"vendas-15", name:"Comportamento do consumidor e sua relação com vendas e negociação", subtopics:[]},
    {id:"vendas-16", name:"Política de Relacionamento com o Cliente (Resolução CMN 4.949/21)", subtopics:[]},
    {id:"vendas-17", name:"Ouvidoria nas instituições financeiras (Resolução CMN nº 4.860/2020)", subtopics:[]},
    {id:"vendas-18", name:"Diversidade e Inclusão (Lei nº 13.146/2015)", subtopics:[]},
    {id:"vendas-19", name:"Código de Proteção e Defesa do Consumidor (Lei nº 8.078/1990)", subtopics:[]}
  ]},
  {id:"redacao", name:"Redação", weight:5, topics:[]}
  // Conteúdo programático de Redação não constava no edital fornecido — adicione tópicos aqui se necessário.
];
  root.BB_EDITAL=Object.freeze({
    subjectGroups:Object.freeze(subjectGroups),
    subjects:Object.freeze(subjects)
  });
})(typeof globalThis!=="undefined"?globalThis:this);
