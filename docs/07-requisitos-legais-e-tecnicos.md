# Requisitos legais e técnicos para o 2.0

> Pesquisa feita em 13/10/2026. **Isto não é parecer jurídico.** Reúne o que as fontes dizem e o que isso implica para o sistema; antes de vender, vale uma revisão com advogado(a) de proteção de dados e de terceiro setor.
> Voltar ao índice: [README](README.md) · Relacionados: [04 Mercado](04-pesquisa-de-mercado.md) · [06 Funcionalidades](06-funcionalidades-e-roadmap.md)
>
> Itens marcados **[proposta]** são minhas recomendações; **[a confirmar]** precisam de validação.

---

## 1. Proteção de dados (LGPD) e crianças (ECA Digital)

### 1.1 Que dados o sistema guarda hoje
| Dado | Titular | Observação |
|---|---|---|
| Escolas, endereços, telefones | Instituição | Baixo risco |
| Nome, celular, e-mail das **diretoras** | Pessoa física (funcionária) | Dado pessoal comum |
| **Currículos**: nome, telefone, e-mail, vaga, indicação, observações, feedback | Candidatos (adultos) | Dado pessoal; as **observações e feedback** podem conter juízos sobre pessoas |
| Usuários do sistema | Funcionárias | Dado pessoal |
| Prestadores: nome, documento, **PIX** | Pessoa física/jurídica | Dado financeiro; cuidado com exposição |

**Hoje o sistema não guarda dados de crianças.** Isso muda o tamanho do risco: se o 2.0 incluir diário, presença, fila de vagas ou dados de famílias, entram regras muito mais rígidas (itens 1.3 e 1.4).

### 1.2 LGPD: pontos práticos
- **Papéis [a confirmar]:** a AEMC provavelmente seria a **controladora** dos dados; nós, fornecedores do sistema, **operadores**. Isso pede cláusulas contratuais de proteção de dados e lista de subprocessadores (Google/Firebase, Vercel, serviço de WhatsApp).
- **Bases legais** (segundo guia da Confidata): execução de contrato, obrigação legal, políticas públicas, proteção à saúde, exercício regular de direitos; **consentimento** para o que é acessório (uso de imagem, marketing, compartilhamento com terceiros).
- **Candidatos:** base típica é o **procedimento preliminar à contratação**; manter só o necessário e **definir prazo de guarda** (hoje não existe) e como o candidato pede exclusão.
- **Marcador PCD no Banco de Talentos [proposta de cautela]:** deficiência é **dado sensível** (de saúde). A AEMC mantém um Banco de Talentos para PCD, então o tema é real, mas exige base legal clara, acesso restrito e finalidade explícita. **Não adicionar sem alinhar com a AEMC.**
- **Direitos do titular:** canal para pedir acesso, correção, exclusão; registro das operações (Art. 37).
- **Segurança e incidentes:** controle de acesso, registro de acessos, backup, plano de resposta a incidentes. Um caso citado: a ANPD **sancionou a SEEDF** por usar ferramenta genérica para coletar dados de saúde de crianças sem relatório de impacto nem registro de operações (fonte: Confidata).

### 1.3 Crianças: LGPD, Art. 14
Para **menores de 12 anos**, o tratamento por consentimento exige **consentimento específico e em destaque de ao menos um dos pais**; o princípio do **melhor interesse** vale sempre. Para dados da rotina escolar, o guia sugere bases como execução de contrato ou política pública, **sem exigir consentimento para o que é essencial**; saúde/alergia/medicação para fins pedagógicos pede termo específico.

### 1.4 ECA Digital (Lei 15.211/2025)
- **Em vigor desde 17/03/2026** (confirmado em alertas de dois escritórios de advocacia, Lefosse e Demarest, e na Confidata). Fiscalização: **ANPD**.
- Alcance: produtos/serviços digitais **direcionados a crianças e adolescentes ou de "acesso provável"** por eles.
- Obrigações citadas: design com **proteção por padrão**, **verificação de idade** (autodeclaração vedada), **relatório de impacto**, **vinculação de contas de menores de 16 anos a um responsável**, supervisão parental, limitação do uso de dados à finalidade educacional.
- Sanções: advertência; multa de até **10% do faturamento** do grupo no Brasil (ou R$ 10 a R$ 1.000 por usuário, até R$ 50 milhões por infração); suspensão/proibição.
- **Aplicação ao Gestão Escolar [a confirmar com jurídico]:** o sistema atual é **interno** (administração, diretoras, RH), sem acesso de crianças; por isso o enquadramento é pouco provável. **Se o 2.0 ganhar portal/app de famílias ou alunos, o ECA Digital passa a ser requisito de projeto** (ex.: relatório de impacto, vínculo com responsável).

