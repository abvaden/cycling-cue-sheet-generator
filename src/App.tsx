import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Bike,
  ChevronDown,
  CircleDot,
  Copy,
  Download,
  FileUp,
  GripVertical,
  Map as MapIcon,
  Minus,
  Mountain,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { ElevationProfile } from "./components/ElevationProfile";
import { RouteMap } from "./components/RouteMap";
import { SheetCanvas } from "./components/SheetCanvas";
import { parseGpxFile } from "./lib/gpx";
import { GRID_UNIT_MM, flowGrid, nextGridPosition, sheetGridSize } from "./lib/layout";
import { isElapsedDuration, normalizeElapsedDuration } from "./lib/duration";
import { exportProjectPdf } from "./lib/pdf";
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
} from "./lib/storage";
import type {
  Cue,
  PointCue,
  Project,
  ScalableField,
  SectionCue,
  Visibility,
} from "./types";
import {
  cueDistance,
  defaultVisibility,
  formatDistance,
  formatElevation,
} from "./types";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function freshProject(): Project {
  return {
    id: id(),
    version: 1,
    name: "Untitled ride",
    cues: [],
    orderCustomized: false,
    sheet: {
      width: 200,
      height: 70,
      dimensionUnit: "mm",
      units: "imperial",
      marginMm: 3,
    },
    createdAt: now(),
    updatedAt: now(),
  };
}

function FieldToggle({
  field,
  visibility,
  onChange,
}: {
  field: keyof Visibility;
  visibility: Visibility;
  onChange: (next: Visibility) => void;
}) {
  return (
    <label className="visibility-toggle">
      <input
        type="checkbox"
        checked={visibility[field] !== false}
        onChange={(event) =>
          onChange({ ...visibility, [field]: event.target.checked })
        }
      />
      <span>{field === "units" ? "Distance unit (mi/km)" : field}</span>
    </label>
  );
}

