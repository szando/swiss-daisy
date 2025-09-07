<script>
    import { get } from 'svelte/store';
    import { currentFragment, audioElement } from '../lib/stores/overlay.js';

    /** @type {Record<string, string[]>} */
    export let variants = {};

    let answer = '';
    let result = '';
    let score = 0;

    const norm = (s) =>
        s.toLowerCase()
            .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
            .replace(/[’`]/g,"'")
            .replace(/[^a-zäöüéèàâêîôûç'\\s-]/gi,' ')
            .replace(/\s+/g,' ').trim();

    function applyVariants(tokens) {
        const out = [];
        for (const t of tokens) {
            let mapped = t;
            for (const [canon, alts] of Object.entries(variants || {})) {
                const c = norm(canon);
                if (t === c || (alts || []).map(norm).includes(t)) { mapped = c; break; }
            }
            out.push(mapped);
        }
        return out;
    }

    function wer(ref, hyp) {
        const r = ref.split(' ').filter(Boolean);
        const h = hyp.split(' ').filter(Boolean);
        const dp = Array(r.length+1).fill(null).map(()=>Array(h.length+1).fill(0));
        for (let i=0;i<=r.length;i++) dp[i][0]=i;
        for (let j=0;j<=h.length;j++) dp[0][j]=j;
        for (let i=1;i<=r.length;i++){
            for (let j=1;j<=h.length;j++){
                dp[i][j] = Math.min(
                    dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1] + (r[i-1]===h[j-1]?0:1)
                );
            }
        }
        return r.length ? dp[r.length][h.length]/r.length : 0;
    }

    function playSegment() {
        const frag = get(currentFragment);
        const audio = get(audioElement);
        if (!frag || !audio) return;
        audio.currentTime = frag.start;
        audio.play();
        const stopAt = frag.end;
        const tick = () => {
            if (audio.currentTime >= stopAt) audio.pause();
            else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    function check() {
        const frag = get(currentFragment);
        if (!frag) return;
        const refTokens = applyVariants(norm(frag.text).split(' '));
        const hypTokens = applyVariants(norm(answer).split(' '));
        const scoreNum = Math.max(0, 1 - wer(refTokens.join(' '), hypTokens.join(' ')));
        score = scoreNum;
        result = `Similarity: ${(score*100).toFixed(1)}%`;
    }
</script>

{#if $currentFragment}
    <div class="rounded-2xl p-4 shadow bg-white">
        <div class="text-sm opacity-70 mb-1">listen and type what you hear</div>
        <div class="font-medium mb-2">{$currentFragment.text}</div>

        <div class="flex gap-2 mb-3">
            <button class="px-3 py-1 rounded bg-black text-white" on:click={playSegment}>▶ replay</button>
            <button class="px-3 py-1 rounded bg-gray-200" on:click={() => (answer = '')}>clear</button>
        </div>

        <input class="w-full border rounded px-3 py-2 mb-2"
               bind:value={answer}
               placeholder="type here…"
               on:keydown={(e)=>e.key==='Enter' && check()} />

        <div class="flex gap-2">
            <button class="px-3 py-1 rounded bg-emerald-600 text-white" on:click={check}>check</button>
            {#if result}<div class="self-center text-sm">{result}</div>{/if}
        </div>

        {#if $currentFragment.glossDe || $currentFragment.glossEn}
            <details class="mt-3">
                <summary class="cursor-pointer text-sm underline">show gloss</summary>
                {#if $currentFragment.glossDe}<div class="text-sm mt-1">DE: {$currentFragment.glossDe}</div>{/if}
                {#if $currentFragment.glossEn}<div class="text-sm">EN: {$currentFragment.glossEn}</div>{/if}
            </details>
        {/if}
    </div>
{:else}
    <div class="opacity-60 text-sm">open a DAISY title and select a segment to begin</div>
{/if}
