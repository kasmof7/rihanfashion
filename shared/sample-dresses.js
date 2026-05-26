const SHARED_DRESSES_KEY = 'rf_dresses';
let sharedSampleDresses = [];

async function loadSampleDresses() {
  if (sharedSampleDresses.length > 0) return sharedSampleDresses;
  try {
    const cached = localStorage.getItem(SHARED_DRESSES_KEY);
    if (cached) {
      sharedSampleDresses = JSON.parse(cached);
      return sharedSampleDresses;
    }
    const url = (typeof SAMPLE_DATA_PATH !== 'undefined' ? SAMPLE_DATA_PATH : 'data/sample-dresses.json');
    const res = await fetch(url);
    if (res.ok) {
      sharedSampleDresses = await res.json();
      localStorage.setItem(SHARED_DRESSES_KEY, JSON.stringify(sharedSampleDresses));
    }
  } catch (e) {}
  return sharedSampleDresses;
}

function getFallbackDresses() {
  return sharedSampleDresses;
}

function saveFallbackDresses(dresses) {
  sharedSampleDresses = dresses;
  localStorage.setItem(SHARED_DRESSES_KEY, JSON.stringify(dresses));
}
