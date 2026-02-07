import convert from 'convert';

export function PostTimestamp({ time }: { time: Date }) {
  const now = new Date();
  const diff = convert(now.getTime() - time.getTime(), 'ms').to('best');

  return <div className="text-sm text-gray-500">{`${diff.quantity.toFixed(0)}${diff.unit.toString()}`}</div>;
}
