# Controle de saldo

> Feito em 14/10/2026, a pedido: uma aba para controlar a verba de cada área (manutenção, brinquedos...), lançar o que foi gasto em cada mês e saber automaticamente quanto ainda dá para gastar, com o restante recalculado quando um mês passa do limite. Base: a planilha "Controle de Saldo — Horto Creche — 2026", em versão mais simples.
> Voltar ao índice: [README](README.md) · Relacionado: [14 Importação de planilhas](14-importacao-de-planilhas.md) · [17 Alertas](17-alertas.md)

## 1. Onde fica e quem vê

- Menu **Controle de saldo** (`/admin/saldo`), logo abaixo de Contas a pagar.
- **Só a administração.** RH e diretoras não veem nem pelo menu nem pelo banco (regras testadas).

## 2. A tela

> Simplificada em 15/10/2026: a primeira versão tinha 4 abas e uma tabela de 10 colunas, como a planilha, e ficou complicada para o dia a dia. A conta é a mesma.

**Entrada (resumo):**
- o mês, com setas ‹ › (começa no mês de hoje);
- um número grande: **quanto ainda dá para gastar no mês**, somando as áreas, e, em letra menor, quanto sobra da verba até o fim do período;
- **um cartão por área**:
  - "Ainda pode gastar em outubro: R$ X", em verde, amarelo ou vermelho;
  - a barra "Gastou R$ Y de R$ limite";
  - a situação, em palavras simples: Tudo certo, Quase no limite, Passou do limite do mês, A verba acabou ou Sem verba;
  - o botão **Lançar gasto** (com a área já escolhida) e o link **Ver gastos**;
- "Como o sistema calcula o limite de cada mês?", explicação que abre ao clicar;
- no pé, o link para **Configurar**.

**Ver gastos (uma área):** resumo da área (pode gastar, barra, verba, já gasto e sobra), lista dos gastos dela (editar e excluir) e, recolhido em "Ver mês a mês", a tabela com o gasto e o limite de cada mês. Em vermelho fica o mês que passou do limite.

> Segunda limpeza em 15/10/2026: cartões com menos linhas (saiu "sobra da verba" de cada cartão, que continua na página da área), letras maiores, "Configurar" saiu do alto e "Mês a mês" ficou recolhido. A conta não mudou.

**Botões no alto:** **Lançar gasto** e **Todos os gastos**.
- **Todos os gastos:** procurar (o que foi, loja, nota), filtrar por área e por mês, **Baixar em Excel** e **Trazer de uma planilha**;
- **Configurar (link no pé da tela):**
  - 1. quando a verba começa e quantos meses vale;
  - 2. as áreas, com a verba de cada uma (cadastrar, editar, excluir e importar).

Cada parte tem endereço próprio (`?ver=area&area=…`, `?ver=gastos`, `?ver=configurar`), então o botão Voltar do navegador funciona.

| Na planilha era | No sistema |
|---|---|
| Painel | Resumo (cartões por área) |
| Lançamentos + Extrato | Todos os gastos / Ver gastos de uma área |
| Mês a Mês | Tabela mês a mês dentro de cada área |
| Orçamento | Configurar |

## 3. Lançar um gasto

**Na frente:** área, o que foi comprado (opcional), valor, data e "Foi parcelado em N vezes".
**Em "Mais detalhes (opcional)":** loja ou fornecedor, nota fiscal, o mês em que o gasto conta e observação. Essa parte já vem aberta ao editar um gasto que tenha algo preenchido nela.

- **Parcelado:** o valor total é dividido igualmente, uma parcela por mês a partir do mês da 1ª parcela. Os centavos que sobram da divisão vão para a última parcela (igual à planilha).
- O mês em que o gasto conta segue a data, a menos que alguém o mude (para o caso de a nota ser de um mês e o vencimento de outro).
- **Antes de salvar**, a janela mostra:
  - como o gasto fica ("2x de R$ 500,00 (out/26 a nov/26)");
  - o efeito no mês: "Depois deste gasto, Manutenção ainda pode gastar R$ X em outubro".
  Se passar do limite, o aviso fica em vermelho e diz que dá para lançar mesmo assim.
- Parcelas que caem depois do fim do período só contam na próxima verba. A janela e o resumo avisam.
- Excluir manda para a lixeira (dá para restaurar em Segurança dos dados), e o saldo é refeito na hora.

## 4. A conta (a mesma da planilha)

- **Verba do período** = verba mensal × nº de meses do período.
- **Limite do mês** (na conta, "teto") = (verba do período − tudo o que caiu nos *outros* meses, inclusive parcelas já assumidas para os meses seguintes) ÷ meses que faltam, contando o mês escolhido. Nunca fica negativo.
- **Ainda pode gastar no mês** = teto do mês − gasto no mês.
- **Se um mês passa do teto, o teto dos meses seguintes diminui sozinho; se sobra, aumenta.** Ninguém precisa recalcular nada.
- **Situação:**
  - sem verba (verba zero);
  - verba estourada (o lançado passou da verba do período);
  - passou do teto do mês;
  - perto do teto (sobram até 20% do teto);
  - dentro do teto.
