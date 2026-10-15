# Visão da sede

> Feita em 14/10/2026 (itens 1.2 e 1.3 do [roadmap](06-funcionalidades-e-roadmap.md)): um nível acima da escola, **Município → Contrato → Escola**, e um painel com semáforo por município, para quem decide na sede ver tudo numa tela.
> Voltar ao índice: [README](README.md) · Relacionado: [02 A AEMC](02-associacao-aemc.md) · [17 Alertas](17-alertas.md)

## 1. Onde fica e quem vê

> **Atualizado com [22](22-acesso-por-municipio.md):** a Visão da sede passou a ser a tela inicial do perfil **Sede**, a única que a vê. Cada cartão de município tem o botão **Entrar**, e as escolas pertencem ao município pelo próprio cadastro. A administração de cada município vê só o seu.

- Menu **Visão da sede** (`/admin/sede`), logo abaixo do Painel. Só a administração.
- **(a confirmar)** Um perfil próprio para a sede (vê todos os municípios, sem poder alterar) e um para coordenação regional (vê só os seus municípios). Fica para quando a sede for usar de verdade.

## 2. Como os dados se ligam

- **Município:** nome e UF. Os 16 municípios com contrato ativo no portal de transparência da AEMC aparecem como sugestão, e a UF é preenchida sozinha.
- **Contrato (termo de colaboração):**
  - obrigatórios: município e número;
  - opcionais: objeto (com sugestões, como educação infantil, apoio escolar, escola integral e educação inclusiva), início e fim da vigência, valor global e observação.
- **Escola:** passa a apontar para o contrato que a atende. **Cada escola fica em um contrato só.** A ligação é feita no próprio contrato: uma lista de escolas para marcar. Marcar uma escola que estava em outro contrato a muda de contrato, e o formulário avisa ("hoje em: Hortolândia · nº 901/2024").
- O município de cada escola vem do contrato. Por isso, trocar o contrato de uma escola já muda o município dela em todas as telas.
- **Proteções:**
  - município com contratos não pode ser excluído;
  - contrato com escolas ligadas também não (antes é preciso desmarcar as escolas);
  - tudo o que é excluído vai para a lixeira, e cada mudança entra no histórico.

## 3. Painel por município

- **No topo:** municípios atendidos (com contrato vigente), contratos vigentes, escolas ativas, alunos e funcionários.
- **Um cartão por município**, do mais grave para o menos grave, com:
  - o semáforo;
  - os contratos, cada um com a vigência ("Vigente", "Vence em 60 dias", "Encerrado");
  - os números do município: escolas, alunos, funcionários, chamados abertos, contas vencidas (em R$) e ciclos vencidos;
  - quantas pendências são críticas e quantas são de atenção.
- **"Ver escolas"** abre a visão por unidade, com o semáforo de cada escola e os mesmos números.
- **Escolas ainda sem contrato** aparecem num cartão à parte, com o atalho "Ligar a um contrato".

### O semáforo

São as **mesmas regras do quadro "Precisa de atenção hoje"** ([17](17-alertas.md)), aplicadas escola por escola:
- **Crítico:** a escola tem algo crítico. Exemplos: prazo de chamado estourado, conta vencida sem envio, ciclo vencido sem chamado, chamado urgente parado.
- **Atenção:** a escola tem algo que pede atenção. Exemplos: chamado parado há mais de 7 dias, ASO vencido, conta vencendo amanhã.
- **Em dia:** nenhuma das duas situações.
- **No município, vale o pior caso entre as escolas.** Um contrato vencendo em até 30 dias, ou vencido com escolas ainda ligadas, também deixa o município em atenção.
- Escolas inativas não entram no semáforo nem nos totais de escolas e alunos.

## 4. Outras mudanças

- **Escolas:** cada cartão mostra o município, e há um filtro por município (inclusive "Sem contrato").
- **Alertas** no Painel da administração:
  - contrato que vence em até 90 dias: aviso (atenção a partir de 30 dias);
  - contrato vencido com escolas ativas ainda ligadas: atenção.

  O botão "Ver contratos" abre a lista.
- **Cópia de segurança** com as abas Municípios e Contratos.

## 5. Demonstração

O ambiente de demonstração ganhou 4 municípios com contratos **fictícios** (números inventados, marcados "(fictício)"):

| Município | Contrato | Escolas |
|---|---|---|
| Hortolândia | vigente | 4 escolas |
| Jaguariúna | vence em 60 dias (gera o aviso) | 2 escolas |
| Indaiatuba | vigente | 2 escolas (uma inativa) |
| Sorocaba | encerrado | nenhuma escola |

## 6. O que depende de você

1. Cadastrar os municípios e os contratos reais (número, vigência e, se quiser, o valor) e marcar as escolas de cada contrato. Hoje, no sistema real, todas as escolas são de Hortolândia: basta um município e um contrato.
2. **(a confirmar)** Se cada município tiver mais de um contrato ao mesmo tempo (por exemplo, creches e apoio escolar), funciona como está: cada escola fica no contrato que a atende.

## 7. Próximos passos naturais

- **Relatório mensal de prestação de contas por contrato** (item 1.4): as contas e os gastos já são por escola, e a escola já sabe o seu contrato.
- **Controle de saldo por contrato:** hoje o controle de saldo ([20](20-controle-de-saldo.md)) é um só para o projeto inteiro. Com os contratos cadastrados, cada contrato pode ter as suas verbas.
- Perfis da sede e da coordenação regional (seção 1).

## 8. Arquivos

| Arquivo | O quê |
|---|---|
| `src/pages/admin/VisaoDaSede.jsx` | A tela: painel por município, visão por escola, cadastro de municípios e contratos |
| `src/utils/sede.js` | Semáforo e números por escola e por município |
| `src/utils/contratos.js` | Situação do contrato pela vigência |
| `src/utils/alertas.js` | Alertas de contrato vencendo ou vencido |
| `firestore.rules` | Coleções `municipios` e `contratos`, só da administração |

## 9. Como verificar

- `npm test`: 90 testes, entre eles:
  - a vigência do contrato (90 e 30 dias, encerrado, ainda não começou);
  - o semáforo, em que o pior caso decide a cor e o contrato no fim pede atenção;
  - os totais, as escolas inativas e as escolas sem contrato;
  - os alertas de contrato e os dados da demonstração.
- `npm run test:regras`: 63 testes de regras no emulador. Os 2 novos garantem que só a administração lê e grava, e que a diretora não consegue mudar o contrato da própria escola.
- Na tela, no emulador local (14/10/2026):
  - painel com os 4 municípios e a visão por escola;
  - novo município com UF automática e contrato com fim antes do início recusado;
  - escola mudando de contrato, com o aviso "hoje em";
  - exclusões bloqueadas quando há vínculo;
  - filtro por município em Escolas e alerta de contrato no Painel;
  - celular sem rolagem lateral.
- Auditoria de acessibilidade (axe): sem violações no painel, na visão por escola, na lista de contratos e nos dois formulários.
