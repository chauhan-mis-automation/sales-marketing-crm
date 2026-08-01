// Ek value ko subtotal ke against resolve karta hai:
// - Agar value "%" se end hoti hai, toh subtotal ka percentage nikalta hai
// - Warna plain number treat karta hai
function resolveAmount(value, subtotal) {
  if (!value) return 0
  const str = String(value).trim()
  if (str.endsWith('%')) {
    const pct = parseFloat(str.slice(0, -1)) || 0
    return subtotal * (pct / 100)
  }
  return parseFloat(str) || 0
}

// Sequential calculation: Base -> +Packing -> +Freight -> +Insurance -> +GST
// Har step ka % running subtotal (pichle steps tak) ke against calculate hota hai
export function calculateTotalCost({ baseValue, packing, freight, insurance, gst }) {
  const base = parseFloat(baseValue) || 0
  let subtotal = base

  const packingAmt = resolveAmount(packing, subtotal)
  subtotal += packingAmt

  const freightAmt = resolveAmount(freight, subtotal)
  subtotal += freightAmt

  const insuranceAmt = resolveAmount(insurance, subtotal)
  subtotal += insuranceAmt

  const gstAmt = resolveAmount(gst, subtotal)
  subtotal += gstAmt

  return {
    base,
    packingAmt,
    freightAmt,
    insuranceAmt,
    gstAmt,
    total: subtotal
  }
}