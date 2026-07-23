/**
 * Equipment definitions for idleRO interface prototype.
 *
 * Maps RO weapon/headgear/shield IDs to ragassets view IDs and sprite folders.
 * When the player equips an item, the sprite set for standby/attack animations
 * switches to the corresponding folder.
 *
 * === WEAPONS ===
 * Novice can equip: daggers, swords, axes, maces, rods (no bows, no 2h weapons).
 * Walk and dead animations are always weapon-less (RO design).
 * Weapon is visible only in standby and attack-variant-1.
 *
 * === HEADGEARS ===
 * Headgear overlay works for Novice via ragassets.
 * View IDs 1-5+ correspond to different hat types.
 *
 * === SHIELDS ===
 * Shield overlay works for Novice via ragassets.
 * View ID 1 = Buckler (basic shield).
 */

// ============================================================================
// Types
// ============================================================================

export type WeaponClass = 'dagger' | 'sword' | 'axe' | 'mace' | 'rod' | 'none';

export interface WeaponDef {
  /** Ragassets weapon view ID (passed as weapon= param). */
  viewId: number;
  /** Display name. */
  name: string;
  /** Weapon class for game logic. */
  class: WeaponClass;
  /** Sprite folder suffix: standby-{suffix} and attack-{suffix}. */
  spriteKey: string;
  /** Ragassets action for attack animation with this weapon visible. */
  attackAction: number;
  /** Number of attack frames for this weapon. */
  attackFrames: number;
  /** Sample item IDs that use this view (for drop tables). */
  itemIds: number[];
}

export interface HeadgearDef {
  viewId: number;
  name: string;
  spriteKey: string;
}

export interface ShieldDef {
  viewId: number;
  name: string;
  spriteKey: string;
}

// ============================================================================
// Weapon DB
// ============================================================================

export const WEAPONS: WeaponDef[] = [
  { viewId: 1,  name: 'Dagger', class: 'dagger', spriteKey: 'dagger', attackAction: 86, attackFrames: 9, itemIds: [1201, 1202, 1203, 1204, 1205, 1206, 1207, 1208, 1209, 1210, 1211, 1212, 1213, 1214, 1215, 1216, 1217, 1218, 1219, 1220, 1221, 1222, 1223, 1224, 1225, 1226, 1227, 1228, 1229, 1230, 1231, 1232, 1233, 1234, 1235, 1236, 1237, 1238, 1239, 1240, 13049, 13050, 13051, 13052] },
  { viewId: 2,  name: 'Sword',  class: 'sword',  spriteKey: 'sword',  attackAction: 94, attackFrames: 8, itemIds: [1101, 1102, 1103, 1104, 1105, 1106, 1107, 1108, 1109, 1110, 1111, 1112, 1113, 1114, 1115, 1116, 1117, 1118, 1119, 1120, 1121, 1122, 1123, 1124, 1125, 1126, 1127, 1128, 1129, 1130, 1131, 1132, 1133, 1134, 1135, 1136, 1137, 1138, 1139, 1140, 1141, 1142, 1143, 1144, 13412, 13413, 13414] },
  { viewId: 6,  name: 'Axe',    class: 'axe',    spriteKey: 'axe',    attackAction: 94, attackFrames: 8, itemIds: [1351, 1352, 1353, 1354, 1355, 1356, 1357, 1358, 1359, 1360, 1361, 1362, 1363, 1364, 1365, 1366, 1367, 1368, 1369, 1370, 1371, 1372, 1373, 1374, 1375, 1376, 1377, 1378, 1379, 1380, 1381, 1382, 1383, 1384, 1385, 1386, 1387, 1388, 1389, 1390] },
  { viewId: 8,  name: 'Mace',   class: 'mace',   spriteKey: 'mace',   attackAction: 94, attackFrames: 8, itemIds: [1501, 1502, 1503, 1504, 1505, 1506, 1507, 1508, 1509, 1510, 1511, 1512, 1513, 1514, 1515, 1516, 1517, 1518, 1519, 1520, 1521, 1522, 1523, 1524, 1525, 1526, 1527, 1528, 1529, 1530, 1531] },
  { viewId: 10, name: 'Rod',    class: 'rod',    spriteKey: 'rod',    attackAction: 94, attackFrames: 8, itemIds: [1601, 1602, 1603, 1604, 1605, 1606, 1607, 1608, 1609, 1610, 1611, 1612, 1613, 1614, 1615, 1616, 1617, 1618, 1619, 1620] },
];

/** Find weapon definition by item ID. */
export function weaponByItemId(itemId: number): WeaponDef | undefined {
  return WEAPONS.find((w) => w.itemIds.includes(itemId));
}

// ============================================================================
// Headgear DB (starter — expand as needed)
// ============================================================================

export const HEADGEARS: HeadgearDef[] = [
  { viewId: 1,  name: 'Goggles',     spriteKey: 'hat1' },
  { viewId: 2,  name: 'Hat',         spriteKey: 'hat2' },
  { viewId: 3,  name: 'Cap',         spriteKey: 'hat3' },
  { viewId: 4,  name: 'Ribbon',      spriteKey: 'hat4' },
  { viewId: 5,  name: 'Bandana',     spriteKey: 'hat5' },
];

// ============================================================================
// Shield DB (starter)
// ============================================================================

export const SHIELDS: ShieldDef[] = [
  { viewId: 1,  name: 'Buckler',     spriteKey: 'shield1' },
  { viewId: 2101, name: 'Guard',     spriteKey: 'shield2101' },
];

// ============================================================================
// Equipment state
// ============================================================================

export interface Equipment {
  weapon: WeaponDef | null;
  headgear: HeadgearDef | null;
  shield: ShieldDef | null;
}

/** Default Novice equipment: dagger (starter). */
export const DEFAULT_EQUIP: Equipment = {
  weapon: WEAPONS[0]!,    // Dagger
  headgear: null,
  shield: null,
};
