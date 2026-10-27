import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'

export const EDGE_SCROLL_ZONE = 90
const EDGE_SCROLL_SPEED = 14

// Drags a seed packet from the shed onto the garden using pointer events only,
// so mouse and touch share one code path (no HTML5 drag-and-drop).
//
// The shed starts a drag by setting ui.seedPicked, ui.seedDragPointerId and ui.selectedSeedFlower.
// This composable then follows that pointer, shows the ghost, scrolls the garden near its edges,
// and opens the "create seed" page for the cell under the pointer when it is released.
export function useSeedDrag({
  scrollerEl, stageEl, ghostRef, ghostBlocked,
  screenToCell, isBlocked, placeSprite, hideSprite, requestRender,
}) {
  const router = useRouter()
  const ui = useUiStore()

  let hoverCell = null
  let pointer = null // last pointer position, in client coordinates
  let scrollFrame = 0

  const isDragPointer = (e) => ui.seedPicked && e.pointerId === ui.seedDragPointerId
  const isInside = (rect, p) => p.x >= rect.left && p.x < rect.right && p.y >= rect.top && p.y < rect.bottom

  // the garden cell under a client position, or null when it is outside the stage
  function cellAt(point) {
    const stage = stageEl.value.getBoundingClientRect()
    return isInside(stage, point) ? screenToCell(point.x - stage.left, point.y - stage.top) : null
  }

  function updateGhost() {
    const ghost = ghostRef.value?.$el ?? ghostRef.value
    if (!ghost) return
    if (!hoverCell) {
      hideSprite(ghost)
      ghostBlocked.value = false
      return
    }
    placeSprite(ghost, hoverCell.col, hoverCell.row)
    ghostBlocked.value = isBlocked(hoverCell.col, hoverCell.row)
  }

  // -1 near the start edge, 1 near the end edge, 0 elsewhere
  function edgeDirection(pos, start, end) {
    if (pos < start + EDGE_SCROLL_ZONE) return -1
    if (pos > end - EDGE_SCROLL_ZONE) return 1
    return 0
  }

  // runs every frame while dragging: nudges the garden when the pointer is near an edge of the view
  function autoScroll() {
    if (!ui.seedPicked || !pointer) { scrollFrame = 0; return }
    const view = scrollerEl.value.getBoundingClientRect()
    if (isInside(view, pointer)) {
      const dx = edgeDirection(pointer.x, view.left, view.right)
      const dy = edgeDirection(pointer.y, view.top, view.bottom)
      if (dx || dy) {
        scrollerEl.value.scrollLeft += dx * EDGE_SCROLL_SPEED
        scrollerEl.value.scrollTop += dy * EDGE_SCROLL_SPEED
        hoverCell = cellAt(pointer) // the garden moved under a still pointer
        requestRender()
      }
    }
    scrollFrame = requestAnimationFrame(autoScroll)
  }

  function endDrag() {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
    pointer = null
    hoverCell = null
    ui.seedPicked = false
    ui.seedDragPointerId = null
    requestRender() // updateGhost hides the ghost
  }

  function plantAt(cell) {
    if (!cell || isBlocked(cell.col, cell.row)) return
    router.push({
      name: 'seed-create',
      params: { col: cell.col, row: cell.row },
      query: { color: ui.selectedSeedColor, flower: ui.selectedSeedFlower },
    })
  }

  function onPointerMove(e) {
    if (!isDragPointer(e)) return
    pointer = { x: e.clientX, y: e.clientY }
    hoverCell = cellAt(pointer)
    requestRender()
    if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll)
  }

  function onPointerUp(e) {
    if (!isDragPointer(e)) return
    const cell = cellAt({ x: e.clientX, y: e.clientY })
    endDrag()
    plantAt(cell)
  }

  function onPointerCancel(e) {
    if (isDragPointer(e)) endDrag()
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && ui.seedPicked) endDrag()
  }

  onMounted(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('keydown', onKeyDown)
    cancelAnimationFrame(scrollFrame)
  })

  return { updateGhost }
}