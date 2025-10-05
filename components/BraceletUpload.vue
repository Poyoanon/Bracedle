<template>
  <div
    class="rounded-lg p-6 border-2 transition-all"
    :class="cardClass"
  >
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-white">Bracelet {{ braceletNum }}</h3>
      <div v-if="typeof totalScore === 'number'" class="text-sm">
        <span class="text-gray-400 mr-1">Score:</span>
        <span :class="scoreColor">{{ formattedScore }}</span>
      </div>
    </div>
    
    <div v-if="!imageSrc" class="relative">
      <div
        class="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg transition-colors"
        :class="isDragging ? 'border-purple-500 bg-purple-900/20' : 'border-gray-600'"
        @dragenter.prevent="isDragging = true"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <label class="flex flex-col items-center justify-center cursor-pointer w-full h-full pointer-events-none">
          <svg class="w-12 h-12 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span class="text-gray-400">Drag & drop or Ctrl+V to paste</span>
          <span class="text-gray-500 text-sm mt-1">or click below to browse</span>
        </label>
      </div>
      <label class="block mt-2">
        <span class="block text-center text-purple-400 hover:text-purple-300 cursor-pointer text-sm">Browse files</span>
        <input
          type="file"
          class="hidden"
          accept="image/*"
          @change="handleFileUpload"
        />
      </label>
    </div>

    <div v-else>
      <div class="relative mb-4 h-64 overflow-hidden">
        <img :src="imageSrc" alt="Bracelet" class="w-full h-full object-cover object-top rounded border border-gray-600" />
        <button
            @click="clearImage"
            class="absolute top-2 right-2 bg-red-600 hover:bg-red-700 p-2 rounded-full"
        >
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>

      <div v-if="loading" class="text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
        <p class="text-gray-400 mt-2">Processing OCR...</p>
      </div>

      <div v-else-if="ocrResult" class="space-y-4">
        <div>
          <h4 class="text-sm font-semibold text-purple-400 mb-2">
            Parsed Stats: {{ sortedStats.length }} found
          </h4>
          <div v-if="sortedStats.length > 0" class="bg-gray-900 rounded p-3 space-y-2">
            <div
              v-for="(stat, i) in sortedStats"
              :key="i"
              class="text-sm"
            >
              <div class="flex items-start gap-2">
                <span 
                  class="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
                  :class="{
                    'bg-blue-900 text-blue-300': stat.category === 'basic',
                    'bg-green-900 text-green-300': stat.category === 'combat',
                    'bg-purple-900 text-purple-300': stat.category === 'special',
                    'bg-orange-900 text-orange-300': stat.category === 'dps',
                    'bg-cyan-900 text-cyan-300': stat.category === 'support',
                    'bg-gray-700 text-gray-400': stat.category === 'low-value',
                    'bg-red-900 text-red-300': stat.category === 'unknown'
                  }"
                >
                  {{ stat.category }}
                </span>
                <span class="text-gray-300 flex-1">{{ stat.display || stat.raw }}</span>
                <span v-if="typeof stat.contribution === 'number'" class="text-xs text-gray-400 ml-2 shrink-0">
                  {{ stat.contribution.toFixed(2) }}
                </span>
              </div>
            </div>
          </div>
          <p v-else class="text-gray-500 text-sm">No stats detected</p>
        </div>

        <details class="text-sm">
          <summary class="text-gray-400 cursor-pointer hover:text-gray-300">
            Raw OCR Output
          </summary>
          <pre class="mt-2 bg-gray-900 rounded p-3 text-xs text-gray-400 overflow-x-auto max-h-48 overflow-y-auto">{{ ocrResult.text }}</pre>
        </details>

        <div v-if="!ocrResult.success" class="bg-red-900/20 border border-red-700 text-red-200 text-sm rounded p-3">
          <p class="whitespace-pre-line">{{ ocrResult.error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useOCR } from '~/composables/useOCR';
import { sortStatsByContribution } from '~/composables/weights';

const props = defineProps({
  braceletNum: { type: Number, required: true },
  weights: { type: Object, default: () => ({}) },
  totalScore: { type: Number, default: null },
  highlight: { type: String, default: null } 
});

const emit = defineEmits(['update:stats']);

const { processImage } = useOCR();

const imageSrc = ref(null);
const loading = ref(false);
const ocrResult = ref(null);
const isDragging = ref(false);

const parsedStats = computed(() => ocrResult.value?.parsed || []);

const sortedStats = computed(() => {
  if (!parsedStats.value.length) return [];
  const arr = sortStatsByContribution(parsedStats.value, props.weights);
  return arr;
});

const scoreColor = computed(() => {
  if (props.highlight === 'winner') return 'text-emerald-300';
  if (props.highlight === 'tie') return 'text-yellow-300';
  return 'text-gray-300';
});

const formattedScore = computed(() =>
  typeof props.totalScore === 'number'
    ? props.totalScore.toFixed(2)
    : '--'
);

const cardClass = computed(() => {
  if (props.highlight === 'winner') return 'border-emerald-500 ring-2 ring-emerald-400 bg-gray-800 shadow-lg';
  if (props.highlight === 'tie')    return 'border-yellow-500 ring-2 ring-yellow-400 bg-gray-800';
  return 'border-gray-700 bg-gray-800';
});

const processImageFile = async (file) => {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = (e) => { imageSrc.value = e.target.result; };
  reader.readAsDataURL(file);

  loading.value = true;
  ocrResult.value = null;

  const result = await processImage(file);
  
  loading.value = false;
  ocrResult.value = result;

  if (result.success) {
    emit('update:stats', result.parsed);
  } else {
    emit('update:stats', result.parsed || []);
  }
};

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  await processImageFile(file);
};

const handleDrop = async (event) => {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) await processImageFile(file);
};

const clearImage = () => {
  imageSrc.value = null;
  ocrResult.value = null;
  emit('update:stats', []);
};

const hasImage = () => !!imageSrc.value;
const processFile = async (file) => { await processImageFile(file); };

defineExpose({ hasImage, processFile });
</script>
