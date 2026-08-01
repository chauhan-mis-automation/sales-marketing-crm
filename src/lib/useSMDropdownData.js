import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export function useSMDropdownData() {
  const [data, setData] = useState({
    source: [], businessVolume: [], interactionType: [], response: [],
    paymentMode: [], paymentStatus: [], industry: [], category: [],
    rating: [], region: [], leadStatus: [], priority: [],
    salesTeam: [], marketingTeam: [], allTeam: [],
  })
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    const [{ data: optRows }, { data: userRows }] = await Promise.all([
      supabase.from('sm_dropdown_options').select('*').order('category', { ascending: true }).order('sort_order', { ascending: true }),
      supabase.from('sm_users').select('name, role').eq('status', 'Active').order('name', { ascending: true }),
    ])

    const grouped = {}
    ;(optRows || []).forEach(r => {
      if (!grouped[r.category]) grouped[r.category] = []
      grouped[r.category].push(r.value)
    })

    const salesTeam = (userRows || []).filter(u => u.role === 'Sales').map(u => u.name)
    const marketingTeam = (userRows || []).filter(u => u.role === 'Marketing').map(u => u.name)
    const allTeam = (userRows || []).map(u => u.name)

    setData({
      source: grouped['Source'] || [],
      businessVolume: grouped['BusinessVolume'] || [],
      interactionType: grouped['InteractionType'] || [],
      response: grouped['Response'] || [],
      paymentMode: grouped['PaymentMode'] || [],
      paymentStatus: grouped['PaymentStatus'] || [],
      industry: grouped['Industry'] || [],
      category: grouped['Category'] || [],
      rating: grouped['Rating'] || [],
      region: grouped['Region'] || [],
      leadStatus: grouped['LeadStatus'] || [],
      priority: grouped['Priority'] || [],
      salesTeam,
      marketingTeam,
      allTeam,
    })
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  return { ...data, loading, refetch: fetchAll }
}
