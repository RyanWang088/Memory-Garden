import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'

export const SEED_MIME = 'application/x-sproutly-seed'
export const EDGE_SCROLL_ZONE = 90

export function useSeedDrag({ scrollerEl, stageEl, ghostRef, ghostBlocked, screenToCell, isBlocked, placeSprite, requestRender }) {
  const router = useRouter()
  const ui = useUiStore()
  let hoverCell = null

  function cellFromEvent(e) {
    const stage = stageEl.value.getBoundingClientRect()
    return screenToCell(e.clientX - stage.left, e.clientY - stage.top)
  }

  function cellAtPointer(e) {
    const rect = stageEl.value.getBoundingClientRect()
    if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) return null
    return cellFromEvent(e)
  }

  function dropAt(e) {
    const cell = cellAtPointer(e)
    clearGhost()
    ui.seedPicked = false
    ui.seedDragPointerId = null
    if (!cell || isBlocked(cell.col, cell.row)) return
    router.push({ name: 'seed-create', params: { col: cell.col, row: cell.row } })
  }

  function onDragOver(e) {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes(SEED_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const view = scrollerEl.value.getBoundingClientRect()
    if (e.clientY - view.top < EDGE_SCROLL_ZONE) scrollerEl.value.scrollTop -= 14
    scrollerEl.value.scrollLeft += 14 * ((e.clientX > view.right - EDGE_SCROLL_ZONE) - (e.clientX < view.left + EDGE_SCROLL_ZONE))
    hoverCell = cellFromEvent(e)
    requestRender()
  }

  function onDragLeave(e) { if (!stageEl.value.contains(e.relatedTarget)) clearGhost() }
  function clearGhost() { hoverCell = null; ghostBlocked.value = false; requestRender() }

  function updateGhost() {
    const ghost = ghostRef.value?.$el ?? ghostRef.value
    if (!ghost) return
    if (!hoverCell) {
      ghost.style.display = 'none'
      ghostBlocked.value = false
      return
    }
    placeSprite(ghost, hoverCell.col, hoverCell.row, 1)
    ghostBlocked.value = isBlocked(hoverCell.col, hoverCell.row)
  }

  function onDrop(e) {
    const rawSeed = e.dataTransfer.getData(SEED_MIME)
    if (rawSeed) dropAt(e)
  }

  function onPointerMove(e) {
    if (e.pointerId !== ui.seedDragPointerId) return
    e.preventDefault()
    hoverCell = cellAtPointer(e)
    requestRender()
  }

  function onPointerUp(e) {
    if (e.pointerId !== ui.seedDragPointerId) return
    dropAt(e)
  }

  function onPointerCancel(e) {
    if (e.pointerId !== ui.seedDragPointerId) return
    clearGhost()
    ui.seedPicked = false
    ui.seedDragPointerId = null
  }

  onMounted(() => {
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
  })

  return { cellFromEvent, cellAtPointer, dropAt, onDragOver, onDragLeave, clearGhost, updateGhost, onDrop, onPointerMove, onPointerUp, onPointerCancel }
}
