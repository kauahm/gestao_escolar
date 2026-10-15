# Registro de alterações

> O que foi efetivamente mudado no código, em ordem de data. Tudo sem custo nenhum (plano gratuito).
> Voltar ao índice: [README](README.md) · Relacionado: [06 Roadmap](06-funcionalidades-e-roadmap.md) · [09 Segurança](09-auditoria-de-seguranca-e-infraestrutura.md)

---

## 13/10/2026 — Base segura e painel honesto

### 1. Regras do Firestore agora vivem no repositório (item 0.1)
**Antes:** as regras existiam só no console do Firebase. O arquivo `firestore.rules` do projeto continha, na verdade, a configuração do Firebase Web.
**Agora:** `firestore.rules` tem as regras de verdade, com `firebase.json` e `firestore.indexes.json` para publicar pela linha de comando.

O que mudou nas regras:
- **`prestadores` deixou de ser aberta.** Antes era `request.auth != null`, ou seja, qualquer conta logada lia, alterava e apagava todos os prestadores. Agora é só da administração.
- **Chamado aberto pela diretora passou a ser validado**: ele nasce obrigatoriamente como "Pendente", na escola dela, em nome dela, com campos conhecidos, descrição de até 2000 caracteres e prioridade dentro da lista. Antes ela podia criar um chamado já concluído, em outra escola ou com qualquer campo.
- **`isAtiva` passou a valer para todas as operações**, inclusive a leitura de manutenções pelo admin (antes um admin desativado ainda lia).
- **`candidatos`** passou a aceitar também o perfil `administrativo`, que já tem "Processo Seletivo" no menu (antes a tela abria e dava erro de permissão).
- Usuário continua sem poder ser apagado (`delete: if false`): desativa-se em vez de excluir.

**Falta fazer (você, uma vez):** publicar as regras. Com a CLI do Firebase instalada, na pasta do projeto:
`firebase deploy --only firestore:rules`
Ou copiar o conteúdo de `firestore.rules` e colar no console, em Firestore → Regras → Publicar.

### 2. Higiene do repositório (item 0.4)
- Criado **`.gitignore`** (ignora `.env`, `node_modules`, `dist`, logs do Firebase, arquivos de editor).
- Criado **`.env.example`**, sem valores, para quem for rodar o projeto.

**Falta fazer (você, uma vez):** o `.env` já está versionado; o `.gitignore` sozinho não tira o que já entrou. Na pasta do projeto, rode uma vez:
`git rm --cached .env`
Depois um commit. O arquivo continua no seu computador e para de ser enviado. Não é preciso trocar chaves: o conteúdo é a configuração pública do Firebase Web ([09](09-auditoria-de-seguranca-e-infraestrutura.md), seção 6).

### 3. `PrivateRoute` corrigido (item 0.2)
**Antes:** o `App.jsx` passava `allowedRoles` (lista) e o componente lia `allowedRole` (texto). Como o valor chegava vazio, **a verificação de perfil nunca rodava**: qualquer pessoa logada conseguia abrir as telas de `/admin`.
**Agora:** o componente aceita lista ou texto, bloqueia quem não tem o perfil, manda cada perfil para a sua tela inicial e **barra conta desativada**.

Além disso, cada tela de `/admin` passou a declarar quem pode entrar. O perfil `administrativo` (RH) entra apenas em Banco de Talentos e Processo Seletivo; as demais são do admin.

### 4. A lógica que enganava o painel (item 0.8, achados A1–A3)
**Antes:** toda conta "A enviar" cujo vencimento passava era **reescrita no banco** como "Vencida". O painel só somava as "A enviar" e, por isso, mostrava **"Contas a Enviar: 0 / R$ 0,00"** enquanto havia 20 contas em aberto somando R$ 18.148,46. Pior: o botão "Marcar como Enviada" só aparecia para contas "A enviar", então **as vencidas não tinham como ser quitadas na tela**.

**Agora:**
- O status gravado é só **"A enviar"** ou **"Enviada"**. **"Vencida" virou condição calculada** (venceu e ainda não foi enviada), em `utils/calcularStatus.js`.
- O painel conta **todas as pendentes** e destaca em vermelho quantas estão vencidas e quanto somam. O cartão virou link para a tela de contas.
- O alerta de contas vencidas aparece **resumido em uma linha** ("20 contas vencidas somando R$ 18.148,46"), em vez de uma linha por conta.
- A lista do painel virou **"Contas vencidas e dos próximos 7 dias"**, com as mais atrasadas no topo e os dias de atraso.
- Na tela de contas: selos e filtros calculados, dias de atraso na coluna de vencimento, totalizador separando "vencidas" de "a enviar no prazo", e **"Marcar como Enviada" para qualquer conta pendente**.
- **"Próximos Eventos" só mostra o que ainda não aconteceu.** Havia um erro na condição (`data >= hoje || diaInteiro`) que deixava passar **qualquer** evento de dia inteiro, por mais antigo que fosse — daí reuniões de maio aparecerem como "próximas" em outubro.
- A descrição longa no alerta de manutenção passou a ser resumida (achado V5).

