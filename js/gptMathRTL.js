/**
 * BGU Spark - ChatGPT Math RTL Fix
 * Copyright (c) 2025 Shay Avivi
 * All Rights Reserved - Proprietary and Confidential
 * Contact: kshayk16@gmail.com
 */

// Check if the feature is enabled before running
chrome.storage.sync.get('toggleStateGptMath', function(data) {
  // Default is false (disabled) if not set
  const isEnabled = data.toggleStateGptMath || false;
  
  if (!isEnabled) {
    console.log('GPT Math RTL is disabled');
    return;
  }

  // Run the script only if enabled
  (() => {
    /** CSS we'll inject once: forces LTR + left alignment */
    const css = `
      .katex,
      .katex-display,
      .katex-html,
      .katex-mathml {
        direction: ltr !important;
        text-align: left !important;
      }
    `;
    const styleTag = Object.assign(document.createElement('style'), { textContent: css });
    document.head.appendChild(styleTag);

    /** Helper that (re)labels elements as LTR – useful if your layout engine checks [dir] */
    const markLTR = el => { el.setAttribute('dir', 'ltr'); };

    /** Apply immediately to anything already on the DOM */
    document.querySelectorAll('.katex, .katex-display, .katex-html, .katex-mathml')
            .forEach(markLTR);

    /** Observe for KaTeX nodes added later (e.g. SPA routes, live editors) */
    new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;                       // only Elements
          if (node.matches?.('.katex, .katex-display, .katex-html, .katex-mathml'))
            markLTR(node);
          node.querySelectorAll?.('.katex, .katex-display, .katex-html, .katex-mathml')
              .forEach(markLTR);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  })();
});