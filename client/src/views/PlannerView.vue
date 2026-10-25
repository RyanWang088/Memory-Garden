<script setup>
import { computed, onMounted, watchEffect, ref } from 'vue'
import { useGardenStore } from '@/stores/garden'

// full calendar from fullcalendar.io v7
import FullCalendar from "@fullcalendar/vue3";
import themePlugin from "@fullcalendar/vue3/themes/monarch"; // YOUR THEME
import dayGridPlugin from "@fullcalendar/vue3/daygrid";
import interactionPlugin from "@fullcalendar/vue3/interaction";

  // stylesheets
import '@fullcalendar/vue3/skeleton.css'; // ALWAYS NEED SKELETON
import '@fullcalendar/vue3/themes/monarch/theme.css'; // YOUR THEME
import '@fullcalendar/vue3/themes/monarch/palettes/purple.css'; // YOUR THEME'S PALETTE

  
// Book-flip styling goes here later. Data side: group seeds by subject with an aggregate readiness score.
const garden = useGardenStore()
onMounted(() => { if (!garden.loaded) garden.fetchSeeds() })

const subjects = computed(() => [...new Set(garden.seeds.filter(s1=>!s1.in_house).map(s => { 

  return s.subject
  

}))])
// TODO: milestones/deadlines -> add a `milestones` table 
const milestones = computed(()=>
  [...new Set(garden.seeds.filter(s=>!s.in_house).map(s=>{
    return {title:s.subject,start:s.exam_date,end:s.exam_date}
  }))]
) 
const nextReviewDates = computed(()=>
[...new Set(garden.seeds.map(s=>({title:s.title,
  start:s.cards.map(c=>c.next_review).sort((a,b)=>Date(a?.next_review)-Date(b?.next_review))[0] || new Date().toISOString(),
  end:s.cards.map(c=>c.next_review).sort((a,b)=>Date(a?.next_review)-Date(b?.next_review))[0] || new Date().toISOString(),
})
))] // anything with no next review date is placed at now
)
//START
// SUGGESTED FIX for nextReviewDates (commented out so you can compare):
// 1. After .map(c=>c.next_review), a and b are already date strings, so a?.next_review is undefined.
// 2. Date(x) without `new` ignores x and returns the CURRENT time as a string; string - string = NaN.
//    sort() treats NaN as "equal", so the order never changes and [0] is just the first card, not the earliest.
// Fix: drop empty dates with .filter(Boolean), compare with new Date(a) - new Date(b) (gives milliseconds),
// and compute the earliest date once since start and end are the same.
// const nextReviewDates = computed(()=>
//   garden.seeds.map(s=>{
//     const earliest = s.cards.map(c=>c.next_review).filter(Boolean).sort((a,b)=>new Date(a)-new Date(b))[0] || new Date().toISOString()
//     return {title:s.title, start:earliest, end:earliest}
//   })
// ) // anything with no next review date is placed at now
// END
const events=computed(()=> milestones.value.concat(nextReviewDates.value))
const calendarOptions = computed(()=> ({
  plugins: [themePlugin, dayGridPlugin, interactionPlugin],
  initialView: "dayGridMonth",
  headerToolbar:{start:'title', right:'prev,next'},
  events:events.value
 })) // calendarOptions from full calendar, passed in exam dates
watchEffect(()=>{
  console.log(milestones.value)
  // console.log(nextReviewDates.value)
  console.log(events.value)
}) //testing, milestone updates later once fetchSeeds() runs
  

</script>

<template>
  <main class="container py-4" data-testid="planner">
    <h2>Planner</h2>
    <p v-if="!subjects.length" class="text-muted">No subjects yet. Plant a seed in the garden to start tracking progress.</p>
    <table v-else class=" table table-bordered">
      <thead class="table-primary">
        <tr>
      <th><span class="text-muted">Subject</span></th>
      <th><span class="text-muted">Readiness</span></th>
      <!-- <th><span class="text-muted">Exam Date</span></th> -->
      </tr>
    </thead>
      <tbody>
        <tr v-for="s in subjects" :key="s">
          <td><strong>{{ s }}</strong></td>
          <td>{{ garden.readiness(s) }}%</td>
          
        </tr>
      </tbody>
    </table>
    <!-- <div v-for="s in subjects" :key="s" class="mb-3">
      <strong>{{ s }}</strong> <span class="text-muted">readiness {{ garden.readiness(s) }}%</span>

    </div> -->
    <h4 class="mt-4">Upcoming milestones</h4>
    <p class="text-muted">TODO</p>
    
    <FullCalendar :options="calendarOptions" />
  </main>
</template>
