import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export function useDropdownData() {
  const [data, setData] = useState({
    customerCategory: [],
    enquirySource: [],
    products: [],
    frontendTeam: [],
    backendTeam: [],
    designTeam: [],
    stages: [],
    reasonOfLost: [],
    authorizedPerson: [],
    model: [],
    pre: [],
    post: [],
    vd20: [],
    rotorDia: [],
    machineOrientation: [],
    fanDia: [],
    ieHpPole: [],
    instHeater: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDropdowns() {
      const { data: rows, error } = await supabase
        .from('dropdown_list')
        .select('customer_category, enquiry_source, enquiry_details_products, assign_to_frontend, assign_to_backend, design_team, stages, reason_of_lost, authorized_person, model, pre, post, vd2_0, rotor_dia, machine_orientation, fan_dia, ie_hp_pole, inst_heater, row_no')
        .order('row_no', { ascending: true })

      if (error || !rows) {
        setLoading(false)
        return
      }

      // Har column se unique, non-null values nikalo (jaise GAS ke col() helper mein tha)
      const uniqueNonEmpty = (key) =>
        [...new Set(rows.map(r => r[key]).filter(v => v && v.trim() !== ''))]

      setData({
        customerCategory: uniqueNonEmpty('customer_category'),
        enquirySource: uniqueNonEmpty('enquiry_source'),
        products: uniqueNonEmpty('enquiry_details_products'),
        frontendTeam: uniqueNonEmpty('assign_to_frontend'),
        backendTeam: uniqueNonEmpty('assign_to_backend'),
        designTeam: uniqueNonEmpty('design_team'),
        stages: uniqueNonEmpty('stages'),
        reasonOfLost: uniqueNonEmpty('reason_of_lost'),
        authorizedPerson: uniqueNonEmpty('authorized_person'),
        model: uniqueNonEmpty('model'),
        pre: uniqueNonEmpty('pre'),
        post: uniqueNonEmpty('post'),
        vd20: uniqueNonEmpty('vd2_0'),
        rotorDia: uniqueNonEmpty('rotor_dia'),
        machineOrientation: uniqueNonEmpty('machine_orientation'),
        fanDia: uniqueNonEmpty('fan_dia'),
        ieHpPole: uniqueNonEmpty('ie_hp_pole'),
        instHeater: uniqueNonEmpty('inst_heater'),
      })
      setLoading(false)
    }

    fetchDropdowns()
  }, [])

  return { ...data, loading }
}