- No topo, **"Pode gastar em (mês)"** soma só o que sobra em cada área: a área que passou do teto não "desconta" das outras.
- O cálculo foi conferido contra a planilha real e bate centavo por centavo: totais, saldo, % usada, "pode gastar" do mês e o teto de cada área em cada mês.

## 5. Período e áreas

- **Período:** mês inicial + nº de meses (1 a 12). A planilha usa agosto a dezembro de 2026 (5 meses). Para um ano inteiro, 12 meses.
- **Áreas:** nome (com as 9 da planilha como sugestão, mas aceita qualquer outra) e verba. Dá para digitar a verba **mensal** ou a **do período**: um campo calcula o outro. Exemplo: "100 mil por ano" num período de 12 meses vira R$ 8.333,33 por mês.
- Área com lançamentos não pode ser excluída: o sistema pede para mudar a área desses lançamentos (ou excluí-los) antes. Renomear uma área não afeta os lançamentos.
- **Ao mudar o período**, todas as contas são refeitas. Lançamentos de fora do período continuam guardados; só deixam de contar.
- **(a confirmar)** Um período por vez, para o projeto inteiro (como na planilha, que é um arquivo por projeto). Se for preciso controlar vários projetos ou municípios separados, ou guardar o ano anterior lado a lado, o próximo passo é ter vários períodos.

## 6. Trazer a planilha atual

O assistente de importação reconhece as duas abas da planilha **sem nenhum ajuste**. Foi conferido na planilha real, sem gravar nada:

| O quê | Onde | Resultado na planilha real |
|---|---|---|
| Áreas e verbas | Aba "Áreas e verbas" → Importar planilha → escolher o arquivo (ele acha a aba "Orçamento") | 9 áreas prontas; a linha TOTAL e o texto de instrução ficam de fora, como deve ser |
| Gastos | Aba "Lançamentos" → Importar planilha → o mesmo arquivo (ele acha a aba "Lançamentos") | 15 lançamentos prontos, sem erro nem aviso |

**Ordem:** primeiro o período, depois as áreas e por último os gastos (cada gasto precisa achar a sua área pelo nome; um pedaço do nome também serve, com aviso, se apontar para uma área só).

A planilha real **não foi copiada** para o projeto nem para a demonstração: foi lida numa cópia temporária, depois apagada.

## 7. Alertas no Painel da administração

Só para o mês de hoje, e só se ele estiver dentro do período:
- **Verba estourada** em uma área: cobra atenção (entra no contador do menu);
- **Área que passou do teto do mês:** aviso (os próximos meses já se ajustam sozinhos).

O botão "Ver controle de saldo" abre a tela.

## 8. Demonstração

O ambiente de demonstração ganhou:
- um período de 12 meses que começou há 3 meses;
- as 9 áreas, com verbas inventadas;
- 17 gastos fictícios (fornecedores e notas inventados), alguns parcelados.

No mês atual, uma área passa do teto e outras ficam perto dele, para mostrar as cores e o alerta.

## 9. Arquivos

| Arquivo | O quê |
|---|---|
| `src/pages/admin/ControleDeSaldo.jsx` | A tela (resumo por área, gastos de uma área, todos os gastos, configurar, formulários, exportar e importar) |
| `src/utils/saldo.js` | A conta: meses do período, parcelas, teto, saldo e situação |
| `src/importacao/esquemas.js` | Importação de áreas (`rubricas`) e de gastos (`gastos`) |
| `src/utils/alertas.js` | Alertas de verba estourada e de teto do mês |
| `firestore.rules` | Coleções `rubricas` e `gastos` só da administração; o período fica em `config/saldo` |

## 10. Como verificar

- `npm test`: 85 testes, entre eles:
  - a conta com as mesmas regras da planilha (teto que diminui depois de um mês acima, verba estourada, perto do teto, parcelas fora do período, centavos na última parcela);
  - a importação com os mesmos títulos das abas Orçamento e Lançamentos;
  - os alertas e os dados da demonstração.
- `npm run test:regras`: 61 testes de regras no emulador, 3 novos (só a administração lê e grava; importar e desfazer).
- Na tela, no emulador local (14/10/2026):
  - lançamento parcelado com prévia e saldo recalculado na hora;
  - extrato por área, filtro por mês, Mês a mês, nova área com a verba digitada pelo período;
  - exclusão de área com lançamentos bloqueada; exclusão de gasto indo para a lixeira;
  - alerta no Painel;
  - celular sem rolagem lateral.
- Auditoria de acessibilidade (axe): sem violações nas quatro abas e nos dois formulários.
- Depois da simplificação (15/10/2026), no emulador: lançar à vista e parcelado com a prévia, excluir, todos os gastos, configurar e celular sem rolagem lateral; axe sem violações no resumo, na área e no formulário.
