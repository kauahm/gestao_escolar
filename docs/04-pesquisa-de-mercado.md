# Pesquisa de mercado — sistemas parecidos com o Gestão Escolar

> Pesquisa feita em 13/10/2026. Objetivo: entender o que já existe, o que as pessoas elogiam e reclamam, e **onde o Gestão Escolar 2.0 pode ser muito melhor**, sem copiar ninguém.
> Voltar ao índice: [README](README.md) · Relacionados: [05 Design](05-referencias-de-design.md) · [06 Funcionalidades](06-funcionalidades-e-roadmap.md) · [07 Legal e técnico](07-requisitos-legais-e-tecnicos.md)

**Como ler:** nenhum produto que encontrei junta, num só lugar, o que o nosso sistema junta (manutenção + contas das unidades + ciclos preventivos + recrutamento + agenda) **para uma rede de creches/escolas operada por uma OSC**. Cada concorrente cobre uma fatia. Isso é a nossa oportunidade, mas é uma conclusão da *minha busca*, não uma garantia: vale confirmar com a sede o que eles já usam.

**Confiabilidade das fontes:** preços e notas vêm de comparativos de terceiros (SoftwareConnect, Capterra, GetApp) e de páginas dos próprios fabricantes (marketing). Tratei como **ordem de grandeza**, não como cotação.

---

## 1. Mapa do mercado em 6 categorias

| # | Categoria | Exemplos | Parte do nosso sistema que compete |
|---|---|---|---|
| A | Manutenção de escolas / facilities (CMMS) | SchoolDude/Brightly, FMX, MaintainX, UpKeep, Click Maint, OperationsHERO, Fracttal | Manutenções, Ciclos, Prestadores |
| B | Gestão de creches / educação infantil | Brightwheel, Procare, Famly | (não temos hoje: diário, presença, famílias) |
| C | Gestão escolar brasileira (ERP escolar) | Sponte, Proesc, Totvs Educacional, Árvore | (não temos: matrícula, financeiro de mensalidades, notas) |
| D | Gestão pública de vagas em creche | Sistema Central de Vagas (Goiás), Gestão Presente (MEC) | (não temos: fila de espera) |
| E | Prestação de contas de parcerias com OSC | Sistema de São Bernardo do Campo; planilhas e manuais MROSC | Contas a Pagar (parte da prestação) |
| F | Recrutamento (ATS) | Gupy, Kenoby, Recrutei, Teamtailor, Greenhouse | Banco de Talentos + Processo Seletivo |

Além disso há **gestão de energia/água multiunidade** (Brightly Energy Manager e similares), que conversa com nossas Contas a Pagar.

---

## 2. A — Manutenção de escolas (o concorrente mais direto)

### O que os líderes oferecem
Dados do comparativo SoftwareConnect (2026) e do Principal Center:

| Produto | Destaques | Preço aproximado* |
|---|---|---|
| **SchoolDude / Brightly** | "Plataforma de ordens de serviço mais implantada em escolas K-12" (Principal Center); portais para professores e funcionários abrirem e acompanharem pedidos; preventiva; reserva de espaços | sob consulta (preço por distrito) |
| **FMX** | Formulários de solicitação personalizáveis, calendário compartilhado por escola, atribuição automática por departamento | a partir de ~US$ 3.000/ano |
| **MaintainX** | App móvel, **solicitantes ilimitados**, chat dentro do app, anexos de foto | grátis; US$ 20 e US$ 65/usuário/mês |
| **UpKeep** | Portal de solicitação com a marca da escola, **solicitantes sem licença**, fotos, aprovações por assinatura, resumos com IA | a partir de US$ 20/usuário/mês |
| **Click Maint** | Localização até o nível de **sala**, **QR code por espaço**, preventiva, portal de solicitações | a partir de US$ 35/usuário/mês |
| **OperationsHERO** | Cria ativos pela **foto da placa de identificação (IA)**, QR/código de barras, localização obrigatória | não divulgado |
| **eMaint** | Hierarquia de ativos, **modo offline com sincronização**, KPIs customizáveis | US$ 69–85/usuário/mês |
| **MicroMain** | Mais de 500 relatórios padrão, análise de custo total | US$ 99 (admin) / US$ 45 (técnico) por usuário/mês |
| **Brightly (energia)** | Módulo de **energia/água**: gera ordem de serviço automática em picos de consumo | sob consulta |
| **Fracttal One** (plataforma latino-americana, a confirmar) | Ativos, preventiva, OS, dashboards, app móvel leve; nota 4,6 em 1.785 avaliações (Capterra) | não divulgado |

