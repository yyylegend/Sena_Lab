<script>
  import { onMount } from 'svelte';

  onMount(() => {
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', 'yyylegend/Sena_Lab');
    script.setAttribute('data-repo-id', 'R_kgDORvl9ZQ');
    script.setAttribute('data-category', 'Comments');
    script.setAttribute('data-category-id', 'DIC_kwDORvl9Zc4C5TY3');
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'bottom');
    script.setAttribute('data-theme', 'dark_dimmed');
    script.setAttribute('data-lang', 'zh-CN');
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;
    document.getElementById('giscus-container').appendChild(script);
  });
</script>

<div id="giscus-container"></div>
