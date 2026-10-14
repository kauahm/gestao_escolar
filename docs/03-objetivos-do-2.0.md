# Objetivos e contexto do Gestão Escolar 2.0

> Informações passadas pelo dono do projeto em 13/10/2026. Atualizar este arquivo sempre que o rumo mudar.
> Voltar ao índice: [README](README.md)

## Contexto

- O sistema nasceu de uma necessidade real: a mãe do desenvolvedor é **prestadora de serviços no escritório de Hortolândia** da AEMC ([02](02-associacao-aemc.md)). Com a quantidade de demandas dela, o escritório tinha muita bagunça e o sistema foi criado para organizar (manutenções, contas, ciclos, contratações, agenda).
- Hoje ele é usado/pensado a partir de Hortolândia.
- **Quem pode comprar:** o pessoal da **sede, em São Paulo**.

## Como a AEMC trabalha hoje (informado em 13/10/2026)

- No escritório de Hortolândia e na secretaria, **tudo é feito em Word, Excel, Google Drive e Formulários Google**.
- O desenvolvedor **nunca vendeu software para eles**; esta será a primeira venda.
- **Quando o sistema estiver pronto**, será preciso pesquisar o melhor caminho para chegar à sede (quem procurar, como apresentar, como propor). Isso fica como etapa futura.

**O que isso significa:** o concorrente real **não é outro software, é a planilha e o formulário**. A demonstração precisa mostrar, lado a lado, o que a planilha não faz (alertas, histórico, fotos, relatório pronto) e, ao mesmo tempo, **ser tão fácil quanto um formulário**. Importar o que já existe (planilhas de escolas, contas, currículos) pode ser decisivo para a adoção.

## Por que o 1.0 nunca foi usado de verdade (informado em 13/10/2026)

- O sistema **nunca foi aberto para uso real**: o desenvolvedor ainda não terminou e **não conseguiu deixá-lo funcionando perfeitamente**.
- A mãe tem **medo de que o sistema caia e ela perca tudo**. Por isso não adotou.
- **Todos os lançamentos que existem hoje são de teste** e podem ser descartados, assim como as contas de usuário extras.

**O que isso significa:** a barreira de adoção não é só visual, é **confiança**. O 2.0 precisa **provar que não perde dados** (backup automático, lixeira com restauração, histórico, exportação para Excel a qualquer momento) e **funcionar de forma estável** antes de ser bonito. Ver a Fase 0 do [roadmap](06-funcionalidades-e-roadmap.md).

## Ordem de trabalho combinada

**Design visual por último.** Primeiro base segura e estável, depois funcionalidades, e só então o acabamento visual. (O desenho dos fluxos e telas em rascunho pode acontecer antes, porque orienta as funcionalidades; o acabamento visual vem no fim.)

## Objetivo do 2.0

1. **Deixar o projeto o mais bonito e profissional possível**, para ser apresentado e **vendido para a sede em São Paulo**.
2. Depois da venda, **ativar o sistema nas escolas** (diretoras passam a usar no dia a dia).

## O que isso significa na prática (a validar)

- **Primeira impressão pesa:** o 2.0 precisa ser convincente em demonstração (visual, clareza, velocidade, funcionar bem no celular).
- **Quem decide não é quem usa:** a sede quer ver visão geral, controle, números e relatórios; as diretoras querem simplicidade.
- **Segurança e dados** precisam estar corretos antes de uma demonstração real (ver pontos de atenção em [01](01-entendimento-do-projeto.md)).
- **Dados de demonstração:** ter um ambiente de demo com dados fictícios, para mostrar à sede sem expor dados reais.

## Etapas futuras já combinadas

1. Auditoria visual do sistema atual (documento 08).
2. Pesquisa de **como abordar a sede** (somente quando o sistema estiver pronto).

## Decisões em aberto

- Vender como **produto único para a AEMC** (todos os municípios) ou só para o escritório de Hortolândia primeiro?
- Modelo comercial (licença, mensalidade, prestação de serviço)?
- Prazo desejado para a apresentação em São Paulo?
