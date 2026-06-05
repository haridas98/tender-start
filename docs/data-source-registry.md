# TenderStart: реестр источников данных

Цель сервиса минимум: помочь человеку или компании купить нужное сырье дешевле, быстрее и надежнее. Пользователь вводит вещество, например "сера", "диоксид титана", "силикагель", а система показывает поставщиков, производителей, покупателей, спецификации, документы, примерную цену, логистику и следующий коммерческий шаг.

Главный принцип: каждая цифра и каждый вывод должны иметь источник, дату обновления и уровень уверенности.

## 1. Спрос: тендеры, закупки, потребности

### Россия

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| ЕИС закупки | https://zakupki.gov.ru | 44-ФЗ, 223-ФЗ, извещения, контракты, договоры, заказчики, НМЦК, победители, документы | P0 |
| FTP/XML ЕИС | ftp://ftp.zakupki.gov.ru | массовые XML-выгрузки извещений, протоколов, контрактов | P0 |
| Сбербанк-АСТ | https://www.sberbank-ast.ru | коммерческие и госзакупки, лоты, заказчики | P1 |
| РТС-тендер | https://www.rts-tender.ru | закупки, заказчики, лоты | P1 |
| ЕЭТП / Росэлторг | https://www.roseltorg.ru | закупки, заказчики, закупочная документация | P1 |
| ТЭК-Торг | https://www.tektorg.ru | промышленные закупки, нефтехимия, энергетика | P1 |
| ЭТП Газпромбанка | https://etpgpb.ru | закупки крупных компаний, химия, промышленность | P1 |
| B2B-Center | https://www.b2b-center.ru | коммерческие закупки заводов и холдингов | P1 |
| СИБУР: актуальные закупочные процедуры | https://www.sibur.ru/ru/procurement/buy/ | номер процедуры, предмет, способ, даты, организатор, статус, закупщик, телефон, email, категория, документация SRM | P0 для нефтехимии |
| Фабрикант | https://www.fabrikant.ru | закупки и продажи, промышленные лоты | P1 |
| Тендерплан / Контур.Закупки / СБИС Торги | коммерческие API/выгрузки | нормализованные закупочные данные | P2 |

Поля: вещество, описание лота, ОКПД2, ТН ВЭД, заказчик, регион, объем, единица измерения, цена, срок поставки, требования к документам, закупочная документация, победитель, история закупок.

### Международные закупки

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| TED EU Open Data | https://data.ted.europa.eu | тендеры ЕС, CPV, заказчики, суммы, страны | P1 |
| TED Search API | https://docs.ted.europa.eu/api/latest/search.html | API поиска публичных закупок ЕС | P1 |
| UNGM | https://www.ungm.org | закупки организаций ООН, контакты procurement, UNSPSC | P1 |
| UNGM API | https://developer.ungm.org | API notices, если будет доступ | P2 |
| World Bank Procurement | https://www.worldbank.org/en/projects-operations/procurement | закупки по проектам Всемирного банка | P2 |
| Asian Development Bank | https://www.adb.org/business | закупки ADB, проекты, поставки | P2 |

## 2. Производители и поставщики сырья

### Россия и ЕАЭС

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| ГИСП | https://gisp.gov.ru | российская промышленная продукция, производители, ОКПД2, ТН ВЭД, выписки | P0 |
| ФНС ЕГРЮЛ/ЕГРИП | https://egrul.nalog.ru | юрлицо, ИНН, ОГРН, адрес, руководитель, статус | P0 |
| Прозрачный бизнес ФНС | https://pb.nalog.ru | проверка контрагента, риск-сигналы | P1 |
| Федресурс | https://fedresurs.ru | банкротства, залоги, существенные факты | P1 |
| Картотека арбитражных дел | https://kad.arbitr.ru | судебные риски поставщика/покупателя | P1 |
| сайты заводов | официальные сайты компаний | продукция, паспорта качества, TDS, SDS/MSDS, контакты отделов | P0 |

