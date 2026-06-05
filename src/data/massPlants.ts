import { massPlantsAsia } from './massPlantsAsia'
import { massPlantsCis } from './massPlantsCis'
import { massPlantsEu } from './massPlantsEu'
import { massPlantsRussia } from './massPlantsRussia'
import type { Plant } from './market'

export const massPlants: Record<string, Plant> = {
  ...massPlantsRussia,
  ...massPlantsCis,
  ...massPlantsEu,
  ...massPlantsAsia,
}
