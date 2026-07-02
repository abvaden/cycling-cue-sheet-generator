import type { Project } from '../types'
import { toMm } from '../types'

export async function exportProjectPdf(project: Project) {
  const sheet = document.querySelector<HTMLElement>('[data-cue-sheet-preview]')
  if (!sheet) throw new Error('The cue sheet preview is not available.')

  const [{ jsPDF }, { toPng }] = await Promise.all([
    import('jspdf'),
    import('html-to-image'),
  ])
  const widthMm = toMm(project.sheet.width, project.sheet.dimensionUnit)
  const heightMm = toMm(project.sheet.height, project.sheet.dimensionUnit)
  sheet.classList.add('exporting')
  let imageData: string
  try {
    imageData = await toPng(sheet, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: 'transparent',
      width: sheet.offsetWidth,
      height: sheet.offsetHeight,
      // The sheet is centered in the editor with `margin: 0 auto`; html-to-image
      // bakes that resolved margin (e.g. `0 194.5px`) onto the clone and shifts
      // the canvas right by the on-screen offset. Force zero margin on the clone
      // so the exported page contains only the canvas, flush to the origin.
      style: { margin: '0' },
    })
  } finally {
    sheet.classList.remove('exporting')
  }
  const pdf = new jsPDF({
    unit: 'mm',
    format: [widthMm, heightMm],
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    compress: true,
  })
  pdf.addImage(imageData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST')
  pdf.save(`${project.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-cue-sheet.pdf`)
}
