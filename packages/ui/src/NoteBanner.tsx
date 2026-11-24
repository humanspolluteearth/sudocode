// A dismissible note under the file tab strip (the design's `note`): one line of plain words, a soft red
// background when it is about an error, and a Dismiss link. No feature sets one yet; the room is kept so a later
// one (for example "this file was converted") can show a message without changing the layout.
export interface Note {
  text: string;
  /** True for a note about an error: the background is the soft red instead of the subtle grey. */
  error?: boolean;
}

export function NoteBanner({ note, onDismiss }: { note: Note; onDismiss: () => void }) {
  return (
    <div role="status" className={note.error === true ? "sc-note sc-note-err" : "sc-note"}>
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" className="sc-note-icon">
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 6v4.2M7 3.6v1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <span className="sc-note-text">{note.text}</span>
      <button type="button" className="sc-note-dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
