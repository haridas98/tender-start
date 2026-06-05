import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { materials, plants } from './data/market'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => cleanup())

describe('TenderStart deal OS', () => {
  it('renders the new procurement-first sulfur workspace', () => {
    render(<App />)

    expect(screen.getByText('TenderStart')).toBeInTheDocument()
    expect(screen.getByText('Deal OS')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Введите вещество, завод или страну')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Мне нужна сера' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Хочу найти покупателя' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сравнить поставщиков' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Найти импортозамещение' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Сера' })).toBeInTheDocument()
    expect(screen.getByText('7704-34-9')).toBeInTheDocument()
    expect(screen.getByText('2503 00 000 0')).toBeInTheDocument()
    expect(screen.getAllByText('Сера гранулированная 99.9%').length).toBeGreaterThan(0)
    expect(screen.getByText('100 т/мес')).toBeInTheDocument()
    expect(screen.getAllByText('$174/т').length).toBeGreaterThan(0)

    expect(screen.getByText(/Лучшие поставщики/)).toBeInTheDocument()
    expect(screen.getByText('Самая низкая цена')).toBeInTheDocument()
    expect(screen.getByText('Самый надежный вариант')).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Сравнение поставщиков серы' })
    expect(within(table).getByText('Reliance Industries')).toBeInTheDocument()
    expect(within(table).getByText('Tengizchevroil')).toBeInTheDocument()
    expect(within(table).getByText('Sinopec Maoming')).toBeInTheDocument()
    expect(within(table).getAllByRole('button', { name: 'Источник' }).length).toBeGreaterThan(0)

    expect(screen.getByText('Кому может быть нужна')).toBeInTheDocument()
    expect(screen.getAllByText('Казаньоргсинтез').length).toBeGreaterThan(0)
    expect(screen.getByText('AI-аналитик сделки')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Собрать сделку через TenderStart' })).toBeInTheDocument()
  })

  it('keeps slugs and opens deal room and sources', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/materials/sulfur')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Сера' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/materials/sulfur')

    await user.click(screen.getByRole('button', { name: 'Собрать сделку через TenderStart' }))
    expect(window.location.pathname).toBe('/deals/sulfur-ufa-rfq')
    expect(screen.getByRole('heading', { name: 'Deal room: сера для Уфы' })).toBeInTheDocument()
    expect(screen.getByText('RFQ поставщикам')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Источники' }))
    expect(window.location.pathname).toBe('/sources')
    expect(screen.getByRole('heading', { name: 'Источники и доверие' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Как данные попадают в карточку' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Азия: покрытие базы' })).toBeInTheDocument()
    expect(screen.getByText('ЕИС закупки')).toBeInTheDocument()
    expect(screen.getByText('UN Comtrade')).toBeInTheDocument()
  })

  it('opens the federal demo flow and producer profile screens', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/demo')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'TenderStart: от потребности завода до готового RFQ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Маршрут показа на завтра' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3 готовых примера для жюри' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Кому это нужно' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Как TenderStart зарабатывает' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Формулировка для федерального этапа' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Начать с СНХЗ/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Регистрация производителя/ })).toBeInTheDocument()
    expect(screen.getByText('Success fee')).toBeInTheDocument()
    expect(screen.getByText('ИП / участник тендера')).toBeInTheDocument()
    expect(screen.getByText('Потребность внутри сервиса')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Регистрация производителя/ }))
    expect(window.location.pathname).toBe('/producer/register')
    expect(screen.getByRole('heading', { name: 'Регистрация производителя в TenderStart' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Что производитель заполняет сам' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Glycidol, CAS 556-52-5')).toBeInTheDocument()
    expect(screen.getByText('Продуктовая матрица производителя')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Открыть демо-профиль/ }))
    expect(window.location.pathname).toBe('/producers/demo-verified-chemical')
    expect(screen.getByRole('heading', { name: 'Demo Verified Chemical Works' })).toBeInTheDocument()
    expect(screen.getByText('Прямой производитель, не трейдер')).toBeInTheDocument()
    expect(screen.getAllByText('COA, SDS/MSDS, TDS').length).toBeGreaterThan(0)
  })

  it('keeps presentation demo route buttons functional', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/demo')
    const { rerender } = render(<App />)

    await user.click(screen.getByRole('button', { name: 'Открыть кейс глицидола' }))
    expect(window.location.pathname).toBe('/materials/snhz-glycidol')
    expect(screen.getAllByRole('heading', { name: 'Глицидол' }).length).toBeGreaterThan(0)

    window.history.pushState({}, '', '/demo')
    window.dispatchEvent(new PopStateEvent('popstate'))
    rerender(<App />)

    await user.click(screen.getByRole('button', { name: 'RFQ по FeCl3' }))
    expect(window.location.pathname).toBe('/deals/ferric-chloride-import-rfq')
    expect(screen.getByRole('heading', { name: 'Deal room: Хлорид железа (FeCl3)' })).toBeInTheDocument()

    window.history.pushState({}, '', '/demo')
    window.dispatchEvent(new PopStateEvent('popstate'))
    rerender(<App />)

    await user.click(screen.getByRole('button', { name: 'Источники данных' }))
    expect(window.location.pathname).toBe('/sources')
    expect(screen.getByRole('heading', { name: 'Источники и доверие' })).toBeInTheDocument()
  })

  it('keeps top actions functional for roles, global search and import map', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/materials/sulfur')
    render(<App />)

    await user.clear(screen.getByPlaceholderText('Введите вещество, завод или страну'))
    await user.type(screen.getByPlaceholderText('Введите вещество, завод или страну'), 'глицидол{Enter}')

    expect(window.location.pathname).toBe('/materials/snhz-glycidol')
    expect(screen.getAllByRole('heading', { name: 'Глицидол' }).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Логист' }))
    expect(screen.getByText('Логистика и таможня')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Открыть правила' }))
    expect(window.location.pathname).toBe('/rules')

    await user.click(screen.getByRole('button', { name: 'Найти импортозамещение' }))
    expect(window.location.pathname).toBe('/map/snhz-glycidol')
    expect(screen.getByRole('heading', { name: 'Импортозамещение и маршруты: Глицидол' })).toBeInTheDocument()
    expect(screen.getAllByText('Agex Pharma glycidol lead').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Собрать RFQ' }))
    expect(window.location.pathname).toBe('/deals/snhz-glycidol-import-rfq')
    expect(screen.getByRole('heading', { name: 'Deal room: Глицидол' })).toBeInTheDocument()
  })

  it('keeps route context for direct deal, supplier and buyer pages', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/deals/ferric-chloride-import-rfq')
    const { rerender } = render(<App />)

    expect(screen.getByRole('heading', { name: 'Deal room: Хлорид железа (FeCl3)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Найти импортозамещение' }))
    expect(window.location.pathname).toBe('/map/ferric-chloride')
    expect(screen.getByRole('heading', { name: 'Импортозамещение и маршруты: Хлорид железа (FeCl3)' })).toBeInTheDocument()

    window.history.pushState({}, '', '/suppliers/kmml')
    window.dispatchEvent(new PopStateEvent('popstate'))
    rerender(<App />)

    await user.click(screen.getByRole('button', { name: 'Собрать RFQ' }))
    expect(window.location.pathname).toBe('/deals/titanium-dioxide-import-rfq')
    expect(screen.getByRole('heading', { name: 'Deal room: Диоксид титана' })).toBeInTheDocument()

    window.history.pushState({}, '', '/buyers/kazan-plast')
    window.dispatchEvent(new PopStateEvent('popstate'))
    rerender(<App />)

    await user.click(screen.getByRole('button', { name: 'Подготовить КП покупателю' }))
    expect(window.location.pathname).toBe('/deals/titanium-dioxide-import-rfq')
  })

  it('shows a turnkey ferric chloride tender with India suppliers, docs and route costs', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/materials/ferric-chloride')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Хлорид железа (FeCl3)' })).toBeInTheDocument()
    expect(screen.getByText('АО "АПТС"')).toBeInTheDocument()
    expect(screen.getByText('Коагулянт Хлорид железа (марка А), 12 т')).toBeInTheDocument()
    expect(screen.getByText('МКУП "ЭКОВОДТЕХНОЛОГИИ"')).toBeInTheDocument()
    expect(screen.getByText('60 т, НМЦ 2 080 000 ₽ с НДС')).toBeInTheDocument()
    expect(screen.getAllByText('Lomash Chemical Industries').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pooja Industries').length).toBeGreaterThan(0)
    expect(screen.getByText('Пошлина 5% + НДС 20%')).toBeInTheDocument()
    expect(screen.getAllByText('COA по партии').length).toBeGreaterThan(0)
    expect(screen.getByText('Nhava Sheva/Mundra → Новороссийск → Татарстан')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Собрать сделку через TenderStart' }))
    expect(window.location.pathname).toBe('/deals/ferric-chloride-import-rfq')
    expect(screen.getByRole('heading', { name: 'Deal room: Хлорид железа (FeCl3)' })).toBeInTheDocument()
    expect(screen.getByText('ТН ВЭД 2827 39 200 0')).toBeInTheDocument()
    expect(screen.getByText('UN 2582, Class 8')).toBeInTheDocument()
    expect(screen.getByText('Запросить COA/MSDS/TDS у 5 индийских производителей')).toBeInTheDocument()
  })

  it('opens the global duties and rules layer', () => {
    window.history.pushState({}, '', '/rules')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Пошлины, налоги и правила' })).toBeInTheDocument()
    expect(screen.getByText('Индия → Россия')).toBeInTheDocument()
    expect(screen.getByText('WTO Tariff Download Facility')).toBeInTheDocument()
    expect(screen.getByText('EAEU Common Customs Tariff')).toBeInTheDocument()
    expect(screen.getByText('ICEGATE')).toBeInTheDocument()
    expect(screen.getByText('США')).toBeInTheDocument()
    expect(screen.getByText('Китай')).toBeInTheDocument()
  })

  it('shows Asia coverage and visible India/China plant groups', async () => {
    window.history.pushState({}, '', '/plants')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'СНГ: покрытие базы' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Азия: покрытие базы' })).toBeInTheDocument()
    expect(screen.getByText('Индия 100/регион, Китай 150/регион')).toBeInTheDocument()
    expect(screen.getByText('Government e-Marketplace (GeM)')).toBeInTheDocument()
    expect(screen.getByText('China Government Procurement Network')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'India' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { name: 'China' }).length).toBeGreaterThan(0)
    expect(await screen.findByText('1740', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText('12/67')).toBeInTheDocument()
    expect(screen.getAllByText(/компания|завод\/площадка/).length).toBeGreaterThan(0)

    const asiaLeadCard = (await screen.findByText('Department of Defence Production', {}, { timeout: 10000 })).closest('.plant-card')
    expect(asiaLeadCard).not.toBeNull()
    expect(within(asiaLeadCard as HTMLElement).getByText('Нужно проверить')).toBeInTheDocument()
    expect(within(asiaLeadCard as HTMLElement).getByText('компания')).toBeInTheDocument()
    expect(within(asiaLeadCard as HTMLElement).getByText('Адрес проверить')).toBeInTheDocument()
    expect(within(asiaLeadCard as HTMLElement).getByText('Продукция требует проверки')).toBeInTheDocument()
    expect(within(asiaLeadCard as HTMLElement).getByText('Нужна проверка')).toBeInTheDocument()
    expect(within(asiaLeadCard as HTMLElement).getByText('Проверок: 3')).toBeInTheDocument()
  })

  it('shows Asia tender enrichment in passport and source drawer', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/plants/buyer-department-of-defence-production-073956')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Department of Defence Production' }, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getAllByText('rubber sheet').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Technical specification / buyer document').length).toBeGreaterThan(0)

    const passport = screen.getByText('Что известно о заводе').closest('.plant-passport')
    expect(passport).not.toBeNull()
    expect(within(passport as HTMLElement).getAllByText('Нужно проверить').length).toBeGreaterThan(0)
    expect(within(passport as HTMLElement).getAllByText('компания').length).toBeGreaterThan(0)
    expect(within(passport as HTMLElement).getByText('Адрес проверить')).toBeInTheDocument()
    expect(within(passport as HTMLElement).getByText('Продукция требует проверки')).toBeInTheDocument()
    expect(within(passport as HTMLElement).getByText('Нужна проверка')).toBeInTheDocument()
    expect(within(passport as HTMLElement).getByText(/parsed tender notice/i)).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'откуда взяты данные' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Источник данных' })
    expect(within(dialog).getByText(/GeM-CPPP latest active tenders parser/)).toBeInTheDocument()
    expect(within(dialog).getByText('Что подтверждает источник')).toBeInTheDocument()
    expect(within(dialog).getByText('Лид на проверку')).toBeInTheDocument()
    expect(within(dialog).getByText('компания')).toBeInTheDocument()
    expect(within(dialog).getByText('Нужна проверка')).toBeInTheDocument()
    expect(within(dialog).getByText(/Official verification required/i)).toBeInTheDocument()
    expect(within(dialog).getAllByText(/parsed tender notice/i).length).toBeGreaterThan(0)
    expect(dialog).toBeInTheDocument()
  })

  it('opens a deal search command center from /search', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/search')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Поиск сырья и сделки' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Сера, диоксид титана, силикагель, завод или страна')).toBeInTheDocument()
    expect(screen.getByText('Каталог веществ')).toBeInTheDocument()
    expect(screen.getAllByText('Диоксид титана').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Силикагель').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Поставщики' })).toBeInTheDocument()
    expect(screen.getByText('The Kerala Minerals and Metals')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Покупатели' })).toBeInTheDocument()
    expect(screen.getAllByText('Казаньоргсинтез').length).toBeGreaterThan(0)

    await user.clear(screen.getByPlaceholderText('Сера, диоксид титана, силикагель, завод или страна'))
    await user.type(screen.getByPlaceholderText('Сера, диоксид титана, силикагель, завод или страна'), 'силикагель')

    expect(screen.getByText('Sorbead India')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Открыть Силикагель' }))
    expect(window.location.pathname).toBe('/materials/silica-gel')
  })

  it('loads the full plant index for search results outside the directory preview', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/search')
    render(<App />)

    await user.clear(screen.getByPlaceholderText('Сера, диоксид титана, силикагель, завод или страна'))
    await user.type(screen.getByPlaceholderText('Сера, диоксид титана, силикагель, завод или страна'), 'Алфит')

    const plantName = await screen.findByText('Гален (Алфит)', {}, { timeout: 30000 })
    const plantCard = plantName.closest('article')
    expect(plantCard).not.toBeNull()
    expect(within(plantCard as HTMLElement).getByText(/Алтайский край/)).toBeInTheDocument()
  })

  it('loads the full plant index for direct plant slugs outside the directory preview', async () => {
    window.history.pushState({}, '', '/plants/mass-altayskiy-kray-galen-0')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Гален (Алфит)' }, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getAllByText(/Алтайский край/).length).toBeGreaterThan(0)
    expect(screen.getByText('Что закупает завод')).toBeInTheDocument()
  })

  it('loads regional plant chunks for direct CIS, EU and Asia slugs', async () => {
    const regionalSlugs = [
      {
        name: 'Баку Стил Кастинг',
        path: '/plants/cis-azerbaijan-baku-stil-kasting',
      },
      {
        name: 'Austro-Daimler',
        path: '/plants/eu-austria-wikidata-austria-q27091',
      },
      {
        name: 'A区70座',
        path: '/plants/asia-china-fujian-a-70-7677814661',
      },
    ]

    window.history.pushState({}, '', regionalSlugs[0].path)
    const { rerender } = render(<App />)

    for (const plant of regionalSlugs) {
      window.history.pushState({}, '', plant.path)
      window.dispatchEvent(new PopStateEvent('popstate'))
      rerender(<App />)

      expect(await screen.findByRole('heading', { name: plant.name }, { timeout: 20000 })).toBeInTheDocument()
      expect(screen.getByText('Что закупает завод')).toBeInTheDocument()
    }
  })

  it('does not show the plant directory while resolving an unknown plant slug', async () => {
    window.history.pushState({}, '', '/plants/mass-no-such-demo-slug')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Подтягиваем завод' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Реестр заводов РФ, СНГ, Европы и Азии' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Завод не найден' }, { timeout: 20000 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Реестр заводов РФ, СНГ, Европы и Азии' })).not.toBeInTheDocument()
    expect(screen.getByText('Похожие заводы')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть реестр заводов' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Поиск сырья и заводов' })).toBeInTheDocument()
    expect(screen.getByText('Что проверить в парсере')).toBeInTheDocument()
  })

  it('shows ECOSYS CAS records inside the search screen', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/search')
    render(<App />)

    expect(screen.getByText('ECOSYS CAS-база')).toBeInTheDocument()
    expect(await screen.findByText(/записей PubChem\/CAS/)).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Сера, диоксид титана, силикагель, завод или страна'))
    await user.type(screen.getByPlaceholderText('Сера, диоксид титана, силикагель, завод или страна'), 'oxidane')

    expect(await screen.findByText('oxidane')).toBeInTheDocument()
    expect(screen.getByText('CID 962')).toBeInTheDocument()
    expect(screen.getByText('7732-18-5')).toBeInTheDocument()
    expect(screen.getByText('H2O')).toBeInTheDocument()

    const cidCard = screen.getByText('CID 962').closest('.ecosys-record-card')
    expect(cidCard).not.toBeNull()
    await user.click(within(cidCard as HTMLElement).getByRole('button', { name: 'Открыть карточку CID 962' }))

    expect(window.location.pathname).toBe('/chemicals/962')
    expect(screen.getByRole('heading', { name: 'oxidane' })).toBeInTheDocument()
    expect(screen.getByText('ECOSYS: химический паспорт')).toBeInTheDocument()
    expect(screen.getAllByText('7732-18-5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('H2O').length).toBeGreaterThan(0)
    expect(screen.getByText('chemicals/by-cid/000/962.json')).toBeInTheDocument()
    expect(screen.getByText('Что нужно дозагрузить')).toBeInTheDocument()
  })

  it('links a material card to its ECOSYS chemical passport by CAS', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/materials/sulfur')
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'ECOSYS паспорт CAS 7704-34-9' }))

    expect(window.location.pathname).toBe('/chemicals/5362487')
    expect(screen.getAllByRole('heading', { name: 'Сера' }).length).toBeGreaterThan(0)
    expect(screen.getByText('ECOSYS: химический паспорт')).toBeInTheDocument()
    expect(screen.getAllByText('7704-34-9').length).toBeGreaterThan(0)
  })

  it('links an ECOSYS chemical passport back to the TenderStart market card', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/chemicals/5362487')
    render(<App />)

    expect(await screen.findByText('TenderStart: рыночная карточка')).toBeInTheDocument()
    expect(screen.getByText('4 поставщика')).toBeInTheDocument()
    expect(screen.getByText('3 покупателя')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Открыть рынок Сера' }))

    expect(window.location.pathname).toBe('/materials/sulfur')
    expect(screen.getByRole('heading', { name: 'Сера' })).toBeInTheDocument()
  })

  it('opens supplier, buyer and plant pages by their slugs', () => {
    window.history.pushState({}, '', '/suppliers/kmml')
    const { rerender } = render(<App />)

    expect(screen.getByRole('heading', { name: 'The Kerala Minerals and Metals' })).toBeInTheDocument()
    expect(screen.getByText('Диоксид титана')).toBeInTheDocument()
    expect(screen.getByText('$2 870/т')).toBeInTheDocument()

    window.history.pushState({}, '', '/buyers/kazan-plast')
    window.dispatchEvent(new PopStateEvent('popstate'))
    rerender(<App />)

    expect(screen.getByRole('heading', { name: 'Казанский завод пластмасс' })).toBeInTheDocument()
    expect(screen.getByText('Диоксид титана')).toBeInTheDocument()
    expect(screen.getByText('90 т/мес')).toBeInTheDocument()

    window.history.pushState({}, '', '/plants/kazanorgsintez')
    window.dispatchEvent(new PopStateEvent('popstate'))
    rerender(<App />)

    expect(screen.getByRole('heading', { name: 'Казаньоргсинтез' })).toBeInTheDocument()
    expect(screen.getByText('Производит')).toBeInTheDocument()
    expect(screen.getByText('Что закупает завод')).toBeInTheDocument()
    expect(screen.getAllByText('Сера').length).toBeGreaterThan(0)
  })

  it('shows a region-by-region plant registry for Russia, CIS, Europe and Asia', () => {
    window.history.pushState({}, '', '/plants')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Реестр заводов РФ, СНГ, Европы и Азии' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'СНГ: покрытие базы' })).toBeInTheDocument()
    expect(screen.getByText('Заводов СНГ')).toBeInTheDocument()
    expect(screen.getAllByText('510').length).toBeGreaterThan(0)
    expect(screen.getByText('Заводов Азии')).toBeInTheDocument()
    expect(screen.getAllByText('1740').length).toBeGreaterThan(0)
    expect(screen.getByText('9/9')).toBeInTheDocument()
    expect(screen.getByText('Россия')).toBeInTheDocument()
    expect(screen.getAllByText('Казахстан').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Беларусь').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Узбекистан').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Кыргызстан').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Армения').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Азербайджан').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Таджикистан').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Молдова').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Туркменистан').length).toBeGreaterThan(0)
    expect(screen.getByText('Германия')).toBeInTheDocument()
    expect(screen.getByText('Франция')).toBeInTheDocument()
    expect(screen.getByText('Нидерланды')).toBeInTheDocument()
    expect(screen.getByText('Польша')).toBeInTheDocument()
    expect(screen.getByText('Республика Адыгея')).toBeInTheDocument()
    expect(screen.getByText('Республика Башкортостан')).toBeInTheDocument()
    expect(screen.getByText('Республика Татарстан')).toBeInTheDocument()
    expect(screen.getByText('Молочный завод Тамбовский')).toBeInTheDocument()
    expect(screen.getByText('ЗАРЕМ')).toBeInTheDocument()
    expect(screen.getByText('Башкирская содовая компания')).toBeInTheDocument()
    expect(screen.getByText('Нижнекамскнефтехим')).toBeInTheDocument()
    expect(screen.getByText('BASF Ludwigshafen Verbund')).toBeInTheDocument()
    expect(screen.getByText('Shell Chemicals Moerdijk')).toBeInTheDocument()
    expect(screen.getByText('ORLEN Plock')).toBeInTheDocument()
    expect(screen.getByText('Qarmet')).toBeInTheDocument()
    expect(screen.getByText('Navoiyazot')).toBeInTheDocument()
  })

  it('shows plant branding and public procurement contacts', () => {
    window.history.pushState({}, '', '/plants/adygea-zarem')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'ЗАРЕМ' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Логотип ЗАРЕМ' })).toBeInTheDocument()
    expect(screen.getByText('Паспорт завода')).toBeInTheDocument()
    expect(screen.getAllByText(/отдел снабжения/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/57-81-35/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Официальный сайт завода/i })).toHaveAttribute('href', 'https://www.zarem.ru/')
    expect(screen.getByText('Как выглядит продукция и сырьё')).toBeInTheDocument()
    expect(screen.getAllByText(/Машиностроительные изделия/).length).toBeGreaterThan(0)
  })

  it('adds source-backed curated European plant cards', () => {
    expect(plants['eu-germany-basf-ludwigshafen'].dataQuality).toBe('verified')
    expect(plants['eu-germany-basf-ludwigshafen'].productionItems?.[0].documents).toContain('SDS/MSDS')
    expect(plants['eu-germany-basf-ludwigshafen'].procurementEvidence?.[0].sourceUrl).toContain('basf.com')
    expect(plants['eu-netherlands-shell-moerdijk'].purchaseCategories).toContain('нафта')
    expect(plants['eu-poland-orlen-plock'].purchaseCategories).toContain('водород')
    expect(plants['eu-ireland-intel-leixlip'].needs[0].spec).toContain('semiconductor grade')
  })

  it('separates procurement evidence from industry hypotheses', () => {
    window.history.pushState({}, '', '/plants/adygea-feed-mill')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Адыгейский комбикормовый завод' })).toBeInTheDocument()
    expect(screen.getByText('Поиск закупок сырья для комбикорма')).toBeInTheDocument()
    expect(screen.getByText('профильная гипотеза')).toBeInTheDocument()
    expect(screen.getAllByText('ТЗ/спецификация').length).toBeGreaterThan(0)
    expect(screen.getAllByText('премиксы').length).toBeGreaterThan(0)
  })

  it('keeps plant evidence inside the service instead of sending users to source sites', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/plants/adygea-agrokompleks-organika')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'АГРОКОМПЛЕКС ОРГАНИКА' })).toBeInTheDocument()
    expect(screen.getByText('Поиск закупок и договоров: АГРОКОМПЛЕКС ОРГАНИКА')).toBeInTheDocument()
    expect(screen.getAllByText('семена').length).toBeGreaterThan(0)
    expect(screen.getAllByText('органические удобрения').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.plant-source-row a')).toHaveLength(0)

    const procurementCard = screen
      .getByText('Поиск закупок и договоров: АГРОКОМПЛЕКС ОРГАНИКА')
      .closest('.procurement-evidence')

    expect(procurementCard).not.toBeNull()

    await user.click(within(procurementCard as HTMLElement).getByRole('button', { name: /откуда/i }))
    const sourceDialog = screen.getByRole('dialog', { name: 'Источник данных' })

    expect(sourceDialog).toBeInTheDocument()
    expect(within(sourceDialog).getByRole('heading', { name: 'ЕИС закупки' })).toBeInTheDocument()
    expect(within(sourceDialog).getByText(/Поиск закупок и договоров: АГРОКОМПЛЕКС ОРГАНИКА/)).toBeInTheDocument()
    expect(within(sourceDialog).getByText(/Досье документов:/)).toBeInTheDocument()
    expect(within(sourceDialog).getByText('Данные перенесены в карточку TenderStart; внешний адрес нужен только для аудита.')).toBeInTheDocument()
    expect(within(sourceDialog).queryByRole('link')).toBeNull()
  })

  it('shows the full procurement dossier in the plant card', () => {
    window.history.pushState({}, '', '/plants/adygea-agrokompleks-organika')
    render(<App />)

    expect(screen.getByText('Позиции закупки')).toBeInTheDocument()
    expect(screen.getAllByText('Семена овощных культур').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Органические удобрения').length).toBeGreaterThan(0)
    expect(screen.getByText('ТЗ и требования')).toBeInTheDocument()
    expect(screen.getAllByText('Указать культуру, сорт/гибрид, репродукцию, партию, всхожесть и срок годности').length).toBeGreaterThan(0)
    expect(screen.getByText('Пакет документов')).toBeInTheDocument()
    expect(screen.getAllByText('ТЗ/спецификация').length).toBeGreaterThan(0)
    expect(screen.getAllByText('проект договора').length).toBeGreaterThan(0)
    expect(screen.getByText('Документы в сервисе')).toBeInTheDocument()
    expect(screen.getByText('Пакет качества')).toBeInTheDocument()
    expect(screen.getByText('структурировано в карточке; оригинал файла нужно дозагрузить парсером')).toBeInTheDocument()
    expect(screen.getByText('Условия договора')).toBeInTheDocument()
    expect(screen.getByText('Поставка партиями под сезон, приемка по качеству и документам')).toBeInTheDocument()
    expect(screen.getByText('Что дозагрузить')).toBeInTheDocument()
    expect(screen.getByText('номер закупки, НМЦК, сроки подачи заявок, файл ТЗ и проект договора после парсинга ЕИС/ЭТП')).toBeInTheDocument()
  })

  it('shows a detailed database-backed plant card for DomBytKhim', () => {
    window.history.pushState({}, '', '/plants/adygea-dombytkhim')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'ДомБытХим' })).toBeInTheDocument()
    expect(screen.getByText('ИНН')).toBeInTheDocument()
    expect(screen.getByText('0107017663')).toBeInTheDocument()
    expect(screen.getByText('ОГРН')).toBeInTheDocument()
    expect(screen.getByText('1090107001082')).toBeInTheDocument()
    expect(screen.getByText('Количество сотрудников')).toBeInTheDocument()
    expect(screen.getByText('180')).toBeInTheDocument()
    expect(screen.getAllByText('Средства бытовой химии под СТМ').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Анионные/неионогенные ПАВ').length).toBeGreaterThan(0)
    expect(screen.getByText('OFAC SDN')).toBeInTheDocument()
    expect(screen.getAllByText('ЕИС: поиск закупок и договоров по ИНН 0107017663').length).toBeGreaterThan(0)
  })

  it('covers the next Adygea food-manufacturing layer with source-backed leads', () => {
    const adygeaPlants = Object.values(plants).filter((plant) => plant.region === 'Республика Адыгея')

    expect(adygeaPlants.length).toBeGreaterThanOrEqual(45)
    expect(plants['adygea-greenvill'].sourceUrl).toBe('https://foodsuppliers.ru/company/greenvill')
    expect(plants['adygea-adygeyskiy-konservnyy-kombinat'].procurementEvidence?.length).toBeGreaterThan(0)
    expect(plants['adygea-hatukayskiy-konservnyy-zavod'].products).toContain('консервы')
    expect(plants['adygea-krasnogvardeyskiy-molochnyy-zavod'].purchaseCategories).toContain('молоко-сырье')
    expect(plants['adygea-agrokompleks-organika'].procurementEvidence?.[0].source).toBe('ЕИС закупки')
  })

  it('excludes meat, fish and alcohol businesses from the visible plant base', () => {
    const bannedPattern = /пив|алког|водоч|ликер|винн|вино|wine|winery|beer|brew|alcohol|meat|fish|seafood|chicken|poultry|мяс|рыб|икр|осетр|морепродукт|хмел|солод|птиц|индей|гусь|колбас|убойн|хладобойн/i
    const visiblePlantText = Object.values(plants)
      .map((plant) =>
        [
          plant.name,
          plant.industry,
          ...(plant.products ?? []),
          ...(plant.purchaseCategories ?? []),
          ...(plant.needs ?? []).flatMap((need) => [need.materialName, need.note, need.spec]),
        ].join(' '),
      )
      .join(' ')

    expect(visiblePlantText).not.toMatch(bannedPattern)
    expect(plants['adygea-maykop-brewery']).toBeUndefined()
    expect(plants['adygea-piteyniy-dom']).toBeUndefined()
    expect(plants['adygea-myasnaya-karusel']).toBeUndefined()
    expect(plants['adygea-carskiy-ulov']).toBeUndefined()
    expect(plants.snhz).toBeDefined()
    expect(plants.snhz.purchaseCategories).toContain('Спирт бутиловый нормальный технический, марка А')
  })

  it('adds the next region layers for Bashkortostan and Tatarstan', () => {
    const byRegion = Object.values(plants).reduce<Record<string, number>>((acc, plant) => {
      acc[plant.region] = (acc[plant.region] ?? 0) + 1
      return acc
    }, {})

    expect(byRegion['Республика Башкортостан']).toBeGreaterThanOrEqual(45)
    expect(byRegion['Республика Татарстан']).toBeGreaterThanOrEqual(20)
    expect(plants['bashkortostan-farmstandart-ufavita'].sourceUrl).toBe('https://manufacturers.ru/company/farmstandart-ufavita')
    expect(plants['bashkortostan-elementy-truboprovoda'].purchaseCategories).toContain('трубы')
    expect(plants['bashkortostan-ufimkabel'].products).toContain('кабельная продукция')
    expect(plants['bashkortostan-beloretskiy-metallurgicheskiy-kombinat'].purchaseCategories).toContain('катанка')
    expect(plants['bashkortostan-meleuzovskiy-molkonservnyy-kombinat'].sourceUrl).toBe('https://foodsuppliers.ru/company/meleuzovskiy-molochnokonservnyy-kombinat')
    expect(plants['tatarstan-almetevskiy-trubnyy-zavod'].products).toContain('трубы')
    expect(plants['tatarstan-akulchev'].procurementEvidence?.[0].source).toBe('ЕИС закупки')
  })

  it('shows concrete product and demand lines on plant pages', () => {
    window.history.pushState({}, '', '/plants/bashkortostan-ufimkabel')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Уфимкабель' })).toBeInTheDocument()
    expect(screen.getByText('Паспорт завода')).toBeInTheDocument()
    expect(screen.getByText('Конкретные позиции производства')).toBeInTheDocument()
    expect(screen.getByText('Кабель силовой ВВГнг-LS')).toBeInTheDocument()
    expect(screen.getByText('0.66/1 кВ, медная жила, негорючая оболочка')).toBeInTheDocument()
    expect(screen.getAllByText('Характеристики').length).toBeGreaterThan(0)
    expect(screen.getByText('Как выглядит продукция и сырьё')).toBeInTheDocument()
    expect(screen.getAllByText(/Кабельная продукция/).length).toBeGreaterThan(0)
    expect(screen.getByText('Конкретные потребности')).toBeInTheDocument()
    expect(screen.getAllByText('Медная катанка 8 мм').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cu-ETP, 99.9%, бухты/катушки, сертификат химсостава').length).toBeGreaterThan(0)
    expect(plants['bashkortostan-ufimkabel'].productionItems?.[0].name).toBe('Кабель силовой ВВГнг-LS')
    expect(plants['bashkortostan-ufimkabel'].demandItems?.[0].sourceUrl).toContain('zakupki.gov.ru')
  })

  it('shows the SNHZ official raw material matrix inside the plant card', async () => {
    const user = userEvent.setup()

    window.history.pushState({}, '', '/plants/snhz')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Стерлитамакский нефтехимический завод' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Завод за 60 секунд' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'RFQ' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Досье').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Официальный сайт завода/i })).toHaveAttribute('href', 'https://snhz.ru/')
    expect(screen.getByText('Как выглядит продукция и сырьё')).toBeInTheDocument()
    expect(screen.getAllByText('Характеристики').length).toBeGreaterThan(0)
    expect(screen.getByText('Постоянный закуп сырья СНХЗ: 117 конкретных позиций')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Показать всю базу потребностей (117)' })).toBeInTheDocument()
    expect(screen.getByText('Матрица потребностей СНХЗ')).toBeInTheDocument()
    expect(screen.getAllByText('Глицидол').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ТУ 38402-62-162-96').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Валиахметов Руслан Азатович/).length).toBeGreaterThan(0)
    expect(plants.snhz.demandItems).toHaveLength(117)
    expect(plants.snhz.demandItems?.[0].materialSlug).toBe('snhz-glycidol')
    expect(plants.snhz.demandItems?.[0].cas).toBe('556-52-5')
    expect(plants.snhz.demandItems?.[0].responsible).toMatchObject({
      email: 'zaharov.ra@ruschem.ru',
      name: 'Захаров Роман Александрович',
      phone: '+7 (3473) 29-42-22',
    })
    expect(materials['snhz-glycidol'].cas).toBe('556-52-5')
    expect(plants.snhz.procurementContacts).toHaveLength(9)
    expect(screen.getAllByText('Ответственный за позицию').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Захаров Роман Александрович').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Чинкараева Дина Алексеевна/).length).toBeGreaterThan(0)

    const demandSearch = screen.getByLabelText('Поиск потребностей завода')
    await user.type(demandSearch, 'диметил')
    expect(screen.getAllByText('Диметилформамид (ДМФА)').length).toBeGreaterThan(0)
    await user.clear(demandSearch)
    await user.type(demandSearch, 'бутил')
    expect(screen.getAllByText('Спирт бутиловый нормальный технический, марка А').length).toBeGreaterThan(0)
    await user.clear(demandSearch)

    await user.click(screen.getAllByRole('button', { name: 'Глицидол: открыть вещество' })[0])
    expect(window.location.pathname).toBe('/materials/snhz-glycidol')
    expect(screen.getAllByRole('heading', { name: 'Глицидол' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('556-52-5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('C3H6O2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Agex Pharma glycidol lead').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Hangzhou Keying Chem glycidol lead').length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: 'Лучшие поставщики (3)' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: 'Самая низкая цена' }))
    expect(screen.getByRole('tab', { name: 'Самая низкая цена' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Показать источники вывода' }))
    expect(screen.getByRole('dialog', { name: 'Источник данных' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))

    await user.click(screen.getByRole('button', { name: 'Собрать сделку через TenderStart' }))
    expect(window.location.pathname).toBe('/deals/snhz-glycidol-import-rfq')
    expect(screen.getByRole('heading', { name: 'Deal room: Глицидол' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить RFQ (демо)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Построить маршрут' })).toBeInTheDocument()
    expect(screen.getByText('Стерлитамакский нефтехимический завод: постоянный закуп; точный объем по RFQ/тендеру')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Карточка покупателя' }))
    expect(window.location.pathname).toBe('/plants/snhz')
    expect(screen.getByRole('heading', { name: 'Стерлитамакский нефтехимический завод' })).toBeInTheDocument()
  })

  it('does not mask unknown deal and producer slugs', () => {
    window.history.pushState({}, '', '/deals/unknown-import-rfq')
    const { rerender } = render(<App />)

    expect(screen.getByRole('heading', { name: 'Сделка не найдена' })).toBeInTheDocument()

    window.history.pushState({}, '', '/producers/unknown-producer')
    window.dispatchEvent(new PopStateEvent('popstate'))
    rerender(<App />)

    expect(screen.getByRole('heading', { name: 'Профиль производителя не найден' })).toBeInTheDocument()
  })

  it('adds direct producer leads to SNHZ material pages', () => {
    expect(materials['snhz-phenol'].suppliers.map((supplier) => supplier.name)).toContain('Deepak Phenolics Limited')
    expect(materials['snhz-phenol'].suppliers[0].capacity).toContain('330 KTA')
    expect(materials['snhz-sodium-hydroxide'].suppliers.map((supplier) => supplier.name)).toContain('Gujarat Alkalies and Chemicals Limited')
    expect(materials['snhz-sodium-hydroxide'].suppliers.map((supplier) => supplier.name)).toContain('Nirma Limited')
    expect(materials['snhz-dimethylformamide'].suppliers.map((supplier) => supplier.name)).toContain('Balaji Amines Limited')
    expect(materials['snhz-formaldehyde'].suppliers.map((supplier) => supplier.name)).toContain('Kanoria Chemicals & Industries Limited')
    expect(materials['snhz-1-butanol'].suppliers.map((supplier) => supplier.name)).toContain('The Andhra Petrochemicals Limited')
    expect(materials['snhz-sodium-silicate'].suppliers.map((supplier) => supplier.name)).toContain('Kiran Global Chems Limited')
    expect(materials['snhz-1-3-butadiene'].suppliers.map((supplier) => supplier.name)).toContain('IndianOil')
    expect(materials['snhz-cyclohexanone'].suppliers.map((supplier) => supplier.name)).toContain('Gujarat State Fertilizers & Chemicals Limited')

    window.history.pushState({}, '', '/materials/snhz-phenol')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Фенол' })).toBeInTheDocument()
    expect(screen.getAllByText('Deepak Phenolics Limited').length).toBeGreaterThan(0)
    expect(screen.getAllByText('INEOS Phenol').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Phenol 330 KTA, Acetone 200 KTA, IPA 80 KTA').length).toBeGreaterThan(0)
  })
})

