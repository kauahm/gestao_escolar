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

## 14/10/2026 — Ambiente de demonstração (item 0.5)

- **Modo demonstração:** `npm run dev:demo` e `npm run build:demo` leem o arquivo `.env.demo` (fora do Git; modelo em `.env.demo.example`), que aponta para um segundo projeto Firebase gratuito.
- **Dados fictícios** em `src/demo/dadosDemo.js`: 8 escolas, 5 prestadores, 14 chamados, 46 contas, 28 ciclos, 8 compromissos e 9 currículos, com datas relativas ao dia da restauração.
- **Botão "Restaurar dados de demonstração"** na tela Segurança dos dados e **selo roxo fixo** em todas as telas. Ambos só existem no modo demonstração; o build do sistema real não os contém.
- **Regras:** novo documento `config/ambiente`, que o app não consegue gravar (só o console). O histórico só pode ser apagado onde esse documento existe com `demo: true`, ou seja, só na demonstração.
- **`firebase.json`** ganhou a seção de hospedagem, para publicar a demonstração gratuitamente no Firebase Hosting.
- **Testes:** 45 passando no emulador, incluindo a restauração completa.

**Falta fazer (você, uma vez):** criar o projeto de demonstração, seguindo o passo a passo de [13](13-ambiente-de-demonstracao.md).

---

## Como testar
1. `npm run dev` na pasta do projeto.
2. Painel: o cartão "Contas a Enviar" deve mostrar **20** e o valor, com a linha vermelha de vencidas.
3. Tela de contas: filtro "Vencidas" deve trazer as 20; o botão verde de "Marcar como Enviada" deve aparecer em todas.
4. "Próximos Eventos" não deve mais listar datas passadas.
5. Entrar com uma conta de diretora e tentar abrir `/admin/contas` pela barra de endereço: deve voltar para a tela da diretora.