### 1.5 Checklist LGPD para o 2.0 **[proposta]**
1. Inventário dos dados (o que, por quê, onde, quem acessa, por quanto tempo).
2. Política de privacidade e termos de uso em linguagem simples.
3. Registro de consentimento **por finalidade** e de revogação (quando houver consentimento).
4. Retenção e **exclusão** automática de currículos antigos (ex.: após X meses) [prazo a definir com a AEMC].
5. **Log de auditoria** de acesso e alteração; acesso por menor privilégio.
6. Criptografia em trânsito (já é padrão do Firebase/Vercel) e backups.
7. Contrato com a AEMC com cláusulas de proteção de dados, lista de subprocessadores e resposta a incidentes.
8. Indicação do **encarregado (DPO)** pela AEMC.
9. Relatório de Impacto (RIPD) se tratar dados sensíveis ou de crianças.

---

## 2. Prestação de contas: o que a lei e as prefeituras cobram

A relação é regida pelo **MROSC (Lei 13.019/2014)**. As regras detalhadas variam por prefeitura (cada uma tem decreto/manual próprio), então **cada contrato precisa ser conferido**. Como retrato do que se exige, o manual da FAPDF (DF, 2025) diz:

| Exigência | Detalhe (FAPDF) | Impacto no sistema |
|---|---|---|
| Prazo | Prestação de contas até **90 dias** após o fim da vigência; em parcerias de mais de um ano, ao fim de cada exercício | Fechamento mensal/anual, travas de período |
| Relatório de execução do objeto | Metas × resultados, **listas de presença, fotos, vídeos**, pesquisa de satisfação | Anexos e métricas de metas |
| Relatório de execução financeira | Receitas e despesas, **assinado pelo representante legal e pelo contador** | Exportação + campo de assinatura |
| Comprovantes | Notas e comprovantes com **data, valor, dados da OSC e do fornecedor, descrição**; **memória de cálculo de rateio** | Campos obrigatórios por despesa; rateio |
| Conciliação bancária | Débitos da conta × relação de pagamentos | Importação/ conferência de extrato [futuro] |
| Pagamentos | **Eletrônicos**, com identificação do beneficiário final | Registro de forma de pagamento e beneficiário |
| Vedações | Ex.: taxa de administração, pagamento de servidores, juros/multas (salvo atraso da administração), despesas fora da vigência | Alerta quando despesa fora de categoria/vigência |
| **Guarda de documentos** | **10 anos** após a prestação de contas | Armazenamento durável, com backup e recuperação |

**Também relevante:** o **Tribunal de Contas do Estado de SP** orienta entidades do terceiro setor a publicar informações; a AEMC já mantém portal de transparência. **São Bernardo do Campo** lançou (abr/2025) sistema digital de prestação de contas para as OSCs. A tendência é de **prefeituras cobrarem dados estruturados**.

**Requisitos de sistema decorrentes [proposta]:** categorias de despesa alinhadas às da AEMC; comprovante obrigatório e imutável após fechamento; trilha de auditoria; vínculo despesa → contrato → unidade; exportação em PDF/Excel; retenção de 10 anos com backup.

---

## 3. Como se paga o sistema? (ponto delicado, vale conversar cedo)

Duas perguntas que podem mudar a venda:

1. **Com que dinheiro a AEMC pagaria?** Se for com recursos de um termo de colaboração, a despesa precisa estar **prevista no plano de trabalho** e ser permitida pelo contrato. Se for recurso próprio da AEMC, é decisão interna. **[a confirmar]** com a sede.
2. **Conflito de interesses:** sua mãe é prestadora de serviços do escritório de Hortolândia. Se o sistema for vendido à própria AEMC, vale checar o **manual de compras/regulamento interno** que a AEMC publica no portal de transparência, e como contratos com pessoas ligadas a prestadores são tratados. **Não é uma conclusão, é uma verificação preventiva** para evitar problema depois.

