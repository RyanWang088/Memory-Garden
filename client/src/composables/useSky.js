import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useWeatherStore } from '@/stores/weather'

// Just the phase, no timer. Anything that only needs to *read* the time of day (the meadow palette) uses this;
// useSky() below owns the one clock that advances w.nowMin, so it must only be called once (by Skybox).
export function useSkyPhase() {
    const w = useWeatherStore()

    const phase = computed(() => {
        const t = w.nowMin
        if (t >= w.sunrise - 30 && t <= w.sunrise + 60) return 'dawn'
        if (t >= w.sunset - 60 && t <= w.sunset + 30) return 'dusk'
        return t > w.sunrise && t < w.sunset ? 'day' : 'night'
    })

    return { phase }
}

export function useSky() {
    const w = useWeatherStore()
    const { phase } = useSkyPhase()
    let timer

    onMounted(() => { timer = setInterval(() => { w.nowMin = (w.nowMin + 1) % 1440 }, 60000) })
    onBeforeUnmount(() => clearInterval(timer))

    // 0..1 progress of whichever body is up (sun by day, moon by night)
    const progress = computed(() => {
        const t = w.nowMin
        if (t >= w.sunrise && t <= w.sunset) return (t - w.sunrise) / (w.sunset - w.sunrise)
        const len = w.sunrise + 1440 - w.sunset
        const tt = t >= w.sunset ? t : t + 1440
        return Math.min(1, Math.max(0, (tt - w.sunset) / len))
    })

    const bodyStyle = computed(() => { //sun moon height
        const s = Math.sin(Math.PI * progress.value)   // 0 at the ends, 1 at the peak
        return {
            '--body-x': `${10 + 80 * progress.value}%`,  // starts and ends just off-screen
            // peak sits at 15% from the top; at the ends it's 90px below the horizon, fully hidden
            '--body-y': `${(60 - (60 - 15) * s).toFixed(1)}%`,
        }
    })

    return { phase, bodyStyle, condition: computed(() => w.condition) }
}