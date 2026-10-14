# Textos em português do Brasil e estados de tela (vazio, erro, sem conexão)

> Feito em 14/10/2026 (item 0.6 do [roadmap](06-funcionalidades-e-roadmap.md); achados V1, V2, V3 e V10 da [auditoria visual](08-auditoria-visual-do-sistema-atual.md)). Só texto e estrutura: cores e acabamento ficam para o bloco de design.
> Voltar ao índice: [README](README.md) · Relacionado: [10 Registro de alterações](10-registro-de-alteracoes.md)

## 1. Português do Brasil

Trocados: "registados" → "cadastrados", "registos" → "registros", "Registo de Execução" (na O.S. impressa) → "Registro de Execução", "Casa de banho" → "banheiro" (dois formulários de chamado), "ficheiro" → texto novo sobre a O.S.

**Proteção para o futuro:** o teste `tests/interface/textos.test.mjs` (`npm test`) procura em todo o código palavras de Portugal (registo, ficheiro, utilizador, ecrã, telemóvel, palavra-passe, equipa, contacto, morada, "a carregar"...) e falha apontando arquivo e linha. Foi esse teste que achou o "Registo de Execução", que a revisão manual tinha deixado passar.

## 2. Um nome por tela (V1)

- Tabela única em `src/config/telas.js`. O **menu**, a **barra superior** e o **título da aba do navegador** ("Escolas · Gestão Escolar") leem dela.
- A barra superior deixou de repetir um título com outro nome ("Gestão de Escolas", "Ciclos Periódicos", "Agenda Escolar"...) e passou a mostrar o caminho: **Gestão Escolar › Escolas**.
- Títulos das páginas alinhados: "Controle de Ciclos" → "Ciclos", "Prestadores de Serviço" → "Prestadores", "Gerenciamento de Usuários" → "Usuários", "Dashboard" → "Painel".
- O perfil aparece em português no topo e no menu: **Administração**, **RH**, **Diretora** (antes: "admin", "administrativo").
- Um teste confere que toda rota do sistema tem nome na tabela.

## 3. Data e saudação (V2, V3)

- Data: "Terça-feira, 13 de outubro de 2026" (antes: "Terça-Feira, 13 De Outubro De 2026"). Ficou com a primeira letra maiúscula, por começar a linha; o resto em minúsculas, como se escreve em português.
- Saudação com o primeiro nome: "Boa tarde, Alessandra!".
- Valem para o painel da administração e o início da diretora.

## 4. Estados vazios que ensinam o próximo passo (V10)

O componente `EmptyState` passou a ter título, explicação e até dois botões, e cada tela distingue duas situações:

| Situação | Exemplo |
|---|---|
| **Ainda não há cadastros** | "Nenhuma escola cadastrada — Cadastre a primeira escola ou traga a lista que você já tem em Excel" + **Nova escola** e **Importar planilha** |
| **Nada com estes filtros** | "Nenhuma conta com estes filtros" + **Limpar filtros** |

Aplicado em Escolas, Contas a pagar, Ciclos, Manutenções, Prestadores, Usuários, Banco de Talentos e Processo seletivo (que aponta para o Banco de Talentos, onde se agenda a entrevista).

## 5. Quando os dados não chegam

Antes, se a leitura falhasse a tela ficava girando para sempre, sem explicação. Pior: **testando com o servidor desligado, a tela de contas dizia "Nenhuma conta registrada"**, porque o Firebase entrega uma lista vazia da memória quando não alcança o servidor. Para quem tem medo de perder dados, é o pior susto possível.

Agora:
- Todas as telas leem pelo `ouvir()` (`src/services/leitura.js`), no lugar do `onSnapshot` direto.
- **Lista vazia que não veio do servidor não é mostrada como "nada cadastrado"**: a tela continua carregando até o servidor confirmar.
- Um **aviso no alto da tela** (`AvisoDeConexao`) explica o que houve:

| Situação | Aviso |
|---|---|
| Computador sem internet | "Sem conexão com a internet... O que você salvar agora só é confirmado quando a conexão voltar: não feche esta página até lá." |
| Servidor não alcançado (por mais de 3 s) | "Sem conexão com o servidor... Nada foi apagado." + Tentar de novo |
| Sem permissão | "Sua conta não tem permissão para ver parte destes dados..." + Tentar de novo |
| Mais de 15 s sem resposta | "Está demorando mais que o normal para carregar. Verifique a internet." + Tentar de novo |

- Se, mesmo assim, uma lista aparecer vazia por falha, ela diz **"Os dados não carregaram — Nada foi apagado"** em vez de "nenhum cadastro".
- **No login:** sem conexão, a tela diz "Não foi possível carregar o seu perfil... Seus dados continuam guardados" (com Tentar de novo e Sair), em vez de "Não encontramos o perfil desta conta", que fica só para quando o perfil realmente não existe.

## 6. Como foi verificado

- `npm test`: 42 testes (35 da importação + 7 de textos, data, saudação e nomes das telas).
- Na tela, no emulador local (14/10/2026): painel (barra, data, primeiro nome, aba do navegador); Prestadores com busca sem resultado e sem nenhum cadastro; aviso de "sem internet" aparecendo e sumindo; emulador desligado com a tela aberta (tela carregando + aviso, sem "nenhum ciclo"); emulador religado (o sistema reconectou sozinho e, como o banco voltou zerado, mostrou corretamente o aviso de sem permissão); falta de permissão ao abrir Contas ("Os dados não carregaram"); login com o servidor fora do ar.
- Não conferido na tela: o início da diretora (as mudanças lá são só a data e a saudação, com o mesmo código do painel testado).

## 7. Fica para depois
- Os cartões do painel ainda usam maiúsculas em cada palavra ("Contas a Enviar", "Entrevistas este Mês"): entra no bloco de design.
- O item "Solicitar Manutenção" do menu da diretora leva a um endereço que não existe e volta para o início (já anotado no [01](01-entendimento-do-projeto.md)); entra no bloco D, com a tela de detalhe do chamado.
- (Resolvido no mesmo dia: os totais no topo de Contas só aparecem com os dados confirmados pelo servidor, nunca "R$ 0,00" por falha de leitura.)
