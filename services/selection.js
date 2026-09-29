const repo = require("./repository");
const defaults = require("../mock/data").defaultSelection;
let selected = { ...defaults };
const get = () => ({ ...selected });
const set = (value) => {
  selected = { ...selected, ...value };
};
const reset = () => {
  selected = { ...defaults };
};
async function load(preferred) {
  const communities = await repo.communities();
  if (!communities.length)
    return { communities, buildings: [], units: [], floors: [], selection: {} };
  const old = Object.assign({}, get(), preferred || {});
  const community =
    communities.find((c) => c.id === old.communityId) || communities[0];
  const buildings = await repo.buildings(community.id);
  const building =
    buildings.find((b) => b.id === old.buildingId) || buildings[0];
  const detail = building ? await repo.building(building.id) : { units: [] };
  const unit = detail.units.find((u) => u.id === old.unitId) || detail.units[0];
  const floors = unit ? unit.floors : [];
  const floor = floors.find((f) => f.id === old.floorId) || floors[0];
  const selection = {
    communityId: community.id,
    buildingId: building ? building.id : "",
    unitId: unit ? unit.id : "",
    floorId: floor ? floor.id : "",
  };
  set(selection);
  return {
    communities,
    buildings,
    units: detail.units,
    floors,
    selection,
    communityIndex: communities.indexOf(community),
    buildingIndex: buildings.indexOf(building),
    unitIndex: detail.units.indexOf(unit),
    floorIndex: floors.indexOf(floor),
    locationText: [
      community.name,
      building && building.name,
      unit && unit.name,
      floor && floor.number + "层",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
module.exports = { get, set, load, reset };
