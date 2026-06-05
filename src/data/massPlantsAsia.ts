import asiaPlantLeadFeed from './asiaMassPlantLeads.json'
import { buildMassPlants } from './massPlantFactory'
import type { RegionalLeadProfile } from './market'

export const massPlantsAsia = buildMassPlants(asiaPlantLeadFeed as { items?: RegionalLeadProfile[] })
