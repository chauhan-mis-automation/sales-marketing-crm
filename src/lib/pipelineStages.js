// Tumhare Dropdown sheet ke "Stages" column ke known values ka color mapping.
// Agar koi naya/unknown stage aaye toh fallback gray color mil jayega.
export const STAGE_ACCENT_COLORS = {
  'Questionnaire': '#6a8c6f',
  'Waiting For Filled Questionnaire By client': '#b45309',
  'Technical Flow Chart Submited': '#534AB7',
  'Client Want Flowchart Revision': '#b45309',
  'Waiting For Confirmation on Flowchart': '#0369a1',
  'Received Confirmation on Flow Chart': '#059669',
  'Quotation': '#6d28d9',
  'Client Want Quotation Revision': '#b45309',
  'GA Drawing Submmited to client': '#0d9488',
  'GA Drawing Revision By client': '#b45309',
  'Client is Waiting For Approval on GA Drawing': '#0369a1',
  'Design at Consultant Side': '#0d9488',
  'Bidding By Contractors': '#b45309',
  'Won By Contractor': '#059669',
  'Lost By Contractor': '#be123c',
  'Hot Lead': '#b45309',
  'Order Won': '#059669',
  'Order Lost by Us': '#be123c',
  'Planning By EndClient': '#0369a1',
  'Project on Hold': '#6a8c6f',
}

export function getStageColor(stage) {
  return STAGE_ACCENT_COLORS[stage] || '#6a8c6f'
}
