import { describe, expect, it } from 'vitest'
import { emailConfig, escapeHtml, isDigestHour, localDateKey, renderAlertsEmail, renderDigestEmail } from './email'

describe('horário do resumo (America/Sao_Paulo)', () => {
  const now = new Date('2026-11-20T11:07:00Z') // 08:07 em São Paulo (UTC−3)
  it('compara a hora local com a preferência', () => {
    expect(isDigestHour(8, now)).toBe(true)
    expect(isDigestHour(11, now)).toBe(false)
  })
  it('chave do dia local (vira o dia às 00h de SP, não UTC)', () => {
    expect(localDateKey(new Date('2026-11-21T02:00:00Z'))).toBe('2026-11-20')
    expect(localDateKey(new Date('2026-11-21T03:30:00Z'))).toBe('2026-11-21')
  })
})

describe('emailConfig', () => {
  it('sem RESEND_API_KEY → null (e-mail desativado, nada quebra)', () => {
    expect(emailConfig({})).toBeNull()
  })
  it('remetente padrão de teste do Resend', () => {
    expect(emailConfig({ RESEND_API_KEY: 're_x' })).toEqual({ apiKey: 're_x', from: 'Deniels Home Tracker <onboarding@resend.dev>' })
  })
})

describe('renderização', () => {
  it('escapa HTML vindo dos anúncios', () => {
    expect(escapeHtml('<b>"x" & y</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;')
  })

  it('alertas: assunto com quantidade e links absolutos', () => {
    const m = renderAlertsEmail(
      [
        { title: 'Aluguel caiu: <Ape>', body: 'de R$ 1.500 para R$ 1.400', apartmentId: 'a1' },
        { title: 'Anúncio removido: Casa', body: null, apartmentId: 'a2' },
      ],
      'https://site.test',
    )
    expect(m.subject).toBe('Deniels: 2 novidades nos seus apartamentos')
    expect(m.html).toContain('https://site.test/apartamentos/a1')
    expect(m.html).toContain('&lt;Ape&gt;')
    expect(m.html).not.toContain('<Ape>')
    expect(m.text).toContain('Aluguel caiu: <Ape>')
  })

  it('resumo diário: números, oportunidades e anúncios para abrir', () => {
    const m = renderDigestEmail(
      {
        dateLabel: '20/11/2026',
        total: 6,
        priceChanges: 2,
        unavailable: 1,
        top: [{ name: 'Ape A', score: 82, label: 'Excelente', apartmentId: 'a1' }],
        stale: [{ name: 'Ape ZAP', url: 'https://www.zapimoveis.com.br/imovel/x' }],
      },
      'https://site.test',
    )
    expect(m.subject).toBe('Deniels: resumo de 20/11/2026')
    expect(m.text).toContain('6 imóveis monitorados')
    expect(m.text).toContain('2 com mudança de preço')
    expect(m.html).toContain('https://www.zapimoveis.com.br/imovel/x')
    expect(m.html).toContain('82')
  })
})
