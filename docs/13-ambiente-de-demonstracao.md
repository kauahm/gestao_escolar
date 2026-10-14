# Ambiente de demonstração

> Criado em 14/10/2026 (item 0.5 do [roadmap](06-funcionalidades-e-roadmap.md)). Custo zero: usa um segundo projeto Firebase no plano gratuito (Spark).
> Voltar ao índice: [README](README.md) · Relacionado: [10 Registro de alterações](10-registro-de-alteracoes.md) · [12 Testes das regras](12-revisao-e-testes-das-regras.md)

## 1. O que é

Um **segundo projeto Firebase**, separado do real, que só contém **dados fictícios**. Serve para apresentar o sistema à sede sem expor nada de verdade, e para testar à vontade.

- O mesmo código roda nos dois ambientes; o que muda é o arquivo de configuração (`.env` = real, `.env.demo` = demonstração).
- No ambiente de demonstração aparece um selo roxo fixo: **"Ambiente de demonstração · dados fictícios"**.
- Na tela **Segurança dos dados** aparece o botão **"Restaurar dados de demonstração"**, que apaga tudo e grava de novo os dados de exemplo. As contas de usuário são mantidas.
- No build do sistema real, o selo, o botão e os dados fictícios **não existem** (conferido: o texto não aparece nos arquivos gerados por `npm run build`).

## 2. O que vem nos dados fictícios

Tudo inventado (escolas, pessoas, telefones, e-mails `@exemplo.org`, valores). As datas são calculadas a partir do dia em que se restaura, então a demonstração sempre parece viva.

| Módulo | Conteúdo |
|---|---|
| Escolas | 8 unidades em bairros de Hortolândia (7 ativas, 1 inativa) |
| Prestadores | 5 (1 interno, 4 terceirizados) |
| Manutenções | 14 chamados: pendentes (alguns parados há mais de 5 dias, para o alerta aparecer), em andamento (um com prazo estourado) e concluídos |
| Contas | 46: energia e água de 3 meses por escola, mais taxa de limpeza e notas de serviço; há enviadas, vencidas e a vencer nos próximos dias |
| Ciclos | 28 (4 por escola ativa): a maioria em dia, alguns vencendo e alguns vencidos |
| Agenda | 8 compromissos, quase todos nos próximos 15 dias |
| Currículos | 9: disponíveis, com entrevista agendada, aprovado e reprovado com feedback |

Fonte: `src/demo/dadosDemo.js`. Para mudar os exemplos, edite esse arquivo e restaure.

**Dica:** restaure os dados **no dia da apresentação**, para as datas ficarem alinhadas.

## 3. Travas que impedem misturar com o sistema real

Para a restauração apagar alguma coisa, **todas** precisam passar:

1. **O botão só existe no modo demonstração** (`VITE_AMBIENTE=demo` no `.env.demo`).
2. **O modo demonstração não liga se a configuração apontar para o projeto real** (`gestaoescolar-b84c2`). Nesse caso aparece um aviso vermelho na tela.
3. **A função confere o identificador do projeto** e se recusa no real.
4. **A função exige o documento `config/ambiente` com `demo: true`.** Esse documento só pode ser criado à mão no console do Firebase: as regras proíbem o app de gravá-lo, mesmo para o admin. No projeto real ele não existe.
5. **As regras só deixam apagar o histórico quando esse documento existe.** No sistema real o histórico continua impossível de apagar.

As travas 4 e 5 e a restauração completa estão cobertas por testes automatizados ([12](12-revisao-e-testes-das-regras.md)).

## 4. Passo a passo para criar o projeto

**Situação em 14/10/2026: ambiente pronto e conferido.** O projeto `gestao-escolar-demo` foi criado no plano Spark (sem Gemini e sem Analytics), todos os passos abaixo foram concluídos e a restauração foi feita na tela, gravando os 118 registros fictícios esperados. Falta apenas o passo 10 (diretora e RH de demonstração), se ainda não tiver sido feito.

