import { useEffect, useRef, useState } from 'react';
import { searchLeads } from '../lib/followupsApi';
import './ContactSearchSelect.css';

/**
 * Searchable "Contact" input used inside the Schedule Follow-up modal.
 * Props:
 *  - value: { leadId, leadName }
 *  - onChange: ({ leadId, leadName }) => void
 *  - locked: boolean (true when a lead is passed in from a lead card — read-only)
 */
export default function ContactSearchSelect({ value, onChange, locked }) {
  const [query, setQuery] = useState(value?.leadName || '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const boxRef = useRef(null);

  useEffect(() => setQuery(value?.leadName || ''), [value?.leadName]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function runSearch(q) {
    const res = await searchLeads(q);
    if (res.success) setResults(res.data);
  }

  return (
    <div ref={boxRef} className="css-wrap">
      <input
        type="text"
        readOnly={locked}
        value={query}
        placeholder="Type to search contact..."
        onFocus={() => {
          if (!locked) {
            setOpen(true);
            runSearch(query);
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          runSearch(e.target.value);
        }}
        className="css-input"
      />
      {open && !locked && (
        <div className="css-dropdown">
          {results.length === 0 && (
            <div className="css-empty">No matches found</div>
          )}
          {results.map((c) => (
            <div
              key={c.lead_id}
              onClick={() => {
                onChange({ leadId: c.lead_id, leadName: c.name });
                setQuery(c.name);
                setOpen(false);
              }}
              className="css-option"
            >
              <div className="css-option-name">{c.name}</div>
              <div className="css-option-meta">
                {c.phone} {c.company ? `· ${c.company}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
