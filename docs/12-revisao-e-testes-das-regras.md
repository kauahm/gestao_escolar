# Revisão e testes das regras do Firestore

> Revisão feita em 13/10/2026, lendo `firestore.rules` linha a linha contra o código de cada tela. Nada foi publicado nem executado contra o projeto real.
> Voltar ao índice: [README](README.md) · Relacionado: [09 Segurança](09-auditoria-de-seguranca-e-infraestrutura.md) · [10 Registro de alterações](10-registro-de-alteracoes.md)

## 1. Situação

- **Revisão por leitura: concluída.** Não encontrei nenhuma tela que as regras bloqueiem por engano, nem acesso indevido entre perfis.
- **Testes automatizados: 45 testes, todos passando** no emulador local (executados em 13/10/2026, com Java 21 portátil em `%USERPROFILE%\.local\java`).
- **Endurecimentos T1 e T2 aplicados** nas regras depois de os testes rodarem; T4 corrigido na tela de Usuários.

## 2. O que cada perfil lê e grava (código × regras)

| Coleção | Telas que usam | admin | administrativo (RH) | diretora |
|---|---|---|---|---|
| `usuarios` | Login (próprio perfil), Usuários, Segurança | lê e grava tudo; ninguém apaga | só o próprio perfil | só o próprio perfil |
| `escolas` | Escolas, Contas, Ciclos, Manutenções, Usuários | lê e grava | só lê | só lê |
| `manutencoes` | Manutenções, Painel, Agenda, Início da diretora | lê e grava | sem acesso | lê as da própria escola; cria só "Pendente" |
| `contas`, `ciclos` | Contas, Ciclos, Painel, Agenda, Início da diretora | lê e grava | sem acesso | lê as da própria escola |
| `prestadores` | Prestadores, Manutenções | lê e grava | sem acesso | sem acesso |
| `curriculos`, `candidatos` | Banco de Talentos, Processo Seletivo, Agenda, Painel | lê e grava | lê e grava | sem acesso |
| `eventos`, `config` | Agenda, Painel, Segurança | lê e grava | sem acesso | sem acesso |
| `historico` | Segurança (leitura); toda gravação registra uma linha | lê; acrescenta | só acrescenta | só acrescenta |
| `lixeira` | Segurança; toda exclusão | lê, cria, restaura | cria e lê só itens de currículos/candidatos | sem acesso |

As consultas da diretora usam `where('escolaId', '==', unidade)`, o que as regras exigem; sem esse filtro a consulta é negada.

## 3. Achados da revisão

Nenhum é brecha entre perfis. São endurecimentos e pontos de atenção. T1, T2 e T4 já foram resolvidos; os demais ficam registrados.

| # | Achado | Risco | Proposta |
|---|---|---|---|
| T1 | No chamado da diretora, `escolaNome`, `solicitadaPorNome` e `responsavel` não têm tipo nem tamanho validados, e `criadoEm` não é conferido com a hora do servidor | Baixo: ela pode gravar um nome falso ou texto grande nesses campos | ✅ **Feito:** exige `responsavel == 'A definir'`, nomes de até 200 caracteres e datas iguais à hora do servidor |
| T2 | `historico`: qualquer usuário ativo cria linhas com qualquer conteúdo e tamanho (só `porUid`, `acao` e `colecao` são conferidos) | Baixo: uma conta mal-intencionada poderia poluir o histórico | ✅ **Feito:** lista fechada de campos, hora do servidor, e-mail igual ao do login, limites de tamanho. O conteúdo de `antes`/`depois` continua sem limite |
| T3 | Admin pode apagar direto, sem passar pela lixeira, se usar outra ferramenta que não o app | Baixo: no app toda exclusão passa por `db.js` | Aceitar; as regras não conseguem amarrar a exclusão à cópia sem custo extra |
| T4 | Um admin pode desativar a si mesmo ou o último admin, ficando sem ninguém para reativar | Médio para o uso real | ✅ **Feito:** a tela de Usuários impede desativar a própria conta (o último admin ativo é sempre quem está logado). Pelo console do Firebase ainda é possível |
| T5 | Conta sem documento em `/usuarios` fica presa numa tela de carregamento eterna, em vez de ver uma mensagem | Baixo (experiência) | Tratar junto com os estados de erro (bloco C) |
| T6 | Cada operação lê o perfil do usuário (`get`), o que consome leituras da cota gratuita | Conhecido (R3 em [09](09-auditoria-de-seguranca-e-infraestrutura.md)) | *Custom claims*, depois da venda |

## 4. Testes

Arquivo: `tests/regras/firestore.rules.test.mjs`. Usa `@firebase/rules-unit-testing` e o executor de testes do próprio Node (sem biblioteca extra).

O que cobrem:
- visitante sem login, conta sem perfil e coleção desconhecida: tudo negado;
- usuário inativo bloqueado (diretora e admin), lendo apenas o próprio perfil;
- diretora só vê a própria escola (leitura direta e consultas);
- diretora não cria chamado com status diferente de "Pendente", em outra escola, em nome de outra pessoa, já atribuído, com data forjada, com campo desconhecido ou texto gigante; não altera nem apaga;
- `prestadores` só admin;
- `administrativo` só currículos e candidatos;
- ninguém se promove nem troca a própria escola; ninguém apaga usuário;
- histórico imutável (nem o admin altera ou apaga), sem data forjada, sem e-mail de outra pessoa e sem campo extra;
- lixeira e restauração, reproduzindo os lotes de `src/services/db.js`;
- uso normal do admin em todas as coleções;
- ambiente de demonstração ([13](13-ambiente-de-demonstracao.md)): ninguém marca o projeto como demonstração pelo app; sem a marca o histórico não pode ser apagado; a restauração completa roda de ponta a ponta com as regras ligadas e preserva os usuários.

### Como rodar
1. Ter Java 11 ou superior. Neste computador há um Java 21 portátil (Temurin, gratuito) em `%USERPROFILE%\.local\java`, que não está no PATH. No PowerShell, antes de rodar:
   `$env:JAVA_HOME = (Get-ChildItem "$env:USERPROFILE\.local\java" -Directory)[0].FullName; $env:PATH = "$env:JAVA_HOMEin;$env:PATH"`
2. Na pasta do projeto: `npm run test:regras`

O comando baixa a CLI do Firebase na primeira vez, sobe o emulador local e roda os testes. **Segurança:** usa o projeto fictício `demo-gestao-escolar` (prefixo `demo-`, que a CLI nunca conecta à nuvem), e o arquivo de teste se recusa a rodar se o emulador não estiver ativo. Não há como atingir o projeto real.
