# Funcionários

> Feito em 14/10/2026, a pedido: uma aba de funcionários com a mesma estrutura da planilha "Colaboradores" que a AEMC já usa, com filtros e informações, só os campos principais obrigatórios e os cargos já sugeridos (mas com liberdade para digitar outro).
> Voltar ao índice: [README](README.md) · Relacionado: [14 Importação de planilhas](14-importacao-de-planilhas.md) · [17 Alertas](17-alertas.md) · [07 LGPD](07-requisitos-legais-e-tecnicos.md)

## 1. Onde fica e quem vê

- Menu **Funcionários** (`/admin/funcionarios`), para a **administração** e para o **RH** (perfil administrativo). Para o RH, passa a ser a primeira tela ao entrar.
- **A diretora não vê.** O cadastro tem CPF, salário e afastamentos por doença, que a LGPD trata como dado pessoal e, no caso da saúde, **dado sensível**. As regras do banco barram a leitura para qualquer outro perfil, não só o menu.

## 2. Estrutura (a mesma da planilha)

A planilha de exemplo tem 20 colunas, na ordem abaixo. A tela guarda todas e acrescenta "Observações".

| Coluna da planilha | Na tela | Obrigatório |
|---|---|---|
| Situação | Ativa / Inativa (desligado) | **Sim** (vem "Ativa") |
| Unidade | Escola, escolhida da lista de escolas | **Sim** |
| Colaborador | Nome completo | **Sim** |
| Descrição do cargo | Cargo: lista de sugestões ou texto livre | **Sim** |
| Data de nasc. | Data de nascimento (o detalhe mostra a idade) | |
| PCD | Caixa "Pessoa com deficiência" | |
| Admissão, Salário | Seção "Contrato" | |
| CPF, RG, PIS, Fone, Endereço, Cidade | Seção "Documentos e contato" | |
| Data último ASO, Data venc. ASO | Seção "Saúde ocupacional (ASO)" | |
| Data início afast., Data retorno afast., Tipo de afastamento | Seção "Afastamento" | |
| Data de rescisão | Aparece quando a situação é "Inativa" (aí passa a ser obrigatória) | |

**Cargos sugeridos** (os da planilha, com o nome completo; na planilha eles vêm cortados, como "AGENTE DE DESENVOLVIMENTO INFA"):
Agente de Desenvolvimento Infantil · Professor(a) de Educação Infantil · Professor(a) de Educação Especial · Auxiliar de Serviços Gerais · Auxiliar Administrativo · Assistente Administrativo · Coordenador(a) Pedagógico(a) · Diretor(a) Educacional · Psicólogo(a) · Assistente Social · Zelador(a) · Menor Aprendiz.

O campo de cargo mostra essa lista enquanto se digita, mas aceita qualquer texto. Um cargo novo (ex.: "Cozinheira") passa a aparecer nas sugestões e no filtro. Escritas diferentes do mesmo cargo são unificadas: "DIRETORA EDUCACIONAL", "Diretor Educacional" e "diretor(a) educacional" viram "Diretor(a) Educacional".

## 3. O que a tela faz

- **Cabeçalho com os números:** ativos, inativos, PCD e afastados.
- **Filtros:** busca por nome ou CPF (bastam 3 dígitos), unidade, cargo e situação (começa em "Ativos"), e os atalhos **PCD**, **Afastados** e **ASO vencido ou vencendo**, cada um com a contagem.
- **Lista:** nome e cargo, unidade, selos (Ativa/Inativa, Afastado(a), PCD, ASO vencido, ASO vencendo em N dias), admissão e telefone. No celular, a unidade vai para baixo do nome.
- **Detalhe:** todos os dados, com faixa de aviso para afastamento (desde quando, retorno previsto, tipo) e para ASO vencido ou perto de vencer.
- **Formulário em seções**, com:
  - CPF, PIS e telefone formatados sozinhos ao sair do campo;
  - **CPF conferido pelos dígitos verificadores** e **CPF repetido barrado** ("Este CPF já está no cadastro (nome)"). CPF que já veio errado da planilha não trava a edição dos outros campos;
  - ao informar o **último ASO**, o vencimento é sugerido para um ano depois (dá para mudar);
  - retorno de afastamento antes do início é recusado.
- **Exportar Excel:** baixa o que está filtrado, com as colunas na mesma ordem da planilha original.
- **Importar planilha:** o mesmo assistente dos outros módulos ([14](14-importacao-de-planilhas.md)).
- **Excluir** manda para a lixeira (a administração restaura em Segurança dos dados). Para quem saiu da escola, o certo é marcar "Inativa" com a data de rescisão; a confirmação de exclusão lembra disso.
- Toda criação, alteração e exclusão entra no histórico de alterações.

## 4. Afastamento e ASO: como o sistema calcula

