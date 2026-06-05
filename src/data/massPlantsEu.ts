import euPlantLeadFeed from './euMassPlantLeads.json'
import { buildMassPlants } from './massPlantFactory'
import type { RegionalLeadProfile } from './market'

export const massPlantsEu = buildMassPlants(euPlantLeadFeed as { items?: RegionalLeadProfile[] })