### Индия

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| CHEMEXCIL | https://chemexcil.in | индийские экспортеры химии, отраслевые данные, участники | P0 |
| TRADESTAT India | https://tradestat.commerce.gov.in | экспорт/импорт Индии по HS, страны, годы | P0 |
| ICEGATE | https://www.icegate.gov.in | таможенная инфраструктура, тарифы, процедуры, IEC/портовые данные после доступа | P1 |
| MCA India | https://www.mca.gov.in | регистрационные данные компаний, CIN/LLPIN | P1 |
| IndiaMART | https://www.indiamart.com | лиды поставщиков, цены, MOQ, контакты | P1 |
| TradeIndia | https://www.tradeindia.com | поставщики, производители, экспортные предложения | P1 |
| ExportersIndia | https://www.exportersindia.com | поставщики и экспортные профили | P2 |
| сайты индийских заводов | официальные сайты | производимые вещества, мощности, документы, экспортные рынки | P0 |

IndiaMART/TradeIndia/ExportersIndia использовать как источник лидов, но не как финальную верификацию производителя. Производителя надо проверять через сайт компании, MCA, экспортные следы, сертификаты и ответы на RFQ.

### Китай

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| GACC China Customs | https://english.customs.gov.cn/Statistics/Statistics | таможенная статистика Китая | P0 |
| GSXT / NECIPS | https://www.gsxt.gov.cn | официальная проверка китайских компаний, USCC, статус, риски | P0 |
| Made-in-China | https://www.made-in-china.com | поставщики, товары, RFQ, экспортные предложения | P1 |
| Alibaba | https://www.alibaba.com | лиды поставщиков, цены, MOQ, контакты | P1 |
| 1688 | https://www.1688.com | внутренние цены Китая, фабрики и торговцы | P2 |
| ChemicalBook | https://www.chemicalbook.com | поставщики химии, CAS, предложения | P1 |
| Echemi | https://www.echemi.com | химический B2B, цены, поставщики | P1 |
| сайты заводов | официальные сайты | паспорта, мощности, сертификаты, реальные контакты | P0 |

Китайские маркетплейсы обязательно пропускать через фильтр "производитель или посредник": регистрация, scope деятельности, сайт, адрес завода, фото/видео производства, экспортная история, документы, ответ на технические вопросы.

### Глобальные B2B и каталоги

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| Knowde | https://www.knowde.com | химические продукты, спецификации, supplier storefronts | P1 |
| SpecialChem | https://www.specialchem.com | химсырье, полимеры, добавки, TDS | P1 |
| ChemPoint | https://www.chempoint.com | дистрибуция спецхимии, паспорта, производители | P2 |
| Thomasnet | https://www.thomasnet.com | производители США, категории продукции | P2 |
| Kompass | https://www.kompass.com | международные компании и отрасли | P2 |
| Europages | https://www.europages.com | европейские поставщики | P2 |
| OpenCorporates | https://opencorporates.com | глобальные регистрационные данные компаний | P2 |

## 3. Торговая статистика и карта потоков

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| UN Comtrade | https://comtradeplus.un.org | экспорт/импорт по HS, страна-страна, месяцы/годы | P0 |
| UN Comtrade API | https://comtradedeveloper.un.org | API для интеграции торговых потоков | P0 |
| ITC Market Analysis Tools | https://marketanalysis.intracen.org | Trade Map, Market Access Map, Export Potential Map | P0 |
| World Bank WITS | https://wits.worldbank.org | trade, tariffs, NTM, WITS API | P0 |
| WTO Tariff & Trade Data | https://www.wto.org/english/tratop_e/tariffs_e/tariff_data_e.htm | пошлины, импорт, HS6, MFN/bound rates | P0 |
| WTO Tariff Download Facility | https://www.wto.org/english/tratop_e/tariffs_e/database_explanation_e.htm | тарифы в CSV/XML/Excel | P1 |
| TRADESTAT India | https://tradestat.commerce.gov.in | индийский экспорт/импорт по HS | P0 |
| GACC China | https://english.customs.gov.cn/Statistics/Statistics | китайская таможенная статистика | P0 |
| ЕЭК / ЕАЭС ТН ВЭД | https://eec.eaeunion.org | ТН ВЭД ЕАЭС, ставки, меры регулирования | P0 |