Também definir: **quem é o titular do software** (propriedade intelectual) e o modelo (licença, mensalidade, prestação de serviço).

---

## 4. WhatsApp automatizado: custo e regras

Hoje o sistema abre o WhatsApp com mensagem pronta (`wa.me`) e a pessoa clica em enviar: **grátis, mas manual**. Automatizar exige a **API oficial (WhatsApp Business Platform)**.

Segundo a documentação oficial da Meta:
- Desde **01/07/2025** a cobrança é **por mensagem** (não mais por conversa).
- Só **mensagens de template** são cobradas fora da janela de atendimento; **mensagens não-template e templates "utility" dentro da janela de 24h são gratuitos**; **marketing** é sempre cobrado.
- A Meta só altera preços no primeiro dia do trimestre, com aviso mínimo de 1 mês para tabelas de preço.
- O preço em **BRL** para o Brasil estava anunciado para o **segundo semestre de 2026** (data pendente) **[conferir a tabela atual]**.

Estimativa de terceiros (não oficial): mensagem utilitária ≈ **R$ 0,04** no Brasil; marketing ≈ **R$ 0,34**. Exemplo: 1.000 mensagens utilitárias/mês ≈ R$ 37. Um blog afirma que mensagens de serviço passariam a ser cobradas a partir de 01/10/2026; **a documentação oficial lida não confirma isso** (tratar como não verificado).

**Necessário:** número dedicado, verificação do negócio na Meta, provedor (BSP) com sua margem, **templates aprovados**, e **consentimento/opt-in** de quem receberá (prestadores, diretoras). **[proposta]** começar com `wa.me` (já existe) + notificações push/in-app e adicionar API oficial como fase posterior, se a sede quiser.

---

## 5. Arquitetura técnica

### 5.1 Segurança com Firebase
Pontos da documentação oficial:
- As **regras do Firestore** usam `request.auth` (quem pede), `resource.data` (documento atual) e `request.resource.data` (estado futuro). **Clientes de servidor (Admin SDK) ignoram as regras.**
- Para papéis, é possível ler um documento do usuário com `get()`: **custa 1 leitura faturável** por avaliação e há **limite de 10 chamadas** por requisição simples (20 em operações multidocumento).
- **Custom claims** (papéis no token): definidos **apenas no servidor** (Admin SDK), **limite de 1.000 bytes**, chegam ao token **na próxima renovação** (então mudança de perfil não é instantânea) e **substituem** as claims anteriores a cada chamada.

**[proposta] para o 2.0:**
- Papéis e escopo como **custom claims**: `{org, papel, municipios: [...]}` para a sede/coordenação e `{org, papel, unidadeId}` para diretoras. Para coordenadores com muitas unidades, usar **escopo por município** (poucos IDs) para ficar longe de 1.000 bytes.
- Toda coleção carrega `orgId`, `municipioId`, `contratoId` e `escolaId`; as regras comparam com o token.
- **Testes automatizados das regras** com o emulador do Firebase [a confirmar a ferramenta atual].
- **Criação de usuários e troca de claims por Cloud Function** (hoje o app cria a conta pelo navegador com uma segunda instância do Firebase, o que depende da confiança no cliente).
- **MFA** para administradores.

### 5.2 Multi-contrato, multi-cliente
| Opção | Prós | Contras |
|---|---|---|
| **Um projeto Firebase, vários clientes** (campo `orgId` + regras) | Barato, uma base de código, atualização única | Regras mais complexas; erro de regra = vazamento entre clientes |
| **Um projeto Firebase por cliente** | Isolamento forte | Mais operação (implantar/atualizar cada projeto) |

**[proposta]:** como o primeiro cliente é a AEMC (uma organização com vários municípios), começar com **um projeto** e modelar `orgId` desde já; decidir isolamento por projeto se aparecer segundo cliente com exigências diferentes.

### 5.3 Funções de servidor necessárias
Tarefas agendadas (ciclos vencidos → chamado, alertas de vencimento, marcar contas vencidas), criação de usuário/claims, envio de WhatsApp/e-mail, geração de PDF/relatório, exportações e backups. Isso pede **Cloud Functions** (normalmente exige plano pago do Firebase **[a confirmar]**) ou alternativa de servidor.

