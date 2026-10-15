// Situação de um contrato (termo de colaboração) pela vigência. Separado de
// sede.js para os alertas poderem usar sem importar a visão da sede inteira.

/** Com quantos dias de antecedência o fim da vigência começa a avisar. */
export const DIAS_AVISO_CONTRATO = 90;
/** Abaixo disto, o aviso vira "atenção". */
export const DIAS_URGENTE_CONTRATO = 30;

const ymdDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diasEntre = (deYmd, ateYmd) => {
  const [a1, m1, d1] = deYmd.split('-').map(Number);
  const [a2, m2, d2] = ateYmd.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
};

/**
 * Situação de um contrato pela vigência.
 * @returns {{ rotulo, vigente, encerrado, diasParaFim, aviso: 'urgente'|'proximo'|null }}
 */
export function situacaoDoContrato(contrato, hoje = new Date()) {
  const h = ymdDe(hoje);
  if (contrato?.inicio && contrato.inicio > h) return { rotulo: 'Ainda não começou', vigente: false, encerrado: false, diasParaFim: null, aviso: null };
  if (!contrato?.fim) return { rotulo: 'Vigente (sem data de fim)', vigente: true, encerrado: false, diasParaFim: null, aviso: null };
  const dias = diasEntre(h, contrato.fim);
  if (dias < 0) return { rotulo: 'Encerrado', vigente: false, encerrado: true, diasParaFim: dias, aviso: null };
  const aviso = dias <= DIAS_URGENTE_CONTRATO ? 'urgente' : dias <= DIAS_AVISO_CONTRATO ? 'proximo' : null;
  const rotulo = aviso ? (dias === 0 ? 'Vence hoje' : `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`) : 'Vigente';
  return { rotulo, vigente: true, encerrado: false, diasParaFim: dias, aviso };
}
