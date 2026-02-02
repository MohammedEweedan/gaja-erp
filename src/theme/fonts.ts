const fontFaces = `
  @font-face {
    font-family: 'HSN_Razan_Regular';
    src: url('/fonts/HSN_Razan_Regular.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'HSN_Razan_Regular';
    src: url('/fonts/HSN_Razan_Bold.ttf') format('truetype');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
`;

// Create a style element and inject the font faces
const styleElement = document.createElement('style');
styleElement.appendChild(document.createTextNode(fontFaces));
document.head.appendChild(styleElement);

// This is a no-op component that just returns null
const FontStyles = () => null;

export default FontStyles;