\* Valores em dólar, de comparativos de terceiros; **a confirmar** com os fabricantes.

### O que os usuários elogiam (padrão que se repete)
- **Quem pede não paga licença** (MaintainX, UpKeep): o modelo certo para escolas, onde dezenas de diretoras só abrem chamados.
- **App móvel com foto** e conclusão do serviço no celular.
- **Portal simples para solicitantes**, sem treinamento.
- **Preventiva que gera ordem de serviço sozinha** e histórico por ativo/local.
- **Dashboards de custo e backlog** que o financeiro consegue usar. Caso real (Greenhill School, EUA): o sistema revelou **~12.000 ordens por ano**, bem mais que o imaginado, e os dados passaram a alimentar o **orçamento com o CFO**.

### O que reclamam (nossas brechas)
| Reclamação (fonte) | Oportunidade |
|---|---|
| Inspeção reprovada **não gera ordem de serviço automaticamente** (FMX) | Ciclo vencido → ordem de serviço automática |
| Configuração inicial longa, "exige administrador qualificado" (WebTMA, Fiix, Fracttal) | Sistema que já nasce configurado para creche, em minutos |
| Curva de aprendizado e interface pesada (Fracttal, Brightwheel) | Interface que a diretora entende sem treinamento |
| **100% online**, ruim com sinal fraco (Fracttal); **modo offline é diferencial** (eMaint) | PWA com rascunho offline |
| Falta de **calendário visual** e **impressão em lote** (Fracttal) | Já temos Agenda e impressão de O.S.; evoluir |
| **Pouca visibilidade do trabalho de terceiros** (Fiix) | Link para o prestador atualizar status sem criar conta |
| App móvel instável, dificuldade com leituras de medidores (Brightly) | Priorizar o celular desde o início |
| Preço por usuário cresce com a equipe (UpKeep, WebTMA) | Preço por contrato/unidade, **solicitantes ilimitados** |
| Ferramentas pensadas para **EUA/UE**, em inglês, sem realidade brasileira (CPFL, SABESP, WhatsApp) | Produto nativo do Brasil |

### Lição de produto
Em todos, a **diretora (solicitante)** é uma usuária secundária. No nosso caso é a que garante que o sistema seja usado nas escolas. **Se ela não usa, a sede não vê os dados.**

---

## 3. B — Gestão de creches (referência de experiência, não concorrente direto)

Brightwheel, Procare e Famly resolvem o **dia a dia da criança e da família**, algo que o Gestão Escolar hoje não faz.

- **Brightwheel** (nota 4,7 / 3.257 avaliações): relatórios diários (refeição, soneca, atividades) com foto, presença com check-in/out, portal dos pais, matrícula e lista de espera, faturamento, permissões por função. **Críticas:** interface confusa no início, bugs de check-in/out, *alertas repetidos para famílias com vários filhos*, **problemas com várias unidades**, preços e taxas.
- **Procare** (4,6 / 2.809): mais funcionalidades, mais antigo; críticas de instabilidade e interface pouco intuitiva.
- **Famly** (4,7 no Capterra, segundo o site): diário, ocupação e presença, **escala da equipe com cálculo automático da razão adulto/criança**, finanças, app dos pais com **tradução ao vivo**, e "migração em horas". Foco no Reino Unido/Irlanda (regras locais).

