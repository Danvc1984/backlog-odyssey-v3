import { describe, expect, it } from "vitest";
import { assignPlayRoles, type PlayRoleCandidate } from "./roles";

function candidate(id: string, tastePoints = 0, envStatus: PlayRoleCandidate["envStatus"] = "UNKNOWN", genres: string[] = []): PlayRoleCandidate {
  return { id, tastePoints, envStatus, genres };
}

describe("assignPlayRoles", () => {
  it("assigns two best fits, a ready out-of-the-box pick, and the lowest nonzero taste pick", () => {
    const result = assignPlayRoles(
      [
        candidate("fit-1", 5),
        candidate("fit-2", 4),
        candidate("not-ready", -1),
        candidate("ready", 2, "READY"),
        candidate("contrary", -3),
      ],
      "RERANKED",
    );

    expect(result.assigned).toEqual([
      { id: "fit-1", role: "BEST_FIT_1", caveats: [] },
      { id: "fit-2", role: "BEST_FIT_2", caveats: [] },
      { id: "ready", role: "OUT_OF_THE_BOX", caveats: [] },
      { id: "contrary", role: "CHANGE_OF_PACE", caveats: [] },
    ]);
  });

  it("uses role fallbacks when no ready or nonzero-taste candidate remains", () => {
    const result = assignPlayRoles(
      [candidate("a"), candidate("b"), candidate("c"), candidate("d")],
      "RERANKED",
    );

    expect(result.assigned[2]).toMatchObject({
      id: "c",
      role: "OUT_OF_THE_BOX",
      caveats: [{ factor: "role_fallback", label: "No ready-to-play candidate left for this role" }],
    });
    expect(result.assigned[3]).toMatchObject({
      id: "d",
      role: "CHANGE_OF_PACE",
      caveats: [{ factor: "role_fallback", label: "No taste signal yet for a change of pace" }],
    });
  });

  it("keeps displayed roles non-overlapping and excludes displayed ids from batches", () => {
    const result = assignPlayRoles(
      [
        candidate("a", 2, "READY"),
        candidate("b", 1),
        candidate("c", -1, "READY"),
        candidate("d", -2),
        candidate("zero", 0),
      ],
      "RERANKED",
    );
    const ids = result.assigned.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.values(result.batches).flat()).not.toEqual(expect.arrayContaining(ids));
    expect(result.batches.OUT_OF_THE_BOX).toEqual([]);
    expect(result.batches.CHANGE_OF_PACE).toEqual(["zero"]);
  });

  it("assigns cold-start diversified picks in pick order with a change-of-pace fallback", () => {
    const result = assignPlayRoles(
      [
        candidate("a", 8, "UNKNOWN", ["RPG"]),
        candidate("b", 7, "UNKNOWN", ["RPG"]),
        candidate("c", 6, "READY", ["Strategy"]),
        candidate("d", 5, "UNKNOWN", ["Puzzle"]),
        candidate("e", 4, "READY", ["Racing"]),
      ],
      "COLD_START",
    );

    expect(result.assigned.map((item) => [item.id, item.role])).toEqual([
      ["a", "BEST_FIT_1"],
      ["c", "BEST_FIT_2"],
      ["e", "OUT_OF_THE_BOX"],
      ["d", "CHANGE_OF_PACE"],
    ]);
    expect(result.assigned[3].caveats).toEqual([
      { factor: "role_fallback", label: "No taste signal yet for a change of pace" },
    ]);
  });

  it("leaves roles absent when the pool is exhausted", () => {
    const result = assignPlayRoles([candidate("only")], "RERANKED");
    expect(result.assigned).toEqual([{ id: "only", role: "BEST_FIT_1", caveats: [] }]);
  });
});
