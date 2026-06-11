import { useState } from 'react'
import Home from './pages/Home'
import Chat from './pages/Chat'
import Reminders from './pages/Reminders'
import TokenFlow from './pages/TokenFlow'
import Memories from './pages/Memories'
import Diary from './pages/Diary'
import Snippets from './pages/Snippets'
import Letters from './pages/Letters'
import Persona from './pages/Persona'
import './App.css'

export type Page = 'home' | 'chat' | 'memories' | 'diary' | 'reminders' | 'tokenflow' | 'snippets' | 'letters' | 'persona'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  return (
    <div className="app">
      {page === 'home'      && <Home      onNavigate={setPage} />}
      {page === 'chat'      && <Chat      onNavigate={setPage} />}
      {page === 'memories'  && <Memories  onNavigate={setPage} />}
      {page === 'diary'     && <Diary     onNavigate={setPage} />}
      {page === 'reminders' && <Reminders onNavigate={setPage} />}
      {page === 'tokenflow' && <TokenFlow onNavigate={setPage} />}
      {page === 'snippets'  && <Snippets  onNavigate={setPage} />}
      {page === 'letters'   && <Letters   onNavigate={setPage} />}
      {page === 'persona'   && <Persona   onNavigate={setPage} />}
    </div>
  )
}
