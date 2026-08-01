// export async function fetchCountries() {
//   // Simple hardcoded list (fast) — GAS code jaisa hi
//   return [
//     "Afghanistan","Albania","Algeria","Argentina","Armenia","Australia","Austria",
//     "Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bolivia","Bosnia",
//     "Brazil","Bulgaria","Cambodia","Canada","Chile","China","Colombia","Croatia",
//     "Cuba","Cyprus","Czech Republic","Denmark","Ecuador","Egypt","Estonia",
//     "Ethiopia","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala",
//     "Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Japan",
//     "Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Latvia","Lebanon","Libya",
//     "Lithuania","Malaysia","Mexico","Moldova","Morocco","Myanmar","Nepal",
//     "Netherlands","New Zealand","Nigeria","Norway","Oman","Pakistan","Palestine",
//     "Panama","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia",
//     "Saudi Arabia","Serbia","Singapore","Slovakia","Slovenia","South Africa",
//     "South Korea","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria",
//     "Taiwan","Tajikistan","Tanzania","Thailand","Tunisia","Turkey","Turkmenistan",
//     "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
//     "Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zimbabwe"
//   ]
// }

// const INDIA_STATES = ["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh",
//   "Assam","Bihar","Chandigarh","Chhattisgarh","Delhi","Goa","Gujarat","Haryana",
//   "Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Ladakh",
//   "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha",
//   "Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
//   "Uttar Pradesh","Uttarakhand","West Bengal"]

// const INDIA_CITIES = ["Agra","Ahmedabad","Bengaluru","Bhopal","Chandigarh","Chennai",
//   "Coimbatore","Delhi","Gurugram","Guwahati","Hyderabad","Indore","Jaipur","Jodhpur",
//   "Kanpur","Kochi","Kolkata","Kolhapur","Lucknow","Ludhiana","Madurai","Mangalore",
//   "Meerut","Mumbai","Mysore","Nagpur","Nashik","Noida","Patna","Pune","Raipur",
//   "Rajkot","Ranchi","Surat","Thane","Vadodara","Varanasi","Visakhapatnam"]

// export async function fetchStates(country) {
//   if (country.toLowerCase() === 'india') return INDIA_STATES

//   try {
//     const res = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ country })
//     })
//     const json = await res.json()
//     if (json && !json.error && json.data?.states) {
//       return json.data.states.map(s => s.name)
//     }
//     return []
//   } catch {
//     return []
//   }
// }

// export async function fetchCities(country, state) {
//   if (country.toLowerCase() === 'india' && INDIA_STATES.includes(state)) {
//     return INDIA_CITIES
//   }

//   try {
//     const res = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ country, state })
//     })
//     const json = await res.json()
//     if (json && !json.error && Array.isArray(json.data)) {
//       return json.data
//     }
//     return []
//   } catch {
//     return []
//   }
// }


export async function fetchCountries() {
  // Simple hardcoded list (fast) — GAS code jaisa hi
  return [
    "Afghanistan","Albania","Algeria","Argentina","Armenia","Australia","Austria",
    "Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bolivia","Bosnia",
    "Brazil","Bulgaria","Cambodia","Canada","Chile","China","Colombia","Croatia",
    "Cuba","Cyprus","Czech Republic","Denmark","Ecuador","Egypt","Estonia",
    "Ethiopia","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala",
    "Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Japan",
    "Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Latvia","Lebanon","Libya",
    "Lithuania","Malaysia","Mexico","Moldova","Morocco","Myanmar","Nepal",
    "Netherlands","New Zealand","Nigeria","Norway","Oman","Pakistan","Palestine",
    "Panama","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia",
    "Saudi Arabia","Serbia","Singapore","Slovakia","Slovenia","South Africa",
    "South Korea","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria",
    "Taiwan","Tajikistan","Tanzania","Thailand","Tunisia","Turkey","Turkmenistan",
    "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
    "Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zimbabwe"
  ]
}

const stateCache = new Map()
const cityCache = new Map()

export async function fetchStates(country) {
  if (!country) return []
  if (stateCache.has(country)) return stateCache.get(country)

  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country })
    })
    const json = await res.json()
    const states = (json && !json.error && json.data?.states)
      ? json.data.states.map(s => s.name)
      : []
    stateCache.set(country, states)
    return states
  } catch {
    return []
  }
}

export async function fetchCities(country, state) {
  if (!country || !state) return []
  const key = `${country}|${state}`
  if (cityCache.has(key)) return cityCache.get(key)

  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, state })
    })
    const json = await res.json()
    const cities = (json && !json.error && Array.isArray(json.data)) ? json.data : []
    cityCache.set(key, cities)
    return cities
  } catch {
    return []
  }
}