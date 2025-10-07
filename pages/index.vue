<template>
  <div class="min-h-screen p-8 bg-gradient-to-br from-gray-950 via-[#0b0020] to-black">
    <div class="max-w-7xl mx-auto pb-24">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">Bracedle (Beta)</h1>
        <h2 class="text-1xl font-bold text-white mb-2">Lost Ark Bracelet Comparator</h2>
        <p class="text-gray-400">Upload bracelet screenshots to be told left or right better</p>
      </div>

      <!-- Role toggle -->
      <div class="mb-6 flex items-center justify-center gap-4">
        <span class="text-sm text-gray-300">Role:</span>
        <label
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition-colors"
          :class="role === 'DPS' ? 'border-emerald-500 bg-emerald-900/20 text-emerald-200' : 'border-gray-600 text-gray-300 hover:border-gray-500'"
        >
          <input type="radio" class="hidden" value="DPS" v-model="role" />
          <span>DPS</span>
        </label>
        <label
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition-colors"
          :class="role === 'Support' ? 'border-cyan-500 bg-cyan-900/20 text-cyan-200' : 'border-gray-600 text-gray-300 hover:border-gray-500'"
        >
          <input type="radio" class="hidden" value="Support" v-model="role" />
          <span>Support</span>
        </label>
      </div>

      <!-- Uploaders -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BraceletUpload
          ref="bracelet1Ref"
          :bracelet-num="1"
          :weights="weights"
          :total-score="score1"
          :highlight="highlight1"
          @update:stats="bracelet1Stats = $event"
        />

        <BraceletUpload
          ref="bracelet2Ref"
          :bracelet-num="2"
          :weights="weights"
          :total-score="score2"
          :highlight="highlight2"
          @update:stats="bracelet2Stats = $event"
        />
      </div>

      <!-- Tips + Disclaimer -->
      <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-gray-900/70 border border-gray-700 rounded p-4">
          <h4 class="text-sm font-semibold text-purple-300">Upload tips for best OCR results</h4>
          <ul class="mt-2 text-xs text-gray-300 list-disc list-inside space-y-1">
            <li>Crop tightly around the bracelet text (no background/UI).</li>
            <li>Use 100% zoom or higher; avoid scaled or blurred screenshots.</li>
            <li>Avoid overlapping cursors on the bracelet panel.</li>
            <li>Upload a <span class="font-semibold">PNG</span> if possible.</li>
            <li>Ensure the blue bullet icon is visible for <em>every</em> line.</li>
            <li>Do not use Forced 21:9 in non-ultrawide setups (too blurry for OCR).</li>
          </ul>
        </div>

        <div class="bg-gray-900/70 border border-gray-700 rounded p-4">
          <h4 class="text-sm font-semibold text-purple-300">Disclaimer</h4>
          <ul class="mt-2 text-xs text-gray-300 list-disc list-inside space-y-1">
            <li>This is not a true bracelet calculator, just a simple comparator.</li>
            <li>Does not account for Blunt Thorn, Supersonic Breakthrough, etc.</li>
            <li>Does not account for class specifics that may value stats differently.</li>
            <li>Meant as a lazy quick way to decide left vs. right (no spreadsheets).</li>
            <li>If you want something more accurate, there are plenty of bracelet calculators that have been created by the community for that purpose with more inputs to personalize your stats.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Fixed footer -->
    <footer
      class="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40"
    >
      <div class="mx-auto max-w-7xl px-4 sm:px-6 py-2.5 text-center text-sm text-gray-200">
        Yell at me for bugfixes on the
        <a
          href="https://discord.com/invite/loanexus"
          target="_blank"
          rel="noopener noreferrer"
          class="underline decoration-dotted underline-offset-2 hover:text-white"
        >Nexus Discord</a>
        or
        <a
          href="https://ko-fi.com/poyoanon"
          target="_blank"
          rel="noopener noreferrer"
          class="underline decoration-dotted underline-offset-2 hover:text-white"
        >support me</a>
        for whatever reason.
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import BraceletUpload from '~/components/BraceletUpload.vue'
import { getProfileWeights, scoreBracelet } from '~/composables/weights'

const bracelet1Stats = ref([])
const bracelet2Stats = ref([])
const bracelet1Ref = ref(null)
const bracelet2Ref = ref(null)

const role = ref('DPS')
const weights = computed(() => getProfileWeights(role.value))

const score1 = computed(() => scoreBracelet(bracelet1Stats.value, weights.value))
const score2 = computed(() => scoreBracelet(bracelet2Stats.value, weights.value))

const winner = computed(() => {
  if (bracelet1Stats.value.length === 0 || bracelet2Stats.value.length === 0) return null
  if (score1.value > score2.value) return 1
  if (score2.value > score1.value) return 2
  return 0
})

const highlight1 = computed(() => (winner.value === 1 ? 'winner' : winner.value === 0 ? 'tie' : null))
const highlight2 = computed(() => (winner.value === 2 ? 'winner' : winner.value === 0 ? 'tie' : null))

const handleGlobalPaste = async (event) => {
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (bracelet1Ref.value && !bracelet1Ref.value.hasImage()) {
        await bracelet1Ref.value.processFile(file)
        event.preventDefault()
      } else if (bracelet2Ref.value && !bracelet2Ref.value.hasImage()) {
        await bracelet2Ref.value.processFile(file)
        event.preventDefault()
      }
      break
    }
  }
}

onMounted(() => window.addEventListener('paste', handleGlobalPaste))
onUnmounted(() => window.removeEventListener('paste', handleGlobalPaste))
</script>
