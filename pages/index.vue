<template>
  <!-- Deep, near-black background with faint saturated glows -->
  <div class="relative min-h-screen">
    <!-- Base: pure black -->
    <div class="absolute inset-0 bg-black"></div>

    <!-- Soft color wash (very low opacity, saturated but dark) -->
    <div
      class="pointer-events-none absolute inset-0
             [background:
               radial-gradient(800px_520px_at_10%_0%,rgba(168,85,247,0.10),transparent_60%),
               radial-gradient(700px_460px_at_90%_10%,rgba(99,102,241,0.08),transparent_55%)
             ]">
    </div>

    <!-- Content -->
    <div class="relative p-8">
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-white mb-2">
            Bracedle
          </h1>
          <h2 class="text-1xl font-bold text-white mb-2">
            Lost Ark Bracelet Comparator
          </h2>
          <p class="text-gray-400">
            Upload bracelet screenshots to be told left or right better
          </p>
        </div>

        <!-- Role toggle -->
        <div class="mb-6 flex items-center justify-center gap-4">
          <span class="text-sm text-gray-300">Role:</span>
          <label
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer"
            :class="role === 'DPS'
              ? 'border-emerald-500 bg-emerald-900/20 text-emerald-200'
              : 'border-gray-600 text-gray-300'"
          >
            <input type="radio" class="hidden" value="DPS" v-model="role" />
            <span>DPS</span>
          </label>
          <label
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer"
            :class="role === 'Support'
              ? 'border-cyan-500 bg-cyan-900/20 text-cyan-200'
              : 'border-gray-600 text-gray-300'"
          >
            <input type="radio" class="hidden" value="Support" v-model="role" />
            <span>Support</span>
          </label>
        </div>

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

        <!-- Upload tips anchored at the bottom -->
        <div class="mt-8 bg-gray-900/70 border border-gray-700 rounded p-4">
          <h4 class="text-sm font-semibold text-purple-300">Upload tips for best OCR results</h4>
          <ul class="mt-2 text-xs text-gray-300 list-disc list-inside space-y-1">
            <li>Crop tightly around the bracelet text (no background/UI).</li>
            <li>Use 100% zoom or higher; avoid scaled or blurred screenshots.</li>
            <li>Avoid overlapping cursors on the bracelet panel.</li>
            <li>Upload a <span class="font-semibold">PNG</span> if possible.</li>
            <li>Ensure the blue bullet icon is visible for <em>every</em> line.</li>
            <li>Do not use Forced 21:9 in non-ultrawide setups as the screenshot will be too unclear for the OCR.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import BraceletUpload from '~/components/BraceletUpload.vue';
import { getProfileWeights, scoreBracelet } from '~/composables/weights';

const bracelet1Stats = ref([]);
const bracelet2Stats = ref([]);
const bracelet1Ref = ref(null);
const bracelet2Ref = ref(null);

// Role (DPS / Support)
const role = ref('DPS');
const weights = computed(() => getProfileWeights(role.value));

const score1 = computed(() => scoreBracelet(bracelet1Stats.value, weights.value));
const score2 = computed(() => scoreBracelet(bracelet2Stats.value, weights.value));

const winner = computed(() => {
  if (bracelet1Stats.value.length === 0 || bracelet2Stats.value.length === 0) return null;
  if (score1.value > score2.value) return 1;
  if (score2.value > score1.value) return 2;
  return 0; // tie
});

const highlight1 = computed(() =>
  winner.value === 1 ? 'winner' : (winner.value === 0 ? 'tie' : null)
);
const highlight2 = computed(() =>
  winner.value === 2 ? 'winner' : (winner.value === 0 ? 'tie' : null)
);

const handleGlobalPaste = async (event) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (bracelet1Ref.value && !bracelet1Ref.value.hasImage()) {
        await bracelet1Ref.value.processFile(file);
        event.preventDefault();
      } else if (bracelet2Ref.value && !bracelet2Ref.value.hasImage()) {
        await bracelet2Ref.value.processFile(file);
        event.preventDefault();
      }
      break;
    }
  }
};

onMounted(() => window.addEventListener('paste', handleGlobalPaste));
onUnmounted(() => window.removeEventListener('paste', handleGlobalPaste));
</script>