**O que aprender (sem copiar):**
1. A família (ou, no nosso caso, a diretora e a coordenação) precisa de **uma tela inicial que mostre "o que importa hoje"**.
2. **Multiunidade** é onde esses produtos tropeçam; é onde o nosso produto precisa brilhar.
3. **Escala de equipe e razão adulto/criança** são necessidades reais de uma operadora de creches. Para a AEMC (centenas de profissionais por município), é um módulo futuro de alto valor.
4. Se o 2.0 chegar a lidar com dados das crianças, entra o regime de proteção de dados do [documento 07](07-requisitos-legais-e-tecnicos.md).

---

## 4. C — Gestão escolar brasileira (ERPs)

- **Sponte** (desde 1998; segundo o site: 5.200+ escolas, 2 milhões de alunos/ano, versão para ensino público "Sponte GOV"): módulos pedagógico, financeiro, secretaria, app de agenda escolar, portal do aluno, análise de dados com IA, captação de alunos. **Preço não público** (só com demonstração).
- **Árvore**: plataforma de leitura e escrita, foco pedagógico, não de gestão administrativa.
- **Proesc, Totvs Educacional e outros**: ERPs escolares generalistas; encontrei reclamações públicas de usuários em canais de consumidor, mas não validei (não usar como argumento de venda).

**Leitura:** esses sistemas são **ERPs para escola que cobra mensalidade** (matrícula, notas, boletos). A rede da AEMC é **pública conveniada** (financiada por termo de colaboração): o centro do problema é **contrato, prestação de contas, equipe e infraestrutura**, não mensalidade. **Não competimos de frente**, e isso é bom: podemos nos integrar, se um dia necessário.

---

## 5. D — Gestão pública de vagas em creche

Há iniciativas públicas de **fila única e transparente**: o **Sistema Central de Vagas de Creches de Goiás** (piloto em Valparaíso de Goiás, 11/11/2025; meta: todos os municípios goianos) permite cadastro da criança de 0 a 3 anos, escolha da unidade, **posição na fila em tempo real** e organização por critério de prioridade em lei. O MEC também tem o **Gestão Presente** com cartilha para famílias pedirem vaga.

**Leitura:** em Hortolândia a AEMC afirma ter "eliminado a fila de espera". Se a sede quiser **provar isso com dados** (ocupação por unidade, vagas abertas), há espaço para um módulo de **ocupação**. É extensão futura, não prioridade.

---

## 6. E — Prestação de contas com OSC (onde o dinheiro está)

- A relação AEMC–prefeitura é regida pelo **MROSC (Lei 13.019/2014)**. O manual de prestação de contas da FAPDF (DF, 2025) é um bom retrato do que se exige: **relatório de execução do objeto** (metas, listas de presença, fotos, pesquisa de satisfação) e **relatório de execução financeira** (receitas/despesas, extrato, notas e comprovantes, **conciliação bancária**), com **guarda dos documentos por 10 anos** (art. 19 do manual).
- Algumas prefeituras estão digitalizando: **São Bernardo do Campo lançou em 09/04/2025** um sistema onde a OSC envia documentos e relatórios sem papel e a prefeitura acompanha em tempo real. Significa que **o lado da prefeitura já está se digitalizando**, e a OSC que entregar dados organizados sai na frente.
- Hoje a AEMC publica no portal de transparência PDFs mensais de prestação de contas por município (ex.: Indaiatuba, jun/2025, com despesas em categorias: serviços de terceiros, recursos humanos, locações, materiais, utilidades públicas, manutenção…).

**Oportunidade (a maior):** as contas, manutenções e serviços que o Gestão Escolar já registra **são exatamente os comprovantes que alimentam essa prestação de contas**. Se cada despesa for registrada com categoria, comprovante anexo e município/contrato, o relatório mensal sai quase pronto. Não encontrei produto comercial que faça isso para o dia a dia de uma operadora de creches (a confirmar).

---

## 7. F — Recrutamento (ATS)

