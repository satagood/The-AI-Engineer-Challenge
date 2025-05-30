# AI Engineer Challenge - Premium Frontend

A premium high-end chat interface built with Next.js, featuring the "Midnight Sunset" theme with neon accents and glass morphism effects.

## Features

- 🎨 **Premium Design**: Glass morphism effects, neon gradients, and smooth animations
- 🌙 **Midnight Sunset Theme**: Dark background with coral (#ff6f61) and teal (#00d1b2) accents
- 🤖 **AI Chat Interface**: Real-time streaming chat with OpenAI models
- ⚙️ **Configurable Settings**: API key management, model selection, and system prompts
- 📱 **Responsive Design**: Works beautifully on desktop and mobile
- 🎭 **Smooth Animations**: Framer Motion powered transitions and micro-interactions

## Prerequisites

- Node.js 18+ installed
- OpenAI API key
- Backend API running on port 8000 (see `/api` directory)

## Installation & Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Configure Settings**: Click the settings icon in the top-right corner
2. **Add API Key**: Enter your OpenAI API key (starts with `sk-`)
3. **Select Model**: Choose from available OpenAI models
4. **Customize System Message**: Set the AI's behavior and personality
5. **Start Chatting**: Type your message and press Send or Enter

## Backend Integration

This frontend integrates with the FastAPI backend located in the `/api` directory. Make sure the backend is running on port 8000:

```bash
cd ../api
python app.py
```

## Build for Production

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Run: `vercel`
3. Follow the prompts to deploy

## Theme Customization

The theme follows the "Midnight Sunset" specification:
- **Background**: Deep black (#0f0f0f)
- **Primary**: Coral (#ff6f61) 
- **Accent**: Teal (#00d1b2)
- **Text**: White (#ffffff)
- **Fonts**: Inter for UI, Fira Code for code blocks

## Technologies Used

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Smooth animations
- **Lucide React**: Beautiful icons
- **Glass Morphism**: Modern UI effects