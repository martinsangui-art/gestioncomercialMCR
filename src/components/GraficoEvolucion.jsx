import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts'
import { C, F } from '../lib/theme'

// Gráfico de evolución del tablero, en su propio archivo para cargarlo aparte
export default function GraficoEvolucion({ evolucion, techoEvol }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={evolucion} margin={{ top: 10, right: 24, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="gradNav" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.navy} stopOpacity={0.22} />
            <stop offset="100%" stopColor={C.navy} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.ruleSoft} vertical={false} />
        <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, techoEvol]} ticks={Array.from({ length: techoEvol / 25 + 1 }, (_, i) => i * 25)} tick={{ fontSize: 11, fill: C.inkSoft, fontFamily: F.mono }} tickLine={false} axisLine={false} tickFormatter={v => v + '%'} />
        <ReferenceLine y={100} stroke={C.navy} strokeOpacity={0.5} strokeWidth={1.5}
          label={{ value: 'objetivo', position: 'insideTopRight', fill: C.navy, fontSize: 11, fontFamily: F.body, fontWeight: 600 }} />
        <ReferenceLine y={50} stroke={C.inkSoft} strokeOpacity={0.45} strokeDasharray="4 4"
          label={{ value: '50%', position: 'insideTopRight', fill: C.inkSoft, fontSize: 11, fontFamily: F.mono }} />
        <Tooltip contentStyle={{ fontSize: 12.5, border: `1px solid ${C.rule}`, borderRadius: 8, background: C.paperRaised, fontFamily: F.body }}
          formatter={v => [v + '%', 'Cumplimiento de la zona']} labelFormatter={l => `Corte del ${l}`} />
        <Area type="monotone" dataKey="pct" stroke={C.navy} strokeWidth={2.5}
          fill="url(#gradNav)" dot={{ r: 3.5, fill: C.navy, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: C.crimson, strokeWidth: 2, stroke: '#fff' }}
          isAnimationActive animationDuration={900} animationEasing="ease-out" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
