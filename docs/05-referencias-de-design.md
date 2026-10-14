# Referências de design e UX para o Gestão Escolar 2.0

> Pesquisa feita em 13/10/2026. Objetivo: definir **como o sistema deve parecer e se comportar** para impressionar a sede em São Paulo e ser fácil para a diretora.
> Voltar ao índice: [README](README.md) · Relacionado: [04 Mercado](04-pesquisa-de-mercado.md) · [06 Funcionalidades](06-funcionalidades-e-roadmap.md)

**Sobre "designers":** entendi como *referências de design e quem faz bem*. Cito produtos e times cujo trabalho é público e estudável (Linear, Stripe, Vercel, Serpro/gov.br), mais fontes de inspiração. **Não é para copiar**: a ideia é aprender os princípios e aplicá-los ao nosso contexto (creches, diretoras, coordenação regional).

> Itens marcados **[proposta]** são recomendações minhas, não fatos de pesquisa.

---

## 1. Diagnóstico do que existe hoje (leitura do código)

O 1.0 usa Tailwind com uma cor primária `#185FA5` (azul), sidebar azul, cards brancos, tabelas padrão e modais. Cada página repete o seu próprio layout de filtros/tabela/modal; há mistura de português de Portugal e do Brasil; os estados vazios e de erro são mínimos. É um sistema **funcional e limpo, mas genérico**: à primeira vista não passa a imagem de "produto". Ainda **não vi as telas no navegador**; o próximo passo recomendado é uma auditoria visual com capturas.

---

## 2. O que as referências ensinam

### Linear — "menos ruído, mais hierarquia"
Fonte: o artigo do próprio time sobre o redesign da interface.
- Objetivo declarado: **reduzir ruído visual, manter alinhamento e aumentar hierarquia e densidade** da navegação.
- **Cor em espaço perceptual (LCH):** temas claro/escuro gerados a partir de **3 variáveis** (cor base, cor de destaque, contraste), em vez de dezenas de cores soltas. Efeito: tudo "combina" e dá para criar tema de alto contraste.
- **Tipografia:** Inter para texto e uma variação (Inter Display) para títulos.
- Processo: protótipo em ferramenta de design, teste em 3 frentes (ambiente, aparência, hierarquia), liberação gradual atrás de *feature flag*; cerca de 6 semanas com pares de design + engenharia.

**Aplicar [proposta]:** definir poucos *design tokens* (cor base, destaque, contraste) e derivar todo o resto; reduzir bordas, sombras e cores de fundo; padronizar espaçamentos.

### Stripe, Linear e Vercel — três "personalidades" de produto
Reconstrução do estilo das marcas feita por terceiros (valores aproximados, só do site de marketing, não oficiais):

| | Stripe | Linear | Vercel |
|---|---|---|---|
| Sensação | Corporativo polido | Engenharia precisa | Minimalista confiante |
| Fonte | Sohne → Inter | Inter | Geist → Inter |
| Texto base | 18px | 16px | 16px |
| Disciplina de cor | ≤ 3 tokens de destaque por seção | 1 cor primária | 1 cor de destaque por página |

**Lição comum:** *uma* cor de destaque, tipografia consistente, afirmações com números e sem exagero.

### gov.br Design System (Serpro)
Padrão Digital de Governo do Brasil, com fundamentos visuais, **componentes web, modelos, acessibilidade** e comunidade (gov.br/ds). **Por que importa para nós:** quem decide na sede e nas prefeituras vive no ecossistema gov.br; usar **acessibilidade e padrões conhecidos** transmite seriedade. Não precisamos *parecer* governo; precisamos seguir seus padrões de **contraste, foco de teclado, rótulos de formulário e mensagens de erro**.

### shadcn/ui — como construir sem ficar refém de biblioteca
"Não é uma biblioteca de componentes; é como você constrói a sua". Você recebe o **código** de cada componente (Data Table, Sidebar, Chart, Card…) e pode editá-lo. Combina com o nosso stack (Tailwind + React). **[proposta]** boa base para o design system do 2.0, com migração gradual.