function DistanceInput({
  distanceKm,
  units,
  onCommit,
}: {
  distanceKm: number;
  units: "metric" | "imperial";
  onCommit: (distanceKm: number) => void;
}) {
  const factor = units === "imperial" ? 0.621371 : 1;
  const formatted = (distanceKm * factor).toFixed(1);
  const [value, setValue] = useState(formatted);

  useEffect(() => setValue(formatted), [formatted]);

  const commit = () => {
    const numeric = Number(value);
    if (value.trim() !== "" && Number.isFinite(numeric)) onCommit(numeric / factor);
    else setValue(formatted);
  };

  return (
    <input
      type="number"
      min="0"
      step="0.1"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setValue(formatted);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export default function App() {
  const [project, setProject] = useState<Project>(freshProject);
  const [selectedId, setSelectedId] = useState<string>();
  const [pickedKm, setPickedKm] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSelected, setProjectSelected] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [orderMode, setOrderMode] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const selected = project.cues.find((cue) => cue.id === selectedId);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .finally(() => setProjectsLoaded(true));
  }, []);

  useEffect(() => {
    if (!projectSelected) return;
    const timer = window.setTimeout(async () => {
      try {
        const next = await saveProject(project);
        setProject((current) =>
          current.updatedAt === project.updatedAt ? next : current,
        );
        setProjects(await listProjects());
        setSaved(true);
      } catch {
        /* IndexedDB may be unavailable in private browser contexts. */
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [projectSelected, project.name, project.route, project.cues, project.sheet]);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 1600);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const importRoute = async (file?: File) => {
    if (!file) return;
    try {
      const route = await parseGpxFile(file);
      setProject((current) => ({
        ...current,
        name: route.name,
        route,
        cues: [],
      }));
      setSelectedId(undefined);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not read this route.",
      );
    }
  };

  const addSection = () => {
    if (!project.route) return;
    const startKm = Math.min(
      pickedKm,
      Math.max(0, project.route.distanceKm - 0.5),
    );
    const cue: SectionCue = {
      id: id(),
      order: project.cues.length,
      kind: "section",
      fieldScales: {},
      category: "Climb",
      title: "Key section",
      note: "",
      noteBold: false,
      startKm,
      endKm: Math.min(
        project.route.distanceKm,
        startKm + Math.max(0.5, project.route.distanceKm * 0.08),
      ),
      colorByGrade: false,
      gradeMaxPercent: 9,
      gradeResolution: 24,
      overlayTextOnProfile: false,
      visibility: { ...defaultVisibility },
      grid: nextGridPosition(project.cues, 6, 3, sheetGridSize(project.sheet).columns),
    };
    setProject((current) => ({
      ...current,
      cues: flowGrid(
        current.orderCustomized ? [...current.cues, cue] : [...current.cues, cue].sort((a, b) => cueDistance(a) - cueDistance(b)),
        sheetGridSize(current.sheet).columns,
      ).map((item, order) => ({ ...item, order })),
    }));
    setSelectedId(cue.id);
  };

  const addRouteProfile = () => {
    if (!project.route) return;
    const cue: SectionCue = {
      id: id(),
      order: project.cues.length,
      kind: "section",
      fieldScales: {},
      category: "Route",
      title: "Route profile",
      note: "",
      noteBold: false,
      startKm: 0,
      endKm: project.route.distanceKm,
      colorByGrade: false,
      gradeMaxPercent: 9,
      gradeResolution: 24,
      overlayTextOnProfile: false,
      visibility: { ...defaultVisibility },
      grid: nextGridPosition(project.cues, 12, 4, sheetGridSize(project.sheet).columns),
    };
    setProject((current) => ({
      ...current,
      cues: flowGrid(
        current.orderCustomized ? [...current.cues, cue] : [...current.cues, cue].sort((a, b) => cueDistance(a) - cueDistance(b)),
        sheetGridSize(current.sheet).columns,
      ).map((item, order) => ({ ...item, order })),
    }));
    setSelectedId(cue.id);
  };

  const addPoint = () => {
    if (!project.route) return;
    const cue: PointCue = {
      id: id(),
      order: project.cues.length,
      kind: "point",
      fieldScales: {},
      category: "Aid",
      title: "Aid station",
      note: "",
      noteBold: false,
      distanceKm: pickedKm,
      elapsed: "",
      horizontalLayout: false,
      visibility: { ...defaultVisibility, profile: false },
      grid: nextGridPosition(project.cues, 6, 2, sheetGridSize(project.sheet).columns),
    };
    setProject((current) => ({
      ...current,
      cues: flowGrid(
        current.orderCustomized ? [...current.cues, cue] : [...current.cues, cue].sort((a, b) => cueDistance(a) - cueDistance(b)),
        sheetGridSize(current.sheet).columns,
      ).map((item, order) => ({ ...item, order })),
    }));
    setSelectedId(cue.id);
  };

  const patchCue = (patch: Partial<Cue>) =>
    setProject((current) => ({
      ...current,
      cues: current.cues.map((cue) =>
        cue.id === selectedId ? ({ ...cue, ...patch } as Cue) : cue,
      ),
    }));
  const removeSelected = () => {
    setProject((current) => ({
      ...current,
      cues: flowGrid(current.cues.filter((cue) => cue.id !== selectedId), sheetGridSize(current.sheet).columns).map((cue, order) => ({ ...cue, order })),
    }));
    setSelectedId(undefined);
  };
  const pickDistance = useCallback(
    (distanceKm: number) => setPickedKm(distanceKm),
    [],
  );

  const reorder = (fromId: string, toId: string) => {
    setProject((current) => {
      const cues = [...current.cues];
      const from = cues.findIndex((cue) => cue.id === fromId);
      const to = cues.findIndex((cue) => cue.id === toId);
      if (from < 0 || to < 0 || from === to) return current;
      const [moved] = cues.splice(from, 1);
      cues.splice(to, 0, moved);
      return {
        ...current,
        orderCustomized: true,
        cues: flowGrid(cues, sheetGridSize(current.sheet).columns).map((cue, order) => ({ ...cue, order })),
      };
    });
  };

  const resize = (cueId: string, axis: "w" | "h", delta: number) =>
    setProject((current) => {
      const resized = current.cues.map((cue) =>
        cue.id === cueId
          ? ({
              ...cue,
              grid: {
                ...cue.grid,
                [axis]: Math.max(
                  axis === "w" ? 3 : 1,
                  Math.min(axis === "w" ? sheetGridSize(current.sheet).columns : 60, cue.grid[axis] + delta),
                ),
              },
            } as Cue)
          : cue,
      );
      return { ...current, cues: flowGrid(resized, sheetGridSize(current.sheet).columns) };
    });
  const overflow = useMemo(
    () =>
      project.cues.some(
        (cue) => cue.grid.y + cue.grid.h > sheetGridSize(project.sheet).rows || cue.grid.x + cue.grid.w > sheetGridSize(project.sheet).columns,
      ),
    [project.cues],
  );
  const openProject = async (projectId: string) => {
    const stored = await loadProject(projectId);
    if (stored) {
      const cues = stored.cues
        .map((cue, index) => ({
        ...cue,
        order: cue.order ?? index,
        visibility: { ...defaultVisibility, ...cue.visibility },
        }))
        .sort((a, b) => a.order - b.order)
        .map((cue, order) => ({ ...cue, order }));
      setProject({ ...stored, cues: flowGrid(cues, sheetGridSize(stored.sheet).columns) });
      setProjectSelected(true);
      setSelectedId(undefined);
    }
  };
  const newProject = () => {
    setProject(freshProject());
    setProjectSelected(true);
    setSelectedId(undefined);
  };
  const duplicateProject = () => {
    const stamp = now();
    setProject({
      ...project,
      id: id(),
      name: `${project.name} copy`,
      createdAt: stamp,
      updatedAt: stamp,
    });
    setSelectedId(undefined);
  };
  const removeProject = async () => {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    await deleteProject(project.id);
    const remaining = await listProjects();
    setProjects(remaining);
    if (remaining[0]) setProject(remaining[0]);
    else {
      setProject(freshProject());
      setProjectSelected(false);
    }
    setSelectedId(undefined);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Rouleur home">
          <Bike />
          <span>ROULEUR</span>
          <small>Cue Sheet Studio</small>
        </a>
        {projectSelected ? <div className="project-control">
          <label className="project-picker">
            <span>Saved project</span>
            <select
              value={project.id}
              onChange={(event) => openProject(event.target.value)}
            >
              {!projects.some((item) => item.id === project.id) && (
                <option value={project.id}>{project.name}</option>
              )}
              {projects.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="project-name">
            <span>Name</span>
            <input
              aria-label="Project name"
              value={project.name}
              onChange={(event) =>
                setProject({ ...project, name: event.target.value })
              }
            />
          </label>
          <div className="project-actions" aria-label="Project actions">
            <button onClick={newProject} title="Start a new project">
              <Plus /><span>New</span>
            </button>
            <button onClick={duplicateProject} title="Duplicate this project">
              <Copy /><span>Duplicate</span>
            </button>
            <button className="delete-project" onClick={removeProject} title="Delete this project">
              <Trash2 /><span>Delete</span>
            </button>
          </div>
        </div> : <div className="project-prompt">Choose a saved project or create a new one</div>}
        {projectSelected && <div className="header-actions">
          <span className={`save-status ${saved ? "visible" : ""}`}>
            <Save /> Saved locally
          </span>
          <button
            className="button secondary"
            onClick={() => uploadRef.current?.click()}
          >
            <FileUp /> {project.route ? "Replace GPX" : "Upload GPX"}
          </button>
          <button
            className="button primary"
            disabled={!project.route || !project.cues.length || overflow}
            onClick={() => exportProjectPdf(project)}
          >
            <Download /> Export PDF
          </button>
        </div>}
        <input
          ref={uploadRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          hidden
          onChange={(event) => importRoute(event.target.files?.[0])}
        />
      </header>

      {!projectSelected ? (
        <main className="project-gateway" id="top">
          <div className="gateway-heading">
            <span className="eyebrow">YOUR CUE SHEETS</span>
            <h1>Choose a ride.</h1>
            <p>Continue a saved cue sheet or start with a new GPX route.</p>
            <button className="button primary large" onClick={newProject}><Plus /> New project</button>
          </div>
          <section className="project-list" aria-label="Saved projects">
            <div className="project-list-heading"><h2>Saved locally</h2><span>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span></div>
            {!projectsLoaded ? <p className="project-list-empty">Loading projects…</p> : projects.length ? projects.map((item) => (
              <button className="project-entry" key={item.id} onClick={() => openProject(item.id)}>
                <span className="project-entry-mark">{item.route ? 'GPX' : 'NEW'}</span>
                <span className="project-entry-copy"><strong>{item.name}</strong><small>{item.route ? `${formatDistance(item.route.distanceKm, item.sheet.units)} · ${item.cues.length} cues` : 'Route not added'}</small></span>
                <time dateTime={item.updatedAt}>Edited {new Date(item.updatedAt).toLocaleDateString()}</time>
                <ChevronDown className="project-entry-arrow" />
              </button>
            )) : <div className="project-list-empty"><strong>No saved projects yet.</strong><span>Create a project to import your first route.</span></div>}
          </section>
        </main>
      ) : !project.route ? (
        <main className="welcome" id="top">
          <div className="welcome-copy">
            <span className="eyebrow">RIDE NOTES / MADE TO FIT</span>
            <h1>
              Know the road.
              <br />
              <em>Lose the screen.</em>
            </h1>
            <p>
              Turn a GPX route into a precise, printable cue sheet sized for
              your top tube or bars.
            </p>
            <button
              className="button primary large"
              onClick={() => uploadRef.current?.click()}
            >
              <FileUp /> Choose a GPX route
            </button>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <span className="privacy-note">
              Your route stays in this browser.
            </span>
          </div>
          <div className="specimen" aria-hidden="true">
            <div className="specimen-number">01</div>
            <div className="specimen-line" />
            <span>SUMMIT APPROACH</span>
            <strong>42.8 — 49.6 MI</strong>
            <svg viewBox="0 0 300 80">
              <polyline points="0,75 35,68 60,70 90,53 110,58 145,38 170,43 205,16 230,29 265,8 300,11" />
            </svg>
            <p>Steady opening ramp. Commit after the cattle guard.</p>
          </div>
        </main>
      ) : (
        <main className="workspace" id="top">
          <aside className="left-panel">
            <section className="route-summary">
              <div className="section-kicker">
                <MapIcon /> Route
              </div>
              <h2>{project.route.name}</h2>
              <dl>
                <div>
                  <dt>Distance</dt>
                  <dd>
                    {formatDistance(
                      project.route.distanceKm,
                      project.sheet.units,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Gain</dt>
                  <dd>
                    {project.route.hasElevation
                      ? formatElevation(
                          project.route.elevationGainM,
                          project.sheet.units,
                        )
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Cues</dt>
                  <dd>{project.cues.length}</dd>
                </div>
              </dl>
            </section>
            <section className="source-view">
              <RouteMap
                route={project.route}
                cues={project.cues}
                onPick={pickDistance}
              />
              <ElevationProfile
                route={project.route}
                cues={project.cues}
                units={project.sheet.units}
                onPick={pickDistance}
              />
              <div className="pick-readout">
                Selected distance{" "}
                <strong>{formatDistance(pickedKm, project.sheet.units)}</strong>
              </div>
            </section>
            <section className="add-cues">
              <h3>Add to sheet</h3>
              <div>
                <button onClick={addSection}>
                  <Mountain />
                  <span>
                    <strong>Section</strong>
                    <small>Climb, attack or key segment</small>
                  </span>
                </button>
                <button onClick={addRouteProfile}>
                  <AreaChart />
                  <span>
                    <strong>Route profile</strong>
                    <small>Whole-route elevation profile</small>
                  </span>
                </button>
                <button onClick={addPoint}>
                  <CircleDot />
                  <span>
                    <strong>Point</strong>
                    <small>Aid, water or hazard</small>
                  </span>
                </button>
              </div>
            </section>
          </aside>

          <section className="canvas-panel">
            <div className="canvas-head">
              <div>
                <span className="eyebrow">PRINT LAYOUT</span>
                <h2>Sheet composition</h2>
              </div>
              <div className={`fit-status ${overflow ? "bad" : ""}`}>
                <i />
                {overflow ? "Content outside sheet" : "Ready at 100% scale"}
              </div>
            </div>
            <SheetCanvas
              project={project}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <p className="canvas-help">
              Select a card to edit it. Size and order controls are in the
              inspector. Export prints at the exact dimensions shown.
            </p>
          </section>

          <aside className="inspector">
            <section>
              <div className="section-kicker">Sheet geometry</div>
              <div className="dimension-row">
                <label>
                  Width
                  <input
                    type="number"
                    min="1"
                    value={project.sheet.width}
                    onChange={(e) =>
                      setProject({
                        ...project,
                        sheet: {
                          ...project.sheet,
                          width: Math.max(1, Number(e.target.value)),
                        },
                      })
                    }
                  />
                </label>
                <span>×</span>
                <label>
                  Height
                  <input
                    type="number"
                    min="1"
                    value={project.sheet.height}
                    onChange={(e) =>
                      setProject({
                        ...project,
                        sheet: {
                          ...project.sheet,
                          height: Math.max(1, Number(e.target.value)),
                        },
                      })
                    }
                  />
                </label>
                <label className="unit-select">
                  <select
                    value={project.sheet.dimensionUnit}
                    onChange={(e) =>
                      setProject({
                        ...project,
                        sheet: {
                          ...project.sheet,
                          dimensionUnit: e.target.value as "mm" | "in",
                        },
                      })
                    }
                  >
                    <option value="mm">mm</option>
                    <option value="in">in</option>
                  </select>
                  <ChevronDown />
                </label>
              </div>
              <label className="select-label">
                Route units
                <select
                  value={project.sheet.units}
                  onChange={(e) =>
                    setProject({
                      ...project,
                      sheet: {
                        ...project.sheet,
                        units: e.target.value as "metric" | "imperial",
                      },
                    })
                  }
                >
                  <option value="imperial">Miles / feet</option>
                  <option value="metric">Kilometers / meters</option>
                </select>
              </label>
            </section>
            {selected ? (
              <section className="cue-editor">
                <div className="editor-title">
                  <div>
                    <span className="section-kicker">
                      Selected {selected.kind}
                    </span>
                    <h2>{selected.title || "Untitled cue"}</h2>
                  </div>
                  <button
                    className="icon-button danger"
                    onClick={removeSelected}
                    aria-label="Delete cue"
                  >
                    <Trash2 />
                  </button>
                </div>
                <label>
                  Type
                  <select
                    value={selected.category}
                    onChange={(e) => patchCue({ category: e.target.value })}
                  >
                    {(selected.kind === "section"
                      ? ["Climb", "Attack", "Descent", "Key section", "Route"]
                      : ["Aid", "Water", "Food", "Hazard", "Checkpoint"]
                    ).map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Label
                  <input
                    value={selected.title}
                    onChange={(e) => patchCue({ title: e.target.value })}
                  />
                </label>
                {selected.kind === "section" ? (
                  <>
                    <div className="field-pair">
                      <label>
                        Start ({project.sheet.units === "metric" ? "km" : "mi"})
                        <DistanceInput
                          distanceKm={selected.startKm}
                          units={project.sheet.units}
                          onCommit={(startKm) => patchCue({ startKm })}
                        />
                      </label>
                      <label>
                        End ({project.sheet.units === "metric" ? "km" : "mi"})
                        <DistanceInput
                          distanceKm={selected.endKm}
                          units={project.sheet.units}
                          onCommit={(endKm) => patchCue({ endKm })}
                        />
                      </label>
                    </div>
                    <label className="grade-option">
                      <input
                        type="checkbox"
                        checked={selected.visibility.units !== false}
                        onChange={(event) =>
                          patchCue({
                            visibility: {
                              ...selected.visibility,
                              units: event.target.checked,
                            },
                          })
                        }
                      />
                      <span>Show distance unit ({project.sheet.units === "metric" ? "km" : "mi"})</span>
                    </label>
                    <label className="grade-option">
                      <input
                        type="checkbox"
                        checked={selected.colorByGrade ?? false}
                        onChange={(e) =>
                          patchCue({ colorByGrade: e.target.checked })
                        }
                      />
                      <span>Color elevation by grade</span>
                    </label>
                    {selected.colorByGrade && (
                      <>
                        <label>
                          Red zone starts at (%)
                          <input
                            type="number"
                            min="0.3"
                            max="40"
                            step="0.5"
                            value={selected.gradeMaxPercent ?? 9}
                            onChange={(e) =>
                              patchCue({
                                gradeMaxPercent: Math.max(
                                  0.3,
                                  Number(e.target.value) || 9,
                                ),
                              })
                            }
                          />
                        </label>
                        <label className="font-scale-label">
                          <span>
                            Grade bands{" "}
                            <output>{selected.gradeResolution ?? 24}</output>
                          </span>
                          <input
                            type="range"
                            min="3"
                            max="60"
                            step="1"
                            value={selected.gradeResolution ?? 24}
                            onChange={(e) =>
                              patchCue({
                                gradeResolution: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <div
                          className="grade-legend"
                          aria-label="Grade color legend"
                        >
                          <span className="descent">Down</span>
                          <span className="easy">
                            0–{((selected.gradeMaxPercent ?? 9) / 3).toFixed(1)}
                            %
                          </span>
                          <span className="moderate">
                            {((selected.gradeMaxPercent ?? 9) / 3).toFixed(1)}–
                            {(
                              ((selected.gradeMaxPercent ?? 9) * 2) /
                              3
                            ).toFixed(1)}
                            %
                          </span>
                          <span className="hard">
                            {(
                              ((selected.gradeMaxPercent ?? 9) * 2) /
                              3
                            ).toFixed(1)}
                            –{(selected.gradeMaxPercent ?? 9).toFixed(1)}%
                          </span>
                          <span className="steep">
                            {(selected.gradeMaxPercent ?? 9).toFixed(1)}%+
                          </span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <label>
                      Distance ({project.sheet.units === "metric" ? "km" : "mi"}
                      )
                      <DistanceInput
                        distanceKm={selected.distanceKm}
                        units={project.sheet.units}
                        onCommit={(distanceKm) => patchCue({ distanceKm })}
                      />
                    </label>
                    <label className="grade-option">
                      <input
                        type="checkbox"
                        checked={selected.visibility.units !== false}
                        onChange={(event) =>
                          patchCue({
                            visibility: {
                              ...selected.visibility,
                              units: event.target.checked,
                            },
                          })
                        }
                      />
                      <span>Show distance unit ({project.sheet.units === "metric" ? "km" : "mi"})</span>
                    </label>
                    <label>
                      Elapsed duration (HH:MM:SS)
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="02:35:00"
                        aria-invalid={!isElapsedDuration(selected.elapsed)}
                        value={selected.elapsed}
                        onChange={(e) => patchCue({ elapsed: e.target.value })}
                        onBlur={(e) =>
                          patchCue({
                            elapsed: normalizeElapsedDuration(e.target.value),
                          })
                        }
                      />
                      <small className="field-hint">
                        Duration from route start; hours may exceed 23.
                      </small>
                    </label>
                  </>
                )}
                <label>
                  Note
                  <textarea
                    rows={3}
                    value={selected.note}
                    onChange={(e) => patchCue({ note: e.target.value })}
                    placeholder="What matters when you reach this cue?"
                  />
                </label>
                <fieldset>
                  <legend>Data sizes</legend>
                  <div className="data-size-list">
                    {(
                      [
                        "type",
                        "title",
                        "distance",
                        ...(selected.kind === "point" ? ["time"] : []),
                        "note",
                      ] as ScalableField[]
                    ).map((field) => {
                      const scale =
                        selected.fieldScales?.[field] ??
                        selected.fontScale ??
                        1;
                      return (
                        <label className="font-scale-label" key={field}>
                          <span>
                            {field} <output>{Math.round(scale * 100)}%</output>
                          </span>
                          <input
                            type="range"
                            min="0.6"
                            max="5"
                            step="0.05"
                            value={scale}
                            onChange={(e) =>
                              patchCue({
                                fieldScales: {
                                  ...(selected.fieldScales ?? {}),
                                  [field]: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Show on sheet</legend>
                  <div className="visibility-grid">
                    {([
                      "type",
                      "title",
                      "distance",
                      ...(selected.kind === "section" ? ["profile"] : ["time"]),
                      "note",
                    ] as (keyof Visibility)[])
                      .map((field) => (
                        <FieldToggle
                          key={field}
                          field={field}
                          visibility={selected.visibility}
                          onChange={(visibility) => patchCue({ visibility })}
                        />
                      ))}
                  </div>
                </fieldset>
              </section>
            ) : (
              <section className="inspector-empty">
                <span>NO CUE SELECTED</span>
                <p>
                  Select a card on the sheet to edit its content and visibility.
                </p>
              </section>
            )}
            {selected && (
              <section className="control-size-panel">
                <div className="section-kicker">Control size</div>
                <div className="size-adjustments">
                  <div><span>Width</span><strong>{selected.grid.w * GRID_UNIT_MM} mm</strong><div><button onClick={() => resize(selected.id, "w", -1)} aria-label="Reduce width"><Minus /></button><button onClick={() => resize(selected.id, "w", 1)} aria-label="Increase width"><Plus /></button></div></div>
                  <div><span>Height</span><strong>{selected.grid.h * GRID_UNIT_MM} mm</strong><div><button onClick={() => resize(selected.id, "h", -1)} aria-label="Reduce height"><Minus /></button><button onClick={() => resize(selected.id, "h", 1)} aria-label="Increase height"><Plus /></button></div></div>
                </div>
              </section>
            )}
            {project.cues.length > 1 && (
              <section className="order-panel">
                <div className="order-panel-heading"><div><div className="section-kicker">Sheet order</div><p>Controls flow in this saved order.</p></div><button className={`button ${orderMode ? "primary" : "secondary"}`} onClick={() => setOrderMode((value) => !value)}>{orderMode ? "Done" : "Order mode"}</button></div>
                {orderMode && <div className="order-list">{project.cues.map((cue, index) => <div className="order-item" key={cue.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/cue-id", cue.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const from = event.dataTransfer.getData("text/cue-id"); if (from) reorder(from, cue.id); }}><GripVertical /><span>{index + 1}</span><strong>{cue.title || cue.category}</strong><small>{cue.kind}</small></div>)}</div>}
              </section>
            )}
            {selected && (
              <section className="note-layout-options">
                <div className="section-kicker">Note presentation</div>
                <label className="grade-option">
                  <input
                    type="checkbox"
                    checked={selected.noteBold ?? false}
                    onChange={(e) => patchCue({ noteBold: e.target.checked })}
                  />
                  <span>Bold note</span>
                </label>
                {selected.kind === "section" && (
                  <label className="grade-option">
                    <input
                      type="checkbox"
                      checked={selected.overlayTextOnProfile ?? false}
                      onChange={(e) =>
                        patchCue({ overlayTextOnProfile: e.target.checked })
                      }
                    />
                    <span>Stack distance and note over profile</span>
                  </label>
                )}
                {selected.kind === "point" && (
                  <label className="grade-option">
                    <input
                      type="checkbox"
                      checked={selected.horizontalLayout ?? false}
                      onChange={(e) =>
                        patchCue({ horizontalLayout: e.target.checked })
                      }
                    />
                    <span>Stack point items horizontally</span>
                  </label>
                )}
              </section>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}
