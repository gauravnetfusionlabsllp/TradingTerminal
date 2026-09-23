# Panel audit — 2026-09-23

Every dock panel was checked against the running server: each API path the panel's hooks call was requested,
and the fields the panel reads were compared with the fields the route actually returns. Panels that read
fields the route no longer returns render blank (or crash); those, plus two with stale hardcoded data, were removed.

- Panels before: 445 · removed: 352 · kept: 93
- Files deleted: 702 client (panels + hooks), 350 server routes; 392 translation keys (×6 locales)
- Backup of the pre-removal sources: `D:\trading\backups\neuberg-src-2026-09-23.zip`

## Method

1. Panel → component → hooks → API paths, from `dock-layout.tsx` and the hook files.
2. GET every path on the dev server (~1 req/s), recording status and every response key.
3. Compare the fields read off the result (`data.x`, `data?.x`, `const {x} = data`) with the live keys, and the
   share of response keys the panel source references at all. Calibrated on 25 known-live and 19 known-dead panels.
4. Probe URL artifacts (`${qs}`, `${key}`, empty params) re-checked by hand; 14 borderline panels reviewed
   against the live response (2 kept, 12 removed).

Only two external data sources are live: Yahoo Finance and the ForexFactory calendar feed. Several kept panels
present Yahoo *proxies* (e.g. Economic Surprises, Positioning are derived from prices) — they render real market
data but not the underlying statistic their name suggests.

## Removed (352)

