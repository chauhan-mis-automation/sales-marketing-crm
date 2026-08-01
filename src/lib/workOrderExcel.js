// ============================================================
// WORK ORDER EXCEL GENERATOR (client-side, ExcelJS)
// Recreates the exact layout used by the old Apps Script
// generateWorkOrderExcel() function — Casilica logo, green
// header bands, dehumidifier rows, sizes box, drawings
// checklist and signature footer.
// ============================================================

import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import casilicaLogo from '../assets/casilica.jpeg'
import { DRAWING_ITEMS } from './workOrderConstants'

const DARK_GREEN = 'FF385623'
const LIGHT_GREEN = 'FFE2EFDA'
const WHITE = 'FFFFFFFF'
const BLACK = 'FF000000'
const GREEN_TICK = 'FF059669'
const RED_CROSS = 'FFBE123C'

// ── style helpers ──────────────────────────────────────────
function applyBorder(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: BLACK } },
    left: { style: 'thin', color: { argb: BLACK } },
    bottom: { style: 'thin', color: { argb: BLACK } },
    right: { style: 'thin', color: { argb: BLACK } }
  }
}

function styleCell(ws, r, c, opts = {}) {
  const cell = ws.getCell(r, c)
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg || WHITE } }
  cell.font = {
    bold: !!opts.bold,
    size: opts.size || 10,
    color: { argb: opts.fg || BLACK }
  }
  cell.alignment = {
    horizontal: opts.ha || 'left',
    vertical: opts.va || 'middle',
    wrapText: !!opts.wrap
  }
  if (opts.border !== false) applyBorder(cell)
  return cell
}

// merge a range, style every cell in it, then set the value on the master cell
function mset(ws, r1, c1, r2, c2, val, opts = {}) {
  if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2)
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) styleCell(ws, r, c, opts)
  }
  ws.getCell(r1, c1).value = val
}

function cset(ws, r, c, val, opts = {}) {
  const cell = styleCell(ws, r, c, opts)
  cell.value = val
}

