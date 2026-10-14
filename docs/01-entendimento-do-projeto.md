# Gestão Escolar — Entendimento do Projeto (ponto de partida do "2.0")

> Veja também: [02 — Associação Educacional Maria do Carmo (AEMC)](02-associacao-aemc.md).
>
> Documento gerado em 13/10/2026 a partir da leitura do código em `gestao_escolar/`.
> O que está marcado com **(a confirmar)** é inferência minha e precisa ser validado com você / sua mãe.

---

## 1. Resumo em poucas linhas

O **Gestão Escolar — Hortolândia** é um sistema web (funciona no navegador, inclusive no celular) para a **administração central de uma rede de escolas** controlar, num só lugar, o que antes provavelmente ficava em planilhas, papel e WhatsApp:

- **Manutenções** das escolas (chamados / ordens de serviço)
- **Contas a pagar** de cada unidade (energia, água, taxas, notas fiscais)
- **Ciclos de manutenção preventiva** (limpeza de caixa d'água, extintores, filtros, DR/DS)
- **Prestadores de serviço** (equipe interna e terceirizados)
- **Cadastro das escolas** e das diretoras
- **Recrutamento** (banco de currículos + entrevistas + decisão com feedback)
- **Agenda** única que junta tudo (vencimentos, prazos, entrevistas e compromissos)

Cada pessoa vê só o que precisa: a **administração** vê tudo; o **administrativo/RH** vê apenas recrutamento; a **diretora** vê só a sua escola e pode abrir pedidos de manutenção.

---

## 2. Quem usa e o que cada um faz

| Perfil (`perfil`) | Quem é | O que acessa |
|---|---|---|
| `admin` | Administração central (sua mãe e equipe) | Tudo: Dashboard, Escolas, Manutenções, Prestadores, Contas a Pagar, Ciclos, Banco de Talentos, Processo Seletivo, Agenda, Usuários |
| `administrativo` | Equipe de apoio / RH | Só **Banco de Talentos** e **Processo Seletivo** |
| `diretora` | Diretora de cada escola (1 ativa por unidade) | **Início** com os dados da própria escola + formulário **Solicitar manutenção** |

**Quem o sistema ajuda, na prática**
- **Administração:** enxerga pendências e atrasos de todas as escolas, não perde vencimentos de contas e de revisões preventivas, manda a O.S. por WhatsApp ao prestador, imprime a O.S., organiza contratações.
- **Diretoras:** deixam de ligar/mandar mensagem para pedir reparo; abrem o chamado direto no sistema e acompanham o status; veem as contas e ciclos da sua escola.
- **Prestadores:** recebem a O.S. por WhatsApp (ainda não têm acesso ao sistema).
- **Candidatos a vaga:** têm o currículo guardado e recebem um processo organizado (agendado → aprovado/reprovado com feedback).

---

## 3. Como cada módulo funciona

### Login (`/login`)
Uma tela com **dois portais**: "Área Administrativa" e "Portal da Escola" (diretoras). Autenticação por e-mail/senha (Firebase Auth). Se o usuário estiver com `situacao = inativa`, é deslogado. Depois do login, `/` redireciona: admin → `/admin/dashboard`, administrativo → `/admin/talentos`, diretora → `/diretora/dashboard`.

### Dashboard da administração
Saudação + indicadores em tempo real: manutenções abertas (pendentes / em andamento), **valor total de contas "A enviar"**, ciclos vencidos / vencendo, entrevistas, eventos próximos. Gera **alertas**, por exemplo manutenção **Pendente há mais de 5 dias**.

### Escolas
CRUD completo: nome, código da unidade, situação (Ativa/Inativa), endereço, bairro, CEP, telefone, e-mail, **dados da diretora** (nome, celular/WhatsApp, e-mail), nº de alunos, **capacidade da caixa d'água (litros)** e observações. Tem busca e filtro por situação. Todo o resto do sistema se liga à escola por `escolaId`.

### Manutenções (chamados / O.S.)
- Campos: escola, local dentro da escola, descrição, **prioridade** (Baixa/Média/Alta), **status** (Pendente → Em andamento → Concluído), **responsável** (um prestador ou "A definir"), prazo, observações internas.
- Ao concluir, grava `concluidoEm` automaticamente.
- Mostra "dias em aberto" e destaca atraso (Pendente > 5 dias).
- **Envia a O.S. por WhatsApp** (link `wa.me`) para o prestador e **imprime a O.S.** numa página formatada.
- Chamados podem nascer de duas formas: a administração cria, ou a **diretora solicita** (entra como *Pendente*, responsável *A definir*, com nome de quem pediu).

### Prestadores
Cadastro de quem executa os serviços: nome, especialidade, tipo (**Interno** ou **Terceirizado**), telefone (com botão de WhatsApp), documento e PIX. Alimenta a lista de responsáveis nas Manutenções.

### Contas a Pagar
- Tipos: **CPFL, SABESP, Taxa de Limpeza, Nota Fiscal de Serviço, Outro**.
- Campos: escola, tipo, competência (ex.: "Abril/2025"), valor, vencimento, nº do documento (NF/boleto), observações.
- Status: **A enviar → Enviada**, e **Vencida** (automático: quando a administração abre a tela, contas "A enviar" com vencimento passado viram "Vencida").
- Filtros por escola, tipo, status e competência; soma do valor pendente. *(a confirmar: "enviar" significa enviar a conta para a prefeitura/mantenedora pagar ou para reembolso?)*

### Ciclos (manutenção preventiva)
Controla serviços recorrentes por escola, com **periodicidade padrão**:
- Limpeza de caixa d'água — 180 dias
- Inspeção de DR e DS — 365 dias
- Troca/recarga de extintores — 365 dias
- Troca de filtros de água — 90 dias

Informa a **última execução** → o sistema calcula a **próxima execução**. Status: **Em dia**, **Vencendo em breve** (≤ 30 dias) e **Vencido**. Tem visão de lista e contadores.

### Banco de Talentos → Processo Seletivo
1. **Banco de Talentos** (`curriculos`): cadastra currículo (nome, telefone, e-mail, vaga pretendida, experiência, indicação, observações). Status inicial **Disponível**. Botão de WhatsApp e **agendar entrevista** (data + hora).
2. **Processo Seletivo**: lista só quem está com **Entrevista Agendada**; permite editar/cancelar e **Aprovar / Reprovar exigindo um feedback**, que fica salvo junto ao currículo.
3. O componente `CurriculoUpload` (PDF/JPG/PNG até 5 MB) existe, mas hoje **não aparece conectado a nenhuma tela** — upload de arquivo de currículo ainda não está em uso.

### Agenda
Calendário (FullCalendar: mês/semana/dia/lista) que **mistura eventos manuais** (Reunião, Visita, Prazo, Compromisso, Outro) com **eventos automáticos** gerados de: vencimento de contas, próximas execuções de ciclos, prazos de manutenção e entrevistas do RH. Cada fonte tem cor própria e dá para filtrar.

### Usuários
Só o `admin` cria contas. A criação usa uma segunda instância do Firebase no navegador (para não deslogar o admin), com **senha provisória** (pode gerar aleatória). Regra de negócio: **só uma diretora ativa por escola** — se ativar outra, o sistema pergunta e desativa a anterior. Usuários podem ser ativados/desativados.

---

## 4. Como é construído (stack)

| Camada | Tecnologia |
|---|---|
| Front-end | **React 18** + **Vite 5** (SPA), React Router 6 |
| Estilo | **Tailwind CSS 3** (cor primária `#185FA5`), ícones `lucide-react` |
| Calendário | FullCalendar 6 |
| Back-end | **Firebase**: Authentication, **Firestore** (banco, com `onSnapshot` = tempo real), Storage (inicializado, sem uso visível) |
| Hospedagem | Provavelmente **Vercel** (`vercel.json` com rewrite para SPA) **(a confirmar)** |
| Deploy | `push.bat` → `git add . && git commit -m "update" && git push origin main` |

Não há servidor próprio: o navegador conversa direto com o Firebase. Não há testes automatizados nem README.

### Estrutura de pastas
```
src/
  App.jsx                  rotas e redirecionamento por perfil
  contexts/AuthContext     login, perfil do usuário (coleção `usuarios`)
  hooks/                   useAuth, useFirestore (CRUD genérico)
  services/firebase.js     config (vem do .env)
  utils/                   formatters (data/moeda/telefone), calcularStatus
  components/layout|ui|shared   Sidebar, Topbar, Modal, Toast, Badge, PrivateRoute...
  pages/Login.jsx
  pages/admin/             Dashboard, Escolas, Manutencoes, Prestadores, Contas,
                           Ciclos, BancoTalentos, Selecao, Agenda, Usuarios
  pages/diretora/          Dashboard
```

### Modelo de dados (coleções do Firestore)
| Coleção | Conteúdo principal |
|---|---|
| `usuarios` (id = uid do Auth) | nome, email, perfil, unidadeId/unidadeNome, situacao (ativa/inativa) |
| `escolas` | dados da unidade + diretora, nº alunos, caixa d'água |
| `manutencoes` | escolaId, descricao, localDentroEscola, prioridade, status, responsavel, prazo, concluidoEm, solicitadaPor |
| `prestadores` | nome, especialidade, tipo, telefone, documento, pix |
| `contas` | escolaId, tipo, competencia, valor, vencimento, numeroDocumento, status |
| `ciclos` | escolaId, tipo, periodicidadeDias, ultimaExecucao, proximaExecucao |
| `curriculos` | candidato, vaga, status (Disponível / Entrevista Agendada / Aprovado / Reprovado), dataEntrevista, feedback |
| `eventos` | eventos manuais da agenda |
| `candidatos` | lida pelo Dashboard admin, **mas nada grava nela** (provável resquício) |

---

## 5. Pontos de atenção que encontrei (para tratar no 2.0)

Ordenados do mais importante para o menos. Ainda **não alterei nada** no código.

1. **Regras de segurança do Firestore não estão no repositório.** O arquivo `firestore.rules` contém, na verdade, um trecho de configuração do Firebase (e não regras). **Atualização (13/10/2026):** as regras reais foram lidas no console e são razoáveis, com uma brecha em `prestadores` ([09](09-auditoria-de-seguranca-e-infraestrutura.md)). Continua valendo que: com dados de escolas, valores e candidatos, **a proteção real precisa estar nas regras**, não só no front-end.
2. **Proteção de rotas no front não está valendo.** O `App.jsx` passa `allowedRoles` (lista), mas o `PrivateRoute` lê `allowedRole` (singular). Resultado: qualquer usuário logado consegue abrir `/admin/...` digitando a URL. Hoje só o menu esconde as telas.
3. **Não existe `.gitignore`** na pasta e há um `.env` (366 bytes). Preciso confirmar se o `.env` foi enviado ao GitHub. (Não abri o conteúdo dele.)
4. **Link quebrado:** o menu da diretora tem "Solicitar Manutenção" (`/diretora/manutencoes`), mas essa rota não existe (cai no início). Hoje o pedido é feito por um botão dentro do dashboard.
5. **Regras de status inconsistentes:** "Vencendo em breve" é ≤ 30 dias na tela de Ciclos e ≤ 7 dias no helper usado pelo Dashboard.
6. **Contas "Vencida" só atualizam quando alguém da administração abre a tela** (a lógica roda no navegador). Sem ninguém abrir, nada muda e o Dashboard pode estar desatualizado. Idem para o ideal de lembretes/notificações, que hoje não existem.
7. **Código duplicado:** formulários, filtros, modais e CRUD repetidos em cada página (algumas com 30–45 KB, como Manutenções com ~1.000 linhas). O `useFirestore` existe, mas quase não é usado. Isso encarece cada mudança.
8. Dados de datas ora são `string` (`"2026-10-13"`), ora Timestamp; textos de status são "livres" (strings soltas) — risco de inconsistência.
9. Mistura de português de Portugal e do Brasil na interface ("registos", "A carregar", "casa de banho").
10. **Um único cliente embutido:** nome "Hortolândia" no título, sem conceito de "organização". Para vender a outras associações, será preciso decidir se cada cliente terá sua própria instalação/projeto Firebase ou se o sistema vira multi-cliente.
11. Falta o que o dia a dia costuma pedir: relatórios/exportação (PDF/Excel), anexos (foto do problema, PDF da conta), histórico/auditoria de quem alterou o quê, notificações, recuperação de senha.

---

## 6. Perguntas para alinharmos antes de começar o 2.0

1. ~~Quem é a Associação Maria do Carmo?~~ Respondido parcialmente em [02-associacao-aemc.md](02-associacao-aemc.md); restam as perguntas específicas daquele documento.
2. Em **Contas a Pagar**, o que significa "A enviar" e para quem é enviado? Quem efetivamente paga?
3. O que sua mãe **mais usa hoje** e o que mais incomoda (para priorizar o 2.0)?
4. Os prestadores/diretoras **vão precisar de acesso** (ex.: prestador atualizar o status da O.S. pelo celular)?
5. Há **dados reais em produção** que não podemos perder? Quantas escolas/usuários hoje?
6. Onde está publicado hoje (Vercel? domínio?) e posso ver o **console do Firebase** pelo navegador para conferir as regras?
7. Para a venda: o sistema será **cobrado** (mensalidade, licença)? Isso influencia segurança, suporte e multi-cliente.

---

## 7. Sugestão de próximos passos (para você decidir)

1. **Base segura:** conferir/escrever as regras do Firestore, corrigir o `PrivateRoute`, revisar o `.env`/`.gitignore`.
2. **Arrumar a casa:** componentes e hooks compartilhados, constantes de status, padronizar textos em PT-BR.
3. **Melhorias de valor:** anexos/fotos nas manutenções, notificações e lembretes, relatórios em PDF/Excel, histórico de alterações.
4. **Preparar para vender:** definir modelo multi-cliente, tela de configuração da organização (nome, logo, cores), documentação e treinamento.
