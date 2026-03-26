<script>
  import { onMount } from 'svelte';

  const DARK_THEME = 'dark_dimmed';
  const LIGHT_THEME = 'light';

  function getTheme() {
    return document.documentElement.classList.contains('dark') ? DARK_THEME : LIGHT_THEME;
  }

  function sendThemeToGiscus(theme) {
    const iframe = document.querySelector('iframe.giscus-frame');
    if (iframe) {
      iframe.contentWindow.postMessage(
        { giscus: { setConfig: { theme } } },
        'https://giscus.app'
      );
    }
  }

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
    script.setAttribute('data-theme', getTheme());
    script.setAttribute('data-lang', 'zh-CN');
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;
    document.getElementById('giscus-container').appendChild(script);

    const observer = new MutationObserver(() => {
      sendThemeToGiscus(getTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  });
</script>

<div id="giscus-container"></div>