Задача слоя: по веществу определить HS/ТН ВЭД, показать главных экспортеров, импортеров, динамику цены за тонну, страны-посредники и странные цепочки.

## 4. Цены и рыночная аналитика

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| результаты закупок ЕИС | https://zakupki.gov.ru | фактические цены контрактов в РФ | P0 |
| коммерческие тендеры | B2B-Center, ТЭК-Торг, ЭТП ГПБ | цены заявок, НМЦ, победители | P1 |
| UN Comtrade / TRADESTAT / GACC | см. выше | расчетная цена за тонну: value / quantity | P0 |
| ICIS | https://www.icis.com | benchmark pricing, chemical market intelligence | P1 платно |
| ChemAnalyst | https://www.chemanalyst.com | химические цены, supply/demand, production | P1 платно/частично |
| Argus | https://www.argusmedia.com | химия, нефтехимия, удобрения, методологии | P1 платно |
| S&P Global Commodity Insights | https://www.spglobal.com/commodityinsights | commodity pricing | P1 платно |
| ChemOrbis | https://www.chemorbis.com | полимеры, цены, индексы | P1 платно |
| маркетплейсы | IndiaMART, Alibaba, Made-in-China | ориентировочные FOB/EXW цены | P2 |

Для интерфейса: показывать "цена подтверждена контрактом", "цена из торговли", "цена из маркетплейса", "оценка AI".

## 5. Логистика, фрахт, маршруты

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| SeaRates API | https://docs.searates.com | ставки FCL/LCL/BULK/air/rail/road, route estimate | P1 |
| Freightos Baltic Index | https://www.freightos.com/data | контейнерные ставки и индексы | P1 |
| Shanghai Shipping Exchange SCFI | https://en.sse.net.cn/indices/scfi.jsp | ставки ex Shanghai | P1 |
| Drewry WCI | https://www.drewry.co.uk | контейнерный индекс | P1 платно/частично |
| Indian Ports Association | https://ipa.nic.in | индийские порты, статистика | P1 |
| Jawaharlal Nehru Port | https://www.jnport.gov.in | портовые данные Индии | P2 |
| Mundra/Adani Ports | https://www.adaniports.com | портовые направления и мощности | P2 |
| Новороссийский морской порт | https://www.nmtp.info | портовые данные РФ | P1 |
| Global Ports | https://www.globalports.com | терминалы РФ | P1 |
| FESCO | https://www.fesco.ru | маршруты, ставки, интермодал | P1 |
| Трансконтейнер | https://trcont.com | ЖД/контейнеры РФ/ЕАЭС | P1 |
| РЖД Логистика | https://www.rzdlog.ru | ЖД-логистика | P1 |

Нужно хранить: порт отправления, порт прибытия, сухопутное плечо, вид перевозки, опасность груза, контейнер/налив/мешки/big-bag, срок, ставка, валюта, источник, дата.

## 6. Химические свойства, спецификации, документы

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| PubChem PUG REST | https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest | CAS, формула, синонимы, свойства, identifiers | P0 |
| OECD eChemPortal | https://www.oecd.org/en/data/tools/echemportal-global-portal-to-information-on-chemical-substances.html | свойства, hazards, классификация, ссылки на ECHA | P0 |
| ECHA | https://echa.europa.eu | REACH, hazard, registered substances, classifications | P0 |
| NOAA CAMEO Chemicals | https://cameo.noaa.gov | аварийная химическая информация, опасности | P1 |
| сайты производителей | официальные сайты | COA, SDS/MSDS, TDS, паспорта качества | P0 |
| Sigma-Aldrich / Merck | https://www.sigmaaldrich.com | reference SDS/TDS для веществ | P2 |
| Fisher Scientific | https://www.fishersci.com | SDS, свойства, упаковка | P2 |

Важно: SDS/MSDS от маркетплейса нельзя считать надежным без проверки производителя и партии. COA должен быть привязан к партии, дате и производителю.

