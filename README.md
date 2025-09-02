# LLM Chat Interface

A sophisticated chat interface featuring a modern dark theme and AI integration capabilities. Built with responsive design and sleek animations for an optimal user experience.

## 🌟 Features

- 🎨 Modern dark theme with vibrant gradient styling
  - Consistent dark mode across all environments
  - Custom-designed message bubbles with gradient effects
  - Smooth transitions and hover animations
- 💬 Enhanced Chat Experience
  - Distinct visual styling for user and assistant messages
  - Clear role labels for better conversation flow
  - Support for multiple AI providers
  - Real-time response handling
- 🏷️ User Interface
  - Intuitive message input system
  - Clean and organized conversation layout
  - Visual feedback for system status
  - Code block support with syntax highlighting
- 📱 Responsive Design
  - Optimized for both desktop and mobile devices
  - Adaptive layout for different screen sizes
  - Touch-friendly interface elements

## 🛠️ Tech Stack

- HTML5
- CSS3 (Modern features):
  - CSS Variables
  - Flexbox
  - Gradients
  - Transitions
- Bootstrap 5.3.3
- Bootstrap Icons

## 📂 Project Structure

```
├── index.html    # Main HTML interface with Bootstrap integration
├── style.css     # Custom dark theme and responsive styling
├── agent.js      # Chat logic and API integrations
```

## 🚀 Quick Start

### Running Locally

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <project-folder>
   ```

2. Start a local server (multiple options):
   
   Using Python:
   ```bash
   python -m http.server 8000
   ```
   
   Using Node.js:
   ```bash
   npx http-server
   ```
   
   Or use any static file server of your choice.

3. Open your browser and visit:
   ```
   http://localhost:8000
   ```

### Vercel Deployment

The project includes a pre-configured `vercel.json` for optimal static deployment:
```json
{
  "version": 2,
  "builds": [
    { "src": "index.html", "use": "@vercel/static" },
    { "src": "style.css", "use": "@vercel/static" },
    { "src": "agent.js", "use": "@vercel/static" }
  ]
}
```

### Deployment

The project is configured for Vercel deployment with the following features:
- Automatic static file serving
- Proper routing configuration
- Asset optimization

## 💅 Styling Features

### Dark Theme
- Rich dark background with subtle gradients
- High contrast text for readability
- Vibrant accent colors for interactive elements

### Chat Messages
- User messages: Purple/pink gradient theme
- Assistant messages: Cyan/blue gradient theme
- Hover animations for enhanced interactivity
- Clear role labels above messages

## 🎨 Theme Customization

### Core Theme Variables
```css
:root {
  --radius: 16px;
  --bubble-shadow: 0 6px 18px rgba(0, 0, 0, .25);
  --bg-dark: #1a1b26;
  --bg-darker: #16171f;
}
```

### Key Style Features
- **Message Bubbles**
  - User: Purple/pink gradient with right alignment
  - Assistant: Cyan/blue gradient with left alignment
  - Hover animations for better interactivity
  - Clear role labels with custom styling

- **Dark Theme Elements**
  - Rich dark backgrounds with subtle gradients
  - High-contrast text for optimal readability
  - Custom-styled input fields and controls
  - Consistent dark theme across all components

- **Responsive Components**
  - Adaptive message bubble sizing
  - Flexible layout system
  - Mobile-optimized spacing
  - Touch-friendly interaction areas

## 📱 Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers with CSS Grid support
- Progressive enhancement for older browsers

## 🔐 Security Notes

- Static deployment with no server-side processing
- Client-side API key handling
- CORS-ready configuration
- Secure asset delivery through Vercel

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