**Nada foi apagado nem migrado.** Os 20 registros antigos com "Vencida" gravado continuam no banco e são tratados como pendentes. O status só é normalizado quando alguém editar a conta.

### 5. Rede de segurança contra perda de dados (parte sem custo do item 0.9)
- **Lixeira e histórico:** todas as telas gravam pela camada `src/services/db.js`. Excluir copia o registro para a lixeira antes de remover (tudo ou nada) e toda alteração fica no histórico, com quem fez e quando.
- **Tela "Segurança dos dados"** (`/admin/seguranca`, só admin): baixar cópia completa em Excel ou JSON, restaurar da lixeira e consultar o histórico. O painel lembra quando a última cópia tem mais de 7 dias.
- As mensagens de exclusão deixaram de dizer "não pode ser desfeita".

### 6. Restos do problema "Vencida" (conferência de 13/10)
Duas telas ainda filtravam por `status === 'A enviar'` e, por isso, escondiam as contas antigas gravadas como "Vencida":
- **Agenda:** os vencimentos dessas contas não apareciam no calendário.
- **Início da diretora:** o contador de contas ignorava as vencidas e o selo mostrava "Vencida" em verde. Agora usa a mesma função do painel (`situacaoConta`).

### 7. Revisão e testes das regras
Regras revisadas contra o código de todas as telas, com **38 testes automatizados passando** no emulador local (`tests/regras/`, comando `npm run test:regras`). Depois dos testes, as regras foram endurecidas:
- **Chamado da diretora:** nasce sempre com responsável "A definir", com a hora do servidor e nomes de tamanho limitado.
- **Histórico:** só aceita os campos que o app grava, com a hora do servidor e o e-mail de quem está logado.

Na tela de Usuários, **ninguém consegue mais desativar a própria conta** (evita ficar sem admin para reativar). Detalhes e achados em [12](12-revisao-e-testes-das-regras.md).

---

## 14/10/2026 — Controle de saldo

- **Nova aba Controle de saldo** (só administração), baseada na planilha "Controle de Saldo", em versão mais simples. Tem quatro partes: Painel, Lançamentos, Mês a mês e Áreas e verbas.
- **Áreas e verbas:** período (mês inicial e nº de meses) e áreas com verba mensal ou do período (um campo calcula o outro), com as 9 áreas da planilha como sugestão.
- **Lançar gasto:** à vista ou parcelado (uma parcela por mês). Antes de salvar, mostra quanto ainda sobra para a área no mês e avisa se passar do teto ou estourar a verba.
- **Conta automática igual à da planilha:** teto do mês = (verba − o que caiu nos outros meses) ÷ meses que faltam. Mês acima do teto reduz o teto dos seguintes sozinho. Conferido centavo por centavo com a planilha real.
- **Importação** das abas Orçamento e Lançamentos da planilha, sem ajuste (9 áreas e 15 gastos, nenhum erro). **Exportar Excel** dos lançamentos.
- **Alertas:** verba estourada (atenção) e área acima do teto do mês (aviso).
- **Regras:** coleções `rubricas` e `gastos` só da administração; período em `config/saldo`. **Demonstração:** período, áreas e 17 gastos fictícios.
- **Testes:** 85 (`npm test`) e 61 de regras, todos passando. A tela foi conferida no emulador (inclusive no celular), e a auditoria de acessibilidade não achou violações.

Detalhes em [20](20-controle-de-saldo.md).

---

## 14/10/2026 — Funcionários

- **Nova aba Funcionários** (administração e RH), com a mesma estrutura da planilha "Colaboradores": situação, unidade, nome, nascimento, cargo, PCD, admissão, salário, CPF, RG, PIS, fone, endereço, cidade, ASO, afastamento e rescisão.
- **Só 4 campos obrigatórios** (nome, unidade, cargo, situação). **Cargos sugeridos** (os 12 da planilha, com o nome completo), com liberdade para digitar outro.
- **Filtros:** busca por nome ou CPF, unidade, cargo, situação e atalhos PCD, Afastados e ASO vencido ou vencendo. Números no topo (ativos, inativos, PCD, afastados).
- **CPF e PIS conferidos** pelos dígitos verificadores; CPF repetido barrado; vencimento do ASO sugerido; inativação pede a data de rescisão.
- **Exportar Excel** com as colunas na ordem da planilha original e **importar planilha**: a planilha real foi conferida sem gravar nada (293 de 296 linhas entram).
- **Alertas de ASO** no Painel (vencidos e vencendo em 30 dias), agrupados.
- **Regras:** coleção `funcionarios` só para administração e RH; a diretora não lê (CPF, salário, saúde). RH também usa a lixeira e a importação de funcionários. O RH passa a entrar direto em Funcionários.
- **Demonstração:** 28 funcionários fictícios. A planilha real não entrou no projeto.
- **Testes:** 75 (`npm test`) e 58 de regras (`npm run test:regras`), todos passando; tela conferida no emulador, inclusive no celular, e auditoria de acessibilidade sem violações.