### Para estudar (referências abertas)
- *Refactoring UI* (livro/site de Adam Wathan e Steve Schoger) sobre hierarquia, espaçamento e cor para quem não é designer (do meu conhecimento; não reverificado agora).
- Galerias de telas reais: **Mobbin** e **Dribbble** (busca por "work order", "facility management", "dashboard").
- Páginas de produto dos concorrentes ([04](04-pesquisa-de-mercado.md)): MaintainX, UpKeep, FMX, Famly, Brightwheel.

---

## 3. Regras de ouro para dashboards (tendências 2026)

De dois guias de 2026 (SaaSFrame e Think Design):

1. **Comece pelas 3 decisões** que o usuário toma ali; não por todos os dados possíveis.
2. **Hierarquia vertical:** status ("estamos bem?") no topo → tendências no meio → detalhes e filtros embaixo.
3. **Um número "estrela"** no canto superior esquerdo (o que dá a sensação de sucesso).
4. **Dashboard operacional, não relatório:** em vez de só "10 chamados atrasados", mostrar **a próxima ação** ("Atribuir prestador").
5. **Gráficos simples:** linha para tempo, barra para comparar, rosca só com ≤ 3 partes. *Se precisa passar o mouse para entender, falhou.* Evitar 3D, velocímetros e pizza com muitas fatias.
6. **Não depender só de cor:** usar ícone + texto + cor ("Em dia", "Vencendo", "Vencido").
7. **Filtro global** (período, município, unidade) que atualiza a página inteira; **visões salvas**.
8. **Estados vazios que ensinam:** nunca um gráfico vazio; sempre o próximo passo.
9. **Acessibilidade como requisito:** contraste, navegação por teclado, leitor de tela, zoom 200%.
10. **Modo escuro** esperado em ferramentas de uso longo.
11. **IA com explicação** (se um dia houver previsões): mostrar dados e grau de confiança.

---

## 4. Direção de design proposta **[proposta]**

### 4.1 Princípio central
> **"Calmo para quem usa todo dia, impressionante para quem avalia em 10 minutos."**
> Duas plateias: a *diretora* (simples, celular, 30 segundos para abrir um chamado) e a *sede* (visão geral, números, confiança).

### 4.2 Sensação
Profissional, acolhedor e confiável; menos "painel administrativo genérico", mais "produto de verdade". Inspirações: clareza do Linear, disciplina de cor do Vercel, calor humano de produtos de creche (Famly/Brightwheel).

### 4.3 Elementos de base (tokens)
| Item | Proposta | Justificativa |
|---|---|---|
| Cor de destaque | **Manter o azul `#185FA5`** como base de marca (já usada no sistema) e ajustar tons/estados a partir dela | Continuidade com o que as usuárias já conhecem; evita "outro sistema" |
| Neutros | Cinzas levemente azulados, fundo muito claro | Menos cansaço visual |
| Semânticas | Verde (ok), âmbar (atenção), vermelho (crítico), azul (informação), **sempre com ícone e texto** | Acessibilidade |
| Tipografia | **Inter** (gratuita, legível, já usada por Linear) | Consistência e desempenho |
| Raio / sombra | Raios médios (8–12px), sombras sutis; bordas finas | Aparência moderna e limpa |
| Densidade | Duas: *confortável* (celular/diretora) e *compacta* (tabelas da sede) | Cada plateia no seu ritmo |
| Tema | Claro + escuro | Tendência 2026 |
| Ícones | Manter **lucide** (já no projeto) | Custo zero de migração |

(Exata paleta e escala tipográfica devem ser fechadas com protótipo e conferência de contraste.)

