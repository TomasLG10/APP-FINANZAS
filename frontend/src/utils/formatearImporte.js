export function formatearImporte(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '0,00';

  const signo = numero < 0 ? '-' : '';
  const [entero, decimales] = Math.abs(numero).toFixed(2).split('.');
  const enteroConMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return `${signo}${enteroConMiles},${decimales}`;
}
