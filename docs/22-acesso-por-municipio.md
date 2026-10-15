# Acesso por município (login da sede e administração de cada município)

> Feito em 14/10/2026, a pedido: um login "master" da sede que, ao entrar, vê os municípios e, escolhendo um, tem o acesso da administração dele; e logins de administração separados por município (Hortolândia, Indaiatuba...), com a melhor estrutura para ninguém ter acesso a outra escola.
> Voltar ao índice: [README](README.md) · Relacionado: [21 Visão da sede](21-visao-da-sede.md) · [12 Regras e testes](12-revisao-e-testes-das-regras.md)

## 1. Perfis

| Perfil | Ao entrar | O que vê e faz |
|---|---|---|
| **Sede** (novo) | Visão da sede (todos os municípios) | Escolhe um município com **Entrar** e trabalha como a administração dele. Dentro do município, o menu é igual ao da administração (sem a Visão da sede); para voltar à lista, o botão "Hortolândia · Trocar" no topo. Cadastra municípios e contratos e cria a administração de cada município. |
| **Administração do município** | Painel do município | Tudo do sistema, **só do próprio município**. Cria diretoras e RH do próprio município. Não cria outro administrador e não vê a Visão da sede. |
| **RH** | Funcionários | Funcionários, Banco de Talentos e Processo seletivo, **só do próprio município**. |
| **Diretora** | Início | Como antes: só a própria escola. |

Decisões de 14/10/2026: um RH por município; prestadores de cada município (o mesmo fornecedor em dois municípios é cadastrado nos dois).

## 2. Como a proteção funciona

1. **Todo registro carrega o município** (campo `municipioId`). Isso vale para escolas, chamados, contas, ciclos, prestadores, agenda, currículos, candidatos, funcionários, controle de saldo, contratos, usuários, histórico, lixeira e importações.
2. **O perfil de cada pessoa diz o município dela.** As regras do banco (`firestore.rules`) conferem um contra o outro em **toda** leitura e gravação:
   - consulta que não diga "só do meu município" é recusada, porque tentaria ler todos;
   - registro de outro município não pode ser lido, criado, alterado nem apagado;
   - **ninguém muda um registro de município**, a não ser a sede;
   - a administração não cria administrador nem sede, não promove ninguém e não passa ninguém para outro município.
3. **No app**, as telas pedem os dados por uma função só, que já filtra pelo município ativo (`services/consulta.js`). A camada de gravação (`services/db.js`) carimba o município em tudo o que é criado. A sede, ao trocar de município, recarrega a área inteira, e cada tela volta a ler o novo município.
4. Configurações do município (data da cópia de segurança, período do controle de saldo) e os alertas adiados ficam **dentro do município** (`municipios/{id}/config` e `municipios/{id}/alertasAdiados`).
5. **Custo zero.** O perfil é lido pelas regras. O caminho "de livro", com *custom claims*, exigiria Cloud Functions (plano Blaze) e fica para depois da venda.

**Testado no emulador** (`npm run test:regras`, 72 testes), num cenário com dois municípios. Para cada perfil, os testes provam que:
- ele lê e grava no próprio município;
- ele não lê nem grava **nada** do outro (coleção por coleção, documento por documento);
- consultas sem filtro são recusadas;
- não dá para "mudar" um registro de município nem plantar dados no outro.

## 3. Cópia de segurança, lixeira e histórico

- Cada município tem a sua cópia de segurança, a sua lixeira e o seu histórico (tela Segurança dos dados).
- A sede vê os de cada município ao entrar nele.
- "Restaurar dados de demonstração" apaga todos os municípios, por isso só aparece para a sede.

## 4. Dados que já existem (antes da divisão)

