import { useState, useEffect, useCallback, useRef } from 'react'

export interface UsdRates {
  compra:      number
  venta:       number
  cierre:      number
  fechaActualizacion: string
}

export interface ExchangeRates {
  usd:     UsdRates | null
  eur:     number | null
  uf:      number | null
  utm:     number | null
  loading: boolean
  error:   string | null
  refresh: () => void
}

const REFRESH_INTERVAL_MS = 60 * 60 * 1000   // 1h

async function fetchUsd(): Promise<UsdRates> {
  const res = await fetch('https://cl.dolarapi.com/v1/cotizaciones/usd')
  if (!res.ok) throw new Error(`dolarapi ${res.status}`)
  const { compra, venta, ultimoCierre: cierre, fechaActualizacion } = await res.json()
  return { compra, venta, cierre, fechaActualizacion }
}

interface MindicadorResponse {
  dolar?: { valor: number }
  euro?:  { valor: number }
  uf?:    { valor: number }
  utm?:   { valor: number }
}

async function fetchMindicador(): Promise<MindicadorResponse> {
  const res = await fetch('https://mindicador.cl/api')
  if (!res.ok) throw new Error(`mindicador ${res.status}`)
  return res.json() as Promise<MindicadorResponse>
}

export function useExchangeRates(): ExchangeRates {
  const [usd, setUsd]         = useState<UsdRates | null>(null)
  const [eur, setEur]         = useState<number | null>(null)
  const [uf, setUf]           = useState<number | null>(null)
  const [utm, setUtm]         = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usdData, minData] = await Promise.all([fetchUsd(), fetchMindicador()])
      setUsd(usdData)
      setEur(minData.euro?.valor ?? null)
      setUf(minData.uf?.valor ?? null)
      setUtm(minData.utm?.valor ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar cotizaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(fetchAll, REFRESH_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchAll])

  return { usd, eur, uf, utm, loading, error, refresh: fetchAll }
}