## 7. Сертификация, комплаенс, ограничения

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| ЕАЭС / ТН ВЭД / техрегламенты | https://eec.eaeunion.org | пошлины, меры нетарифного регулирования | P0 |
| Росаккредитация | https://fsa.gov.ru | декларации, сертификаты соответствия | P0 |
| ФТС России | https://customs.gov.ru | таможенные правила, классификация, новости | P1 |
| WTO | https://www.wto.org | тарифы, нотификации | P1 |
| OFAC Sanctions | https://sanctionssearch.ofac.treas.gov | санкционная проверка | P0 |
| EU Sanctions Map | https://www.sanctionsmap.eu | санкции ЕС | P0 |
| UK Sanctions List | https://www.gov.uk/government/publications/the-uk-sanctions-list | санкции UK | P1 |
| BIS Entity List | https://www.bis.gov | экспортный контроль США | P1 |

Задача: перед рекомендацией сделки показывать "можно/нельзя/нужно проверить" по санкциям, опасному грузу, лицензиям, сертификатам и стране происхождения.

## 8. Контакты и отделы закупок/продаж

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| официальный сайт компании | company website | procurement@sales@, телефоны, адреса, формы RFQ | P0 |
| закупочная документация | ЕИС/ЭТП | контакт заказчика, email/телефон, ответственное лицо, отдел | P0 |
| LinkedIn | https://www.linkedin.com | должности и публичные бизнес-контакты | P2 |
| IndiaMART/TradeIndia/Made-in-China/Alibaba | B2B pages | менеджер, форма запроса, телефон, WhatsApp/WeChat, email | P1 |
| выставки и каталоги | ChemExpo, India Chem, ChinaPlas, KHIMIA | экспоненты, контакты, стенды | P1 |

Нельзя строить продукт на незаконном сборе личных данных. Основной объект хранения: бизнес-контакт отдела, публичный email, телефон компании, форма заявки, должность без лишних персональных данных.

## 9. Заводы, мощности, производство

| Источник | URL | Что берем | Приоритет |
| --- | --- | --- | --- |
| сайты заводов | official sites | продуктовая линейка, мощности, марки, документы, новости | P0 |
| годовые отчеты компаний | investor relations | производство, CAPEX, мощности, рынки | P1 |
| ГИСП | https://gisp.gov.ru | российская промышленная продукция | P0 |
| ChemAnalyst / ICIS / Argus | см. выше | capacity, production, demand/supply | P1 платно |
| Росстат / ЕМИСС | https://fedstat.ru | производство по отраслям, регионы | P1 |
| Indian company annual reports | NSE/BSE/company sites | мощности, экспорт, сегменты | P1 |
| China company reports | company sites / exchange filings | мощности, заводы, сегменты | P1 |

## 10. Минимальный пайплайн данных

1. Вещество: имя, CAS, HS/ТН ВЭД, ОКПД2, синонимы.
2. Спрос: закупки, повторяемость, объемы, спецификации, покупатели.
3. Предложение: производители, марки, концентрации, документы, мощности.
4. Цена: контрактная, торговая, маркетплейс, экспертная, диапазон.
5. Логистика: маршрут, срок, ставка, упаковка, опасность.
6. Риски: поставщик, страна, санкции, документы, качество, валюта.
7. Сделка: landed cost, маржа, вероятность успеха, следующий шаг.
8. Хаб: отправить RFQ, запросить COA/SDS, собрать КП, связать покупателя и поставщика.

## 11. Приоритет на ближайший демо-этап

P0 для MVP:
- ЕИС закупки;
- сайты 20-50 российских заводов Башкирии/Татарстана;
- сайты 30-50 индийских/китайских производителей по 3 веществам;
- PubChem + OECD/ECHA;
- UN Comtrade + TRADESTAT India;
- SeaRates/Freightos как логистическая оценка;
- ФНС/ГИСП для российских компаний.

Первые вещества:
- сера;
- диоксид титана;
- силикагель;
- кальцинированная сода;
- ПВХ/полимерные добавки.

Первый пользовательский сценарий:
"Мне нужна сера" -> система показывает производителей, ориентировочную цену, MOQ, документы, маршруты доставки, потенциальных российских покупателей/поставщиков и кнопку "запросить предложения через TenderStart".