Detalhes em [19](19-funcionarios.md).

---

## 14/10/2026 — Design e polimento (bloco F)

- **Base visual** para todas as telas: fonte Inter, cinzas azulados, escala do azul da marca, sombras suaves, foco visível no teclado, 83 rótulos com maiúsculas corrigidas, esqueletos de carregamento.
- **Login** mais limpo e, no celular, abrindo direto na área da escola; **painel** com cartões clicáveis; **menu** que cabe na tela.
- **Celular da diretora:** barra inferior com o botão "Pedir manutenção".
- **Instalável no celular** (ícone próprio e manifesto), sem cache offline, de propósito.
- **Acessibilidade:** auditoria com axe em todas as telas; zero violações fora da biblioteca do calendário (Agenda).
- **Defeito corrigido:** o cartão "Entrevistas do mês" do painel lia uma coleção vazia e mostrava sempre 0.
- Prints de antes e depois em `docs/design/`.

Detalhes em [18](18-design.md).

---

## 14/10/2026 — Alertas que cobram (bloco E)

- **Quadro "Precisa de atenção hoje"** no painel, do mais grave para o menos, com a ação de cada item (abrir chamado, "já foi feito" no ciclo, abrir chamado do ciclo, marcar conta como enviada, ver contas vencidas).
- **Prazos por prioridade** para cobrar chamado pendente: Alta 2 dias, Média 5, Baixa 10. Novos alertas: prazo estourado, em andamento parado há 7 dias, ciclo perto de vencer, conta perto de vencer.
- **Ciclo vencido → chamado → concluir atualiza o ciclo.**
- **"Ciente, lembrar depois"** (1, 3 ou 7 dias), com a nova coleção `alertasAdiados` nas regras.
- **Contador** no menu e na aba do navegador; **alertas da escola** no início da diretora.
- **Regras publicadas** nos dois projetos antes do envio do código. Testes: 63 em `npm test`, 55 de regras.

Detalhes em [17](17-alertas.md).

---

## 14/10/2026 — Dados e fluxo dos chamados (bloco D)

- **Competência** escolhida em mês e ano, sempre gravada como "Outubro/2026", com aviso quando está longe do vencimento; filtro em ordem de data.
- **Tipo "Outro"** sugere os tipos já usados e evita grafias diferentes do mesmo tipo.
- **Responsável ligado ao prestador** (identificador + nome); nomes fora do cadastro aparecem como "não cadastrado".
- **Página de detalhe do chamado** com linha do tempo, mudança de status com um clique, WhatsApp, impressão e exclusão protegida.
- **"Meus chamados"** para a diretora, no lugar do item de menu que não levava a lugar nenhum.
- **"Esqueci minha senha"** no login, e mensagens de erro do login mais claras.
- **Defeito corrigido:** editar um registro gravava um campo `id` dentro do documento.
- **Testes:** 53 em `npm test`, 52 de regras; conferência na tela no emulador.

Detalhes em [16](16-dados-e-fluxo-dos-chamados.md).

---

## 14/10/2026 — Textos em PT-BR e estados de tela (item 0.6)

- **Português do Brasil** em todos os textos encontrados, com um teste que barra palavras de Portugal no código.
- **Um nome por tela** (`src/config/telas.js`): menu, barra superior ("Gestão Escolar › Escolas") e aba do navegador; perfil em português (Administração, RH, Diretora).
- **Data e saudação:** "Terça-feira, 13 de outubro de 2026" e "Boa tarde, Alessandra!".
- **Estados vazios** com título, explicação e botões, separando "ainda não há cadastros" (com Importar planilha) de "nada com estes filtros" (com Limpar filtros).
- **Quando os dados não chegam:** aviso no alto da tela (sem internet, sem servidor, sem permissão, demorando) e, principalmente, **a tela não diz mais "nenhum cadastro" quando o problema é a conexão**. Antes, com o servidor fora do ar, a tela de contas afirmava "Nenhuma conta registrada".
- **Login sem conexão** mostra "Não foi possível carregar o seu perfil... seus dados continuam guardados", separado de "perfil não encontrado".
- **Testes:** 42 em `npm test`; conferência na tela no emulador, inclusive desligando e religando o servidor.

