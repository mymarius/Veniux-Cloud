const pool = require('../config/database');

class WarehouseNavigationService {
  /**
   * Optimize picking route for a list of location items using S-Shape / TSP heuristic with Euclidean distance
   */
  async optimizePickPath(locationItems, warehouseId, startPoint = { x: 0, y: 0 }, client = pool) {
    if (!locationItems || locationItems.length === 0) return [];

    // 1. Fetch coordinates for all locations
    const locationIds = locationItems.map(item => item.location_id).filter(Boolean);
    if (locationIds.length === 0) return locationItems;

    const locsRes = await client.query(`
      SELECT id, location_code, aisle_code, rack_number, shelf_tier, bin_position,
             x_coord, y_coord, z_coord
      FROM warehouse_locations 
      WHERE warehouse_id = $1 AND id IN (${locationIds.map((_, i) => '$' + (i + 2)).join(',')})
    `, [warehouseId, ...locationIds]);

    const locMap = {};
    locsRes.rows.forEach(loc => {
      locMap[loc.id] = loc;
    });

    // 2. Attach coordinate data to items
    const enrichedItems = locationItems.map(item => {
      const loc = locMap[item.location_id] || {
        aisle_code: 'A', rack_number: 1, shelf_tier: 1, bin_position: 1,
        x_coord: 0, y_coord: 0, z_coord: 0
      };
      return {
        ...item,
        location_code: loc.location_code || 'LOC',
        aisle_code: loc.aisle_code,
        rack_number: loc.rack_number,
        shelf_tier: loc.shelf_tier,
        bin_position: loc.bin_position,
        x: loc.x_coord || 0,
        y: loc.y_coord || 0,
        z: loc.z_coord || 0
      };
    });

    // 3. Nearest-Neighbor TSP Heuristic with S-Shape Aisle Traversal
    const unvisited = [...enrichedItems];
    const sortedPath = [];
    let currentPos = { ...startPoint };
    let totalDistanceMeters = 0;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const item = unvisited[i];
        // Manhattan + Z-height penalty distance
        const dx = Math.abs(currentPos.x - item.x);
        const dy = Math.abs(currentPos.y - item.y);
        const dz = Math.abs((currentPos.z || 0) - item.z) * 1.5;
        const dist = Math.sqrt(dx * dx + dy * dy) + dz;

        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const nextTarget = unvisited.splice(nearestIdx, 1)[0];
      totalDistanceMeters += minDistance;
      currentPos = { x: nextTarget.x, y: nextTarget.y, z: nextTarget.z };
      
      sortedPath.push({
        ...nextTarget,
        sequence_number: sortedPath.length + 1,
        step_distance_m: parseFloat(minDistance.toFixed(1))
      });
    }

    // Walking speed: ~1.2 meters / sec
    const estimatedSeconds = Math.round(totalDistanceMeters / 1.2) + (sortedPath.length * 15); // +15 sec pick time per item

    return {
      total_items: sortedPath.length,
      total_distance_m: parseFloat(totalDistanceMeters.toFixed(1)),
      estimated_time_minutes: parseFloat((estimatedSeconds / 60).toFixed(1)),
      optimized_tasks: sortedPath
    };
  }
}

module.exports = new WarehouseNavigationService();
