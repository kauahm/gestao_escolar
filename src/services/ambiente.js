// Em qual ambiente o app está rodando: o real ou o de demonstração.
//
// O ambiente de demonstração é um SEGUNDO projeto Firebase, só com dados
// fictícios (ver docs/13-ambiente-de-demonstracao.md). Ele liga com
// `npm run dev:demo` / `npm run build:demo`, que leem o arquivo `.env.demo`.

/** Projeto Firebase real. Nada de demonstração pode rodar contra ele. */
export const PROJETO_REAL = 'gestaoescolar-b84c2';

export const PROJETO_ATUAL = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';

const pediuDemo = import.meta.env.VITE_AMBIENTE === 'demo';

/**
 * Pediu modo demo, mas a configuração aponta para o projeto real (ou para
 * nenhum). Acontece se o `.env.demo` estiver incompleto: o Vite completa o que
 * falta com o `.env` real. Nesse caso o modo demo NÃO liga.
 */
export const DEMO_MAL_CONFIGURADA = pediuDemo && (!PROJETO_ATUAL || PROJETO_ATUAL === PROJETO_REAL);

/** Verdadeiro só no ambiente de demonstração corretamente configurado. */
export const EH_DEMO = pediuDemo && !DEMO_MAL_CONFIGURADA;