| Panel | Why | Route(s) |
|---|---|---|
| `abs` | reads deals, marketOverview, performance, performanceSummary, riskIndicators… — not in the route's response (7/8 fields missing) | `/abs` |
| `abs-rmbs-monitor` | reads delinquencyData, lossSeverity, marketSummary, prepaymentSpeeds, vintageAnalysis — not in the route's response (5/5 fields missing) | `/abs-rmbs-monitor` |
| `agency-debt` | untyped hook; panel references 11% of the route's response fields | `/agency-debt` |
| `agency-mbs-tba` | reads issuances, prepays, rolls, summary — not in the route's response (4/5 fields missing) | `/agency-mbs-tba` |
| `agricultural-futures` | reads cropConditions, curves, exports, weather — not in the route's response (4/7 fields missing) | `/agricultural-futures` |
| `ai-tech-capex` | reads aiChipMarket, dataCenterBuildOut, hyperscalers, overview, regionalInvestment… — not in the route's response (6/6 fields missing) | `/ai-tech-capex` |
| `aircraft-finance` | reads aircraft, airlines, cdsComparison, deals, eetcAbs… — not in the route's response (10/11 fields missing) | `/aircraft-finance` |
| `alternative-data` | reads companies — not in the route's response (1/1 fields missing) | `/alternative-data` |
| `asset-allocation` | reads efficientFrontier, models — not in the route's response (2/2 fields missing) | `/asset-allocation` |
| `balance-of-payments` | reads countries, timestamp — not in the route's response (2/3 fields missing) | `/balance-of-payments` |
| `bank-earnings` | reads capital, credit, overview, timestamp, trading… — not in the route's response (6/6 fields missing) | `/bank-earnings` |
| `bank-stress-test` | reads asOfDate, capitalRequirements, framework, lossDistribution, overview… — not in the route's response (7/8 fields missing) | `/bank-stress-test` |
| `basis-trade` | reads basisHistory, ctdAnalysis, treasuryBasis — not in the route's response (3/4 fields missing) | `/basis-trade` |
| `benchmark-analytics` | reads attribution, riskDecomposition — not in the route's response (2/3 fields missing) | `/benchmark-analytics` |
| `benchmark-tracker` | reads indices, relativeSpreads, sectorAttribution, trackingAnalysis, updatedAt — not in the route's response (5/5 fields missing) | `/benchmark-tracker` |
| `block-trade` | reads darkPoolPrints, largestBlocks, lockUpExpirations, marketImpact, recentBlocks… — not in the route's response (7/8 fields missing) | `/block-trade` |
| `bond-auction-calendar` | reads analytics, issuance, results, timestamp, upcoming — not in the route's response (5/5 fields missing) | `/bond-auction-calendar` |
| `bond-futures-basis` | untyped hook; panel references 15% of the route's response fields | `/bond-futures-basis` |
| `bond-index-monitor` | untyped hook; panel references 15% of the route's response fields | `/bond-index-monitor` |
| `bond-ladder` | reads bonds, cashFlows, maturityDistribution, metrics — not in the route's response (4/5 fields missing) | `/bond-ladder` |
| `bond-relative-value` | reads butterflyTrades, curveTrades, marketSummary, swapSpreads — not in the route's response (4/5 fields missing) | `/bond-relative-value` |
| `breakeven-inflation` | reads commodityProxy, forwardInflation, globalBreakevens, inflationIndicators, inflationSwaps… — not in the route's response (7/7 fields missing) | `/breakeven-inflation` |
| `capital-structure` | untyped hook; panel references 18% of the route's response fields | `/capital-structure` |
| `carbon-credits` | reads futuresCurve, offsetCredits, regulatoryCalendar, summary — not in the route's response (4/5 fields missing) | `/carbon-credits` |
| `cds` | reads corporates, creditEvents, indices, sovereignMetrics, sovereigns… — not in the route's response (8/8 fields missing) | `/cds` |
| `cds-index-monitor` | reads recentEvents, tranches — not in the route's response (2/4 fields missing) | `/cds-index-monitor` |
| `cds-monitor` | untyped hook; panel references 0% of the route's response fields | `/cds-monitor` |
| `cdx-index` | reads basisTrades, indices, topMovers — not in the route's response (3/3 fields missing) | `/cdx-index` |
| `central-bank` | reads activeBanks, balanceSheets, forwardGuidance, inflationTargets, marketImpact… — not in the route's response (8/8 fields missing) | `/central-bank` |
| `central-bank-balance-sheet` | reads assetComposition, balanceSheets, qtTimeline, summary — not in the route's response (4/4 fields missing) | `/central-bank-balance-sheet` |
| `central-bank-watch` | reads timestamp — not in the route's response (1/2 fields missing) | `/central-bank-watch` |
| `central-clearing` | reads assetClassBreakdown, assetClasses, ccps, clearingHouses, regulatory… — not in the route's response (9/9 fields missing) | `/central-clearing` |
| `climate-risk` | untyped hook; panel references 10% of the route's response fields | `/climate-risk` |
| `clo` | reads collateral, issuance, managers, market, risk… — not in the route's response (6/7 fields missing) | `/clo` |
| `clo-analytics` | reads collateralQuality, coverageTests, managerRankings, marketSummary, trancheSpreads — not in the route's response (5/5 fields missing) | `/clo-analytics` |
| `clo-tranche-analytics` | reads collateralQuality, dealUniverse, managerLeagueTable, newIssuePipeline, ocIcTests… — not in the route's response (7/7 fields missing) | `/clo-tranche-analytics` |
| `collateral-management` | reads assetBreakdown, assetClassBreakdown, counterparties, counterpartyExposures, marginCallTimeline… — not in the route's response (10/10 fields missing) | `/collateral-management` |
| `collateral-monitor` | reads collateralCategories, haircutMatrix, liquidityCoverage, marketSummary, stressScenarios — not in the route's response (5/5 fields missing) | `/collateral-monitor` |
| `collateral-optimization` | reads ctdRanking, demand, inventory, marginCallForecast, optimizationSuggestions… — not in the route's response (6/7 fields missing) | `/collateral-optimization` |
| `commercial-paper` | untyped hook; panel references 27% of the route's response fields | `/commercial-paper` |
| `commodities-forward-curve` | fabricated curve (spot × hardcoded slope); reads commodities{} object, route returns curves[] | `/commodities-forward-curve` |
| `commodity-curve-analytics` | reads basisAnalysis, curveShapes, inventoryCurveCorrelation, marketSummary, rollYield — not in the route's response (5/5 fields missing) | `/commodity-curve-analytics` |
| `commodity-curves` | reads commodities, structureSummary — not in the route's response (2/2 fields missing) | `/commodity-curves` |
| `commodity-demand` | untyped hook; panel references 11% of the route's response fields | `/commodity-demand` |
| `commodity-fundamental` | reads countries, inventory, opec, production, summary… — not in the route's response (8/8 fields missing) | `/commodity-fundamental` |
| `commodity-fundamentals` | reads risks, rows, supplyRisks — not in the route's response (3/4 fields missing) | `/commodity-fundamentals` |
| `commodity-spread` | reads calendarSpreads, interCommoditySpreads, processingSpreads, seasonalPatterns, termStructure… — not in the route's response (7/7 fields missing) | `/commodity-spread` |
| `commodity-spreads` | reads calendarSpreads, crackSpreads, crushSpreads, interCommoditySpreads — not in the route's response (4/4 fields missing) | `/commodity-spreads` |
| `commodity-storage` | reads cashAndCarry, facilityRates, inventoryLevels, storageEconomics — not in the route's response (4/5 fields missing) | `/commodity-storage` |
| `commodity-warehouse` | reads agriculture, comex, energy, lme, timestamp… — not in the route's response (6/7 fields missing) | `/commodity-warehouse` |
| `corporate-action-calendar` | reads events, lockups, maDeals, splits, timestamp — not in the route's response (5/6 fields missing) | `/corporate-action-calendar` |
| `corporate-actions` | untyped hook; panel references 17% of the route's response fields | `/corporate-actions` |
| `correlation-risk` | reads crossAssetMatrix, dispersionTrades, equityCorrelation, regime, sectorCorrelations… — not in the route's response (6/8 fields missing) | `/correlation-risk` |
| `counterparty-exposure` | reads marginCalls, productExposures, timestamp, totalCollateral, totalCva… — not in the route's response (9/10 fields missing) | `/counterparty-exposure` |
| `counterparty-risk` | reads counterparties, cvaDvaTotals, nettingSummary, timestamp — not in the route's response (4/4 fields missing) | `/counterparty-risk` |
| `country-risk` | untyped hook; panel references 10% of the route's response fields | `/country-risk` |
| `covered-bond` | untyped hook; panel references 11% of the route's response fields | `/covered-bond` |
| `credit-auction` | reads bids, bidsAuctionEntity, pending, recent, recovery… — not in the route's response (7/7 fields missing) | `/credit-auction` |
| `credit-curve-builder` | reads analytics, basis, entity, hazardRates, spread… — not in the route's response (6/7 fields missing) | `/credit-curve-builder` |
| `credit-default-index` | reads cdsBondBasis, creditEvents, majorIndices, rollCalendar, singleNameMovers… — not in the route's response (8/8 fields missing) | `/credit-default-index` |
| `credit-default-swaps` | untyped hook; panel references 14% of the route's response fields | `/credit-default-swaps` |
| `credit-event` | reads auctionCalendar, defaultRates, distressedTrend, recentEvents, recoveryBySeniority… — not in the route's response (7/8 fields missing) | `/credit-event` |
| `credit-flow` | reads calendar, flows, issuance, spreads, timestamp — not in the route's response (5/6 fields missing) | `/credit-flow` |
| `credit-impulse` | reads bankLending, countries, creditGrowth, financialConditions, globalDirection… — not in the route's response (9/9 fields missing) | `/credit-impulse` |
| `credit-index` | reads flows, marketConditions, maturityWall, ratings, sectors — not in the route's response (5/6 fields missing) | `/credit-index` |
| `credit-index-monitor` | reads basisTrades, indexLevels, marketSummary, rollAnalysis, trancheData — not in the route's response (5/5 fields missing) | `/credit-index-monitor` |
| `credit-index-tranches` | reads baseCorrelation, baseCorrelationCurve, historicalSpreads, historicalTrancheData, indexOverview… — not in the route's response (8/9 fields missing) | `/credit-index-tranches` |
| `credit-portfolio` | reads avgRating, creditVar95, creditVar99, dv01, dv01Ladder… — not in the route's response (17/18 fields missing) | `/credit-portfolio` |
| `credit-rating-migration` | reads defaultRates, fallenAngels, recentActions, risingStars, sectorMigration… — not in the route's response (9/9 fields missing) | `/credit-rating-migration` |
| `credit-risk-transfer` | reads deals, delinquency, pricing, summary — not in the route's response (4/4 fields missing) | `/credit-risk-transfer` |
| `credit-spread` | reads crossoverWatch, distressedDebt, highYield, indexMetrics, investmentGrade… — not in the route's response (7/8 fields missing) | `/credit-spread` |
| `credit-valuation-adjustment` | reads cvaVarSummary, nettingSets, wrongWayRisks — not in the route's response (3/4 fields missing) | `/credit-valuation-adjustment` |
| `critical-minerals` | untyped hook; panel references 0% of the route's response fields | `/critical-minerals` |
| `cross-asset-correlation` | fabricated ("correlation" = 0.5 + chg*0.03); reads matrix/regime, route returns assets[] | `/cross-asset-correlation` |
| `cross-asset-momentum` | reads marketSummary, meanReversionIndicators, momentumFactors, pairStrategies, trendSignals — not in the route's response (5/5 fields missing) | `/cross-asset-momentum` |
| `cross-border-ma` | untyped hook; panel references 0% of the route's response fields | `/cross-border-ma` |
| `cross-currency-basis` | reads basisSwaps, centralBankSwapLines, dollarFunding, fxForwards, historicalLevels… — not in the route's response (7/7 fields missing) | `/cross-currency-basis` |
| `cross-currency-swaps` | reads activeSwaps, currencyPairs, hedgingCosts, summary, termStructure — not in the route's response (5/5 fields missing) | `/cross-currency-swaps` |
| `cross-margining` | reads assetClassEfficiency, ccpPrograms, comparison, historicalSavings, pairOffsets… — not in the route's response (8/9 fields missing) | `/cross-margining` |
| `crypto-derivatives` | reads basisTrades, marketSummary, optionsData, perpetualFunding, termStructure — not in the route's response (5/5 fields missing) | `/crypto-derivatives` |
| `currency-basket` | reads currencyStrength, customBaskets, dxyChange1d, dxyComponents, dxyHigh… — not in the route's response (11/11 fields missing) | `/currency-basket` |
| `currency-forecast` | reads models, pairs, summary — not in the route's response (3/3 fields missing) | `/currency-forecast` |
| `curve-trade` | reads activeStrategies, carryAnalysis, spreadHistory — not in the route's response (3/4 fields missing) | `/curve-trade` |
| `custom-index` | crashes: reads indices[].level, route returns indices[].price | `/custom-index` |
| `cva-monitor` | reads counterpartyExposures, cvaByProduct, cvaHedges, cvaPnlDrivers, regulatoryCapital… — not in the route's response (7/7 fields missing) | `/cva-monitor` |
| `cyber-risk-insurance` | untyped hook; panel references 0% of the route's response fields | `/cyber-risk-insurance` |
| `cybersecurity` | untyped hook; panel references 0% of the route's response fields | `/cybersecurity` |
| `data-center-infrastructure` | untyped hook; panel references 29% of the route's response fields | `/data-center-infrastructure` |
| `debt-capital-markets` | reads issuancePipeline, leagueTable, marketSummary, timestamp — not in the route's response (4/4 fields missing) | `/debt-capital-markets` |
| `debt-ceiling` | untyped hook; panel references 10% of the route's response fields | `/debt-ceiling` |
| `debt-issuance` | reads deals, pipeline, summary, volumeByCurrency, volumeByType… — not in the route's response (6/6 fields missing) | `/debt-issuance` |
| `debt-maturity` | reads buckets, count, couponSum, migration, ratingMigration… — not in the route's response (10/10 fields missing) | `/debt-maturity` |
| `demographic-trends` | reads laborForce, projections, summary, timestamp, urbanizationTrends — not in the route's response (5/6 fields missing) | `/demographic-trends` |
| `distressed-debt` | reads cccSpread, defaultRate, defaultTracker, defaults, distressedIssuers… — not in the route's response (15/16 fields missing) | `/distressed-debt` |
| `dividend-capture` | reads aristocrats, calendar, highYield, riskMetrics, sectorYields… — not in the route's response (7/8 fields missing) | `/dividend-capture` |
| `dividend-swap` | reads indexDividends, marketMetrics, sectorYields, specialDividends, stockDividends… — not in the route's response (6/6 fields missing) | `/dividend-swap` |
| `dividend-swaps` | reads indexSwaps, seasonality, sectorGrowth, stockSwaps, summary — not in the route's response (5/5 fields missing) | `/dividend-swaps` |
| `duration-management` | reads benchmark, benchmarkKeyRateDurations, hedgingRecommendations, hedgingSummary, keyRateDurations… — not in the route's response (11/11 fields missing) | `/duration-management` |
| `earnings-revision` | reads breadth, earningsSurprises, sectorRevisions, topDownRevisions, topUpRevisions… — not in the route's response (6/7 fields missing) | `/earnings-revision` |
| `econ-indicators` | hardcoded arrays, LAST_UPDATED 2026-03-14 | `` |
| `economic-forecast` | untyped hook; panel references 25% of the route's response fields | `/economic-forecast` |
| `election-risk` | reads geopoliticalHotspots, historicalPatterns, legislativeTracker, marketSensitivity, policyRisks… — not in the route's response (7/7 fields missing) | `/election-risk` |
| `electricity-markets` | reads congestion, forwards, generation — not in the route's response (3/5 fields missing) | `/electricity-markets` |
| `em-bonds` | reads countries, indices, regionAgg — not in the route's response (3/3 fields missing) | `/em-bonds` |
| `em-local-rates` | reads centralBankSpreads, localCurrencyYields, marketSummary, ndfForwards, realRateComparison — not in the route's response (5/5 fields missing) | `/em-local-rates` |
| `emissions-trading` | reads auctions, futures, offsets, summary — not in the route's response (4/5 fields missing) | `/emissions-trading` |
| `endowment` | reads allocationTrends, benchmarks, endowments, investmentThemes, performanceMetrics… — not in the route's response (8/10 fields missing) | `/endowment` |
| `energy-transition` | reads capacityAdditions, cleanEnergyETFs, cleanEnergyStocks, evAdoption, greenBondMarket… — not in the route's response (6/7 fields missing) | `/energy-transition` |
| `equity-analyst-revisions` | reads momentum, ratings, sectors, surprises — not in the route's response (4/5 fields missing) | `/equity-analyst-revisions` |
| `equity-basket-swaps` | reads attribution, financing, rebalanceCalendar — not in the route's response (3/5 fields missing) | `/equity-basket-swaps` |
| `equity-capital-markets` | reads blockTrades, ipoPipeline, secondaryOfferings, timestamp — not in the route's response (4/5 fields missing) | `/equity-capital-markets` |
| `equity-capital-raise` | untyped hook; panel references 0% of the route's response fields | `/equity-capital-raise` |
| `equity-derivatives` | reads marketOverview, optionsFlow, putCallRatio, putCallRatios, sectorVolatility… — not in the route's response (8/10 fields missing) | `/equity-derivatives` |
| `equity-dividend-forecast` | reads alerts, aristocrats, growthTrend, indexYields, sectorYields… — not in the route's response (7/7 fields missing) | `/equity-dividend-forecast` |
| `equity-factor-monitor` | reads correlationMatrix, crowding, movers, regime, spreads — not in the route's response (5/6 fields missing) | `/equity-factor-monitor` |
| `equity-financing` | reads borrowRates, marketAggregates, marketSummary, recentActivity, shortSqueezeIndicators — not in the route's response (5/5 fields missing) | `/equity-financing` |
| `equity-index-futures` | reads basisHistory, contracts, rollCalendar, termStructure — not in the route's response (4/4 fields missing) | `/equity-index-futures` |
| `equity-lending` | reads feeTrends, mostLent, newLoans, recentActivity, sectors… — not in the route's response (6/8 fields missing) | `/equity-lending` |
| `equity-linked-notes` | reads issuance, notes, risk — not in the route's response (3/5 fields missing) | `/equity-linked-notes` |
| `equity-market-microstructure` | reads darkPool, darkPoolTotal, flow, litTotal, orderBook… — not in the route's response (10/12 fields missing) | `/equity-market-microstructure` |
| `equity-pairs-trading` | reads pnlHistory, pnlSummary, recentTrades, riskMetrics, sectors… — not in the route's response (6/8 fields missing) | `/equity-pairs-trading` |
| `equity-screen-results` | reads criteria, factors, performance, rankings, sectors… — not in the route's response (6/6 fields missing) | `/equity-screen-results` |
| `equity-style` | reads factors, stocks, styleReturns — not in the route's response (3/4 fields missing) | `/equity-style` |
| `equity-swap-pricing` | untyped hook; panel references 20% of the route's response fields | `/equity-swap-pricing` |
| `equity-total-return-index` | reads comparison, dividendContribution, sectorTR, topDividendPayers — not in the route's response (4/5 fields missing) | `/equity-total-return-index` |
| `esg-ratings` | reads companies, ratingDist, sectorAverages — not in the route's response (3/3 fields missing) | `/esg-ratings` |
| `etf-flow` | reads creations, redemptions — not in the route's response (2/7 fields missing) | `/etf-flow` |
| `etf-flows` | reads assetClasses, regions, sectors, timestamp, topFlows — not in the route's response (5/6 fields missing) | `/etf-flows` |
| `factor-rotation` | reads backtestResults, cyclicalPosition, factorMomentum, factorValuations, macroFactorLinks… — not in the route's response (6/6 fields missing) | `/factor-rotation` |
| `family-office` | reads aggregateAllocations, offices, recentFilings, sectors, themes… — not in the route's response (7/7 fields missing) | `/family-office` |
| `fi-attribution` | reads currencyAttribution, durationAttribution, marketSummary, returnDecomposition, sectorAttribution — not in the route's response (5/5 fields missing) | `/fi-attribution` |
| `fi-attribution-analysis` | reads attribution, portfolio, sectors, summary, topContributors — not in the route's response (5/5 fields missing) | `/fi-attribution-analysis` |
| `fi-relative-value` | reads breakevens, butterflies, crossMarket, otrOfr, recommendations… — not in the route's response (6/6 fields missing) | `/fi-relative-value` |
| `financial-conditions` | reads globalSummary, regions, timestamp — not in the route's response (3/3 fields missing) | `/financial-conditions` |
| `fintech-digital-payments` | untyped hook; panel references 12% of the route's response fields | `/fintech-digital-payments` |
| `fiscal-deficit` | reads countries, globalDebt, outlook, rating, timestamp — not in the route's response (5/5 fields missing) | `/fiscal-deficit` |
| `fiscal-policy` | reads countries — not in the route's response (1/2 fields missing) | `/fiscal-policy` |
| `fixed-income-analytics` | reads bonds — not in the route's response (1/2 fields missing) | `/fixed-income-analytics` |
| `fixed-income-ladder` | reads bonds, cashFlows, maturityDistribution, summary — not in the route's response (4/4 fields missing) | `/fixed-income-ladder` |
| `flow-of-funds` | untyped hook; panel references 0% of the route's response fields | `/flow-of-funds` |
| `freight-derivatives` | reads ffaContracts, marketSummary, routePricing, seasonalIndices, volatilityData — not in the route's response (5/5 fields missing) | `/freight-derivatives` |
| `freight-indices` | reads commodityCorrelation, container, dryBulk, seasonality, tanker… — not in the route's response (6/6 fields missing) | `/freight-indices` |
| `freight-rate-monitor` | reads baltic, bdi, breakdown, comparison, container… — not in the route's response (20/21 fields missing) | `/freight-rate-monitor` |
| `frontier-market-debt` | untyped hook; panel references 25% of the route's response fields | `/frontier-market-debt` |
| `fund-flow` | reads moneyMarket, retailVsInstitutional — not in the route's response (2/3 fields missing) | `/fund-flow` |
| `fund-flow-analytics` | untyped hook; panel references 0% of the route's response fields | `/fund-flow-analytics` |
| `fund-flow-tracker` | reads commodityAum, commodityFlow, equityAum, equityFlow, fixedIncomeAum… — not in the route's response (11/12 fields missing) | `/fund-flow-tracker` |
| `fund-manager-ranking` | reads persistence, riskAdjusted, strategyFlows, timestamp — not in the route's response (4/5 fields missing) | `/fund-manager-ranking` |
| `funding-rate-monitor` | reads fedFundsImplied, marketSummary, moneyMarketFlows, overnightRates, termRates — not in the route's response (5/5 fields missing) | `/funding-rate-monitor` |
| `fx-carry` | reads carryPairs, centralBanks, fundingCurrencies, risk, timestamp… — not in the route's response (7/8 fields missing) | `/fx-carry` |
| `fx-carry-monitor` | reads carryBaskets, carryTable, g10Rates, risk, timestamp — not in the route's response (5/5 fields missing) | `/fx-carry-monitor` |
| `fx-carry-trade-monitor` | reads carryMatrix, carryToRisk, centralBankRates, emCarryOpportunities, g10Currencies… — not in the route's response (9/9 fields missing) | `/fx-carry-trade-monitor` |
| `fx-reserves` | reads currencyComposition, globalTotal, goldReserves, trends — not in the route's response (4/5 fields missing) | `/fx-reserves` |
| `fx-volatility` | fabricated (iv = 7 + VIX*0.4); reads iv1m/rv1m/rr25d, route returns impliedVol/realizedVol | `/fx-volatility` |
| `fx-volatility-surface` | reads butterflies, movers, riskReversals, summary, surfacePairs… — not in the route's response (6/7 fields missing) | `/fx-volatility-surface` |
| `geopolitical-risk` | reads conflictZones, countryRisks, globalIndex, safeHavenFlows, sanctions… — not in the route's response (6/6 fields missing) | `/geopolitical-risk` |
| `global-credit-monitor` | reads defaultRates, ratingActions, regionComparison, spreads, stressIndicators — not in the route's response (5/5 fields missing) | `/global-credit-monitor` |
| `global-debt-clock` | reads debtGrowthTrajectory, globalAggregate, globalInterestBurden, sovereignDebt — not in the route's response (4/4 fields missing) | `/global-debt-clock` |
| `global-dividend` | untyped hook; panel references 38% of the route's response fields | `/global-dividend` |
| `global-flows` | reads regional, sentiment, topETFs — not in the route's response (3/4 fields missing) | `/global-flows` |
| `global-food-price` | reads faoIndex/commodityPrices/foodInflation, route returns commodities/etfs — all sections empty | `/global-food-price` |
| `global-index-monitor` | untyped hook; panel references 12% of the route's response fields | `/global-index-monitor` |
| `global-liquidity-monitor` | reads balanceSheets, creditImpulse, flows, funding, m2Tracker… — not in the route's response (6/6 fields missing) | `/global-liquidity-monitor` |
| `global-ma` | reads advisoryLeagueTables, recentDeals, regionalActivity, sectorBreakdown — not in the route's response (4/5 fields missing) | `/global-ma` |
| `global-macro-dashboard` | reads fiscalMetrics, gdpNowcasts, leadingIndicators, marketSummary, tradeBalances — not in the route's response (5/5 fields missing) | `/global-macro-dashboard` |
| `global-pmi` | reads regions — not in the route's response (1/3 fields missing) | `/global-pmi` |
| `global-pmi-dashboard` | untyped hook; panel references 12% of the route's response fields | `/global-pmi-dashboard` |
| `global-tax-rates` | reads oecdAverages, trends — not in the route's response (2/3 fields missing) | `/global-tax-rates` |
| `global-trade-flow` | reads summary, tariffData, timestamp, topExporters, tradeDisruptions… — not in the route's response (6/7 fields missing) | `/global-trade-flow` |
| `hedge-fund-monitor` | reads aumFlows, crowdedTrades, leverageRisk, strategyReturns, timestamp — not in the route's response (5/5 fields missing) | `/hedge-fund-monitor` |
| `hedge-fund-replication` | reads alphaDecay, crowdingAnalysis, factorDecomposition, liquidAlternativeEtfs, performanceComparison — not in the route's response (5/6 fields missing) | `/hedge-fund-replication` |
| `housing-market` | reads affordability, homebuilderStocks, housingActivity, inventory, lastUpdated… — not in the route's response (6/7 fields missing) | `/housing-market` |
| `index-arbitrage` | reads arbitrageOpportunities, basisTable, dates, etfPremiumDiscount, historicalBasis… — not in the route's response (9/9 fields missing) | `/index-arbitrage` |
| `index-rebalance` | reads estimatedFlows, floatChanges, historicalImpact, passiveOwnership, projectedChanges… — not in the route's response (7/7 fields missing) | `/index-rebalance` |
| `inflation-breakevens` | reads globalComparison, inflationSwaps, marketSummary, realRates — not in the route's response (4/5 fields missing) | `/inflation-breakevens` |
| `inflation-linked-bond` | reads etfTrackers, globalMarket, realYieldCurve, tipsDetail — not in the route's response (4/4 fields missing) | `/inflation-linked-bond` |
| `inflation-linked-bonds` | reads breakevenTermStructure, globalLinkers, realYieldCurve, seasonality, summary… — not in the route's response (6/6 fields missing) | `/inflation-linked-bonds` |
| `inflation-monitor` | untyped hook; panel references 7% of the route's response fields | `/inflation-monitor` |
| `inflation-swap` | crashes: reads swapRates[].usd/eur, route returns swapRates[].tenor/rate; rate = TNX*k - TIP yield*k | `/inflation-swap` |
| `infrastructure-debt` | reads esg, overview, recentDeals, sectors, timestamp — not in the route's response (5/5 fields missing) | `/infrastructure-debt` |
| `infrastructure-investment` | reads constructionActivity, etfs, majorProjects, pppDeals, regionalBreakdown… — not in the route's response (9/10 fields missing) | `/infrastructure-investment` |
| `insurance-linked` | reads ilw, pipeline, reinsurance, secondary — not in the route's response (4/5 fields missing) | `/insurance-linked` |
| `insurance-market` | reads catBonds, insurerPerformance, lossEvents, overview, pcLines… — not in the route's response (6/6 fields missing) | `/insurance-market` |
| `interest-rate-swap` | reads forwardRates, impliedPolicyPath, marketMetrics, overnightRates, swapCurve… — not in the route's response (9/9 fields missing) | `/interest-rate-swap` |
| `interest-rate-vol-surface` | reads changes, currencies, smile — not in the route's response (3/4 fields missing) | `/interest-rate-vol-surface` |
| `ipo-calendar` | untyped hook; panel references 22% of the route's response fields | `/ipo-calendar` |
| `irs-monitor` | reads basisSwaps, forwardRates, summary, swapRates, swapSpreads — not in the route's response (5/5 fields missing) | `/irs-monitor` |
| `labor-market` | reads averageHourlyEarningsMoM, averageHourlyEarningsYoY, averageWeeklyHours, claims, continuingClaims… — not in the route's response (36/36 fields missing) | `/labor-market` |
| `league-tables` | reads categories, sectorBreakdown, topDeals — not in the route's response (3/4 fields missing) | `/league-tables` |
| `leveraged-loan` | reads bottomPerformers, cloMarket, indexMetrics, newIssuance, pipeline… — not in the route's response (9/9 fields missing) | `/leveraged-loan` |
| `leveraged-loans` | reads indices, loans, pipeline, sectors, summary — not in the route's response (5/5 fields missing) | `/leveraged-loans` |
| `liquidity-coverage` | reads aggregateLcr, aggregateNsfr, cashFlowLadder, hqlaBreakdown, lcrBanks… — not in the route's response (8/8 fields missing) | `/liquidity-coverage` |
| `liquidity-dashboard` | reads centralBanks, conditions, fundingStress, timestamp, usLiquidity — not in the route's response (5/5 fields missing) | `/liquidity-dashboard` |
| `liquidity-monitor` | reads centralBanks, collateralMarket, creditConditions, fedDetail, flowOfFunds… — not in the route's response (9/10 fields missing) | `/liquidity-monitor` |
| `liquidity-risk-monitor` | reads bidAskSpreads, flowToxicity, liquidityScoreboard, marketDepth, marketSummary — not in the route's response (5/5 fields missing) | `/liquidity-risk-monitor` |
| `liquidity-stress-test` | reads buckets, historicalScores, positions, redemptionWaterfall, stressScenarios… — not in the route's response (7/7 fields missing) | `/liquidity-stress-test` |
| `loan-cds` | reads index, recovery, relativeValue, singleNames, summary — not in the route's response (5/5 fields missing) | `/loan-cds` |
| `loan-syndication-pipeline` | reads calendar, marketColor, pipeline, recentlyPriced, stats — not in the route's response (5/5 fields missing) | `/loan-syndication-pipeline` |
| `luxury-collectibles-index` | reads auctions, categories, indices, recentAuctions, watchMarket… — not in the route's response (9/9 fields missing) | `/luxury-collectibles-index` |
| `macro-indicators` | reads countries, keyIndicators, timestamp, upcomingReleases — not in the route's response (4/4 fields missing) | `/macro-indicators` |
| `macro-regime-monitor` | reads allocation, assetAllocation, centralBanks, currentRegime, history… — not in the route's response (12/13 fields missing) | `/macro-regime-monitor` |
| `macro-risk` | crashes: reads compositeRisk.score, route returns compositeRisk as a number; scores are arbitrary blends | `/macro-risk` |
| `macro-surprise-tracker` | reads categories, indices, recent, regions, releases… — not in the route's response (9/9 fields missing) | `/macro-surprise-tracker` |
| `margin-debt` | untyped hook; panel references 0% of the route's response fields | `/margin-debt` |
| `market-breadth-advanced` | reads aboveMa, highsLows, mcclellan, sectors, summary — not in the route's response (5/6 fields missing) | `/market-breadth-advanced` |
| `market-impact-model` | untyped hook; panel references 22% of the route's response fields | `/market-impact-model` |
| `market-internals` | reads advanceDecline, breadthThrust, exchanges, history, mcclellan… — not in the route's response (10/11 fields missing) | `/market-internals` |
| `market-making` | reads depthOfBook, designatedMMs, quoteQuality, regulatoryMetrics, spreadAnalysis… — not in the route's response (7/8 fields missing) | `/market-making` |
| `market-microstructure` | reads darkPoolActivity, hftMetrics, liquidityMetrics, marketDepth, orderFlow… — not in the route's response (7/7 fields missing) | `/market-microstructure` |
| `market-sentiment-index` | reads composite, dailyChange, historicalComparisons, label, notableExtremes… — not in the route's response (8/10 fields missing) | `/market-sentiment-index` |
| `market-surveillance` | reads alertSummary, circuitBreakers, complianceMetrics, crossMarketPatterns, lastUpdated… — not in the route's response (6/7 fields missing) | `/market-surveillance` |
| `mbs-analytics` | reads couponStacks, pools, summary — not in the route's response (3/3 fields missing) | `/mbs-analytics` |
| `merger-arb` | untyped hook; panel references 0% of the route's response fields | `/merger-arb` |
| `merger-arb-monitor` | reads activeDeals, brokenDeals, dealRisks, recentCompletions, regulatoryTimeline… — not in the route's response (8/8 fields missing) | `/merger-arb-monitor` |
| `merger-arbitrage` | untyped hook; panel references 0% of the route's response fields | `/merger-arbitrage` |
| `metals-forward` | reads analysis, curves, spreads, summary, warehouse — not in the route's response (5/6 fields missing) | `/metals-forward` |
| `money-market` | reads fedFunds/repoRates/tbillYields, route returns rates[]/etfs[]; "Fed Funds" = round(IRX*4)/4+0.25 | `/money-market` |
| `money-market-fund` | reads aum/wam/weeklyFlow/yieldHistory (absent); yields come back 0 | `/money-market-fund` |
| `money-market-rates` | reads commercialPaper, fedFundsFutures, fedFundsTarget, globalReferenceRates, overnightRates… — not in the route's response (7/7 fields missing) | `/money-market-rates` |
| `money-velocity` | reads cpi, excessReserves, moneyGrowthLag, multiplier, ppi… — not in the route's response (6/6 fields missing) | `/money-velocity` |
| `mortgage-prepayment` | reads decomposition, pools, psaBenchmarks, satoAnalysis, seasonalFactors… — not in the route's response (8/8 fields missing) | `/mortgage-prepayment` |
| `multi-factor` | reads correlationMatrix, factorReturns, riskDecomposition, sectorExposures, stockExposures — not in the route's response (5/5 fields missing) | `/multi-factor` |
| `muni-bond-auction` | reads failedAuctions, marketSummary, rateTrends, recentAuctions, vrdoRates — not in the route's response (5/5 fields missing) | `/muni-bond-auction` |
| `muni-bonds` | reads bonds, curvePoints, sectorBreakdown, stateAggregates — not in the route's response (4/4 fields missing) | `/muni-bonds` |
| `muni-yield-curves` | reads curves, issuance, ratios, sectors — not in the route's response (4/5 fields missing) | `/muni-yield-curves` |
| `municipal-bond-monitor` | reads advanceDeclineRatio, comparisons, fundFlowsWeekly, issuanceVolume30d, ratings… — not in the route's response (10/10 fields missing) | `/municipal-bond-monitor` |
| `municipal-credit` | reads ratings, tenors — not in the route's response (2/2 fields missing) | `/municipal-credit` |
| `municipal-credit-analysis` | untyped hook; panel references 7% of the route's response fields | `/municipal-credit-analysis` |
| `nuclear-energy` | reads countryFleet, newBuildPipeline, overview, policyTracker, smrPipeline… — not in the route's response (7/7 fields missing) | `/nuclear-energy` |
| `onchain-analytics` | reads exchangeFlows — not in the route's response (1/2 fields missing) | `/onchain-analytics` |
| `operational-risk` | reads capitalAllocations, capitalCharge, capitalChargeChange, eventCount, eventCountChange… — not in the route's response (13/14 fields missing) | `/operational-risk` |
| `option-skew-surface` | reads biggestDailyChanges, crossUnderlyingSummary, riskReversals, skewByExpiry, surfaces… — not in the route's response (7/7 fields missing) | `/option-skew-surface` |
| `option-strategy-builder` | reads marketRegime, recommendations, recommendedStrategies, regime, strategies — not in the route's response (5/5 fields missing) | `/option-strategy-builder` |
| `options-skew` | reads extremeSkew, indexSkew, putCallAnalysis, sectorSkew, singleStockSkew… — not in the route's response (7/7 fields missing) | `/options-skew` |
| `order-book` | untyped hook; panel references 20% of the route's response fields | `/order-book` |
| `pension-fund` | reads funds, summary, timestamp — not in the route's response (3/3 fields missing) | `/pension-fund` |
| `pharma-pipeline` | untyped hook; panel references 0% of the route's response fields | `/pharma-pipeline` |
| `portfolio-attribution` | reads activeReturn, alpha, benchmarkReturn, beta, bottomContributors… — not in the route's response (23/24 fields missing) | `/portfolio-attribution` |
| `portfolio-hedging` | untyped hook; panel references 0% of the route's response fields | `/portfolio-hedging` |
| `portfolio-margin` | reads alerts, assetClassBreakdown, historicalUtilization, stressScenarios, summary — not in the route's response (5/6 fields missing) | `/portfolio-margin` |
| `portfolio-risk-analytics` | reads factorExposure, marketSummary, scenarioAnalysis, stressTests, varDecomposition — not in the route's response (5/5 fields missing) | `/portfolio-risk-analytics` |
| `portfolio-stress-test` | reads concentration, concentrationSummary, drawdownSummary, drawdowns, factorShocks… — not in the route's response (9/9 fields missing) | `/portfolio-stress-test` |
| `precious-metals-lease` | reads centralBanks, etfs, forwards, leaseRates, ratios… — not in the route's response (6/6 fields missing) | `/precious-metals-lease` |
| `price-discovery` | reads intradayPattern, microstructure, pinEstimates, quoteQuality, timestamp… — not in the route's response (7/7 fields missing) | `/price-discovery` |
| `primary-dealer` | reads corporate, financing, positions, summary, trend — not in the route's response (5/5 fields missing) | `/primary-dealer` |
| `prime-brokerage` | reads brokerRankings, capitalIntro, clientFlows, marginFinancing, regulatoryImpact… — not in the route's response (7/7 fields missing) | `/prime-brokerage` |
| `private-credit` | untyped hook; panel references 22% of the route's response fields | `/private-credit` |
| `private-credit-dashboard` | untyped hook; panel references 33% of the route's response fields | `/private-credit-dashboard` |
| `private-equity` | reads fundraising, overview, performanceBenchmarks, recentDeals, recentExits… — not in the route's response (6/6 fields missing) | `/private-equity` |
| `private-equity-secondaries` | untyped hook; panel references 0% of the route's response fields | `/private-equity-secondaries` |
| `productivity-monitor` | reads countries, globalRanking, timestamp — not in the route's response (3/3 fields missing) | `/productivity-monitor` |
| `proxy-voting` | reads boardMetrics, esgProposals, governanceScores, proxyFights, sayOnPay… — not in the route's response (7/7 fields missing) | `/proxy-voting` |
| `quant-factor` | reads factorExposures, factorReturns, factorTiming, riskDecomposition, sectorFactorLoadings… — not in the route's response (7/7 fields missing) | `/quant-factor` |
| `rare-earth-battery-metals` | untyped hook; panel references 0% of the route's response fields | `/rare-earth-battery-metals` |
| `rate-caps-floors` | reads currencies, summary — not in the route's response (2/2 fields missing) | `/rate-caps-floors` |
| `rates-strategy` | untyped hook; panel references 20% of the route's response fields | `/rates-strategy` |
| `real-estate-analytics` | reads marketIndicators, reitFlows, reits, sectorMetrics, topMarkets — not in the route's response (5/5 fields missing) | `/real-estate-analytics` |
| `real-estate-capital` | reads capRates, delinquency, pipeline, spreads, summary — not in the route's response (5/5 fields missing) | `/real-estate-capital` |
| `real-estate-investment` | reads capRates, debtMarket, overview, regionalVacancy, transactions — not in the route's response (5/6 fields missing) | `/real-estate-investment` |
| `realtime-pnl` | reads assetClasses, buyingPower, cash, dayHigh, dayLow… — not in the route's response (14/15 fields missing) | `/realtime-pnl` |
| `recession-probability` | fabricated blend (50 - spread*30 …); reads economies[], route returns probability/indicators | `/recession-probability` |
| `regulatory-capital` | reads capitalRatios, regulatoryTimeline, rwaBreakdown, stressTests, timestamp — not in the route's response (5/5 fields missing) | `/regulatory-capital` |
| `regulatory-filing` | reads enforcementActions, insiderFilings, institutionalFilings, ipoPipeline, proxyFilings… — not in the route's response (7/7 fields missing) | `/regulatory-filing` |
| `repo-market` | reads collateral, fails, summary, termStructure — not in the route's response (4/5 fields missing) | `/repo-market` |
| `repo-rate-heatmap` | reads collateralTypes, fails, heatmap, specials, terms… — not in the route's response (7/7 fields missing) | `/repo-rate-heatmap` |
| `risk-budgeting` | reads breachAlerts, historicalUtilization, overview, riskFactors, strategies… — not in the route's response (7/7 fields missing) | `/risk-budgeting` |
| `risk-dashboard` | reads componentVaR, diversification, esMetrics, limits, pnlAttribution… — not in the route's response (9/9 fields missing) | `/risk-dashboard` |
| `risk-parity` | reads assetAllocation, comparison, historicalComparison, portfolio, portfolioMetrics… — not in the route's response (8/9 fields missing) | `/risk-parity` |
| `risk-scenario-analysis` | reads correlationStress, historicalDrawdowns, reverseStressTests, reverseStressWarning, scenarios… — not in the route's response (7/7 fields missing) | `/risk-scenario-analysis` |
| `sanctions-monitor` | reads complianceAlerts, recentActions, regimes, summary — not in the route's response (4/4 fields missing) | `/sanctions-monitor` |
| `sector-credit-spread` | reads igVsHy, summary — not in the route's response (2/3 fields missing) | `/sector-credit-spread` |
| `securities-borrowing-lending` | reads feeDistribution, hotStocks, marketStats, recentChanges, sectorSummary — not in the route's response (5/5 fields missing) | `/securities-borrowing-lending` |
| `securities-class-action` | reads activeCases, plaintiffFirms, recentFilings, sectorConcentration, settlements… — not in the route's response (7/7 fields missing) | `/securities-class-action` |
| `securities-finance` | reads collateralTransformations, marginLending, rehypothecation, summary, timestamp — not in the route's response (5/5 fields missing) | `/securities-finance` |
| `securities-lending` | reads costTiers, hardToBorrow, sectors, securities, summary — not in the route's response (5/5 fields missing) | `/securities-lending` |
| `securities-lending-revenue` | reads assetClassBreakdown, assetClasses, avgFeeBps, borrowerConcentration, borrowers… — not in the route's response (18/18 fields missing) | `/securities-lending-revenue` |
| `securities-valuation` | reads challenges, methodologies, securities, staleAlerts, stats — not in the route's response (5/5 fields missing) | `/securities-valuation` |
| `securitization` | reads collateral, collateralQuality, issuers, marketVolume, newIssuance… — not in the route's response (15/15 fields missing) | `/securitization` |
| `securitization-pipeline` | reads calendar, deals, issuanceSummary, issuanceVolume, pipeline… — not in the route's response (12/12 fields missing) | `/securitization-pipeline` |
| `settlement-risk` | reads aging, cls, dvp, overallRate, overallStatus… — not in the route's response (10/10 fields missing) | `/settlement-risk` |
| `shareholder-activism` | reads campaigns, filings, outcomes, sectorTargets, summary… — not in the route's response (8/8 fields missing) | `/shareholder-activism` |
| `shipping-freight` | reads balticIndices, bdiChange, bdiValue, bdtiValue, commodityFlows… — not in the route's response (11/11 fields missing) | `/shipping-freight` |
| `shipping-rates` | reads container, dryBulk, ports, summary, tanker — not in the route's response (5/5 fields missing) | `/shipping-rates` |
| `smart-beta` | reads factorExposures, flows, performanceAttribution, rebalanceCalendar, regime — not in the route's response (5/6 fields missing) | `/smart-beta` |
| `sovereign-bond-auction` | reads calendar, recent, stats, upcoming — not in the route's response (4/4 fields missing) | `/sovereign-bond-auction` |
| `sovereign-cds` | untyped hook; panel references 0% of the route's response fields | `/sovereign-cds` |
| `sovereign-cds-monitor` | untyped hook; panel references 0% of the route's response fields | `/sovereign-cds-monitor` |
| `sovereign-debt` | reads countries, summary — not in the route's response (2/2 fields missing) | `/sovereign-debt` |
| `sovereign-debt-maturity` | reads auctions, countries, global, globalMaturityWall, maturityProfiles… — not in the route's response (7/7 fields missing) | `/sovereign-debt-maturity` |
| `sovereign-debt-monitor` | untyped hook; panel references 0% of the route's response fields | `/sovereign-debt-monitor` |
| `sovereign-default` | reads contagion, countries, events, summary — not in the route's response (4/4 fields missing) | `/sovereign-default` |
| `sovereign-risk-score` | reads countries, regionAverages, timestamp, trendSummary, watchlist — not in the route's response (5/5 fields missing) | `/sovereign-risk-score` |
| `sovereign-wealth` | reads allocations, funds, geography, summary, timestamp… — not in the route's response (6/6 fields missing) | `/sovereign-wealth` |
| `sovereign-wealth-fund` | reads allocations, funds, geography, marketImpact, performance… — not in the route's response (8/8 fields missing) | `/sovereign-wealth-fund` |
| `sovereign-yield` | reads auctions, benchmarks, curve, curveSpreads, realYields… — not in the route's response (7/7 fields missing) | `/sovereign-yield` |
| `spac-monitor` | reads activeSpacs, arbOpportunities, completedDeals, liquidations, pendingDeals… — not in the route's response (8/8 fields missing) | `/spac-monitor` |
| `space-economy` | reads companies, constellations, govBudgets, launches, orbitalEnvironment… — not in the route's response (6/6 fields missing) | `/space-economy` |
| `special-situations` | untyped hook; panel references 0% of the route's response fields | `/special-situations` |
| `sports-media-rights` | reads deals, franchises, mediaDeals, media_deals, platforms… — not in the route's response (9/9 fields missing) | `/sports-media-rights` |
| `structured-credit` | reads cloMarket, deals, defaultRecovery, defaults, marketOverview… — not in the route's response (12/12 fields missing) | `/structured-credit` |
| `structured-notes` | reads activeNotes, barrierAlerts, issuancePipeline, performance, timestamp — not in the route's response (5/5 fields missing) | `/structured-notes` |
| `structured-product` | untyped hook; panel references 14% of the route's response fields | `/structured-product` |
| `structured-products` | reads abs, clo, cmbs, overview, prepayment… — not in the route's response (8/8 fields missing) | `/structured-products` |
| `structured-products-analyzer` | untyped hook; panel references 0% of the route's response fields | `/structured-products-analyzer` |
| `subordinated-debt` | reads issuers, recentEvents, riskGauges, riskMetrics, spreadCurve… — not in the route's response (8/8 fields missing) | `/subordinated-debt` |
| `sukuk-monitor` | untyped hook; panel references 11% of the route's response fields | `/sukuk-monitor` |
| `supply-chain-finance` | reads instruments, overview, programs, regionalBreakdown, riskIndicators… — not in the route's response (7/7 fields missing) | `/supply-chain-finance` |
| `supply-chain-stress` | reads commodityFreight, inventoryToSales, portCongestion, pressureIndex, shippingRates… — not in the route's response (7/7 fields missing) | `/supply-chain-stress` |
| `swap-curve-monitor` | untyped hook; panel references 27% of the route's response fields | `/swap-curve-monitor` |
| `swap-execution` | reads executionAnalytics, productBreakdown, sefVolumes, summary — not in the route's response (4/4 fields missing) | `/swap-execution` |
| `swap-pricing` | untyped hook; panel references 18% of the route's response fields | `/swap-pricing` |
| `swap-spread` | reads crossCurrencyBasis, eurSpreads, forwardRates, gbpSpreads, jpySpreads… — not in the route's response (9/9 fields missing) | `/swap-spread` |
| `swap-spread-monitor` | reads butterfly, crossCcy, historical, summary — not in the route's response (4/5 fields missing) | `/swap-spread-monitor` |
| `swap-valuation` | reads discountCurve, greeks, positions, pv01Ladder — not in the route's response (4/4 fields missing) | `/swap-valuation` |
| `swaption-vol` | reads benchmarks, currencies, summary — not in the route's response (3/3 fields missing) | `/swaption-vol` |
| `syndicated-loans` | reads leverage, pipeline, secondary, sectors, summary — not in the route's response (5/5 fields missing) | `/syndicated-loans` |
| `systematic-strategy` | reads factorReturns, riskMetrics, signalDashboard, strategyPerformance — not in the route's response (4/4 fields missing) | `/systematic-strategy` |
| `tax-loss-harvest` | reads candidates, capitalGains, opportunities, replacements, sectorExposure… — not in the route's response (7/7 fields missing) | `/tax-loss-harvest` |
| `total-return-swap` | reads counterpartyExposure, creditTrs, equitySummary, equityTrs, fundingRates… — not in the route's response (9/9 fields missing) | `/total-return-swap` |
| `total-return-swaps` | reads activeSwaps, collateral, counterpartyExposure, financingRates, summary — not in the route's response (5/5 fields missing) | `/total-return-swaps` |
| `trade-balance` | reads categories, containers, countries, currentAccount, headlineBalance… — not in the route's response (10/10 fields missing) | `/trade-balance` |
| `trade-blotter` | reads executionQuality, pnl, summary, trades — not in the route's response (4/4 fields missing) | `/trade-blotter` |
| `trade-compression` | reads counterparties, cycles, efficiency, overallRatio, portfolio… — not in the route's response (8/8 fields missing) | `/trade-compression` |
| `trade-cost-analysis` | untyped hook; panel references 14% of the route's response fields | `/trade-cost-analysis` |
| `trade-execution-quality` | untyped hook; panel references 0% of the route's response fields | `/trade-execution-quality` |
| `trade-finance` | untyped hook; panel references 0% of the route's response fields | `/trade-finance` |
| `trade-ideas` | reads assetBreakdown, ideas, signalHeatmap, summary — not in the route's response (4/4 fields missing) | `/trade-ideas` |
| `trade-recap` | reads activity, execution, executionQuality, hourly, hourlyActivity… — not in the route's response (10/10 fields missing) | `/trade-recap` |
| `trade-repository` | untyped hook; panel references 0% of the route's response fields | `/trade-repository` |
| `trade-settlement` | reads calendar, csds, efficiency, failedTrades, pendingSettlements… — not in the route's response (7/7 fields missing) | `/trade-settlement` |
| `transition-management` | reads costAnalysis, overview, sectorRebalancing, timeline, trackingError… — not in the route's response (6/6 fields missing) | `/transition-management` |
| `treasury-analytics` | reads onRunOffRun, recentAuctions, summary, upcomingAuctions — not in the route's response (4/4 fields missing) | `/treasury-analytics` |
| `treasury-auctions` | reads countryStats, recentAuctions, upcomingAuctions — not in the route's response (3/3 fields missing) | `/treasury-auctions` |
| `treasury-bill` | reads auctionResults, fundFlows, keyRates, moneyMarketRates, tbillRates… — not in the route's response (8/8 fields missing) | `/treasury-bill` |
| `treasury-futures-basis` | reads basisHistory, calendarSpreads, contracts, ctdAnalysis, deliveryOptions… — not in the route's response (6/6 fields missing) | `/treasury-futures-basis` |
| `treasury-strips` | reads strips/richCheap/volumeLeaders (absent); only 4 par yields would show | `/treasury-strips` |
| `variance-swap` | reads dispersion, ideas, stocks, termStructure, vvix — not in the route's response (5/6 fields missing) | `/variance-swap` |
| `variance-swap-monitor` | reads dispersion, gammaExposure, stocks, summary, termStructure… — not in the route's response (6/7 fields missing) | `/variance-swap-monitor` |
| `variance-swaps` | reads convexity, sectorVariance, summary — not in the route's response (3/4 fields missing) | `/variance-swaps` |
| `venture-capital` | untyped hook; panel references 0% of the route's response fields | `/venture-capital` |
| `vol-risk-premium` | reads assets, summary — not in the route's response (2/2 fields missing) | `/vol-risk-premium` |
| `volatility-arbitrage` | reads correlationTrades, dispersionTrades, marketSummary, volRegimeIndicators, volSurfaceArb — not in the route's response (5/5 fields missing) | `/volatility-arbitrage` |
| `volatility-dashboard` | reads crossAsset, realizedVsImplied, skew, termStructure, volEvents — not in the route's response (5/6 fields missing) | `/volatility-dashboard` |
| `volatility-skew` | reads riskReversal, skewMetrics, tenors, termStructure — not in the route's response (4/4 fields missing) | `/volatility-skew` |
| `volatility-smile` | untyped hook; panel references 0% of the route's response fields | `/volatility-smile` |
| `volatility-surface` | reads greeks, greeksSnapshot, skew, skewData, summary… — not in the route's response (13/13 fields missing) | `/volatility-surface` |
| `wage-growth` | reads countries, globalSummary, timestamp — not in the route's response (3/3 fields missing) | `/wage-growth` |
| `warrant-convertible` | untyped hook; panel references 0% of the route's response fields | `/warrant-convertible` |
| `warrant-pricing` | reads analysis, greeksSummary, issuerSummary, issuers, movers… — not in the route's response (6/6 fields missing) | `/warrant-pricing` |
| `water-market` | crashes: reads overview/waterRights, route returns waterEtfs/waterStocks | `/water-market` |
| `weather-derivatives` | reads activeContracts, avgVolatility, cityPricing, hddCddContracts, hedgingStrategies… — not in the route's response (12/13 fields missing) | `/weather-derivatives` |
| `world-economy` | hardcoded arrays, LAST_UPDATED 2026-03-18 | `` |

