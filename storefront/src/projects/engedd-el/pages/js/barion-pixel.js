/**
 * Barion Base Pixel — engedd-el (Engedd el, ami tönkretesz)
 *
 * Official Barion base pixel loader. Creates the window.bp stub, async-loads
 * bp.js from pixel.barion.com, and initializes the pixel with our Pixel ID.
 * Required by Barion for go-live (fraud + conversion tracking).
 *
 * Ref: https://docs.barion.com/Implementing_the_Base_Barion_Pixel
 * Loaded early (non-deferred) in <head> of every page.
 */
(function () {
  'use strict';

  var PIXEL_ID = 'BP-dkCRBlpG0P-26';

  // Create the bp() command queue stub on window
  window['bp'] = window['bp'] || function () {
    (window['bp'].q = window['bp'].q || []).push(arguments);
  };
  window['bp'].l = 1 * new Date();

  // Insert the bp.js loader before the first <script> on the page
  var scriptElement = document.createElement('script');
  var firstScript = document.getElementsByTagName('script')[0];
  scriptElement.async = true;
  scriptElement.src = 'https://pixel.barion.com/bp.js';
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(scriptElement, firstScript);
  } else {
    document.head.appendChild(scriptElement);
  }

  window['barion_pixel_id'] = PIXEL_ID;
  bp('init', 'addBarionPixelId', window['barion_pixel_id']);
})();
