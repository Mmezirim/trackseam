import React from 'react'
import ReactDOM from 'react-dom/client'
// Bundled so the app looks right offline and makes no requests to Google Fonts.
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
