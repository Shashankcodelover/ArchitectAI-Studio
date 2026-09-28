import React from 'react';
import { Zap, ArrowRight, Bot } from 'lucide-react';

export default function LandingPage({ onDemo }) {
  return (
    <div style={{
      minHeight: '100vh', 
      backgroundColor: '#ffffff', 
      color: '#333333', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '0 20px'
    }}>
      <div style={{ maxWidth: '800px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '50%' }}>
            <Zap size={48} color="#6366f1" />
          </div>
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '16px', letterSpacing: '-0.05em' }}>
          ArchitectAI Studio
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '40px', lineHeight: '1.6' }}>
          The ultimate autonomous system design platform powered by LangGraph and Gemini.
          ArchitectAI acts as your AI pair-architect, writing code, generating architecture blueprints, and running simulated environments directly in your browser.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button 
            style={{
              padding: '16px 32px',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)'
            }}
            onClick={() => alert('Authentication not yet configured for Join')}
          >
            Sign Up <ArrowRight size={18} />
          </button>
          <button 
            onClick={onDemo}
            style={{
              padding: '16px 32px',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: '#ffffff',
              color: '#333',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
          >
            <Bot size={18} /> Demo
          </button>
        </div>
      </div>
    </div>
  );
}
