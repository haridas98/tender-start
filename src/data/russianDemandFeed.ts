import type { RussiaDemandFeed } from '../domain/types'
import rawDemandFeed from './russianDemandFeed.json'

export const russianDemandFeed = rawDemandFeed as RussiaDemandFeed
export const collectedRussianDemands = russianDemandFeed.items