O que foi cadastrado antes não tem município. Até ser organizado, **só a sede vê** esses registros. Em **Visão da sede → Municípios e contratos → Dados antigos**:
1. **Procurar** mostra quantos registros de cada tipo estão sem município.
2. **Atribuir tudo a** um município faz três coisas:
   - acrescenta o município a cada registro, sem mudar mais nada;
   - leva as configurações antigas para dentro do município;
   - descarta os alertas adiados antigos (eram só preferência de exibição).

Uma linha no histórico registra a operação. Nas regras, a sede só pode **acrescentar** o município em registro antigo: o histórico e a lixeira continuam sem poder ser alterados de outra forma.

## 5. Publicação no sistema real (passo a passo)

O código novo não funciona com as regras antigas, e vice-versa. Por isso tudo vai junto, num momento combinado, de preferência fora do horário de uso. A administração de Hortolândia fica sem ver os dados só entre os passos 3 e 4, alguns minutos.

1. **Você** cria a conta da sede no Firebase: Authentication → Adicionar usuário, com um e-mail novo e senha. Me diga só o e-mail.
2. **Eu** crio o perfil dessa conta (`usuarios/{uid}` com perfil `sede`) pelo console.
3. **Eu** publico as regras novas e o índice do histórico, e envio o código. Confiro tudo por hash e na Vercel.
4. **Você** entra com a conta da sede, cadastra o município (Hortolândia) e, em Dados antigos, atribui tudo a Hortolândia. Se preferir, eu faço esse passo depois que você entrar.
5. A administração de Hortolândia entra normalmente e vê tudo como antes.

**Demonstração:** a conta de administração da demonstração vira **sede** (eu ajusto pelo console). Depois disso, basta "Restaurar dados de demonstração" e atribuir os dados antigos (as contas de diretora) a Hortolândia.

## 6. Modo emulador (teste local)

`npm run emulador:dados` cria 5 contas de teste (senha no próprio script):

| Conta | Perfil |
|---|---|
| `sede@demo.test` | sede |
| `admin@demo.test` | administração de Hortolândia |
| `admin.jaguariuna@demo.test` | administração de Jaguariúna |
| `diretora@demo.test` | diretora (Hortolândia) |
| `rh@demo.test` | RH (Hortolândia) |

Na tela, no emulador (14/10/2026), foram conferidos:
- a sede entra na lista de municípios, entra em Jaguariúna, vê só os dados de lá em todas as telas e grava;
- "Trocar" volta à lista;
- a administração de Hortolândia vê só as 4 escolas e a equipe de lá, cria apenas diretora e RH, e é mandada de volta ao painel se tentar abrir a Visão da sede;
- a diretora abre chamado;
- o RH vê só os funcionários de Hortolândia;
- nenhuma tela teve leitura recusada.

## 7. Ficou para depois

- Perfil de **coordenação regional** (vários municípios, sem ser a sede): o modelo já comporta, falta a tela.
- Sede com acesso só de leitura (ver sem poder alterar).
- *Custom claims* e verificação em duas etapas para a sede (exigem o plano Blaze).
- Relatório consolidado de todos os municípios (hoje a sede vê o semáforo de todos e os detalhes entrando em cada um).

## 8. Arquivos

| Arquivo | O quê |
|---|---|
| `firestore.rules` | Regras por município (perfis sede, admin, administrativo, diretora) |
| `firestore.indexes.json` | Índice do histórico por município (município + data) |
| `src/services/escopo.js` | Município ativo e coleções que pertencem a um município |
| `src/services/consulta.js` | Consultas já filtradas pelo município ativo |
| `src/services/db.js` | Carimba o município no que é criado, no histórico e na lixeira |
| `src/services/dadosAntigos.js` | Procurar e atribuir dados antigos |
| `src/contexts/AuthContext.jsx` | Município ativo pelo perfil; escolha da sede |
| `src/pages/admin/VisaoDaSede.jsx` | Entrar no município, contratos por município, dados antigos |
| `tests/regras/firestore.rules.test.mjs` | 72 testes, com dois municípios |
