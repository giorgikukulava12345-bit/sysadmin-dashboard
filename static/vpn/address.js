export function ipv4(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value)) return null;
  const octets = value.split('.').map(Number);
  return octets.every(n => n <= 255) ? octets.reduce((a, n) => a * 256 + n, 0) : null;
}
const dotted = n => [24, 16, 8, 0].map(b => (n >>> b) & 255).join('.');
export function cidr(value) {
  if (typeof value !== 'string' || !/^.+\/(0|[1-9]|[12]\d|3[0-2])$/.test(value)) return null;
  const [ip, prefix] = value.split('/');
  const number = ipv4(ip), bits = Number(prefix);
  if (number === null) return null;
  const size = 2 ** (32 - bits), network = Math.floor(number / size) * size;
  return { network, end: network + size - 1, canonical: `${dotted(network)}/${bits}`, mask: dotted((2 ** 32 - size) >>> 0), wildcard: dotted((size - 1) >>> 0), ip: dotted(network) };
}