// ── shared workbook builder ───────────────────────────────────
async function buildWorkbook(payload) {
  const {
    date,
    poId,
    clientName,
    address,
    offerNo,
    completionDate,
    rows = [],
    drawings = {},
    sizes = {}
  } = payload

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')

  // ── column widths (approx px → excel width units) ─────────
  const colWidthsPx = [35, 75, 95, 40, 90, 70, 70, 90, 70, 200, 180, 90]
  colWidthsPx.forEach((px, i) => { ws.getColumn(i + 1).width = px / 7 })

  // ── row heights ────────────────────────────────────────────
  ws.getRow(1).height = 34
  ws.getRow(2).height = 6
  ws.getRow(3).height = 24
  for (let r = 4; r <= 12; r++) ws.getRow(r).height = 20
  ws.getRow(13).height = 32

  // white background for logo rows
  for (let r = 1; r <= 2; r++) for (let c = 1; c <= 12; c++) styleCell(ws, r, c, { bg: WHITE, border: false })

  // ── logo (Casilica) ────────────────────────────────────────
  try {
    const res = await fetch(casilicaLogo)
    const buf = await res.arrayBuffer()
    const imgId = wb.addImage({ buffer: buf, extension: 'jpeg' })
    ws.addImage(imgId, { tl: { col: 10.05, row: 0.05 }, ext: { width: 150, height: 40 } })
  } catch (e) {
    console.warn('Could not embed logo:', e)
  }

  // ── row 3: title bar ───────────────────────────────────────
  mset(ws, 3, 1, 3, 10, 'Work Order', { bg: DARK_GREEN, bold: true, size: 16, fg: WHITE, ha: 'center' })
  mset(ws, 3, 11, 3, 12, 'Sizes(Inner to Inner)', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center' })

  // ── rows 4-9: header info ─────────────────────────────────
  const infoRows = [
    [4, `DATE : ${date || ''}`],
    [5, `PO ID / JOB ID : ${poId || ''}`],
    [6, `CLIENT NAME : ${clientName || ''}`],
    [7, `ADDRESS : ${address || ''}`],
    [8, `OFFER NO. : ${offerNo || ''}`],
    [9, `COMPLETION DATE : ${completionDate || ''}`]
  ]
  infoRows.forEach(([r, val]) => mset(ws, r, 1, r, 10, val, { bold: true, size: 10, ha: 'center' }))

  // ── rows 10-12: note box ──────────────────────────────────
  mset(ws, 10, 1, 11, 10, 'Note:-', { bold: true, size: 10, ha: 'left' })
  mset(ws, 12, 1, 12, 10, '', {})

  // ── sizes box (K/L, rows 4-12) ────────────────────────────
  const SIZE_ROWS = [
    ['freshAirDamper', 'Fresh Air Damper'],
    ['returnAirDamperPre', 'Return Air Damper in Pre cooling'],
    ['returnAirDamperPost', 'Return Air Damper in Post cooling'],
    ['supplyAirDamper', 'Supply Air Damper'],
    ['reactivationAirOutDamper', 'Reactivation Air Out Damper'],
    ['freshAirFilter', 'Fresh Air Filter (Box Type)'],
    ['bleedAirDamper', 'Bleed Air Damper'],
    ['bypassAirDamper', 'Bypass Air Damper'],
    ['reactivationAirInFilter', 'Reactivation Air In Filter (Box Type)']
  ]
  SIZE_ROWS.forEach(([key, label], i) => {
    const r = 4 + i
    const raw = sizes[key]
    const numeric = raw !== undefined && raw !== '' && !isNaN(Number(raw)) ? Number(raw) : (raw || '')
    cset(ws, r, 11, label, { size: 8, ha: 'left', wrap: true })
    cset(ws, r, 12, numeric, { size: 8, ha: 'center' })
  })

  // ── row 13: table column headers ──────────────────────────
  mset(ws, 13, 1, 13, 1, 'Sr.\nNo.', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center', wrap: true })
  mset(ws, 13, 2, 13, 3, 'Dehumidifier', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center' })
  mset(ws, 13, 4, 13, 4, 'Qty.', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center' })
  mset(ws, 13, 5, 13, 5, 'Spec.', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center' })
  mset(ws, 13, 6, 13, 6, 'CFM/\nStatic', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center', wrap: true })
  mset(ws, 13, 7, 13, 7, 'Fan Dia.', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center' })
  mset(ws, 13, 8, 13, 8, 'HP,(IE-2,3,4),\nPole', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center', wrap: true })
  mset(ws, 13, 9, 13, 9, 'Fan Sr. No.', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center' })
  mset(ws, 13, 10, 13, 10, 'Motor Make & Sr. No.', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center', wrap: true })
  mset(ws, 13, 11, 13, 12, 'Drawings Need', { bg: DARK_GREEN, bold: true, size: 9, fg: WHITE, ha: 'center' })

  // ── dehumidifier unit rows (row 14 onwards) ───────────────
  let cur = 14
  rows.forEach((rd, idx) => {
    const s = cur
    const numSub = 5 // Model, Pre, Post, VD2.0, Rotor Dia
    for (let r = s; r < s + numSub; r++) ws.getRow(r).height = 20

    mset(ws, s, 1, s + numSub - 1, 1, idx + 1, { bold: true, ha: 'center', size: 9 })
    const qtyRaw = rd.qty
    const qtyVal = qtyRaw !== undefined && qtyRaw !== '' && !isNaN(Number(qtyRaw)) ? Number(qtyRaw) : (qtyRaw || '1')
    mset(ws, s, 4, s + numSub - 1, 4, qtyVal, { bold: true, ha: 'center', size: 9 })

    const lblVals = [
      ['Model', rd.model || ''],
      ['Pre', rd.pre || ''],
      ['Post', rd.post || ''],
      ['VD2.0', rd.vd20 || ''],
      ['Rotor Dia', rd.rotorDia || '']
    ]
    lblVals.forEach(([lbl, val], i) => {
      cset(ws, s + i, 2, lbl, { size: 9, bold: true, ha: 'left' })
      cset(ws, s + i, 3, val, { size: 9, ha: 'center' })
    })

    const specLabels = ['Supply', 'Reactivation', 'Req. Heater', 'Inst. Heater', 'M/C Orient.']
    specLabels.forEach((lbl, i) => cset(ws, s + i, 5, lbl, { size: 9, bold: true, ha: 'center' }))

    const supply = rd.supply || {}
    const reactivation = rd.reactivation || {}

    cset(ws, s, 6, supply.cfm || '', { size: 9, ha: 'center' })
    cset(ws, s, 7, supply.fanDia || '', { size: 9, ha: 'center' })
    cset(ws, s, 8, supply.hpPole || '', { size: 9, ha: 'center' })
    cset(ws, s, 9, supply.fanSrNo || '', { size: 9, ha: 'center' })
    cset(ws, s, 10, supply.motorMake || '', { size: 9, ha: 'center' })

    cset(ws, s + 1, 6, reactivation.cfm || '', { size: 9, ha: 'center' })
    cset(ws, s + 1, 7, reactivation.fanDia || '', { size: 9, ha: 'center' })
    cset(ws, s + 1, 8, reactivation.hpPole || '', { size: 9, ha: 'center' })
    cset(ws, s + 1, 9, reactivation.fanSrNo || '', { size: 9, ha: 'center' })
    cset(ws, s + 1, 10, reactivation.motorMake || '', { size: 9, ha: 'center' })

    // Req. Heater / Inst. Heater / M-C Orient. merged across F:H
    mset(ws, s + 2, 6, s + 2, 8, rd.reqHeater || '', { size: 9, ha: 'center' })
    cset(ws, s + 2, 9, '', { size: 9 })
    cset(ws, s + 2, 10, '', { size: 9 })

    mset(ws, s + 3, 6, s + 3, 8, rd.instHeater || '', { size: 9, ha: 'center' })
    cset(ws, s + 3, 9, '', { size: 9 })
    cset(ws, s + 3, 10, '', { size: 9 })

    mset(ws, s + 4, 6, s + 4, 8, rd.machOrient || '', { size: 9, ha: 'center' })
    cset(ws, s + 4, 9, '', { size: 9 })
    cset(ws, s + 4, 10, '', { size: 9 })

    cur += numSub

    // thin spacer row between multiple dehumidifier units
    if (idx < rows.length - 1) {
      ws.getRow(cur).height = 20
      for (let c = 1; c <= 12; c++) styleCell(ws, cur, c, { bg: WHITE })
      cur += 1
    }
  })

  const drawingsEndRow = 14 + DRAWING_ITEMS.length - 1
  const teamRow = Math.max(cur, 14 + DRAWING_ITEMS.length)
  const boxEndRow = teamRow + 4 // one blank bordered row after Electrical

  for (let r = cur; r <= boxEndRow; r++) {
    for (let c = 1; c <= 10; c++) cset(ws, r, c, '', { size: 9, ha: 'center' })
  }
  for (let r = drawingsEndRow + 1; r <= boxEndRow; r++) {
    for (let c = 11; c <= 12; c++) {
      if (r < teamRow) cset(ws, r, c, '', { size: 9, ha: 'center' })
    }
  }

  // ── drawings checklist (K/L) starting row 14 ──────────────
  DRAWING_ITEMS.forEach((item, idx) => {
    const r = 14 + idx
    if (!ws.getRow(r).height) ws.getRow(r).height = 20
    const val = drawings[item]
    const sym = val === 'tick' ? '✔' : val === 'cross' ? '✘' : ''
    const fg = val === 'tick' ? GREEN_TICK : val === 'cross' ? RED_CROSS : BLACK
    cset(ws, r, 11, item.toUpperCase(), { size: 8, ha: 'left', wrap: true })
    cset(ws, r, 12, sym, { size: 10, ha: 'center', bold: true, fg })
  })

  // ── team section ───────────────────────────────────────────
  mset(ws, teamRow, 11, teamRow, 12, 'Team', { bg: DARK_GREEN, bold: true, fg: WHITE, ha: 'center', size: 9 })
  cset(ws, teamRow + 1, 11, 'Fabrication', { size: 9, ha: 'left' }); cset(ws, teamRow + 1, 12, '', {})
  cset(ws, teamRow + 2, 11, 'Fitter', { size: 9, ha: 'left' }); cset(ws, teamRow + 2, 12, '', {})
  cset(ws, teamRow + 3, 11, 'Electrical', { size: 9, ha: 'left' }); cset(ws, teamRow + 3, 12, '', {})

  // ── note row ────────────────────────────────────────────────
  const noteRow = Math.max(cur, teamRow + 4) + 1
  mset(
    ws, noteRow, 1, noteRow, 12,
    'Note : Please Manufacture As Per Attached Drawings & Comment Mentioned in Approved Drawing.',
    { bold: true, size: 9, ha: 'left' }
  )

  // ── signature footer ──────────────────────────────────────
  const sigHdr = noteRow + 2
  const sigNames = noteRow + 3
  const sigDate = noteRow + 4
  const sigSign = noteRow + 5

  mset(ws, sigHdr, 1, sigNames, 1, '*', { bold: true, size: 16, ha: 'center' })
  cset(ws, sigDate, 1, 'Date -', { size: 8, ha: 'left' })
  cset(ws, sigSign, 1, 'Sign -', { size: 8, ha: 'left' })

  const sigCols = [
    { c1: 2, c2: 3, label: 'DRAWN. BY', name: 'Anshul' },
    { c1: 4, c2: 5, label: 'HAND. BY', name: 'Mr. Gopal Sharma' },
    { c1: 6, c2: 7, label: 'ENGG. VERIFIED BY', name: 'Mr. Yogesh Kumar' },
    { c1: 8, c2: 9, label: 'COMMERCIAL BY', name: 'Mr. Rajesh Kumar' },
    { c1: 10, c2: 10, label: 'SUPERVISED BY', name: 'Mr. Surender Singh' },
    { c1: 11, c2: 12, label: 'VERIFIED BY', name: 'Mr. Vaibhav Gupta' }
  ]

  sigCols.forEach(sg => {
    mset(ws, sigHdr, sg.c1, sigHdr, sg.c2, sg.label, { bg: LIGHT_GREEN, bold: true, size: 8, ha: 'center' })
    mset(ws, sigNames, sg.c1, sigNames, sg.c2, sg.name, { size: 8, ha: 'center' })
    mset(ws, sigDate, sg.c1, sigDate, sg.c2, '', { size: 8 })
    mset(ws, sigSign, sg.c1, sigSign, sg.c2, '', { size: 8 })
  })

  return wb
}

// build the workbook and trigger a browser download (used by "Save as Excel")
export async function generateWorkOrderExcel(payload) {
  const wb = await buildWorkbook(payload)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const fileName = `WorkOrder_${payload.enquiryId || 'Export'}.xlsx`
  saveAs(blob, fileName)

  return { success: true, fileName }
}

// build the workbook and return it as a Blob (used to upload to Supabase Storage on Submit)
export async function getWorkOrderExcelBlob(payload) {
  const wb = await buildWorkbook(payload)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const fileName = `WorkOrder_${payload.enquiryId || 'Export'}.xlsx`

  return { blob, fileName }
}
