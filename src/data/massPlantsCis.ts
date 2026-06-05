import cisPlantLeadFeed from './cisMassPlantLeads.json'
import { buildMassPlants } from './massPlantFactory'
import type { RegionalLeadProfile } from './market'

export const massPlantsCis = buildMassPlants(cisPlantLeadFeed as { items?: RegionalLeadProfile[] })