- **Afastado(a):** ativo, com início de afastamento até hoje e sem retorno, ou com retorno depois de hoje. No dia do retorno, deixa de aparecer como afastado.
- **ASO vencido:** data de vencimento já passou. **ASO vencendo:** vence nos próximos **30 dias**. Inativos não contam.
- **No Painel da administração** (não no da diretora), dois alertas agrupados, para não afogar o quadro quando houver centenas de pessoas:
  - "N ASOs vencidos" (cobra atenção e entra no contador do menu), com os primeiros nomes do mais atrasado para o menos;
  - "N ASOs vencem nos próximos 30 dias" (aviso).
  - O botão "Ver funcionários" abre a lista já filtrada.
- **(a confirmar)** A sugestão de vencimento em um ano é o caso mais comum do exame periódico, mas a periodicidade depende do PCMSO de cada função. Se a AEMC usar prazos diferentes por cargo, dá para ajustar.

## 5. A planilha real

A planilha de exemplo enviada tem dados reais de funcionários (nomes, CPF, RG, PIS, salário, endereço e afastamentos por doença). Por isso:
- **ela não foi copiada para o projeto**, nem para a documentação, nem para a demonstração. Foi analisada numa cópia temporária, que foi apagada, e só a estrutura e as contagens foram anotadas;
- a demonstração tem **28 funcionários inventados** (nomes, documentos e telefones fictícios; os CPFs e PIS são montados só para passar na conferência dos dígitos).

**Resultado da conferência (sem gravar nada):** o assistente acha sozinho a linha dos títulos (linha 6, depois do cabeçalho da associação) e reconhece as 20 colunas. Das 296 linhas, **293 entram** (286 prontas e 7 com aviso: PIS que não confere ou incompleto, admissão ilegível) e **3 ficam de fora** por falta de nome, cargo ou unidade. As 13 formas de escrever os cargos foram unificadas nos 12 da lista.

**Como importar no sistema real** (quando você quiser; ninguém importou ainda):
1. Antes, conferir em **Escolas** se todas as unidades da planilha estão cadastradas. A coluna "Unidade" pode ter só parte do nome (ex.: "PEQUENOS PASSOS"), desde que aponte para uma escola só.
2. Entrar como administração ou RH → **Funcionários** → **Importar planilha** → escolher o arquivo.
3. Conferir a pré-visualização: as linhas com erro mostram o motivo; dá para baixar o relatório, corrigir no Excel e mandar de novo.
4. Confirmar. Se algo sair errado, **Desfazer importação** tira tudo de uma vez (vai para a lixeira).

## 6. Cuidados (LGPD)

- Só administração e RH leem e gravam; a regra do banco garante isso mesmo para quem tentar fora da tela. Testado no emulador (diretora, conta desativada e visitante são barrados).
- A **cópia de segurança em Excel/JSON** (Segurança dos dados) passa a incluir a aba "Funcionários", com CPF e salário. Guarde o arquivo em pasta com acesso restrito.
- **(a confirmar)** Vale registrar, na política de privacidade da associação, que o sistema guarda esses dados e para quê (gestão de pessoal), e definir por quanto tempo se mantêm os dados de quem saiu.

## 7. Arquivos

| Arquivo | O quê |
|---|---|
| `src/pages/admin/Funcionarios.jsx` | A tela (lista, filtros, detalhe, formulário, exportar, importar) |
| `src/utils/funcionarios.js` | Cargos, tipos de afastamento, unificação de cargos, cálculo de afastamento/ASO, idade |
| `src/importacao/esquemas.js` | Esquema de importação `funcionarios` (títulos da planilha e sinônimos) |
| `src/importacao/normalizar.js` | Conferência e formato de CPF e PIS |
| `src/utils/alertas.js` | Alertas de ASO |
| `src/demo/dadosDemo.js` | 28 funcionários fictícios |
| `firestore.rules` | Coleção `funcionarios`: administração e RH; RH também na lixeira e na importação de funcionários |

## 8. Como verificar

- `npm test`: 75 testes (cargos, afastamento, ASO, CPF/PIS, dados da demonstração, importação com os mesmos títulos da planilha e alertas de ASO).
- `npm run test:regras`: 58 testes de regras no emulador, 3 novos para funcionários.
- Na tela, no emulador local (14/10/2026): cadastro em branco (os 3 campos obrigatórios apontados), CPF inválido e repetido barrados, cargo digitado fora da lista, vencimento do ASO sugerido, inativação exigindo rescisão, exclusão para a lixeira com histórico, busca por CPF, filtros, alerta do Painel abrindo a lista filtrada, perfil RH e largura de celular sem rolagem lateral. Auditoria de acessibilidade (axe) sem violações na lista, no detalhe, no formulário e na importação.