- **Gupy** (líder no Brasil): etapas de processo configuráveis, página de carreiras, testes, integração com *job boards*, comunicação com candidatos na plataforma, dashboards, **triagem de currículos com IA** e **admissão digital** (recebimento e validação de documentos) no mesmo fluxo. Informações do próprio fabricante.
- **Kenoby, Recrutei, Teamtailor, Greenhouse**: mesma ideia, com variações de porte e preço.

**Leitura:** nosso módulo hoje é um *banco de currículos + entrevista + decisão com feedback*. Um ATS completo é overkill, mas há ganhos baratos: **funil visual (kanban)**, **vagas**, **checklist de documentos de admissão**, **mensagens prontas de WhatsApp** e **marcador PCD** (a AEMC mantém Banco de Talentos para PCD). Detalhes no [documento 06](06-funcionalidades-e-roadmap.md).

---

## 8. Resumo: onde estamos e onde podemos ganhar

| Área | Mercado faz bem | Mercado faz mal | Nossa vantagem possível |
|---|---|---|---|
| Manutenção | Preventiva, app móvel, histórico | Cobra por usuário; complexo; em inglês | Solicitante grátis, simples, em português, WhatsApp |
| Contas | Poucos produtos para boletos/NF de várias unidades | — | CPFL/SABESP/NF por unidade, alertas, anomalia de consumo |
| Ciclos | Preventiva por ativo | Não gera OS ao vencer (FMX) | Ciclo vencido → OS automática |
| RH | ATS completos (Gupy) | Caros e grandes para o caso | Funil leve integrado ao resto |
| Prestação de contas | Manuais e sistemas de prefeitura | OSC monta tudo à mão | Relatório mensal gerado dos dados do dia a dia |
| Multiunidade / multimunicípio | — | Quase todos tropeçam | Município → contrato → unidade desde a base |
| Visão da sede | Dashboards genéricos | Genéricos demais | Painel feito para a coordenação regional |

---

## 9. Limites desta pesquisa
- Não testei os produtos; li páginas de fabricantes, comparativos e avaliações públicas.
- Preços em dólar vêm de uma única comparação (SoftwareConnect); tratar como indicação.
- Não encontrei dados de mercado de CMMS **brasileiros** (Tractian, Manusis, Engeman) com profundidade suficiente para citar.
- Sem acesso a quais sistemas a sede da AEMC usa hoje: **pergunta-chave** para a conversa com São Paulo.

---

## 10. Fontes
- [Principal Center — Best School Work Order Software (2026)](https://www.principalcenter.com/best-school-work-order-software)
- [SoftwareConnect — Best School Facilities Management Software](https://softwareconnect.com/roundups/best-school-facilities-management-software)
- [Caso Greenhill School / SchoolDude](https://www.casestudies.com/company/siemens-asset-management-software/case-study/independent-school-saves-time-improves-accountability-with-brightlys-maintenance-management-software)
- [Avaliações do Fracttal One — Capterra](https://www.capterra.com/p/159911/Fracttal/reviews/?page=2)
- [Brightwheel — funcionalidades (GetApp)](https://www.getapp.com/education-childcare-software/a/brightwheel/features/) · [Procare vs Brightwheel — Capterra](https://capterra.com/compare/23486-144060/Procare-Child-Care-Management-vs-brightwheel) · [Famly](https://www.famly.co)
- [Sponte](https://www.sponte.com.br) · [Árvore](https://www.arvore.com.br)
- [Sistema Central de Vagas de Creches — Goiás](https://www.rotajuridica.com.br/?p=167803)
- [Manual de prestação de contas MROSC — FAPDF 2025](https://fap.df.gov.br/documents/d/fap/manual-de-prestacao-de-contas-mrosc-fapdf-2025-2) · [Sistema digital de prestação de contas — São Bernardo do Campo](https://abcdjornal.com.br/novo-sistema-digital-de-prestacao-de-contas-em-sao-bernardo-facilita-parcerias-com-entidades-do-3o-setor)
- [Gupy — módulos de R&S](https://www.gupy.io/blog/comparativo-gupy-modulos-de-rs)
- AEMC: ver [02](02-associacao-aemc.md)
