import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/shared/Navbar'

const Home = () => {
  const { isAuthenticated } = useSelector((state) => state.user)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])
  return (
    <div>
      <Navbar />
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4">
        <div className="max-w-5xl mx-auto text-center space-y-8 pt-32">
          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground">
            AI-Powered Call Support That{' '}
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Remembers Every Conversation
            </span>
          </h1>
          
          {/* Sub-headline */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Automatically capture call context, recall previous conversations, and generate accurate AI summaries for faster and smarter customer support.
          </p>
          
          {/* CTA Button */}
          <div className="pt-4">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 rounded-full"
              onClick={() => navigate('/call')}
            >
              Call an agent
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home