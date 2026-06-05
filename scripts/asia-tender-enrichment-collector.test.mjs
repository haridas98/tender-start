import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  collectAsiaTenderDemand,
  parseCcgpSearchHtml,
  parseCpppLatestTendersHtml,
} from './asia-tender-enrichment-collector.mjs'

const CPPP_HTML = `
<table><tbody><tr>
  <td>1.</td>
  <td>04-Jun-2026 10:00 AM</td>
  <td>15-Jun-2026 10:15 AM</td>
  <td>15-Jun-2026 10:20 AM</td>
  <td><a href="https://eprocure.gov.in/cppp/tendersfullview/demo">Conductive rubber sheet size 2MM thick, width 1 mtr and length 10 mtr</a>/GEM/2026/B/7608048/2026_DoDP_840189_3</td>
  <td>Department of Defence Production</td>
  <td>--</td>
</tr></tbody></table>`

describe('Asia tender enrichment collector', () => {
  it('parses CPPP latest active tenders into internal demand feed records', () => {
    const records = parseCpppLatestTendersHtml(CPPP_HTML)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      country: 'India',
      law: 'GeM bid / CPPP mirror',
      noticeNumber: '2026_DoDP_840189_3',
      organization: 'Department of Defence Production',
      source: 'GeM-CPPP latest active tenders parser',
    })
    expect(records[0].items[0]).toMatchObject({
      name: 'rubber sheet',
      quantity: '1',
      unit: 'm',
    })
    expect(records[0].documents.map((document) => document.type)).toContain('technical_specification')
    expect(records[0].sourceDocumentText).toContain('Documents inside TenderStart')
  })

  it('ignores CPPP non-industrial tenders', () => {
    const html = CPPP_HTML.replace('Conductive rubber sheet size 2MM thick, width 1 mtr and length 10 mtr', 'Hiring of manpower for office support')
    expect(parseCpppLatestTendersHtml(html)).toEqual([])
  })

  it('parses CCGP snippets when the search page is accessible', () => {
    const records = parseCcgpSearchHtml(`
      <ul>
        <li><a href="/cggg/dfgg/gkzb/202606/t20260604_1.htm">Ferric chloride reagent procurement</a>
        采购人：中国化工研究院 发布时间：2026-06-04</li>
      </ul>
    `, { baseUrl: 'https://www.ccgp.gov.cn/' })

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      country: 'China',
      organization: '中国化工研究院',
      source: 'CCGP search parser',
    })
    expect(records[0].items[0].name).toBe('ferric chloride')
  })

  it('handles CCGP anti-bot pages as an empty source instead of failing', () => {
    expect(parseCcgpSearchHtml('<title>频繁访问!中国政府采购网</title>')).toEqual([])
  })

  it('writes and merges Asia tender demand feed records', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-asia-tenders-'))
    const outputPath = join(dir, 'asia-tenders.json')
    const feed = await collectAsiaTenderDemand({
      fetchImpl: async (url) => ({
        ok: true,
        text: async () => String(url).includes('ccgp') ? '<title>频繁访问!中国政府采购网</title>' : CPPP_HTML,
      }),
      outputPath,
      previousFallback: false,
    })

    expect(feed.items).toHaveLength(1)
    expect(JSON.parse(await readFile(outputPath, 'utf8')).items[0].country).toBe('India')

    await rm(dir, { force: true, recursive: true })
  })

  it('mirrors Asia tender notice text into local TenderStart documents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tenderstart-asia-docs-'))
    const outputPath = join(dir, 'asia-tenders.json')
    const documentDir = join(dir, 'documents')
    const feed = await collectAsiaTenderDemand({
      documentDir,
      fetchImpl: async (url) => ({
        ok: true,
        text: async () => String(url).includes('ccgp') ? '<title>йў‘з№Ѓи®їй—®!дё­е›Ѕж”їеєњй‡‡иґ­зЅ‘</title>' : CPPP_HTML,
      }),
      mirrorDocuments: true,
      outputPath,
      previousFallback: false,
    })

    const notice = feed.items[0].documents.find((document) => document.type === 'procurement_notice')
    expect(notice.localPath).toContain('notice.txt')
    expect(notice.status).toBe('mirrored_text_snapshot')
    expect(await readFile(notice.localPath, 'utf8')).toContain('Department of Defence Production')

    await rm(dir, { force: true, recursive: true })
  })
})
