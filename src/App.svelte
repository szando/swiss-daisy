<script>
  import Controls from "./components/controls/controls.svelte";
  import FileInput from "./components/FileInput.svelte";
  import Loading from "./components/Loading.svelte";

  import { audioElement, currentFragment } from '$lib/stores/overlay.js';
  import ExercisePanel from '$components/ExercisePanel.svelte';




  import { onMount } from "svelte";
  import { loadFile } from "./reader/loader";
  import { readContentDOM, lookBackward, lookForward } from "./reader/reader";
  import { getAudioSource } from "./reader/audio";
  import { autoscroll } from "./utils/autoscroll";

  let content = "";
  let zip;
  let ref;
  let cursor;
  let audioRef;
  let walker;
  let playing = false;
  let loading = false;
  let cache = {};
  let audioEl;

  onMount(async () => {
    audioElement.set(audioRef);
    if ("serviceWorker" in navigator) {
      if (__dev__) {
        const regs = await navigator.serviceWorker.getRegistrations();

        if (regs.length) {
          regs.forEach(reg => reg.unregister());
        }
      } else {
        navigator.serviceWorker.register("/service-worker.js");
      }
    }
  });

  const loadDocument = async event => {
    try {
      const [file] = event.target.files;

      if (!file.name.match(/\.zip$/)) {
        return Promise.reject("File must be in .zip format.");
      }

      loading = true;

      const result = await loadFile(file);

      content = result.dom.parentElement.innerHTML;
      zip = result.zip;
    } catch (error) {
      console.warn(error);
    } finally {
      loading = false;
    }
  };

  const stopPlayback = () => {
    walker.return();
    audioRef.pause();
    cursor.classList.remove("active");
  };
  // Call this whenever the SMIL <par> changes:
  function onActivePar({ id, start, end, text, glossDe, glossEn }) {
    currentFragment.set({ id, start, end, text, glossDe, glossEn });
  }

  /**
   *
   * @param {string} audio
   * @param {Element} element
   * @returns {Promise<void>}
   */
  function playAudio(audio, element) {
    return new Promise(async (resolve, reject) => {
      try {
        audioRef.src = audio;

        const onCompleted = () => {
          audioRef.pause();
          audioRef.removeEventListener("pause", onCompleted);
          element.classList.remove("active");
          resolve();
        };

        const onStart = async () => {
          audioRef.addEventListener("pause", onCompleted);
          audioRef.removeEventListener("canplaythrough", onStart);
          element.classList.add("active");

          // --- NEW: gather fragment data for ExercisePanel ---
          // id: prefer explicit element id; fallback to a stable selector
          const id = element.getAttribute("id") || element.dataset?.id || "frag-" + Math.random().toString(36).slice(2);

          // text: innerText/trim
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();

          // optional glosses from data attributes if you have them in your markup
          const glossDe = element.dataset?.glossDe || undefined;
          const glossEn = element.dataset?.glossEn || undefined;

          // timing:
          // try to read SMIL clip times if your loader put them on the element
          const beginAttr = element.dataset?.begin; // e.g., "0:00:01.30" or "1.3s"
          const endAttr = element.dataset?.end;     // e.g., "0:00:02.50" or "2.5s"

          const parseClock = (t) => {
            if (!t) return null;
            if (/^\d+(\.\d+)?s$/.test(t)) return parseFloat(t);
            const parts = t.split(":").map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            const n = Number(t);
            return Number.isFinite(n) ? n : null;
          };

          let start = parseClock(beginAttr);
          let end = parseClock(endAttr);

          // If no per-fragment times exist (common if each <par> maps to its own audio file),
          // fall back to 0..duration.
          if (start == null) start = 0;
          if (end == null || !Number.isFinite(end) || end <= 0) {
            // duration is now known on canplaythrough
            end = Number.isFinite(audioRef.duration) ? audioRef.duration : start;
          }

          // publish to ExercisePanel
          onActivePar({ id, start, end, text, glossDe, glossEn });

          // --- END NEW ---

          audioRef.currentTime = start;
          audioRef.play();
        };

        audioRef.addEventListener("canplaythrough", onStart);
      } catch (error) {
        reject(error);
      }
    });
  }


  const readDocument = async () => {
    walker = readContentDOM(cursor);

    const getAudioUrl = getAudioSource(zip, cache);

    for (const element of walker) {
      const audioUrl = await getAudioUrl(element);

      if (audioUrl) {
        cursor = element;

        if (element.offsetHeight) {
          autoscroll(element);
        }

        await playAudio(audioUrl, element);
      }
    }
  };

  const onContentSelect = event => {
    if (playing) {
      stopPlayback();
    }

    cursor = event.target;
    playing = true;
    readDocument();
  };

  const onDocumentLoad = () => {
    if (ref && ref.children.length) {
      cursor = ref;
    }
  };

  async function loadExample() {
    try {
      loading = true;
      const res = await fetch(
        "https://cors-anywhere.herokuapp.com/https://dl.daisy.org/samples/3full-text-full-audio/are-you-ready-z3986.zip",
        {
          method: "GET",
          mode: "cors"
        }
      );
      const data = await res.blob();

      const result = await loadFile(data);

      content = result.dom.parentElement.innerHTML;
      zip = result.zip;
    } catch (error) {
      console.warn(error);
    } finally {
      loading = false;
    }
  }

  const togglePlay = () => {
    if (playing) {
      stopPlayback();
    } else {
      readDocument();
    }

    playing = !playing;
  };

  const controlHandler = handler => () => {
    const element = handler(cursor);

    if (element) {
      if (playing) {
        stopPlayback();
      }

      playing = true;
      cursor = element;
      readDocument();
    }
  };

  const handlePrevious = controlHandler(lookBackward);

  const handleForward = controlHandler(lookForward);

  // Keyboard events
  window.addEventListener("keydown", event => {
    if (content) {
      switch (event.code) {
        case "ArrowLeft":
          event.preventDefault();
          handlePrevious();
          return;
        case "ArrowRight":
          event.preventDefault();
          handleForward();
          return;
        case "Space":
          event.preventDefault();
          togglePlay();
          return;
        default:
          return;
      }
    }
  });

  $: content, setTimeout(onDocumentLoad, 0);

</script>

<style>
  main {
    min-height: 100vh;
  }
</style>

<main>
  {#if !content}
    <FileInput
      on:change={loadDocument}
      on:click={loadExample}
      disabled={loading} />
  {/if}
  {#if content}
    <section>
      <ExercisePanel />
    </section>
    <section class="content">
      <div id="content" bind:this={ref} on:click={onContentSelect}>
        {@html content}
      </div>
    </section>

  {/if}
  <audio bind:this={audioRef} />
  <Controls
    {playing}
    disabled={!content}
    onPlayToggle={togglePlay}
    onBackward={handlePrevious}
    onForward={handleForward} />
  {#if loading}
    <Loading />
  {/if}
</main>
