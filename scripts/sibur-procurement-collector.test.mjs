import { describe, expect, it } from 'vitest'
import {
  collectSiburProcurements,
  parseSiburProcurementHtml,
} from './sibur-procurement-collector.mjs'

const siburHtml = `
  <div>
    Номер закупочной процедуры Наименование процедуры Предмет закупки Наименование способа закупки
    Дата публикации Срок подачи предложений Организатор Статус закупочной процедуры ФИО закупщика
    Телефон закупщика Email закупщика Номенклатурная категория Документация
    <a href="https://srm.sibur.ru/procedure/2133637">2133637/2</a>
    <span>Развернуть</span>
    <span>Триэтаноламин</span>
    <span>Триэтаноламин (99,5% чистоты). Технические требования приложены в разделе документы. Упаковка - бочки 200 кг. Может быть рассмотрен продукт другого производителя при наличии COA, TDS, MSDS.</span>
    <span>Запрос предложений</span>
    <span>02.06.2026</span>
    <span>05.06.2026 16:00:00</span>
    <span>ПАО "СИБУР Холдинг"</span>
    <span>Прием предложений</span>
    <span>Фаттахова Расиля Ринатовна</span>
    <span>+7 (843) 533-90-90 доб. 622404</span>
    <span>fattakhovarr@rt.sibur.ru</span>
    <span>Химическая продукция и реагенты</span>
    <a href="/upload/docs/euf_d_pr_04_29_docx.docx">euf_d_pr_04_29_docx.docx</a>
    <a href="/upload/docs/tt_trietanolamin_rus_pdf.pdf">tt_trietanolamin_rus_pdf.pdf</a>
  </div>
`

describe('SIBUR procurement collector', () => {
  it('parses SIBUR procurement rows into internal demand records', () => {
    const records = parseSiburProcurementHtml(siburHtml, { baseUrl: 'https://www.sibur.ru/ru/procurement/buy/' })

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      buyerEmail: 'fattakhovarr@rt.sibur.ru',
      buyerName: 'Фаттахова Расиля Ринатовна',
      category: 'Химическая продукция и реагенты',
      confidence: 'high',
      id: 'sibur-2133637-2',
      noticeNumber: '2133637/2',
      organization: 'ПАО "СИБУР Холдинг"',
      publishedAt: '2026-06-02',
      region: 'Республика Татарстан',
      status: 'Прием предложений',
      title: 'Триэтаноламин',
    })
    expect(records[0].items[0].spec).toContain('COA, TDS, MSDS')
    expect(records[0].documents.map((doc) => doc.title)).toContain('tt_trietanolamin_rus_pdf.pdf')
    expect(records[0].sourceDocumentText).toContain('Email закупщика: fattakhovarr@rt.sibur.ru')
  })

  it('collects SIBUR records through the fetch adapter', async () => {
    const feed = await collectSiburProcurements({
      fetchImpl: async () => ({
        ok: true,
        text: async () => siburHtml,
      }),
      maxPages: 1,
    })

    expect(feed.items).toHaveLength(1)
    expect(feed.items[0].documents).toHaveLength(2)
  })
})
