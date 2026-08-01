// Shared constants for the Work Order form + Excel export
// Keeping these in one place ensures the on-screen form and the
// generated Excel file always stay in sync.

export const DRAWING_ITEMS = [
  'Structure Drawing',
  'Rotor Drawing',
  'Panels',
  'Reactivation Fan Drawing',
  'React. Fan Plate + Hole',
  'Heater Duct & Plate',
  'Heaters Filter Box',
  'Elbow Drawing (if Reqd.)',
  'Elbow End Flanges',
  'Doors'
]

export const SIZE_FIELDS = [
  { key: 'freshAirDamper', label: 'Fresh Air Damper' },
  { key: 'returnAirDamperPre', label: 'Return Air Damper (Pre Cooling)' },
  { key: 'returnAirDamperPost', label: 'Return Air Damper (Post Cooling)' },
  { key: 'supplyAirDamper', label: 'Supply Air Damper' },
  { key: 'reactivationAirOutDamper', label: 'Reactivation Air Out Damper' },
  { key: 'freshAirFilter', label: 'Fresh Air Filter (Box Type)' },
  { key: 'bleedAirDamper', label: 'Bleed Air Damper' },
  { key: 'bypassAirDamper', label: 'Bypass Air Damper' },
  { key: 'reactivationAirInFilter', label: 'Reactivation Air In Filter (Box Type)' }
]
