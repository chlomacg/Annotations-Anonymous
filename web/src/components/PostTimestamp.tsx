import convert from 'convert';

export function PostTimestamp({ time }: { time: Date }) {
  const now = new Date();
  const diffMs = now.getTime() - time.getTime();
  const diff = convert(diffMs, 'ms').to('best');

  // We don't use diff.toString(0) because we want no space between the quantity and unit
  const age = diffMs < 1000 ? '0s' : `${diff.quantity.toFixed(0)}${diff.unit.toString()}`;

  return <div className="text-sm text-gray-500">{age}</div>;
}
