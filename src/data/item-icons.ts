/**
 * Item-icon mapping: itemId → PNG file under /public/sprites/items/.
 *
 * PNG assets are sourced from divine-pride.net's public CDN. Each item the
 * engine defines in src/data/items.ts has an entry here so the inventory
 * panel and other UI surfaces can show a real icon instead of an emoji.
 *
 * If an item isn't listed (or the file fails to load) the UI falls back
 * to a type-based emoji.
 */

import type { ItemId } from '@engine/types';

const MAP: Record<ItemId, string> = {
  // Weapons
  Item_Weapon_NoviceKnife:           'novice-knife',
  Item_Weapon_NoviceBow:             'novice-bow',  // (placeholder name — not in source)
  Item_Weapon_CompositeBow:          'composite-bow',
  Item_Weapon_CrossBow:              'crossbow',
  Item_Weapon_GakkungBow:            'gakkung',
  Item_Weapon_HunterBow:             'hunter-bow',
  Item_Weapon_BowOfRoguesTreasure:   'bow-of-rogues-treasure',

  // Ammunition
  Item_Ammo_Arrow:      'arrow',
  Item_Ammo_FireArrow:  'fire-arrow',
  Item_Ammo_SilverArrow:'silver-arrow',

  // Armor
  Item_Armor_CottonShirt:  'cotton-shirt',
  Item_Armor_LeatherJacket:'leather-jacket',
  Item_Armor_Tights:       'tights',
  Item_Armor_SilkRobe:     'silk-robe',
  Item_Armor_Hood:         'hood',
  Item_Armor_Muffler:      'muffler',
  Item_Armor_Sandals:      'sandals',
  Item_Armor_Boots:        'boots',

  // Headgear
  Item_Hat_Sakkat:        'sakkat',
  Item_Hat_Cap:           'cap',
  Item_Hat_FeatherBand:   'feather-band',

  // Consumables
  Item_Consum_RedPotion:   'red-potion',
  Item_Consum_OrangePotion:'orange-potion',

  // Etc
  Item_Jellopy:           'jellopy',
  Item_Feather:           'feather',
  Item_Apple:             'apple',
  Item_Carrot:            'carrot',
  Item_Spore:             'spore-item',
  Item_RedHerb:           'red-herb',
  Item_WhiteHerb:         'white-herb',
  Item_MushroomSpore:     'mushroom-spore',
  Item_WolfClaw:          'wolf-claw',
  Item_AnimalSkin:        'animal-skin',
  Item_RawMeat:           'raw-meat',
  Item_Pet_Egg_Lunatic:   'pet-egg-lunatic',
  Item_TigerSkin:         'tiger-skin',
  Item_BurningHeart:      'burning-heart',
  Item_OldVioletBox:      'old-violet-box',

  // Refine materials
  Item_Phracon:        'phracon',
  Item_Emveretarcon:   'emveretarcon',
  Item_Oridecon:       'oridecon',

  // Cards
  Card_Lunatic:           'card-lunatic',
  Card_Spore:             'card-spore',
  Card_Wolf:              'card-wolf',
  Card_Savage:            'card-savage',
  Card_Eddga:             'card-eddga',
  Card_Hydra:             'card-hydra',
  Card_Vadon:             'card-vadon',
  Card_Minorous:          'card-minorous',
  Card_SkeletonWorker:    'card-skeleton-worker',
  Card_Andre:             'card-andre',
  Card_SoldierSkeleton:   'card-soldier-skeleton',
  Card_TharaFrog:         'card-thara-frog',
  Card_Raydric:           'card-raydric',
  Card_Whisper:           'card-whisper',
  Card_PecoPeco:          'card-peco-peco',
  Card_Matyr:             'card-matyr',
  Card_Sohee:             'card-sohee',
  Card_Mummy:             'card-mummy',
  Card_Ghostring:         'card-ghostring',
};

/**
 * Return the public URL of the icon PNG for `itemId`, or null if no asset
 * is mapped. The caller should still handle onerror → emoji fallback.
 */
export function getItemIconSrc(itemId: ItemId): string | null {
  const file = MAP[itemId];
  if (!file) return null;
  return `sprites/items/${file}.png`;
}
