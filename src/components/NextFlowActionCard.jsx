import { useState } from 'react'
import './NextFlowActionCard.css'

const SPECIFIC_ACTIONS = [
  { value: 'flowchart', label: 'Technical Flowchart' },
  { value: 'quotation', label: 'Send Quotation to Client' },
]

export default function NextFlowActionCard({ onOpenQuestionnaire, onOpenFlowchart, onOpenQuotation }) {
  const [path, setPath] = useState('')
  const [specificAction, setSpecificAction] = useState('')

  function handlePathChange(value) {
    setPath(value)
    setSpecificAction('')
  }

  function handleContinue() {
    if (!path) {
      alert('Please select a path')
      return
    }

    if (path === 'questionnaire') {
      onOpenQuestionnaire()
      return
    }

    if (path === 'technical') {
      if (!specificAction) {
        alert('Please select a specific action')
        return
      }
      if (specificAction === 'flowchart') onOpenFlowchart()
      if (specificAction === 'quotation') onOpenQuotation()
    }
  }

  return (
    <div className="nfa-card">
      <div className="nfa-title">
        <i className="fas fa-code-branch"></i> Select Next Flow Action
      </div>

      <div className="nfa-row">
        <div className="nfa-field">
          <label>Choose Path</label>
          <select value={path} onChange={e => handlePathChange(e.target.value)}>
            <option value="">-- Select Path --</option>
            <option value="questionnaire">Send Questionnaire to Client</option>
            <option value="technical">Technical Flowchart or Quotation</option>
          </select>
        </div>

        {path === 'technical' && (
          <div className="nfa-field">
            <label>Specific Action</label>
            <select value={specificAction} onChange={e => setSpecificAction(e.target.value)}>
              <option value="">-- Select Action --</option>
              <option value="flowchart">Technical Flowchart</option>
              <option value="quotation">Send Quotation to Client</option>
            </select>
          </div>
        )}

        <button className="nfa-continue-btn" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  )
}