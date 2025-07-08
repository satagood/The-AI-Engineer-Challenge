'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Key, Settings, Sparkles, MessageCircle } from 'lucide-react'
import MarkdownRenderer from './components/MarkdownRenderer'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

// Helper to check if a message is a PDF chat response
function isPDFChatResponse(content: string) {
  try {
    const parsed = JSON.parse(content)
    return parsed && typeof parsed.response === 'string' && parsed.context && (Array.isArray(parsed.context.pdf) || Array.isArray(parsed.context.md))
  } catch {
    return false
  }
}

// Elegant context toggle component
function ContextToggle({ context }: { context: { pdf?: string[]; md?: string[] } }) {
  const [show, setShow] = useState(false);
  return (
    <div className="my-4">
      <button
        className={`px-3 py-1 rounded transition-colors duration-200 font-medium shadow-sm border border-primary text-primary bg-background hover:bg-primary hover:text-background focus:outline-none focus:ring-2 focus:ring-primary/50`}
        onClick={() => setShow((prev) => !prev)}
        aria-expanded={show}
        aria-controls="context-section"
      >
        {show ? 'Hide context' : 'Show context used for this answer'}
      </button>
      <div
        id="context-section"
        className={`overflow-hidden transition-all duration-300 ease-in-out ${show ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'} bg-gray-900 rounded text-sm text-gray-200 border border-gray-700`}
        style={{ padding: show ? '1rem' : '0', maxHeight: show ? '24rem' : '0', overflowY: show ? 'auto' : 'hidden' }}
      >
        {show && (
          <>
            {context.pdf && context.pdf.length > 0 && (
              <>
                <h4 className="font-bold mb-1">PDF Context</h4>
                <pre className="whitespace-pre-wrap font-mono text-xs">{context.pdf.join('\n\n')}</pre>
              </>
            )}
            {context.md && context.md.length > 0 && (
              <>
                <h4 className="font-bold mt-2 mb-1">Markdown Context</h4>
                <pre className="whitespace-pre-wrap font-mono text-xs">{context.md.join('\n\n')}</pre>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Indeterminate progress bar component
function IndeterminateProgressBar() {
  return (
    <div className="w-full h-2 bg-gray-800 rounded overflow-hidden mt-2">
      <div className="h-full bg-primary animate-indeterminate" style={{ minWidth: '30%' }}></div>
      <style jsx>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-indeterminate {
          animation: indeterminate 1.2s infinite linear;
          width: 40%;
        }
      `}</style>
    </div>
  );
}

// Hybrid progress bar component
function HybridProgressBar({ progress, label }: { progress: number | null, label: string }) {
  if (progress === null) {
    // Indeterminate bar (embedding phase)
    return (
      <div className="w-full mt-2">
        <div className="text-xs text-gray-400 mb-1">{label}</div>
        <div className="w-full h-2 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-primary animate-indeterminate" style={{ minWidth: '30%' }}></div>
        </div>
        <style jsx>{`
          @keyframes indeterminate {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-indeterminate {
            animation: indeterminate 1.2s infinite linear;
            width: 40%;
          }
        `}</style>
      </div>
    );
  }
  // Determinate bar (chunking phase)
  return (
    <div className="w-full mt-2">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="w-full h-2 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
        ></div>
      </div>
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [userMessage, setUserMessage] = useState('')
  // 1. Update default system prompt
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful assistant. Use the “Knowledge (from PDF)” as your knowledge base, and “Idea (from Markdown)” as the idea to critique. Critique the idea using the knowledge, and provide actionable, thoughtful feedback.')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4.1-mini')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'indexing' | 'indexed' | 'error'>("idle")
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfFileId, setPdfFileId] = useState<string | null>(null)
  const [mdFileId, setMdFileId] = useState<string | null>(null)
  const [mdStatus, setMdStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'indexing' | 'indexed' | 'error'>('idle')
  // Add state for chunking progress
  const [chunkProgress, setChunkProgress] = useState<{ current: number, total: number } | null>(null)
  // Add state for context visibility
  const [showContext, setShowContext] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // PDF upload handler
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfStatus('uploading')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.ext !== '.pdf') throw new Error('Not a PDF')
      setPdfFileId(data.file_id)
      setPdfStatus('uploaded')
      // Index
      setPdfStatus('indexing')
      const indexRes = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: data.file_id, file_path: data.file_path, api_key: apiKey })
      })
      if (!indexRes.ok) throw new Error('Indexing failed')
      setPdfStatus('indexed')
    } catch (err) {
      setPdfStatus('error')
    }
  }
  // Markdown upload handler
  const handleMdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMdStatus('uploading')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.ext !== '.md') throw new Error('Not a Markdown file')
      setMdFileId(data.file_id)
      setMdStatus('uploaded')
      // Index
      setMdStatus('indexing')
      const indexRes = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: data.file_id, file_path: data.file_path, api_key: apiKey })
      })
      if (!indexRes.ok) throw new Error('Indexing failed')
      setMdStatus('indexed')
    } catch (err) {
      setMdStatus('error')
    }
  }

  // Simulate chunking progress for demo (since backend is synchronous)
  const simulateChunking = async (totalChunks: number) => {
    setChunkProgress({ current: 0, total: totalChunks })
    for (let i = 1; i <= totalChunks; i++) {
      setChunkProgress({ current: i, total: totalChunks })
      await new Promise(res => setTimeout(res, 20)) // fast animation
    }
    setChunkProgress(null)
  }

  // In handleSubmit, use /api/chat_dual_rag if both files are indexed
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userMessage.trim() || !apiKey.trim()) return
    if (pdfStatus !== 'indexed' || mdStatus !== 'indexed' || !pdfFileId || !mdFileId) return
    setIsLoading(true)
    setUserMessage('')
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newUserMessage])
    try {
      const response = await fetch('/api/chat_dual_rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_file_id: pdfFileId,
          md_file_id: mdFileId,
          user_query: userMessage,
          api_key: apiKey,
          developer_message: developerMessage
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        )
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your API key and try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* PDF Upload UI */}
      <div className="max-w-6xl mx-auto p-4">
        <form onSubmit={handlePdfUpload} className="flex items-center space-x-4">
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
            className="p-2 rounded bg-gray-800 border border-gray-600 text-white"
            disabled={pdfStatus === 'uploading' || pdfStatus === 'indexing'}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded disabled:opacity-50"
            disabled={!pdfFile || pdfStatus === 'uploading' || pdfStatus === 'indexing'}
          >
            {pdfStatus === 'uploading' ? 'Uploading...' : pdfStatus === 'indexing' ? 'Indexing...' : 'Upload & Index PDF'}
          </button>
          {pdfStatus === 'indexed' && <span className="text-green-400 ml-2">PDF Ready!</span>}
          {pdfStatus === 'error' && <span className="text-red-400 ml-2">{pdfError}</span>}
        </form>
        {pdfStatus === 'indexing' && (
          chunkProgress
            ? <HybridProgressBar progress={chunkProgress.current / chunkProgress.total} label={`Chunking PDF: ${chunkProgress.current} / ${chunkProgress.total}`} />
            : <HybridProgressBar progress={null} label="Embedding chunks..." />
        )}
      </div>
      {/* Markdown Upload UI: match PDF upload UI, but no <form> wrapper */}
      <div className="max-w-6xl mx-auto p-4 flex items-center space-x-4">
        <input
          type="file"
          accept=".md"
          onChange={handleMdUpload}
          className="p-2 rounded bg-gray-800 border border-gray-600 text-white"
          disabled={mdStatus === 'uploading' || mdStatus === 'indexing'}
        />
        <button
          type="button"
          className="px-4 py-2 bg-primary text-white rounded disabled:opacity-50"
          disabled={mdStatus === 'uploading' || mdStatus === 'indexing'}
          onClick={() => {}}
        >
          {mdStatus === 'uploading' ? 'Uploading...' : mdStatus === 'indexing' ? 'Indexing...' : 'Upload & Index Markdown'}
        </button>
        {mdStatus === 'indexed' && <span className="text-green-400 ml-2">Markdown Ready!</span>}
        {mdStatus === 'error' && <span className="text-red-400 ml-2">Error</span>}
      </div>
      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-effect border-b border-gray-700 p-4"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              <div className="absolute inset-0 w-8 h-8 text-accent animate-ping opacity-20">
                <Sparkles className="w-full h-full" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold neon-text text-primary">AI Engineer Challenge</h1>
              <p className="text-sm text-gray-400">Premium Chat Interface</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg glass-effect hover:bg-gray-700 transition-all duration-200 hover:animate-glow"
          >
            <Settings className="w-5 h-5 text-accent" />
          </button>
        </div>
      </motion.header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="glass-effect border-b border-gray-700 overflow-hidden"
          >
            <div className="max-w-6xl mx-auto p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Key className="w-4 h-4 inline mr-2" />
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
                  >
                    <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">System Message</label>
                <textarea
                  value={developerMessage}
                  onChange={(e) => setDeveloperMessage(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 resize-none"
                  placeholder="Enter system instructions for the AI..."
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-8"
              >
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full glass-effect mb-4 animate-float">
                    <MessageCircle className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">Welcome to AI Engineer Challenge</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Start a conversation with our premium AI assistant. Configure your settings above and begin chatting!
                  </p>
                </div>
              </motion.div>
            ) : (
              messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-start space-x-3 ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-gradient-to-br from-primary to-orange-500' 
                      : 'bg-gradient-to-br from-accent to-blue-500'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className={`flex-1 max-w-3xl ${
                    message.role === 'user' ? 'text-right' : ''
                  }`}>
                    <div className={`inline-block p-4 rounded-2xl glass-effect ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-br from-primary/20 to-orange-500/20 border-primary/30' 
                        : 'bg-gradient-to-br from-accent/20 to-blue-500/20 border-accent/30'
                    }`}>
                      {/* PDF chat response formatting */}
                      {message.role === 'assistant' && isPDFChatResponse(message.content) ? (
                        (() => {
                          const parsed = JSON.parse(message.content)
                          return (
                            <div>
                              <MarkdownRenderer content={parsed.response} className="text-sm mb-4" />
                              <ContextToggle context={parsed.context} />
                            </div>
                          )
                        })()
                      ) : (
                        <MarkdownRenderer 
                          content={message.content}
                          className="text-sm"
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start space-x-3"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 max-w-3xl">
                  <div className="inline-block p-4 rounded-2xl glass-effect bg-gradient-to-br from-accent/20 to-blue-500/20 border-accent/30">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="p-4 border-t border-gray-700">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isLoading || (pdfStatus !== 'indexed' || mdStatus !== 'indexed' || !pdfFileId || !mdFileId)}
                  className="w-full p-4 rounded-xl bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 disabled:opacity-50"
                />
              </div>
              <motion.button
                type="submit"
                disabled={isLoading || !userMessage.trim() || !apiKey.trim() || (pdfStatus !== 'indexed' || mdStatus !== 'indexed' || !pdfFileId || !mdFileId)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-4 bg-gradient-to-r from-primary to-orange-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25 transition-all duration-200 flex items-center space-x-2"
              >
                <Send className="w-5 h-5" />
                <span>Send</span>
              </motion.button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
} 