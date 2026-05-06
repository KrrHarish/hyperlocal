const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#2d2200', color: '#FBBF24' },
  confirmed: { bg: '#0d1f3c', color: '#60A5FA' },
  assigned:  { bg: '#1e1540', color: '#A78BFA' },
  picked_up: { bg: '#2d1500', color: '#FB923C' },
  delivered: { bg: '#0d2a18', color: '#22C55E' },
  cancelled: { bg: '#2d0d0d', color: '#EF4444' },
  online:    { bg: '#0d2a18', color: '#22C55E' },
  offline:   { bg: '#1a1a1a', color: '#555' },
  active:    { bg: '#0d2a18', color: '#22C55E' },
  inactive:  { bg: '#2d0d0d', color: '#EF4444' },
  verified:  { bg: '#0d2a18', color: '#22C55E' },
  suspended: { bg: '#2d0d0d', color: '#EF4444' },
}

export default function Badge({ status }: { status: string }) {
  const s = status?.toLowerCase().replace(' ', '_') ?? ''
  const { bg, color } = STATUS_COLORS[s] ?? { bg: '#1a1a1a', color: '#aaa' }
  const label = status?.replace('_', ' ')
  return (
    <span style={{
      display: 'inline-block',
      background: bg,
      color,
      border: `1px solid ${color}30`,
      borderRadius: 99,
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