### 5.4 Arquivos e anexos
Firebase Storage com regras por organização/unidade; limite de tamanho; **compressão de foto no celular** antes de enviar; tipos permitidos (PDF/JPG/PNG). O `CurriculoUpload` existente (limite de 5 MB) pode ser aproveitado.

### 5.5 Aplicativo: PWA é suficiente
Para ferramenta interna, o artigo consultado indica PWA como adequado. No **iPhone**, a instalação é manual (Compartilhar → Adicionar à Tela de Início) e **notificações push só funcionam com o app instalado** (desde o iOS 16.4); **sincronização em segundo plano continua limitada**. Não há necessidade de app nativo para o caso de uso (sem Bluetooth/NFC).

### 5.6 Qualidade e operação **[proposta]**
- **Três ambientes:** desenvolvimento, demonstração (dados fictícios) e produção; Vercel já permite *previews* por ramo.
- Testes: regras de segurança, fluxos críticos (abrir chamado, fechar mês), e testes visuais.
- Padronizar **datas (Timestamp)** e **status (constantes)**; hoje há strings soltas (ver [01](01-entendimento-do-projeto.md)).
- Monitoramento de erros, **backup agendado** do Firestore e do Storage, rotina de restauração testada.
- Componentização para acabar com o código repetido (páginas de 30–45 KB).

### 5.7 Acessibilidade e legislação de acessibilidade
Meta **WCAG 2.2 AA**. O gov.br publica padrões e componentes acessíveis que servem de referência ([05](05-referencias-de-design.md)).

---

## 6. Resumo: o que precisa estar resolvido antes de uma demonstração real
1. Regras do Firestore e proteção de rotas (Fase 0 do [06](06-funcionalidades-e-roadmap.md)).
2. Ambiente de demonstração separado, com dados fictícios.
3. Não incluir dado sensível (PCD) nem dado de crianças sem passar pela AEMC e pelo jurídico.
4. Entender como a sede compra e quem paga (item 3).

---

## 7. Fontes
- ECA Digital: [Lefosse — entra em vigor em 17/03](https://lefosse.com/noticias/alerta/eca-digital-entra-em-vigor-em-17-de-marco-como-se-preparar/) · [Demarest](https://www.demarest.com.br/eca-digital-entrada-em-vigor-em-17-de-marco-de-2026/) · [Confidata — ECA Digital nas escolas](https://confidata.com.br/blog/eca-digital-escolas-protecao-dados-alunos)
- LGPD em escolas: [Confidata — consentimento dos pais](https://confidata.com.br/blog/consentimento-pais-lgpd-escolas-guia)
- MROSC: [Manual de prestação de contas — FAPDF 2025](https://fap.df.gov.br/documents/d/fap/manual-de-prestacao-de-contas-mrosc-fapdf-2025-2) · [Sistema digital — São Bernardo do Campo](https://abcdjornal.com.br/novo-sistema-digital-de-prestacao-de-contas-em-sao-bernardo-facilita-parcerias-com-entidades-do-3o-setor)
- WhatsApp: [Preços — documentação oficial da Meta](https://developers.facebook.com/docs/whatsapp/pricing) · [Estimativas de terceiros — Eazybe](https://eazybe.com/br/blog/preco-api-whatsapp-business)
- Firebase: [Regras: autenticação e condições](https://firebase.google.com/docs/firestore/security/rules-conditions) · [Custom claims](https://firebase.google.com/docs/auth/admin/custom-claims) · [Multi-tenancy com Firebase Auth (DEV)](https://dev.to/ash_dubai/firebase-authentication-for-multi-tenant-apps-mastering-firebase-45gp)
- PWA: [Monterail — PWA no iOS](https://monterail.com/blog/pwa-for-apple-ios)
- AEMC: [portal de transparência](https://transparencia.aemc.org.br) e [02](02-associacao-aemc.md)

*Limites:* as páginas do Firebase foram lidas parcialmente (as últimas ~3.000 caracteres de cada uma não foram lidas); a revogação de claims e outros detalhes devem ser conferidos na documentação ao implementar. A Confidata é um blog de consultoria: seus resumos da lei (inclusive a afirmação de que a escola responde solidariamente pelos fornecedores) devem ser conferidos com o texto oficial.