## Kept (93)

`alerts`, `analyst-ratings`, `backtest`, `bond-calc` (calculator), `bonds-rates`, `capital-flows`, `carry-trade`, `commodities`, `company-profile`, `correlation-matrix`, `credit-spreads`, `cross-asset`, `currency-strength`, `dispersion`, `dividends`, `drawdown`, `earnings-estimates`, `earnings-surprise`, `earnings-whisper`, `econ-calendar`, `economic-surprises`, `etf-explorer`, `etf-holdings`, `execution-analytics` (placeholder), `factor-exposure`, `fibonacci`, `financials`, `forex`, `fund-flows`, `futures`, `futures-curve`, `fx-converter`, `fx-cross-rates`, `fx-forward` (placeholder), `global-dashboard`, `global-supply-chain`, `heat-map`, `holdings`, `insider-sentiment`, `insider-trades`, `intermarket`, `investment-calc` (calculator), `iv-rank`, `iv-surface`, `liquidity`, `live-streams`, `macro-dashboard`, `macro-heatmap`, `market-anomalies`, `market-breadth`, `market-calendar`, `market-depth` (placeholder), `market-hours` (calculator), `market-movers`, `market-regime`, `market-watch`, `money-flow`, `mortgage-calc` (calculator), `mt5-orders`, `mt5-positions`, `options-calc`, `options-flow`, `order-flow`, `pairs-trading`, `performance`, `pivot-points`, `portfolio-analytics` (placeholder), `portfolio-optimizer`, `positioning`, `precious-metals` (placeholder), `relative-strength`, `relative-valuation`, `risk-calculator`, `seasonality`, `sector-heatmap`, `sector-performance`, `sector-rotation`, `sentiment-dashboard`, `short-interest`, `stock-screener`, `style-box`, `tail-risk`, `tech-scanner`, `technical-chart`, `technical-confluence`, `terminal-log`, `trading`, `valuation-multiples`, `vol-term-structure`, `volatility`, `volatility-cone` (placeholder), `watchlist`, `yield-curve`

## Follow-ups

- Prisma models used only by removed routes were left in the schema (dropping them needs a migration).
- Unknown `/api/*` paths fall through to the SPA `index.html` with status 200 instead of a JSON 404.
- Sector Performance (best/worst strip) and Valuation Multiples (EV/EBITDA, P/S, history tab) are kept with
  those parts blank — the route doesn't return them.
