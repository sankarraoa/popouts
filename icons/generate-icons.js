// Node.js script to generate PNG icons from SVG
// Run with: node icons/generate-icons.js
// Requires: npm install sharp (or use the HTML method instead)

const fs = require('fs');
const path = require('path');

const svgContent = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 8C0 3.58172 3.58172 0 8 0H16C20.4183 0 24 3.58172 24 8V16C24 20.4183 20.4183 24 16 24H8C3.58172 24 0 20.4183 0 16V8Z" fill="#030213"/>
<g clip-path="url(#clip0_3_8)">
<path d="M6.58334 8.75H8.75001" stroke="white" stroke-width="1.08333" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6.58334 10.9167H8.75001" stroke="white" stroke-width="1.08333" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6.58334 13.0833H8.75001" stroke="white" stroke-width="1.08333" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6.58334 15.25H8.75001" stroke="white" stroke-width="1.08333" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15.25 6.58333H8.74999C8.15168 6.58333 7.66666 7.06836 7.66666 7.66667V16.3333C7.66666 16.9316 8.15168 17.4167 8.74999 17.4167H15.25C15.8483 17.4167 16.3333 16.9316 16.3333 16.3333V7.66667C16.3333 7.06836 15.8483 6.58333 15.25 6.58333Z" stroke="white" stroke-width="1.08333" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M14.1667 6.58333V17.4167" stroke="white" stroke-width="1.08333" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_3_8">
<rect width="13" height="13" fill="white" transform="translate(5.5 5.5)"/>
</clipPath>
</defs>
</svg>`;

console.log('Icon generator script created.');
console.log('To generate icons, use one of these methods:');
console.log('1. Open icons/generate-icons.html in your browser and click "Generate Icons"');
console.log('2. Use an online SVG to PNG converter with icons/icon.svg');
console.log('3. Install sharp: npm install sharp, then run this script');

// If sharp is available, use it
try {
  const sharp = require('sharp');
  const sizes = [16, 48, 128];
  
  Promise.all(sizes.map(size => {
    return sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(`icons/icon${size}.png`);
  })).then(() => {
    console.log('Icons generated successfully!');
  }).catch(err => {
    console.log('Sharp not available. Use the HTML method instead.');
  });
} catch (e) {
  console.log('Sharp module not found. Use the HTML generator instead.');
}
