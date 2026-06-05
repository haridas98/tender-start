import massPlantLeadFeed from './russiaMassPlantLeads.json'
import { buildMassPlants } from './massPlantFactory'
import type { RegionalLeadProfile } from './market'

export const massPlantsRussia = buildMassPlants(massPlantLeadFeed as { items?: RegionalLeadProfile[] })
