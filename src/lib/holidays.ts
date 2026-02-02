/**
 * 日本の祝日をHolidays JP APIから取得・管理
 * https://github.com/holidays-jp/api
 */

const API_URL = "https://holidays-jp.github.io/api/v1/date.json"
const CACHE_KEY = "grh-holidays-cache"
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24時間

interface CacheData {
  holidays: string[]
  timestamp: number
}

class HolidayManager {
  private holidays: Set<string> = new Set()
  private loaded = false
  private loadPromise: Promise<void> | null = null

  /**
   * 祝日データを取得（キャッシュ対応）
   */
  async load(): Promise<void> {
    if (this.loaded) return
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = this._load()
    return this.loadPromise
  }

  private async _load(): Promise<void> {
    // キャッシュをチェック
    const cached = this.loadFromCache()
    if (cached) {
      this.holidays = new Set(cached)
      this.loaded = true
      console.log("[GRH] Loaded holidays from cache:", this.holidays.size)
      return
    }

    // APIから取得
    try {
      const response = await fetch(API_URL)
      if (!response.ok) throw new Error("API request failed")

      const data: Record<string, string> = await response.json()
      const holidayDates = Object.keys(data)

      this.holidays = new Set(holidayDates)
      this.loaded = true

      // キャッシュに保存
      this.saveToCache(holidayDates)

      console.log("[GRH] Loaded holidays from API:", this.holidays.size)
    } catch (error) {
      console.error("[GRH] Failed to load holidays:", error)
      // エラー時は空のまま（土日のみハイライト）
      this.loaded = true
    }
  }

  private loadFromCache(): string[] | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return null

      const cache: CacheData = JSON.parse(raw)
      const now = Date.now()

      if (now - cache.timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY)
        return null
      }

      return cache.holidays
    } catch {
      return null
    }
  }

  private saveToCache(holidays: string[]): void {
    try {
      const cache: CacheData = {
        holidays,
        timestamp: Date.now()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch {
      // ストレージ容量超過など
    }
  }

  /**
   * 指定された日付が祝日かどうか
   */
  isHoliday(date: Date): boolean {
    const dateStr = this.formatDate(date)
    const result = this.holidays.has(dateStr)
    if (result) {
      console.log("[GRH] Holiday found:", dateStr)
    }
    return result
  }

  /**
   * デバッグ用: 祝日一覧を表示
   */
  debugPrintHolidays(): void {
    console.log("[GRH] All holidays in cache:", Array.from(this.holidays).sort().slice(0, 20), "...")
  }

  /**
   * DateをYYYY-MM-DD形式に変換
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
}

export const holidayManager = new HolidayManager()

/**
 * 日付の種類を判定
 */
export type DayType = "sunday" | "saturday" | "holiday" | null

export function getDayType(date: Date | null): DayType {
  if (!date) return null

  // 祝日チェック（土日より優先）
  if (holidayManager.isHoliday(date)) {
    return "holiday"
  }

  const day = date.getDay()
  if (day === 0) return "sunday"
  if (day === 6) return "saturday"

  return null
}

/**
 * 日付文字列をパース
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}
