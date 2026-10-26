import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, shallowRef, computed, watch } from 'vue'
import { useWeatherStore } from './weather'
import { TRACKS } from '@/lib/tracks'
import { shuffle } from '@/lib/shuffle'

// Garden Radio: background lo-fi that matches the weather (or a mood the user picks).
// One <audio> for the whole app, so music keeps playing across pages.
export const MOODS = [
  { key: 'auto', icon: '🌦️', label: 'Match weather' },
  { key: 'sunny', icon: '☀️', label: 'Sunny' },
  { key: 'cloudy', icon: '☁️', label: 'Cloudy' },
  { key: 'rainy', icon: '🌧️', label: 'Rainy' },
  { key: 'stormy', icon: '⛈️', label: 'Stormy' },
]
const STORAGE_KEY = 'sproutly.music' // on/off, mood and volume, remembered per browser

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {} } catch { return {} }
}

// the one <audio> element; kept outside the store so a hot reload can still reach it to stop it (see bottom)
let audio = null

export const useMusicStore = defineStore('music', () => {
  const weather = useWeatherStore()
  const saved = loadSettings()

  const enabled = ref(saved.enabled ?? false) // the user has music switched on
  const mood = ref(saved.mood ?? 'auto')      // a MOODS key
  const volume = ref(saved.volume ?? 0.5)     // 0-1
  const playing = ref(false)                  // sound is actually coming out right now
  // the TRACKS entry playing; shallowRef keeps it the plain object (not a reactive copy), so
  // comparisons like playlist.includes(track) work
  const track = shallowRef(null)
  const position = ref(0)                     // seconds into the track
  const duration = ref(0)

  // which weather's tracks to play: the live weather, or the mood the user picked
  const activeWeather = computed(() => (mood.value === 'auto' ? weather.condition : mood.value))
  const playlist = computed(() => TRACKS.filter(t => t.weather.includes(activeWeather.value)))

  let queue = []      // shuffled tracks still to come; every track plays once before any repeats
  const history = []  // tracks already played, for the previous button

  function getAudio() {
    if (audio) return audio
    audio = new Audio()
    audio.volume = volume.value
    audio.addEventListener('ended', next)
    audio.addEventListener('timeupdate', () => { position.value = audio.currentTime })
    audio.addEventListener('loadedmetadata', () => { duration.value = audio.duration })
    audio.addEventListener('play', () => { playing.value = true })
    audio.addEventListener('pause', () => { playing.value = false })
    return audio
  }

  function nextFromQueue() {
    queue = queue.filter(t => playlist.value.includes(t)) // the mood/weather may have changed
    if (!queue.length) {
      queue = shuffle(playlist.value)
      // a fresh shuffle shouldn't start with the track that just finished
      if (queue.length > 1 && queue[0] === track.value) queue.push(queue.shift())
    }
    return queue.shift()
  }

  function start(t) {
    track.value = t
    position.value = 0
    duration.value = 0
    const a = getAudio()
    a.src = `/music/${t.file}`
    // browsers block sound until the page has been clicked (e.g. right after a refresh)
    a.play().catch(() => { playing.value = false })
  }

  // only the Garden page loads the weather; fetch it here if needed so "Match weather" is real
  function ensureWeather() {
    if (mood.value === 'auto' && weather.temperature === null) weather.load()
  }

  // call these from clicks (the browser only allows sound to start after one)
  function play() {
    enabled.value = true
    ensureWeather()
    if (track.value && audio) audio.play().catch(() => { playing.value = false })
    else start(nextFromQueue())
  }
  function pause() {
    enabled.value = false
    audio?.pause()
  }
  function toggle() {
    if (enabled.value && playing.value) pause()
    else play()
  }
  function next() {
    if (track.value) history.push(track.value)
    start(nextFromQueue())
  }
  // like most players: restart the track if it's past 3 s, otherwise go back one
  function previous() {
    if (position.value > 3 || !history.length) {
      if (audio) audio.currentTime = 0
      return
    }
    if (track.value) queue.unshift(track.value) // put the current track back so it comes up next
    start(history.pop())
  }
  function setMood(key) {
    mood.value = key
    ensureWeather()
  }

  // when the weather being followed changes (a new mood, the live weather updating, or the Garden's
  // weather dropdown, which sets weather.condition), switch straight away if the song doesn't fit
  watch(activeWeather, () => {
    if (enabled.value && track.value && !playlist.value.includes(track.value)) next()
  })

  // after a refresh: if music was on, start again at the first click/tap/key anywhere
  // (called once from App.vue, not here, so a hot reload can't add the listener twice)
  function restore() {
    if (!enabled.value) return
    const EVENTS = ['click', 'touchend', 'keydown']
    const once = (e) => {
      EVENTS.forEach(ev => window.removeEventListener(ev, once, true))
      // that first click might be on a music button, which then does its own thing
      if (e.target instanceof Element && e.target.closest('[data-music-control]')) return
      if (enabled.value && !playing.value) play()
    }
    EVENTS.forEach(ev => window.addEventListener(ev, once, true))
  }

  watch(volume, (v) => { if (audio) audio.volume = v })
  watch([enabled, mood, volume], () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: enabled.value, mood: mood.value, volume: volume.value }))
    } catch { /* storage blocked: settings just aren't remembered */ }
  })

  return {
    enabled, mood, volume, playing, track, position, duration, activeWeather, playlist,
    play, pause, toggle, next, previous, setMood, restore,
  }
})

// lets Vite swap in edits to this store without a page refresh (otherwise the old store stays in memory)
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMusicStore, import.meta.hot))
  // the new code makes its own <audio>, so stop the old one first, or nothing could switch it off
  // (development only: hot reloads happen when a file is edited while `npm run dev` is running)
  import.meta.hot.dispose(() => {
    audio?.pause()
    useMusicStore().$patch({ playing: false })
  })
}
