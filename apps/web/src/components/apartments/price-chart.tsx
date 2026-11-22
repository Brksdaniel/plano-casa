'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBRL } from '@/lib/format'

export type ChartPoint = { at: string; rent: number | null; total: number | null; source: string }

const SOURCE: Record<string, string> = { server: 'servidor', extension: 'extensão', manual: 'manual' }
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

/** Evolução do aluguel e do total mensal (degraus: o valor vale até a próxima leitura). */
export function PriceChart({ points }: { points: ChartPoint[] }) {
  const data = points.map((p) => ({ ...p, t: new Date(p.at).getTime() }))
  return (
    <div className="h-64 w-full" role="img" aria-label="Gráfico da evolução do aluguel e do total mensal">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => day(new Date(t).toISOString())}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            stroke="var(--border)"
            minTickGap={24}
          />
          <YAxis
            width={72}
            tickFormatter={(v: number) => formatBRL(v)}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            stroke="var(--border)"
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13 }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
            formatter={(value, name, item) => [
              `${formatBRL(Number(value))}${name === 'Aluguel' ? ` · via ${SOURCE[(item.payload as ChartPoint).source] ?? '—'}` : ''}`,
              name,
            ]}
          />
          <Line type="stepAfter" dataKey="total" name="Total mensal" stroke="var(--muted-foreground)" strokeDasharray="4 4" dot={false} connectNulls />
          <Line type="stepAfter" dataKey="rent" name="Aluguel" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
