# 23 — Revisão completa do sistema (15/10/2026)

Revisão de ponta a ponta antes da apresentação para a sede: todas as telas,
todos os níveis de conta, as regras de segurança e os testes automatizados.

## Como foi feito o teste

Tudo rodou **no computador, contra o emulador do Firebase** (projeto fictício
`demo-gestao-escolar`): nada tocou o sistema real nem o de demonstração na nuvem.

| Etapa | Resultado |
|---|---|
| Emulador local + dados de demonstração | 5 contas de teste e 181 registros fictícios |
| Navegação tela a tela nos 4 perfis (sede, administração, RH, diretora) | feita no navegador, em telas de 375 px (celular), 900 px e 1366 px |
| Testes de interface e de importação (`npm test`) | **90 passando, 0 falhando** |
| Testes das regras do Firestore (`npm run test:regras`) | **72 passando, 0 falhando** (73 depois da correção do item 1) |
| Compilação de produção (`npm run build`) | compila em 10 s, sem erro |
| Acessibilidade (axe-core, WCAG 2.1 A/AA) | Painel, Escolas e Contas: **nenhuma falha**; Agenda: 2 falhas (da biblioteca de calendário) |

Para o emulador rodar foi preciso instalar o **Java 21 (OpenJDK Temurin)** nesta
máquina — é exigência do emulador do Firestore, não do sistema.

---

## O que está funcionando bem

**Separação por município (o ponto central da venda para a sede).**
Testado no servidor, não só na tela: com a conta da diretora, pedir as escolas
de outro município, a lista de funcionários ou uma escola de Jaguariúna pelo
identificador é **recusado pelo banco** (`PERMISSION_DENIED`), enquanto os
chamados da própria escola vêm normalmente. Os 72 testes de regras cobrem os
dois municípios, perfil por perfil.

**Os quatro níveis de conta entram no lugar certo e não passam da conta:**

| Conta | Onde cai ao entrar | Confirmado |
|---|---|---|
| Sede | Visão da sede (4 municípios, semáforo, contratos) | entra em qualquer município e trabalha como a administração dele |
| Administração do município | Painel do município | `/admin/sede` é bloqueado e devolve ao painel; só vê os dados de Hortolândia |
| RH (administrativo) | Funcionários | menu com 3 telas; `/admin/contas` e `/admin/usuarios` são bloqueados |
| Diretora | Início (celular) | só a própria escola; `/admin/...` é bloqueado |

