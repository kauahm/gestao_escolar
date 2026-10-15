# Controle de saldo

> Feito em 14/10/2026, a pedido: uma aba para controlar a verba de cada área (manutenção, brinquedos...), lançar o que foi gasto em cada mês e saber automaticamente quanto ainda dá para gastar, com o restante recalculado quando um mês passa do limite. Base: a planilha "Controle de Saldo — Horto Creche — 2026", em versão mais simples.
> Voltar ao índice: [README](README.md) · Relacionado: [14 Importação de planilhas](14-importacao-de-planilhas.md) · [17 Alertas](17-alertas.md)

## 1. Onde fica e quem vê

- Menu **Controle de saldo** (`/admin/saldo`), logo abaixo de Contas a pagar.
- **Só a administração.** RH e diretoras não veem nem pelo menu nem pelo banco (regras testadas).

## 2. As quatro abas da tela

| Aba | Para quê | Na planilha era |
|---|---|---|
| **Painel** | Escolhe o mês e mostra: verba do período, já lançado, saldo, % usada e "pode gastar neste mês". Para cada área: teto do mês, gasto no mês, quanto ainda pode gastar e a situação (dentro, perto do teto, passou do teto, verba estourada) | Painel |
| **Lançamentos** | Lista de gastos com busca (fornecedor, nota, descrição) e filtros por área e por mês. Clicar numa área no Painel abre a lista dela (o antigo "Extrato"). Exportar e importar Excel | Lançamentos + Extrato |
| **Mês a mês** | Grade área × mês com o que caiu em cada mês e o teto daquele mês; em vermelho, o mês que passou do teto | Mês a Mês |
| **Áreas e verbas** | O período (mês inicial e nº de meses) e as áreas com a verba mensal. Cadastrar, editar, excluir e importar | Orçamento |

O que saiu por ser complicação da planilha: as abas Início e Apoio, as colunas automáticas da lista (agora o sistema calcula sozinho) e a proteção de células.

## 3. Lançar um gasto

Campos: **área**, **valor total**, **data do gasto** e **mês em que conta** (obrigatórios); fornecedor, nota fiscal, descrição e observação (opcionais).

- **Compra parcelada:** marca "Compra parcelada" e informa o nº de parcelas. O valor total é dividido igualmente, uma parcela por mês a partir do mês da 1ª parcela. Os centavos que sobram da divisão vão para a última parcela (igual à planilha).
- O mês em que o gasto conta segue a data do gasto até que alguém o mude (para o caso de a nota ser de um mês e o vencimento de outro).
- **Antes de salvar**, a janela mostra como o gasto fica ("3x de R$ 3.000,00, de out/26 a dez/26") e o efeito no saldo: "Depois deste gasto, Manutenção ainda pode gastar R$ X em outubro". Se passar do teto ou estourar a verba, avisa em vermelho.
- Parcelas que caem depois do fim do período não entram na conta. A janela avisa, e o Painel mostra o total delas em amarelo.
- Excluir manda para a lixeira (dá para restaurar em Segurança dos dados), e o saldo é refeito na hora.

## 4. A conta (a mesma da planilha)

- **Verba do período** = verba mensal × nº de meses do período.
- **Teto do mês** = (verba do período − tudo o que caiu nos *outros* meses, inclusive parcelas já assumidas para os meses seguintes) ÷ meses que faltam, contando o mês escolhido. Nunca fica negativo.
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
| `src/pages/admin/ControleDeSaldo.jsx` | A tela (4 abas, formulários de gasto e de área, exportar e importar) |
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