### 4.4 Telas de maior impacto numa demonstração
1. **Painel da sede** ("Visão geral"): número-estrela + 3–4 indicadores + lista "Precisa da sua atenção hoje" com ação direta + mapa/lista por município e unidade.
2. **Detalhe da ordem de serviço**: linha do tempo (aberta → atribuída → em andamento → concluída), fotos, comentários, botão "enviar por WhatsApp".
3. **Início da diretora**: um botão grande "Pedir manutenção", status dos pedidos dela e o que vence na escola.
4. **Contas a pagar**: tabela moderna com filtros salvos, anexo do boleto/nota e alertas.
5. **Ciclos**: linha do tempo/calendário com semáforo (verde/âmbar/vermelho).
6. **Relatório mensal** (prestação de contas) com visual de relatório profissional e exportação em PDF/Excel.
7. **Processo seletivo** em funil (kanban).
8. **Login**: já tem dois portais (Administração / Escola); manter a ideia e elevar a qualidade visual e a marca.

### 4.5 Comportamento e microinterações
- **Busca global** (atalho `Ctrl+K`) para achar escola, chamado, conta, candidato.
- **Feedback imediato** (toasts discretos, botões com estado de carregamento, atualizações otimistas).
- **Skeleton screens** em vez de spinner solto.
- **Confirmar apenas ações destrutivas**; "desfazer" quando possível.
- **Notificações dentro do sistema** (sino) e por WhatsApp para o que é urgente.
- **Atalhos** (criar, buscar) para quem usa muito.

### 4.6 Mobile primeiro para a diretora
- Navegação inferior (como o `MobileNav` já indica), botões grandes, formulários curtos.
- **PWA instalável** (ícone na tela inicial); push disponível no iPhone desde o iOS 16.4 **somente com o app instalado**; background sync no iOS ainda é limitado (ver [07](07-requisitos-legais-e-tecnicos.md)).
- Foto direto da câmera ao abrir chamado.

### 4.7 Acessibilidade (mínimo inegociável)
Contraste adequado, foco visível, teclado completo, rótulos e erros claros, alvos de toque ≥ 44px, texto alternativo, funcionar com zoom de 200%; meta **WCAG 2.2 AA**. Mensagens e termos **100% em português do Brasil**.

### 4.8 Coisas a evitar
Gráficos 3D, pizza com muitas fatias, velocímetros, cor como única informação, telas lotadas, jargão técnico, animações longas, automação invisível que confunde.

---

## 5. Como medir "100x melhor" **[proposta]**

Metas concretas para avaliar o 2.0 (ajustar depois de conversar com sua mãe e com as diretoras):

| Indicador | Hoje (estimativa) | Meta 2.0 |
|---|---|---|
| Tempo para a diretora abrir um chamado com foto no celular | a medir | ≤ 30 segundos |
| Tempo para a sede saber "o que está atrasado hoje" | navegar por várias telas | 1 tela, ≤ 10 segundos |
| Tempo para gerar o relatório mensal de prestação de contas | manual | ≤ 1 minuto (e quase pronto) |
| Treinamento necessário para a diretora | a medir | zero (autoexplicativo) |
| Percepção de qualidade na demonstração | — | "isso parece um produto pronto" |

---

## 6. Fontes
- [Linear — How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Reconstrução dos sistemas Stripe, Linear e Vercel (terceiros)](https://opendesigner.io/pt-br/blog/recreating-stripe-linear-vercel-design-systems-with-design-md)
- [SaaSFrame — Anatomy of High-Performance SaaS Dashboard Design: 2026](https://www.saasframe.io/blog/the-anatomy-of-high-performance-saas-dashboard-design-2026-trends-patterns)
- [Think Design — Dashboard Design in 2026: Do's and Don'ts](https://think.design/?p=2597)
- [shadcn/ui](https://ui.shadcn.com/docs) · [Design System gov.br](https://www.gov.br/ds/home)
- [Monterail — PWA no iOS](https://monterail.com/blog/pwa-for-apple-ios)

*Limite:* o gov.br/ds e o shadcn/ui foram lidos só pelas páginas iniciais; detalhes de tokens e componentes precisam ser consultados diretamente na hora de implementar.
