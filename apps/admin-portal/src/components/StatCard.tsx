interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
  icon: string
}

export default function StatCard({ label, value, sub, accent = '#22C55E', icon }: StatCardProps) {
  return (
    <div style={{
      background: '#161616',
      border: '1px solid #222',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flex: 1,
      minWidth: 160,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#555' }}>{sub}</div>}
    </div>
  )
}
