<script setup>
// Mock data matching your review items and tags
const reviewItems = [
  {
    id: 1,
    tag: 'IS216',
    variant: 'periwinkle',
    dueText: 'Due today',
    isUrgent: true,
    title: 'Vue directives',
    count: 8,
    mastery: '72%'
  },
  {
    id: 2,
    tag: 'CS102',
    variant: 'peach',
    dueText: 'Due today',
    isUrgent: true,
    title: 'Recursion',
    count: 10,
    mastery: '48%'
  },
  {
    id: 3,
    tag: 'IS112',
    variant: 'berry',
    dueText: 'Review in 3 days',
    isUrgent: false,
    title: 'SQL joins',
    count: 12,
    mastery: '90%'
  }
]
</script>

<template>
  <div class="d-flex flex-column gap-3 w-100">
    <!-- Heading Section -->
    <header class="d-flex flex-column gap-1">
      <h3 class="m-0">Watering mode is on</h3>
      <p class="study-desc m-0">Your can is ready. Choose a plant to revise.</p>
    </header>

    <!-- Watering Tool Banner -->
    <section class="watering-banner d-flex align-items-center p-3 gap-3 rounded-3">
      <div class="tool-icon-wrapper d-flex align-items-center justify-content-center">
        <!-- SVG Watering Can matching outline / character art change ltr-->
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 18H32L31 40C24.3333 42 17.6667 42 11 40L10 18Z" fill="#A9C3EE" stroke="#8A6450" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M32 24L42 16L44 19L33 31L32 24Z" fill="#A9C3EE" stroke="#8A6450" stroke-width="2" stroke-linejoin="round"/>
        <path d="M14 18C18.6667 10 23.3333 10 28 18" stroke="#8A6450" stroke-width="5"/>
        <path d="M14 18C18.6667 10 23.3333 10 28 18" stroke="#A9C3EE" stroke-width="2.4"/>
        <path d="M11 32H31.4L31 40C24.3333 42 17.6667 42 11 40V32Z" fill="#8EAADF"/>
        </svg>

      </div>
      <div class="d-flex flex-column">
        <span class="fw-bold">Can equipped</span>
        <span class="text-body-small">Flashcards or a quick quiz</span>
      </div>
    </section>

    <!-- Review Topics List -->
    <div class="d-flex flex-column">
      <article
        v-for="item in reviewItems"
        :key="item.id"
        class="review-card d-flex flex-column py-3 gap-2"
      >
        <!-- Tag & Due Status -->
        <div class="d-flex justify-content-between align-items-center">
          <span class="badge rounded-pill fw-bold" :style="{'background-color':`var(--${item.variant})`,'color':'var(--bark)'}">
            {{ item.tag }}
          </span>
          <span class="due-indicator" :class="{ 'due-indicator--urgent': item.isUrgent }">
            {{ item.dueText }}
          </span>
        </div>

        <!-- Topic Title -->
        <h3 class=" m-0">{{ item.title }}</h3>

        <!-- Mastery & Card Count -->
        <div class="d-flex justify-content-between align-items-center">
          <span class="text-body-small">{{ item.count }} cards · mastery</span>
          <span class="text-body-small">{{ item.mastery }}</span>
        </div>
      </article>
    </div>

    <!-- Action Button -->
    <div class="pt-2">
      <button type="button" class="btn-primary border-0 text-button">
        Put watering can away
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Heading Typography */

.study-desc {
  font-size: 14px;
  line-height: 22px;
  color: var(--bark-muted);
}

/* Tool Banner */
.watering-banner {
  background-color: var(--mint);
  border: 1px solid var(--linen);
}

.tool-icon-wrapper {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.tool-title {
  font-size: 16px;
  line-height: 24px;
  color: var(--bark);
}

.tool-subtitle {
  font-size: 14px;
  line-height: 20px;
  color: var(--bark-muted);
}

/* Review Topics */
.review-card {
  border-bottom: 1px solid var(--linen);
}

.review-card:last-child {
  border-bottom: none;
}

.topic-title {
  font-size: 16px;
  line-height: 24px;
  color: var(--bark);
}

/* Due Labels */
.due-indicator {
  font-size: 14px;
  line-height: 22px;
  color: var(--bark-muted);
}

.due-indicator--urgent {
  color: var(--berry);
}

.meta-label,
.meta-value {
  font-size: 14px;
  line-height: 22px;
  color: var(--bark-muted);
}

/* Tactile Pill Button */
.action-btn {
  font-family: 'Fredoka', cursive, system-ui, sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--bark);
  background-color: var(--paper);
  border: 2px solid var(--linen);
  padding: 10px 22px;
  box-shadow: 0px 4px 0px var(--linen);
  cursor: pointer;
  transition: transform 0.08s var(--spring), box-shadow 0.08s var(--spring);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0px 6px 0px var(--linen);
}

.action-btn:active {
  transform: translateY(2px);
  box-shadow: 0px 2px 0px var(--linen);
}
</style>