O roteiro completo fica abaixo como referência. Nada aqui pede cartão de crédito.

1. **Criar o projeto.** Em console.firebase.google.com → *Adicionar projeto*. Nome sugerido: `gestao-escolar-demo`. Pode desligar o Google Analytics. Confira que o plano é **Spark (gratuito)**.
2. **Ligar o login.** *Authentication* → *Vamos começar* → *E-mail/senha* → ativar.
3. **Criar o banco.** *Firestore Database* → *Criar banco de dados* → local `southamerica-east1` (São Paulo) → modo de produção.
4. **Registrar o app web.** Engrenagem → *Configurações do projeto* → *Seus apps* → ícone `</>`. O console mostra um bloco `firebaseConfig`.
5. **Criar o `.env.demo`.** Na pasta do projeto, copie `.env.demo.example` para `.env.demo` e preencha as seis linhas `VITE_FIREBASE_*` com os valores do `firebaseConfig`. Mantenha `VITE_AMBIENTE=demo`. Esse arquivo não vai para o Git.
6. **Publicar as regras no projeto de demonstração** (troque pelo identificador que o console mostrar):
   `npx -y firebase-tools@13 deploy --only firestore:rules --project gestao-escolar-demo`
7. **Criar o primeiro administrador.**
   - *Authentication* → *Usuários* → *Adicionar usuário* (e-mail e senha de demonstração). Copie o **UID** que aparece na lista.
   - *Firestore* → *Iniciar coleção* `usuarios` → ID do documento = o UID copiado → campos: `uid` (texto, o mesmo UID), `nome` (texto), `email` (texto), `perfil` = `admin`, `situacao` = `ativa`.
8. **Marcar o projeto como demonstração.** *Firestore* → coleção `config` → documento com ID `ambiente` → campo `demo` do tipo **booleano** = `true`.
9. **Rodar e carregar os dados.** Na pasta do projeto: `npm run dev:demo`. Entre com o administrador, abra **Segurança dos dados** e clique em **Restaurar dados de demonstração**.
10. **Criar a diretora e o RH de demonstração.** Na tela **Usuários**, crie uma diretora ligada a uma das escolas (por exemplo, CEI Pequenos Passos) e um usuário administrativo. Eles sobrevivem às restaurações.

### Publicar a demonstração na internet (opcional, gratuito)
O Firebase Hosting funciona no plano Spark e mantém a demonstração num endereço separado do sistema real:

1. `npm run build:demo`
2. `npx -y firebase-tools@13 deploy --only hosting --project gestao-escolar-demo`

O endereço fica no formato `https://gestao-escolar-demo.web.app`. **Atenção:** rode sempre o `build:demo` imediatamente antes, para não publicar por engano o build do sistema real nesse endereço. O contrário (demonstração no endereço real) não acontece por este caminho, porque o sistema real é publicado pela Vercel (a confirmar).

## 5. Uso no dia a dia

| Para | Comando |
|---|---|
| Abrir o sistema real no computador | `npm run dev` |
| Abrir a demonstração no computador | `npm run dev:demo` |
| Gerar o build do sistema real | `npm run build` |
| Gerar o build da demonstração | `npm run build:demo` |

## 6. Limites e pontos a confirmar

- A restauração foi conferida na tela em 14/10/2026, contra o projeto real de demonstração: 118 registros fictícios gravados, lixeira e histórico zerados.
- A restauração apaga e grava cerca de 120 registros por vez, bem abaixo da cota diária gratuita (20 mil gravações e 20 mil exclusões por dia, **a confirmar** os valores atuais na página de preços do Firebase).
- Fotos de chamados e anexos não fazem parte da demonstração: dependem do Storage, que exige o plano pago ([06](06-funcionalidades-e-roadmap.md), "Pendente para depois da venda").
- O login de demonstração usa senha comum; não use nele nenhuma senha que você usa em outro lugar.
