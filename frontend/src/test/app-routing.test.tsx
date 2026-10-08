import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { filterItems } from "@/components/app/app-state";
import { buildSnapshot, personUtilizationSeries, projectHoursByProject, weeklyUtilizationSeries } from "@/services/capacity";
import { routeTree } from "@/routeTree.gen";

afterEach(() => {
  vi.unstubAllEnvs();
});

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("keeps only valid, de-duplicated work items in the snapshot", () => {
    const snapshot = buildSnapshot(undefined, {
      origin: "mock",
      today: "2026-10-07",
      currentSprintId: "Sprint 1",
      people: [],
      projects: [],
      sprints: [],
      teams: [],
      absences: [],
      holidays: [],
      burnRatio: [],
      workItems: [
        {
          id: 1,
          title: "Tarefa válida",
          type: "Task",
          state: "Ativo",
          assigneeId: "p1",
          projectId: "proj-1",
          sprintId: "Sprint 1",
          priority: 2,
          estimateHours: 8,
          remainingHours: 8,
          start: "2026-10-05",
          end: "2026-10-09",
          lastUpdated: "2026-10-07",
        },
        {
          id: 1,
          title: "Tarefa duplicada",
          type: "Task",
          state: "Ativo",
          assigneeId: "p1",
          projectId: "proj-1",
          sprintId: "Sprint 1",
          priority: 2,
          estimateHours: 8,
          remainingHours: 8,
          start: "2026-10-05",
          end: "2026-10-09",
          lastUpdated: "2026-10-07",
        },
        {
          id: 2,
          title: "",
          type: "Task",
          state: "Novo",
          assigneeId: "p1",
          projectId: "proj-1",
          sprintId: "Sprint 1",
          priority: 3,
          estimateHours: 4,
          remainingHours: 4,
          start: "2026-10-10",
          end: "2026-10-12",
          lastUpdated: "2026-10-07",
        },
        {
          id: 3,
          title: "Tarefa sem data",
          type: "Bug",
          state: "Novo",
          assigneeId: "p1",
          projectId: "",
          sprintId: "Sprint 1",
          priority: 1,
          estimateHours: 6,
          remainingHours: 6,
          start: "",
          end: "",
          lastUpdated: "2026-10-07",
        },
      ],
    });

    expect(snapshot.workItems.map((w) => w.id)).toEqual([1]);
    expect(snapshot.workItems[0]?.title).toBe("Tarefa válida");
  });

  it("counts the full project effort across all open tasks and bugs", () => {
    const snapshot = buildSnapshot(undefined, {
      origin: "mock",
      today: "2026-10-07",
      currentSprintId: "Sprint 1",
      people: [
        { id: "p1", name: "Ana", role: "Dev", teamId: "t1", dedication: 1 },
        { id: "p2", name: "Bruno", role: "Dev", teamId: "t1", dedication: 1 },
      ],
      projects: [
        { id: "proj-1", name: "Projeto A", code: "PA", colorVar: "--chart-1" },
        { id: "proj-2", name: "Projeto B", code: "PB", colorVar: "--chart-2" },
      ],
      sprints: [],
      teams: [],
      absences: [],
      holidays: [],
      burnRatio: [],
      workItems: [
        { id: 1, title: "T1", type: "Task", state: "Ativo", assigneeId: "p1", projectId: "proj-1", sprintId: "Sprint 1", priority: 2, estimateHours: 8, remainingHours: 8, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
        { id: 2, title: "B1", type: "Bug", state: "Ativo", assigneeId: "p2", projectId: "proj-1", sprintId: "Sprint 1", priority: 2, estimateHours: 6, remainingHours: 6, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
        { id: 3, title: "T2", type: "Task", state: "Concluído", assigneeId: "p1", projectId: "proj-1", sprintId: "Sprint 1", priority: 2, estimateHours: 3, remainingHours: 0, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
        { id: 4, title: "T3", type: "Task", state: "Ativo", assigneeId: "p1", projectId: "proj-2", sprintId: "Sprint 1", priority: 2, estimateHours: 5, remainingHours: 5, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
      ],
    });

    expect(projectHoursByProject(snapshot.workItems, snapshot.projects)).toEqual([
      { name: "Projeto A", value: 14, color: "var(--chart-1)" },
      { name: "Projeto B", value: 5, color: "var(--chart-2)" },
    ]);
  });

  it("calculates person and week utilization as percentages for the dashboard charts", () => {
    const snapshot = buildSnapshot(undefined, {
      origin: "mock",
      today: "2026-10-07",
      currentSprintId: "Sprint 1",
      people: [
        { id: "p1", name: "Ana", role: "Dev", teamId: "t1", dedication: 1 },
        { id: "p2", name: "Bruno", role: "Dev", teamId: "t1", dedication: 1 },
      ],
      projects: [],
      sprints: [],
      teams: [],
      absences: [],
      holidays: [],
      burnRatio: [],
      workItems: [
        { id: 1, title: "T1", type: "Task", state: "Ativo", assigneeId: "p1", projectId: "proj-1", sprintId: "Sprint 1", priority: 2, estimateHours: 8, remainingHours: 8, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
      ],
    });

    expect(personUtilizationSeries(snapshot.people)).toEqual([
      { name: "Ana", util: 20, status: "available" },
      { name: "Bruno", util: 0, status: "available" },
    ]);
    expect(weeklyUtilizationSeries(snapshot.people, snapshot.weeks, 1)[0]).toMatchObject({ util: expect.any(Number), week: expect.any(String) });
  });

  it("keeps zero-value projects so charts can render instead of collapsing to empty", () => {
    const snapshot = buildSnapshot(undefined, {
      origin: "mock",
      today: "2026-10-07",
      currentSprintId: "Sprint 1",
      people: [
        { id: "p1", name: "Ana", role: "Dev", teamId: "t1", dedication: 1 },
      ],
      projects: [
        { id: "proj-1", name: "Projeto A", code: "PA", colorVar: "--chart-1" },
        { id: "proj-2", name: "Projeto B", code: "PB", colorVar: "--chart-2" },
      ],
      sprints: [],
      teams: [],
      absences: [],
      holidays: [],
      burnRatio: [],
      workItems: [
        { id: 1, title: "Tarefa concluída", type: "Task", state: "Concluído", assigneeId: "p1", projectId: "proj-1", sprintId: "Sprint 1", priority: 2, estimateHours: 8, remainingHours: 0, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
      ],
    });

    expect(projectHoursByProject(snapshot.workItems, snapshot.projects)).toEqual([
      { name: "Projeto A", value: 0, color: "var(--chart-1)" },
      { name: "Projeto B", value: 0, color: "var(--chart-2)" },
    ]);
  });

  it("filters work items by team, person, project and type before rendering the dashboard", () => {
    const items = [
      { id: 1, title: "Task do time A", type: "Task", state: "Ativo", assigneeId: "p1", projectId: "proj-1", sprintId: "Sprint 1", priority: 2, estimateHours: 8, remainingHours: 8, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
      { id: 2, title: "Task do time B", type: "Task", state: "Ativo", assigneeId: "p2", projectId: "proj-1", sprintId: "Sprint 1", priority: 2, estimateHours: 5, remainingHours: 5, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
      { id: 3, title: "Bug do time B", type: "Bug", state: "Ativo", assigneeId: "p2", projectId: "proj-2", sprintId: "Sprint 1", priority: 1, estimateHours: 6, remainingHours: 6, start: "2026-10-05", end: "2026-10-09", lastUpdated: "2026-10-07" },
    ] as const;

    const people = [
      { id: "p1", teamId: "team-a" },
      { id: "p2", teamId: "team-b" },
    ];

    expect(filterItems(items as any, { project: "proj-1", team: "team-b", sprint: "all", period: "8", person: "all", type: "all" }, people)).toHaveLength(1);
    expect(filterItems(items as any, { project: "all", team: "all", sprint: "all", period: "8", person: "p2", type: "Task" }, people).map((w) => w.id)).toEqual([2]);
  });

  it("uses demo mode when Supabase is not explicitly configured", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    const supabaseModule = await import("@/integrations/supabase");

    expect(supabaseModule.supabaseConfigured).toBe(false);
    expect(supabaseModule.demoAuthAllowed).toBe(true);
  });
});
