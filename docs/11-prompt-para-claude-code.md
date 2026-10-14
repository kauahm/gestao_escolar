# Prompt para continuar o projeto no Claude Code

> Cole o texto abaixo (dentro do bloco) numa sessão do Claude Code aberta na pasta do projeto `gestao_escolar`.
> Voltar ao índice: [README](README.md)

```text
Você vai continuar o projeto "Gestão Escolar 2.0". Trabalhe como um engenheiro sênior cuidadoso, em português do Brasil, e execute o melhor processo possível: qualidade acima de velocidade.

## 1. Contexto
Sistema web (React 18, Vite 5, React Router 6, Tailwind 3, Firebase 10: Auth + Firestore, Vercel) feito para a minha mãe, prestadora de serviços no escritório de Hortolândia da Associação Educacional Maria do Carmo (AEMC). O objetivo é deixar o 2.0 o mais profissional possível para vender à sede da AEMC em São Paulo e ativar nas escolas. Hoje a AEMC usa Word, Excel, Drive e Google Forms. Os dados que existem no sistema atual são todos de teste. A sua mãe/usuária tem medo de perder dados, por isso confiança e segurança vêm antes de recursos novos.

## 2. Leia antes de qualquer coisa
Toda a documentação está em `docs/`. Leia nesta ordem e confie nela:
1. `docs/README.md` (índice e convenções)
2. `docs/03-objetivos-do-2.0.md` (objetivo, restrição de custo, decisões)
3. `docs/06-funcionalidades-e-roadmap.md` (fases; o que está feito e o que falta)
4. `docs/09-auditoria-de-seguranca-e-infraestrutura.md` e `docs/10-registro-de-alteracoes.md` (o que já foi feito no código)
5. Depois, conforme precisar: 01 (código e modelo de dados), 07 (LGPD/MROSC/segurança), 08 (auditoria visual), 04 e 05 (mercado e design).
Itens marcados "(a confirmar)" nos docs são hipóteses, não fatos.

## 3. Regras inegociáveis
- **Custo zero até a venda.** Nada que exija o plano Blaze do Firebase (Storage, Cloud Functions, backup agendado, MFA, WhatsApp pago). Esses itens estão listados em `docs/06`, seção "Pendente para depois da venda". Se algo exigir gasto, pare e me avise.
- **Design visual por último.** Ordem combinada: base segura e confiança, depois funcionalidades, depois polimento visual. Pode esboçar fluxos, mas não refaça o visual agora.
- **Git: nunca mencione o Claude.** Nenhuma linha "Co-Authored-By", nenhum "Generated with Claude Code", nenhuma menção a IA em mensagens de commit, descrições de PR ou comentários. As mensagens de commit são minhas, em português, curtas e descritivas.
- **Não toque em dados de produção** nem rode nada contra o projeto Firebase real (`gestaoescolar-b84c2`) sem eu pedir. Use emulador ou um projeto separado de demonstração.
- **Não leia nem exiba o conteúdo do `.env`.** Ele só tem a configuração pública do Firebase, mas não imprima valores em respostas, logs ou docs.
- **Ações destrutivas ou irreversíveis** (apagar, forçar push, reescrever histórico, publicar regras, deploy): peça confirmação antes.
- Todo texto de tela em **português do Brasil** (sem "a carregar", "registados" etc.), com acentuação correta.
- Documente tudo em `docs/` (arquivos `NN-assunto.md`, "(a confirmar)" para inferências) e atualize `docs/README.md` e `docs/10-registro-de-alteracoes.md` a cada etapa concluída.

## 4. Estado atual (resumo)
Já feito e verificado (build de produção passou): regras do Firestore versionadas e endurecidas (`firestore.rules`, `firebase.json`); `.gitignore` e `.env.example`; `PrivateRoute` corrigido; "Vencida" virou condição calculada (`src/utils/calcularStatus.js`) e o painel deixou de mentir; camada de gravação `src/services/db.js` com lixeira e histórico; tela "Segurança dos dados" (`src/pages/admin/Seguranca.jsx`) com cópia em Excel/JSON (`src/utils/exportarDados.js`, `src/utils/planilhaXlsx.js`) e lembrete no painel.

## 5. Primeiro: confira o terreno
1. `git status` e `git log --oneline -10`. Há mudanças não commitadas; revise o diff completo antes de commitar.
2. `npm ci` (ou `npm install`) e `npm run build`. Se falhar, corrija antes de seguir.
3. Revise `firestore.rules` linha a linha contra o código das telas (quais coleções e campos cada perfil lê e escreve). Se tiver Java disponível, rode o emulador do Firestore e escreva testes das regras (@firebase/rules-unit-testing) cobrindo: diretora só vê a própria escola; diretora não cria chamado com status diferente de "Pendente"; `prestadores` só admin; `administrativo` só currículos/candidatos; histórico imutável; lixeira e restauração; usuário inativo bloqueado. Guarde os testes no repositório.
4. Sugira o commit (mensagens claras, em português, sem menção a IA) e **me peça para confirmar** antes de rodar `push.bat` ou `git push`.

## 6. Pendências minhas (lembre-me, não faça sozinho)
- Publicar as regras: `firebase deploy --only firestore:rules` (antes do deploy do código; sem isso, excluir fica bloqueado de propósito).
- Tirar o `.env` do controle de versão: `git rm --cached .env` + commit.
- Restringir a chave de API por domínio no Google Cloud.

## 7. Próximas entregas (nesta ordem; proponha o plano e espere o meu "ok" antes de cada bloco grande)
A. **Ambiente de demonstração**: segundo projeto Firebase gratuito (Spark) para demo, com dados fictícios realistas (escolas, contas, chamados, ciclos, agenda), um script/botão para "resetar" os dados e variáveis de ambiente separadas (`.env.demo` fora do Git; documente o passo a passo para eu criar o projeto). Nunca misturar dados reais.
B. **Importação de planilhas** (Excel/CSV) para escolas, contas, ciclos e currículos, com pré-visualização, validação linha a linha, relatório de erros e desfazer (passando pela camada `db.js`). A AEMC vive em Excel; sem isso a adoção trava. Sem bibliotecas pagas.
C. **Padronização PT-BR e estados vazios/erro** (achados V1–V3, V10 de `docs/08`).
D. **Correções de dados e fluxo** (achados M1–M7 de `docs/08`): competência e tipo de conta como seletores, responsável ligado a prestador, tela de detalhe do chamado, "Esqueci minha senha".
E. **Alertas que cobram** (manutenção parada, ciclo vencido) no painel.
F. Só depois: sistema de design e polimento visual (`docs/05`), auditando também a tela da diretora no celular.

## 8. Como trabalhar
- Use a lista de tarefas, trabalhe em passos pequenos e verificáveis, e rode `npm run build` (e os testes) a cada passo.
- Prefira mudanças pequenas e reversíveis; não faça refatorações amplas sem necessidade e sem me avisar.
- Antes de afirmar que algo funciona, execute e verifique. Quando não conseguir verificar (ex.: depende do console do Firebase), diga claramente.
- Para pesquisas (mercado, legislação, preços), use fontes atuais e cite-as. Não invente fatos; marque "(a confirmar)".
- Ao terminar cada bloco, me entregue: o que mudou, como testar, e o que depende de mim.
```
