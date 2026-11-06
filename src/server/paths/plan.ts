/** A path station as the planner sees it, in path order. */
export type PlanStation = { id: string; included: boolean; plannedSessions: number };
/** A class session in time order; held sessions keep the station they taught. */
export type PlanSession = { id: string; held: boolean; pathStationId: string | null };

/**
 * Assigns every session that hasn't been held to a path station, in order: each included station
 * gets its planned number of sessions, minus those it already had. Sessions left over after the
 * last station get none (the class runs past its path); stations left over continue in the next
 * course. Held sessions are never moved.
 */
export function planSessions(stations: PlanStation[], sessions: PlanSession[]) {
  const held = new Map<string, number>();
  for (const s of sessions)
    if (s.held && s.pathStationId) held.set(s.pathStationId, (held.get(s.pathStationId) ?? 0) + 1);
  const slots: string[] = [];
  for (const st of stations)
    if (st.included)
      for (let i = held.get(st.id) ?? 0; i < st.plannedSessions; i++) slots.push(st.id);
  const out = new Map<string, string | null>();
  let next = 0;
  for (const s of sessions) out.set(s.id, s.held ? s.pathStationId : (slots[next++] ?? null));
  return out;
}

/** Each included station's session numbers (1-based, across the class), in path order. */
export function stationRanges(stations: PlanStation[], sessionStations: (string | null)[]) {
  return stations.map((st) => {
    const numbers = sessionStations.flatMap((id, i) => (id === st.id ? [i + 1] : []));
    return {
      id: st.id,
      first: numbers[0] ?? null,
      last: numbers.at(-1) ?? null,
      count: numbers.length,
    };
  });
}
