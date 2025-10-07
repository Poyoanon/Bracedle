<template>
  <div class="min-h-screen p-8 bg-gradient-to-br from-[#0a0711] via-[#050307] to-[#0a0711]">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">
          Bracedle (Beta)
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
          :class="role === 'DPS' ? 'border-emerald-500 bg-emerald-900/20 text-emerald-200' : 'border-gray-600 text-gray-300'"
        >
          <input type="radio" class="hidden" value="DPS" v-model="role" />
          <span>DPS</span>
        </label>
        <label
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer"
          :class="role === 'Support' ? 'border-cyan-500 bg-cyan-900/20 text-cyan-200' : 'border-gray-600 text-gray-300'"
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

      <!-- Bottom: Tips + Disclaimer -->
      <div class="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Tips -->
        <div class="bg-gray-950/80 border border-gray-800 rounded p-4">
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

        <!-- Disclaimer -->
        <div class="bg-gray-950/80 border border-gray-800 rounded p-4">
          <h4 class="text-sm font-semibold text-purple-300">Disclaimer</h4>
          <ul class="mt-2 text-xs text-gray-300 list-disc list-inside space-y-1">
            <li>This is not a true bracelet calculator, just a simple comparator.</li>
            <li>This does not take into account complicated aspects such as Blunt Thorn and Supersonic Breakthrough.</li>
            <li>This also does not take into account any class specifics that may or may not value certain stats higher.</li>
            <li>This is meant to be a lazy man's quick way to decide if a bracelet is better or worse than another, or for those who really couldn't be bothered with excel spreadsheets.</li>
            <li>And it will remain a tool with a max of 3 inputs, nothing more than that.</li>
            <li>If you want something more accurate, there are plenty of bracelet calculators that have been created by the community for that purpose with more inputs to personalize your stats.</li>
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

const highlight1 = computed(() => (winner.value === 1 ? 'winner' : (winner.value === 0 ? 'tie' : null)));
const highlight2 = computed(() => (winner.value === 2 ? 'winner' : (winner.value === 0 ? 'tie' : null)));

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