**Visão da sede.** 4 municípios, 3 contratos vigentes, 7 escolas, 1.080 alunos,
semáforo por município com o motivo em texto ("6 pendências críticas · 3 de
atenção") e contrato com vigência. É a tela mais forte para a apresentação.

**Painel e alertas.** "Precisa de atenção hoje" lista conta vencida, ciclo
vencido, chamado parado e ASO vencido, cada um com a ação ao lado ("Ver contas",
"Abrir chamado", "Já foi feito", "Ciente"). O contador aparece no menu e no
título da aba. Os números do painel batem com as telas de detalhe.

**Chamado de ponta a ponta (testado de verdade).** A diretora abriu um chamado
pelo celular em 3 campos → apareceu na hora para a administração → "Iniciar
atendimento" mudou o status, escreveu a linha do tempo ("Pendente → Em
andamento") e registrou no histórico com nome e hora. O alerta correspondente
saiu do painel sozinho.

**Celular da diretora.** Abre direto na aba "Escola", barra inferior com
"Início / Pedir manutenção / Meus chamados", botão grande de pedir manutenção,
filtros "Em aberto / Concluídos / Todos". É simples o bastante para quem nunca
usou o sistema.

**Nada se perde.** Testado: criar → excluir (vai para a lixeira) → histórico
mostra "Criou" e "Excluiu" com nome, data e hora. A cópia de segurança em Excel
e em JSON está pronta, com lembrete no painel quando passa de 7 dias.

**Demais telas conferidas sem erro:** Escolas, Manutenções (lista + detalhe com
O.S.), Ciclos (com semáforo de vencimento), Contas a pagar (filtros por unidade,
tipo, status e competência), Controle de saldo (um cartão por área, limite do
mês, "Passou do limite"), Funcionários (17 ativos, selos de PCD, afastado e ASO
vencido), Banco de Talentos, Processo seletivo, Usuários e Segurança dos dados.

**Textos.** Português do Brasil em tudo, um nome por tela, estados vazios que
ensinam o próximo passo. Há teste automatizado garantindo isso.

---

## O que precisa de melhoria

### 1. Restaurar da lixeira não funcionava para a administração e para o RH — **corrigido em 15/10/2026**

Testado: a administração de Hortolândia excluiu um prestador, ele foi para a
lixeira, e ao clicar em "Restaurar" a tela respondeu *"Não foi possível
restaurar. Tente novamente."* Com a conta da sede, a mesma restauração funciona.

Causa: antes de restaurar, `restaurarDaLixeira` (em `src/services/db.js`) lê o
destino para não sobrescrever um registro existente. Como o registro **não
existe** (acabou de ser excluído), a regra do Firestore avalia
`resource.data.municipioId` sobre um valor nulo e nega a leitura ("Null value
error"). A sede escapa porque a regra testa `isSede()` primeiro.

Valia para todas as coleções (escolas, contas, currículos, funcionários...).

**Correção aplicada:** nas regras, a leitura de um registro que não existe
passa a ser permitida para quem administra o município (`resource == null ||
resource.data.municipioId == meuMunicipio()`, em `administraAtual()`,
`rhAtual()` e na leitura de escolas). Ler o que não existe não revela nada, e
é exatamente o que a restauração faz. As leituras da diretora e do RH ganharam
a mesma proteção contra valor nulo, para negar sem erro.

Os 72 testes não pegavam isso porque o teste reproduzia só a gravação em lote
da restauração, sem a leitura prévia que o código real faz. O teste passou a
usar o mesmo caminho do app e ganhou um caso novo ("ler o destino que ainda não
existe é permitido"): **73 testes de regras, todos passando**.

Conferido na tela depois da correção: a administração excluiu um prestador e o
restaurou com um clique — *"Antônio Pinturas voltou para Prestadores"*, lixeira
vazia e histórico com "Excluiu" e "Restaurou".

### 2. Agenda: o mês não mostrava nenhum evento — **corrigido em 15/10/2026**

Na visão "Mês", todos os dias mostravam apenas "mais +1", "mais +2" e nenhum
evento legível — inclusive em tela alta (1366×1100), com células de 110 px
sobrando. É o `dayMaxEvents={true}` combinado com `height="100%"` dentro de um
contêiner flexível: o calendário mede a altura errado e conclui que não cabe
nada. As visões Semana, Dia e Lista sempre estiveram certas.

**Correção aplicada:** `dayMaxEvents={3}` (número fixo, em vez de "o que
couber"), em `src/pages/admin/Agenda.jsx`. Conferido na tela: outubro mostra
"Ciclo: Troca de filtros de água — CEI Arco-Íris", "Vencto: CPFL — CEI Pequenos
Passos", "Prazo: Tomada sem energia na cozinha", reuniões e entrevistas, cada um
com o nome legível.

### 3. O sistema baixa 1,38 MB de JavaScript de uma vez — média

Um arquivo único de 1.378 kB (362 kB compactado). Num 4G fraco, que é o caso da
diretora na escola, a primeira abertura demora. Dá para dividir por tela
(carregar a Agenda e a leitura de planilhas só quando forem abertas).

### 4. Banco de Talentos sem o currículo anexado — média

A tela guarda nome, vaga, telefone e observações, mas **não tem como anexar o
PDF do currículo**. Existe um componente pronto de upload
(`src/components/ui/CurriculoUpload.jsx`) que não é usado por nenhuma tela, e o
Firebase Storage está ligado mas nunca é chamado. Para o RH, um "banco de
talentos" sem o currículo em si é meia funcionalidade.

### 5. Cadastro de usuários tem três limitações — média

- Editar um usuário **não permite trocar o perfil** (diretora ↔ RH): só nome,
  unidade e situação. Hoje isso só se faz pelo console do Firebase.
- Não existe excluir conta (por decisão: desativa-se). Está certo, mas a conta
  continua existindo no Firebase Auth e isso precisa estar claro no contrato com
  a sede (LGPD: prazo de retenção).
- A criação de conta é feita pelo navegador (`createUserWithEmailAndPassword`),
  o que exige deixar o cadastro por e-mail/senha aberto no projeto. Quem tiver a
  chave pública do site consegue criar uma conta — ela fica **sem perfil e sem
  acesso a dado nenhum** (as regras barram), mas é uma pergunta que a sede pode
  fazer. O jeito definitivo é criar usuários por uma função no servidor (Cloud
  Function com Admin SDK).

### 6. Pequenos acabamentos — baixa

- **Cartões de escola entre ~800 e 1000 px:** o nome longo ("CEI Pequenos
  Passos") encosta no selo "Ativa" e o nome do contrato vaza do cartão.
- **Agenda e acessibilidade:** 2 falhas de WCAG vindas da biblioteca
  FullCalendar (atributo ARIA inválido no "mais +N" e setas sem texto
  alternativo). O resto do sistema passou limpo.
- **Banco de Talentos e Processo seletivo** ainda usam as janelas do navegador
  (`window.confirm` / `alert`) em vez da caixa de confirmação do sistema.
- **"Municípios atendidos: 3"** com 4 municípios na tela (Sorocaba tem contrato
  encerrado). O número está certo, mas o rótulo não explica.
- **`npm run lint` não roda:** o eslint não está instalado no projeto.
- **PWA sem service worker:** o sistema instala no celular, mas não abre sem
  internet.
- **Não foram testados nesta revisão:** o download do Excel/JSON (precisa da
  pasta de downloads), o envio de e-mail de "Esqueci minha senha" (o emulador
  não envia) e a importação de planilhas pela tela (coberta por testes
  automatizados).

---

## O que falta para apresentar à sede

### Antes da apresentação
1. ~~Corrigir a restauração da lixeira~~ — **feito** (item 1).
2. ~~Corrigir a Agenda do mês~~ — **feito** (item 2).
3. **Publicar as duas correções** no projeto de demonstração e no real: as
   regras do Firestore precisam ser publicadas à parte
   (`firebase deploy --only firestore:rules`); a Agenda vai junto com o site.
4. Conferir os dados da demonstração na nuvem e deixar as contas dos 4 perfis
   prontas, com uma folha de roteiro (quem entra, o que mostrar, nessa ordem).

### Vale incluir na demonstração (ganha a conversa)
4. **Foto no chamado.** Hoje a diretora descreve em texto; uma foto do que
   quebrou é o pedido mais natural e o que mais impressiona em demonstração.
   O Storage já está configurado.
5. **Currículo anexado** no Banco de Talentos (item 4), com o componente que já
   existe.
6. **Aviso automático** quando um chamado é aberto ou concluído (hoje a O.S. vai
   por WhatsApp manual, com o botão). Mesmo um e-mail simples muda a percepção
   de "sistema que cobra sozinho".
7. **Resumo do município para a sede imprimir/exportar** — um relatório mensal
   por município (chamados, contas, ciclos, contratos) em PDF ou Excel é o que a
   sede costuma pedir depois da primeira reunião.

### Depois da apresentação
8. Cópia de segurança automática (hoje depende de alguém clicar toda semana).
9. Criação de usuários pelo servidor e troca de perfil pela tela (item 5).
10. Divisão do JavaScript por tela e funcionamento offline no celular (itens 3 e 6).
11. Prazos por prioridade acordados com a sede (SLA) e relatório de cumprimento
    — é o indicador que a sede costuma cobrar do município.

---

## Contas usadas no teste (só existem no emulador)

`sede@demo.test`, `admin@demo.test`, `admin.jaguariuna@demo.test`,
`diretora@demo.test`, `rh@demo.test` — senha no próprio
`scripts/semear-emulador.mjs`.

Para repetir a revisão: `npm run emulador`, `npm run emulador:dados`,
`npm run dev:emulador` (exige Java instalado).
