import Dexie, { type EntityTable } from 'dexie'
import type { Project } from '../types'

class CueSheetDb extends Dexie {
  projects!: EntityTable<Project, 'id'>

  constructor() {
    super('rouleur-cue-sheets')
    this.version(1).stores({ projects: 'id, updatedAt, name' })
  }
}

export const db = new CueSheetDb()

export async function saveProject(project: Project) {
  const updated = { ...project, updatedAt: new Date().toISOString() }
  await db.projects.put(updated)
  return updated
}

export const listProjects = () => db.projects.orderBy('updatedAt').reverse().toArray()
export const loadProject = (id: string) => db.projects.get(id)
export const deleteProject = (id: string) => db.projects.delete(id)