Detalhes em [15](15-textos-e-estados-de-tela.md).

---

## 14/10/2026 — Importação de planilhas (item 0.7)

- **Botão "Importar planilha"** em Escolas, Contas a pagar, Ciclos e Banco de Talentos: modelo para baixar, envio de Excel ou CSV, conferência das colunas, pré-visualização com cada linha marcada como pronta, com aviso ou com erro, relatório para corrigir e **desfazer a importação inteira** (vai para a lixeira).
- **Leitor de planilhas próprio** (`src/utils/lerPlanilha.js`), sem biblioteca nova.
- **Regras:** nova coleção `importacoes`. Admin importa tudo; RH só currículos; diretora nada.
- **Modo emulador** (`npm run emulador`, `npm run emulador:dados`, `npm run dev:emulador`): o sistema inteiro roda no computador, com usuários e dados de teste, sem tocar em nenhum projeto Firebase.
- Escola inativa passa a ser informada como tal na importação, em vez de "não encontrada".
- **Testes:** 35 de leitura e validação (`npm test`) e 52 de regras (`npm run test:regras`), todos passando; fluxo conferido na tela no emulador.

**Publicado em 14/10:** regras novas nos dois projetos (real e demonstração, conferidas por hash) e, depois, o código no GitHub. Também entrou a tela que explica uma conta sem perfil (com o UID e o botão Sair), em vez de "A carregar o seu perfil..." para sempre (achado T5 do [12](12-revisao-e-testes-das-regras.md)).

Detalhes em [14](14-importacao-de-planilhas.md).

---

## 14/10/2026 — Ambiente de demonstração (item 0.5)

- **Modo demonstração:** `npm run dev:demo` e `npm run build:demo` leem o arquivo `.env.demo` (fora do Git; modelo em `.env.demo.example`), que aponta para um segundo projeto Firebase gratuito.
- **Dados fictícios** em `src/demo/dadosDemo.js`: 8 escolas, 5 prestadores, 14 chamados, 46 contas, 28 ciclos, 8 compromissos e 9 currículos, com datas relativas ao dia da restauração.
- **Botão "Restaurar dados de demonstração"** na tela Segurança dos dados e **selo roxo fixo** em todas as telas. Ambos só existem no modo demonstração; o build do sistema real não os contém.
- **Regras:** novo documento `config/ambiente`, que o app não consegue gravar (só o console). O histórico só pode ser apagado onde esse documento existe com `demo: true`, ou seja, só na demonstração.
- **`firebase.json`** ganhou a seção de hospedagem, para publicar a demonstração gratuitamente no Firebase Hosting.
- **Testes:** 45 passando no emulador, incluindo a restauração completa.

**Feito no console (14/10):** projeto `gestao-escolar-demo` criado no plano Spark, login por e-mail/senha ativado, banco em São Paulo, regras publicadas, app web registrado e `config/ambiente` marcado como demonstração.

**Concluído em 14/10:** chave no `.env.demo`, primeiro administrador criado e restauração feita na tela (118 registros fictícios). O ambiente de demonstração está pronto ([13](13-ambiente-de-demonstracao.md)).

### Pendências antigas resolvidas em 14/10
- **Regras publicadas no projeto real** (`gestaoescolar-b84c2`), com o mesmo conteúdo de `firestore.rules` (conferido por hash). A versão anterior continua no histórico do console, caso seja preciso voltar.
- **Código enviado ao GitHub** (`git push`), depois das regras.
- **Chave de API restrita por site** no Google Cloud. Sites permitidos: `https://gestao-escolar-phi.vercel.app/*`, `https://gestaoescolar-b84c2.firebaseapp.com/*`, `https://gestaoescolar-b84c2.web.app/*` e `http://localhost:5173/*`. **Atenção:** se o sistema passar a ser aberto por outro endereço (domínio próprio, endereço de prévia da Vercel, outra porta local), o login falha até esse endereço ser incluído em *Google Cloud → APIs e serviços → Credenciais → Browser key*. O `.env` saiu do controle de versão no mesmo envio.

---

## Como testar
1. `npm run dev` na pasta do projeto.
2. Painel: o cartão "Contas a Enviar" deve mostrar **20** e o valor, com a linha vermelha de vencidas.
3. Tela de contas: filtro "Vencidas" deve trazer as 20; o botão verde de "Marcar como Enviada" deve aparecer em todas.
4. "Próximos Eventos" não deve mais listar datas passadas.
5. Entrar com uma conta de diretora e tentar abrir `/admin/contas` pela barra de endereço: deve voltar para a tela da diretora.
