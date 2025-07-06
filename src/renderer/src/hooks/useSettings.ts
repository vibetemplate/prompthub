import { useState, useEffect } from 'react'

interface Settings {
  proxy?: {
    enabled: boolean
    host: string
    port: number
    username?: string
    password?: string
  }
  browser?: {
    headless: boolean
    userAgent?: string
    viewport?: {
      width: number
      height: number
    }
  }
  general?: {
    autoSave: boolean
    theme: 'light' | 'dark'
    language: 'zh' | 'en'
  }
}

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const allSettings = await window.electronAPI.settings.getAll()
      setSettings(allSettings)
    } catch (err) {
      console.error('Failed to load settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (newSettings: Settings) => {
    try {
      setLoading(true)
      setError(null)
      
      // 更新每个设置项
      for (const [key, value] of Object.entries(newSettings)) {
        await window.electronAPI.settings.set(key as keyof Settings, value)
      }
      
      // 重新加载设置
      await loadSettings()
    } catch (err) {
      console.error('Failed to update settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getSetting = async (key: keyof Settings) => {
    try {
      return await window.electronAPI.settings.get(key)
    } catch (err) {
      console.error(`Failed to get setting ${key}:`, err)
      throw err
    }
  }

  const setSetting = async (key: keyof Settings, value: any) => {
    try {
      await window.electronAPI.settings.set(key, value)
      await loadSettings()
    } catch (err) {
      console.error(`Failed to set setting ${key}:`, err)
      throw err
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return {
    settings,
    loading,
    error,
    loadSettings,
    updateSettings,
    getSetting,
    setSetting,
  }
}